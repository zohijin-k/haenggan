"use client";

import { useEffect, useRef, useState } from "react";
import type { Highlight } from "@/lib/types";
import { loadPdfjs } from "@/lib/pdfjs";

type SelectionRect = { x: number; y: number; width: number; height: number };

type SelectionInfo = {
  cfiRange: string;
  text: string;
  chapterHref: string | null;
  rect: SelectionRect | null;
};

type ReaderApi = {
  compareCfi: (a: string, b: string) => number;
  goToCfi: (cfi: string) => void;
};

type Props = {
  pdfUrl: string;
  visibleHighlights: Highlight[];
  startCfi?: string | null;
  onReady?: (api: ReaderApi) => void;
  onSelection?: (info: SelectionInfo) => void;
  onLocationChange?: (cfi: string, percentage: number, chapterHref: string) => void;
  onHighlightClick?: (highlightId: string) => void;
};

// PDF는 epub.js 같은 CFI 개념이 없어서, 자체 위치 표기법을 하나 만들어 쓴다:
// "pdf:{페이지}:{시작항목idx}:{시작offset}:{끝항목idx}:{끝offset}"
// 항목 idx는 그 페이지의 getTextContent().items 순서(=텍스트 레이어의 span 순서)를
// 그대로 가리켜서, 다시 렌더링해도(같은 파일이면) 항상 같은 것을 가리킨다.
function makeCfi(page: number, startItem: number, startOffset: number, endItem: number, endOffset: number) {
  return `pdf:${page}:${startItem}:${startOffset}:${endItem}:${endOffset}`;
}

function parseCfi(cfi: string) {
  const m = /^pdf:(\d+):(\d+):(\d+):(\d+):(\d+)$/.exec(cfi);
  if (!m) return null;
  return {
    page: Number(m[1]),
    startItem: Number(m[2]),
    startOffset: Number(m[3]),
    endItem: Number(m[4]),
    endOffset: Number(m[5]),
  };
}

// "발견" 여부는 페이지 단위로 비교한다 (같은 페이지 안에서는 항목 순서로 tie-break).
function comparePdfCfi(a: string, b: string) {
  const pa = parseCfi(a);
  const pb = parseCfi(b);
  if (!pa || !pb) return 0;
  if (pa.page !== pb.page) return pa.page - pb.page;
  if (pa.startItem !== pb.startItem) return pa.startItem - pb.startItem;
  return pa.startOffset - pb.startOffset;
}

function resolveItemOffset(node: Node | null, domOffset: number): { itemIndex: number; offset: number } | null {
  let el: HTMLElement | null =
    node && node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement | null);
  while (el && el.dataset?.itemIndex === undefined) el = el.parentElement;
  if (!el || el.dataset.itemIndex === undefined) return null;
  return { itemIndex: Number(el.dataset.itemIndex), offset: domOffset };
}

export default function PdfReader({
  pdfUrl,
  visibleHighlights,
  startCfi,
  onReady,
  onSelection,
  onLocationChange,
  onHighlightClick,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pageWrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);

  const pdfDocRef = useRef<any>(null);
  const textDivsRef = useRef<HTMLElement[]>([]);
  const currentPageRef = useRef(1);
  const visibleHighlightsRef = useRef<Highlight[]>(visibleHighlights);
  const renderTokenRef = useRef(0);
  const lastViewportRef = useRef({ width: 0, height: 0 });

  const onSelectionRef = useRef(onSelection);
  const onHighlightClickRef = useRef(onHighlightClick);
  const onLocationChangeRef = useRef(onLocationChange);
  onSelectionRef.current = onSelection;
  onHighlightClickRef.current = onHighlightClick;
  onLocationChangeRef.current = onLocationChange;

  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  function applyHighlightsToPage(pageNum: number) {
    const divs = textDivsRef.current;
    if (!divs.length) return;
    divs.forEach((d) => {
      d.classList.remove("pdf-highlight-span");
      d.style.textDecorationColor = "";
      d.onclick = null;
    });
    for (const h of visibleHighlightsRef.current) {
      const parsed = parseCfi(h.cfi_range);
      if (!parsed || parsed.page !== pageNum) continue;
      for (let i = parsed.startItem; i <= parsed.endItem && i < divs.length; i++) {
        const div = divs[i];
        if (!div) continue;
        div.classList.add("pdf-highlight-span");
        div.style.textDecorationColor = h.color;
        div.onclick = () => onHighlightClickRef.current?.(h.id);
      }
    }
  }

  async function renderPage(pageNum: number) {
    const pdfDoc = pdfDocRef.current;
    const canvas = canvasRef.current;
    const textLayerEl = textLayerRef.current;
    const outer = viewportRef.current;
    if (!pdfDoc || !canvas || !textLayerEl || !outer) return;

    const token = ++renderTokenRef.current;
    const page = await pdfDoc.getPage(pageNum);
    if (token !== renderTokenRef.current) return;

    const containerWidth = Math.max(outer.clientWidth - 48, 280);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(containerWidth / baseViewport.width, 2);
    const viewport = page.getViewport({ scale });

    const outputScale = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

    await page.render({ canvasContext: ctx, viewport, transform }).promise;
    if (token !== renderTokenRef.current) return;

    textLayerEl.innerHTML = "";
    textLayerEl.style.width = `${viewport.width}px`;
    textLayerEl.style.height = `${viewport.height}px`;
    textLayerEl.style.setProperty("--scale-factor", String(scale));

    const textContent = await page.getTextContent();
    const pdfjsLib = await loadPdfjs();
    const textLayer = new pdfjsLib.TextLayer({
      textContentSource: textContent,
      container: textLayerEl,
      viewport,
    });
    await textLayer.render();
    if (token !== renderTokenRef.current) return;

    textLayer.textDivs.forEach((div: HTMLElement, i: number) => {
      div.dataset.itemIndex = String(i);
    });
    textDivsRef.current = textLayer.textDivs;

    lastViewportRef.current = { width: viewport.width, height: viewport.height };

    applyHighlightsToPage(pageNum);
  }

  // 1) PDF 로드
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const pdfjsLib = await loadPdfjs();
      const doc = await pdfjsLib.getDocument(pdfUrl).promise;
      if (cancelled) return;
      pdfDocRef.current = doc;
      setNumPages(doc.numPages);

      const parsedStart = startCfi ? parseCfi(startCfi) : null;
      const initialPage = Math.min(Math.max(parsedStart?.page ?? 1, 1), doc.numPages);
      setCurrentPage(initialPage);

      onReady?.({
        compareCfi: comparePdfCfi,
        goToCfi: (cfi: string) => {
          const parsed = parseCfi(cfi);
          if (parsed) setCurrentPage(Math.min(Math.max(parsed.page, 1), doc.numPages));
        },
      });
    }

    init();
    return () => {
      cancelled = true;
      try {
        pdfDocRef.current?.destroy?.();
      } catch {
        // ignore teardown errors
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfUrl]);

  // 2) 현재 페이지가 바뀔 때마다 다시 그림 + 진행률 보고
  useEffect(() => {
    if (!numPages) return;
    currentPageRef.current = currentPage;
    renderPage(currentPage);
    const percentage = numPages ? currentPage / numPages : 0;
    onLocationChangeRef.current?.(makeCfi(currentPage, 0, 0, 0, 0), percentage, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, numPages]);

  // 3) 창 크기가 바뀌면 현재 페이지를 다시 맞춰 그림.
  // 사이드바를 열고 닫을 때처럼 너비가 갑자기 바뀌면, 매번 캔버스를 처음부터
  // 다시 그리면(래스터라이즈 비용이 커서) 버벅여 보인다. 그래서 우선 기존
  // 캔버스를 CSS transform으로 즉시 늘이거나 줄여서 부드럽게 맞춰두고,
  // 크기 변화가 잠깐 멈추면 그때 한 번만 진짜 해상도로 다시 그린다.
  useEffect(() => {
    const outer = viewportRef.current;
    if (!outer || typeof ResizeObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new ResizeObserver(() => {
      const canvas = canvasRef.current;
      const last = lastViewportRef.current;
      if (canvas && last.width > 0) {
        const targetWidth = Math.max(outer.clientWidth - 48, 280);
        const ratio = targetWidth / last.width;
        canvas.style.width = `${targetWidth}px`;
        canvas.style.height = `${last.height * ratio}px`;
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => renderPage(currentPageRef.current), 220);
    });
    observer.observe(outer);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 4) "발견"된 하이라이트가 바뀌면 현재 페이지에 다시 입힘
  useEffect(() => {
    visibleHighlightsRef.current = visibleHighlights;
    applyHighlightsToPage(currentPageRef.current);
  }, [visibleHighlights]);

  // 5) 텍스트 선택 → 밑줄/메모 후보로 전달
  useEffect(() => {
    function handleMouseUp() {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
      const text = selection.toString();
      if (!text.trim()) return;
      const range = selection.getRangeAt(0);
      const start = resolveItemOffset(range.startContainer, range.startOffset);
      const end = resolveItemOffset(range.endContainer, range.endOffset);
      if (!start || !end) return;
      const cfi = makeCfi(currentPageRef.current, start.itemIndex, start.offset, end.itemIndex, end.offset);

      let rect: SelectionRect | null = null;
      try {
        const r = range.getBoundingClientRect();
        rect = { x: r.left + r.width / 2, y: r.top, width: r.width, height: r.height };
      } catch {
        rect = null;
      }

      onSelectionRef.current?.({ cfiRange: cfi, text, chapterHref: null, rect });
    }
    const el = textLayerRef.current;
    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, []);

  function goPrev() {
    setCurrentPage((p) => Math.max(1, p - 1));
  }
  function goNext() {
    setCurrentPage((p) => Math.min(numPages || p, p + 1));
  }

  return (
    <div ref={viewportRef} className="relative flex h-full w-full flex-col items-center overflow-auto bg-paper px-4 py-8">
      <div ref={pageWrapRef} className="relative shadow-note">
        <canvas ref={canvasRef} className="block rounded-sm transition-[width,height] duration-150 ease-out" />
        <div ref={textLayerRef} className="pdf-text-layer" />
      </div>

      {numPages > 0 && (
        <div className="sticky bottom-4 mt-6 flex items-center gap-4 rounded-full border border-ink/10 bg-white/80 px-4 py-2 shadow-note backdrop-blur">
          <button
            type="button"
            onClick={goPrev}
            disabled={currentPage <= 1}
            className="text-ink/50 hover:text-ink disabled:opacity-30"
            aria-label="이전 페이지"
          >
            ‹
          </button>
          <span className="text-xs tabular-nums text-ink/40">
            {currentPage} / {numPages}
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={currentPage >= numPages}
            className="text-ink/50 hover:text-ink disabled:opacity-30"
            aria-label="다음 페이지"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
