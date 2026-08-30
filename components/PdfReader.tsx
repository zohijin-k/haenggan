"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Highlight } from "@/lib/types";
import { withAlpha } from "@/lib/palette";
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
  myColor: string;
  startCfi?: string | null;
  onReady?: (api: ReaderApi) => void;
  onSelection?: (info: SelectionInfo) => void;
  onLocationChange?: (cfi: string, percentage: number, chapterHref: string) => void;
  // 겹치는 밑줄을 한꺼번에 클릭했을 수도 있어서, 클릭한 위치와 겹치는 모든
  // 하이라이트 id를 함께 넘긴다 (겹치지 않으면 배열 길이는 1).
  onHighlightClick?: (highlightIds: string[]) => void;
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

// "발견" 여부는 순수하게 페이지 단위로 비교한다.
// (같은 페이지 안에서 항목 순서로 tie-break를 하면, 내 진행 위치가 늘
//  "그 페이지 0번 항목"이라 같은 페이지에 있는 남의 밑줄이 전부 "아직 안 읽은 것"으로
//  잠겨버린다 — 그래서 페이지가 같으면 발견된 것으로 본다.)
function comparePdfCfi(a: string, b: string) {
  const pa = parseCfi(a);
  const pb = parseCfi(b);
  if (!pa || !pb) return 0;
  return pa.page - pb.page;
}

// 겹치는(같은 span을 공유하는) 하이라이트들을 서로 다른 "lane"에 배치한다.
// 반환: 입력 순서에 대응하는 lane 번호 배열. lane 0이 글자에 가장 가깝고,
// 겹치는 다른 사람 밑줄일수록 아래로 한 칸씩 내려간다.
function assignLanes(ranges: { startItem: number; endItem: number }[]): number[] {
  const order = ranges.map((_, i) => i).sort((a, b) => ranges[a].startItem - ranges[b].startItem);
  const lanes = new Array(ranges.length).fill(0);
  const laneEnd: number[] = []; // laneEnd[l] = 그 lane을 마지막으로 차지한 구간의 endItem
  for (const idx of order) {
    const r = ranges[idx];
    let lane = 0;
    while (lane < laneEnd.length && laneEnd[lane] >= r.startItem) lane++;
    lanes[idx] = lane;
    laneEnd[lane] = r.endItem;
  }
  return lanes;
}

// 항목(item) 인덱스 구간이 서로 이어져 겹치는 하이라이트들을 하나의 그룹으로 묶는다.
// (transitively 겹치면 같은 그룹 — A-B가 겹치고 B-C가 겹치면 A/B/C 전부 한 그룹)
// 클릭 시 이 그룹 전체의 id를 넘겨서, 겹쳐 있는 메모를 한 번에 보여줄 수 있게 한다.
function groupOverlapping(items: { id: string; startItem: number; endItem: number }[]): Record<string, string[]> {
  const sorted = [...items].sort((a, b) => a.startItem - b.startItem);
  const groups: string[][] = [];
  let current: typeof sorted = [];
  let currentEnd = -Infinity;
  for (const it of sorted) {
    if (current.length && it.startItem <= currentEnd) {
      current.push(it);
      currentEnd = Math.max(currentEnd, it.endItem);
    } else {
      if (current.length) groups.push(current.map((c) => c.id));
      current = [it];
      currentEnd = it.endItem;
    }
  }
  if (current.length) groups.push(current.map((c) => c.id));

  const map: Record<string, string[]> = {};
  for (const g of groups) {
    for (const id of g) map[id] = g;
  }
  return map;
}

// span(텍스트 레이어의 한 항목) 안에서 실제 텍스트가 들어있는 Text 노드를 찾는다.
// 보통은 span의 첫 자식이 바로 텍스트지만, pdf.js 버전에 따라 한 단계 더
// 감쌀 수 있어서 방어적으로 한 단계 더 훑는다.
function findTextNode(el: Node): Text | null {
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) return node as Text;
  }
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const found = findTextNode(node);
      if (found) return found;
    }
  }
  return null;
}

// 항목 하나 안에서 [start, end) 문자 오프셋에 해당하는 실제 화면 좌표(rect)를 구한다.
// 예전엔 항목(줄 전체일 수도 있는) span 하나를 통째로 밑줄 쳐서, "From Zero to
// Detail"만 선택해도 그 줄 전체가 밑줄로 보이는 문제가 있었다 — Range로 정확한
// 글자 범위의 rect를 구해 그 너비만큼만 밑줄을 그리도록 고쳤다.
function getRectsForItem(div: HTMLElement, start: number, end: number): DOMRect[] {
  const textNode = findTextNode(div);
  if (!textNode) return [div.getBoundingClientRect()];
  const len = textNode.textContent?.length ?? 0;
  const s = Math.max(0, Math.min(start, len));
  const e = Math.max(s, Math.min(end, len));
  if (s === e) return [div.getBoundingClientRect()];
  try {
    const range = document.createRange();
    range.setStart(textNode, s);
    range.setEnd(textNode, e);
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 || r.height > 0);
    return rects.length ? rects : [div.getBoundingClientRect()];
  } catch {
    return [div.getBoundingClientRect()];
  }
}

function getRectsForHighlight(
  divs: HTMLElement[],
  parsed: NonNullable<ReturnType<typeof parseCfi>>
): DOMRect[] {
  const rects: DOMRect[] = [];
  for (let idx = parsed.startItem; idx <= parsed.endItem && idx < divs.length; idx++) {
    const div = divs[idx];
    if (!div) continue;
    const start = idx === parsed.startItem ? parsed.startOffset : 0;
    const end = idx === parsed.endItem ? parsed.endOffset : div.textContent?.length ?? 0;
    rects.push(...getRectsForItem(div, start, end));
  }
  return rects;
}

export default function PdfReader({
  pdfUrl,
  visibleHighlights,
  myColor,
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
  const renderTaskRef = useRef<any>(null);
  const textLayerInstanceRef = useRef<any>(null);
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
    const layer = textLayerRef.current;
    if (!divs.length || !layer) return;

    // 이전에 깔아둔 밑줄 막대를 걷어낸다. (텍스트 레이어 span 자체는 건드리지 않음 —
    // 밑줄은 이제 span의 자식이 아니라 레이어에 직접 절대좌표로 얹기 때문.)
    layer.querySelectorAll(".pdf-underline").forEach((el) => el.remove());

    const onPage = visibleHighlightsRef.current
      .map((h) => ({ h, parsed: parseCfi(h.cfi_range) }))
      .filter((x): x is { h: Highlight; parsed: NonNullable<ReturnType<typeof parseCfi>> } =>
        !!x.parsed && x.parsed.page === pageNum
      );
    if (!onPage.length) return;

    const lanes = assignLanes(onPage.map((x) => x.parsed));
    const groupMap = groupOverlapping(
      onPage.map(({ h, parsed }) => ({ id: h.id, startItem: parsed.startItem, endItem: parsed.endItem }))
    );
    const layerRect = layer.getBoundingClientRect();

    onPage.forEach(({ h, parsed }, i) => {
      const lane = lanes[i];
      const groupIds = groupMap[h.id] ?? [h.id];
      const rects = getRectsForHighlight(divs, parsed);

      rects.forEach((rect) => {
        const bar = document.createElement("div");
        bar.className = "pdf-underline";
        bar.style.left = `${rect.left - layerRect.left}px`;
        bar.style.width = `${rect.width}px`;
        bar.style.top = `${rect.top - layerRect.top + rect.height - 2 - lane * 3}px`;
        bar.style.background = h.color;
        bar.onclick = (e) => {
          e.stopPropagation();
          onHighlightClickRef.current?.(groupIds);
        };
        layer.appendChild(bar);
      });
    });
  }

  async function renderPage(pageNum: number) {
    const pdfDoc = pdfDocRef.current;
    const canvas = canvasRef.current;
    const textLayerEl = textLayerRef.current;
    const outer = viewportRef.current;
    if (!pdfDoc || !canvas || !textLayerEl || !outer) return;

    const token = ++renderTokenRef.current;

    // 진행 중이던 렌더를 먼저 취소한다. 안 그러면 같은 canvas에 두 번 render()가
    // 겹쳐 pdf.js가 "Cannot use the same canvas during multiple render() operations"
    // 예외를 던지고, 그 뒤 텍스트 레이어 생성이 통째로 건너뛰어져서 → 드래그해도
    // 선택할 span이 없고 → 배너가 안 뜬다. (dev의 StrictMode 이펙트 2회 실행 등)
    try {
      renderTaskRef.current?.cancel?.();
    } catch {
      // ignore
    }
    renderTaskRef.current = null;
    try {
      textLayerInstanceRef.current?.cancel?.();
    } catch {
      // ignore
    }
    textLayerInstanceRef.current = null;

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

    const renderTask = page.render({ canvasContext: ctx, viewport, transform });
    renderTaskRef.current = renderTask;
    try {
      await renderTask.promise;
    } catch {
      // 취소됐거나(다음 렌더가 시작됨) 렌더 에러 — 어느 쪽이든 여기서 조용히 끝낸다.
      return;
    }
    if (token !== renderTokenRef.current) return;
    renderTaskRef.current = null;

    textLayerEl.innerHTML = "";
    textLayerEl.style.width = `${viewport.width}px`;
    textLayerEl.style.height = `${viewport.height}px`;
    textLayerEl.style.setProperty("--scale-factor", String(scale));

    const textContent = await page.getTextContent();
    if (token !== renderTokenRef.current) return;
    const pdfjsLib = await loadPdfjs();
    const textLayer = new pdfjsLib.TextLayer({
      textContentSource: textContent,
      container: textLayerEl,
      viewport,
    });
    textLayerInstanceRef.current = textLayer;
    try {
      await textLayer.render();
    } catch {
      return;
    }
    if (token !== renderTokenRef.current) return;
    textLayerInstanceRef.current = null;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleHighlights]);

  // 5) 텍스트 선택 → 밑줄/메모 후보로 전달.
  // 선택의 시작/끝이 정확히 span 경계에 걸리면 range.startContainer가 텍스트
  // 레이어 컨테이너 자체가 되어버려 예전 방식(부모를 타고 올라가며 data-item-index
  // 찾기)은 그 선택을 통째로 놓쳤다. 그래서 span 목록을 직접 훑어
  // "선택에 포함된 span"의 첫/끝 인덱스를 구하는 방식으로 바꿨다.
  useEffect(() => {
    function handleMouseUp() {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
      const text = selection.toString();
      if (!text.trim()) return;

      const range = selection.getRangeAt(0);
      const divs = textDivsRef.current;
      let startItem = -1;
      let endItem = -1;
      for (let i = 0; i < divs.length; i++) {
        if (selection.containsNode(divs[i], true)) {
          if (startItem === -1) startItem = i;
          endItem = i;
        }
      }
      // 이 페이지의 텍스트 레이어 밖(사이드바 등)에서 일어난 선택이면 무시.
      if (startItem === -1) return;

      // offset은 선택 경계가 그 span의 텍스트 노드 안에 있을 때만 의미가 있다
      // (경계가 span 자체나 컨테이너면 span 통째로 잡은 것으로 본다).
      const startText = range.startContainer.nodeType === Node.TEXT_NODE;
      const endText = range.endContainer.nodeType === Node.TEXT_NODE;
      const startOffset =
        startText && divs[startItem].contains(range.startContainer) ? range.startOffset : 0;
      const endOffset =
        endText && divs[endItem].contains(range.endContainer)
          ? range.endOffset
          : divs[endItem].textContent?.length ?? 0;

      const cfi = makeCfi(currentPageRef.current, startItem, startOffset, endItem, endOffset);

      let rect: SelectionRect | null = null;
      try {
        const r = range.getBoundingClientRect();
        if (r.width || r.height) {
          rect = { x: r.left + r.width / 2, y: r.top, width: r.width, height: r.height };
        }
      } catch {
        rect = null;
      }

      onSelectionRef.current?.({ cfiRange: cfi, text, chapterHref: null, rect });
    }
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
    <div
      ref={viewportRef}
      className="relative flex h-full w-full flex-col items-center overflow-auto bg-paper px-4 py-8"
      style={{ "--haenggan-select": withAlpha(myColor, 0.3) } as CSSProperties}
    >
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
