"use client";

import { useEffect, useRef } from "react";
import type { Highlight } from "@/lib/types";
import { withAlpha } from "@/lib/palette";

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
  epubUrl: string;
  visibleHighlights: Highlight[];
  myColor: string;
  startCfi?: string | null;
  onReady?: (api: ReaderApi) => void;
  onSelection?: (info: SelectionInfo) => void;
  onLocationChange?: (cfi: string, percentage: number, chapterHref: string) => void;
  onHighlightClick?: (highlightId: string) => void;
};

// 작품 원본 조판을 최대한 살리되, 폰트를 너무 튀지 않는 UI 서체로 통일한다.
// (읽기 폰트 선택은 없앴고, 사용자가 고르는 건 자기 메모 서체다 — lib/notePrefs.ts)
const READER_FONT = `"Pretendard Variable", "Pretendard", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif`;

// iframe 내부 문서엔 우리 Tailwind 스타일시트가 닿지 않아 순수 CSS로 직접 주입한다.
const READER_CSS = `
  body, body * { font-family: ${READER_FONT} !important; }
  mark { background: transparent !important; }
  .exch-underline { cursor: pointer; }
`;

// 드래그로 문장을 고르는 동안 보이는 선택 색 = "내 고유색"
function selectionCss(color: string) {
  return `::selection { background: ${withAlpha(color, 0.3)} !important; }`;
}

export default function EpubReader({
  epubUrl,
  visibleHighlights,
  myColor,
  startCfi,
  onReady,
  onSelection,
  onLocationChange,
  onHighlightClick,
}: Props) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<any>(null);
  const bookRef = useRef<any>(null);
  const addedHighlightIds = useRef<Set<string>>(new Set());
  const onSelectionRef = useRef(onSelection);
  const onHighlightClickRef = useRef(onHighlightClick);
  const onLocationChangeRef = useRef(onLocationChange);
  const myColorRef = useRef(myColor);

  onSelectionRef.current = onSelection;
  onHighlightClickRef.current = onHighlightClick;
  onLocationChangeRef.current = onLocationChange;
  myColorRef.current = myColor;

  // 밑줄(marks-pane <line>)들을 다시 칠하고, 같은 줄에서 x축이 겹치는 것끼리는
  // "lane"만큼 아래로 내려 겹쳐 보이게 한다. marks-pane이 리사이즈 때마다
  // 자식 요소를 통째로 새로 그리기 때문에, MutationObserver로 매번 다시 입힌다.
  const restyleScheduled = useRef(false);
  const restyleUnderlines = useRef(() => {});
  restyleUnderlines.current = () => {
    const root = viewerRef.current;
    if (!root) return;
    const lines = Array.from(root.querySelectorAll("svg line")) as SVGLineElement[];
    if (!lines.length) return;

    // 같은 시각적 줄(y1이 4px 이내)끼리 묶는다.
    const buckets = new Map<number, SVGLineElement[]>();
    for (const ln of lines) {
      const y = parseFloat(ln.getAttribute("y1") || "0");
      const key = Math.round(y / 4);
      const arr = buckets.get(key) ?? [];
      arr.push(ln);
      buckets.set(key, arr);
    }

    for (const group of buckets.values()) {
      group.sort(
        (a, b) => parseFloat(a.getAttribute("x1") || "0") - parseFloat(b.getAttribute("x1") || "0")
      );
      const laneEnd: number[] = []; // laneEnd[l] = 그 lane을 차지한 마지막 밑줄의 x2
      for (const ln of group) {
        const x1 = parseFloat(ln.getAttribute("x1") || "0");
        const x2 = parseFloat(ln.getAttribute("x2") || "0");
        let lane = 0;
        while (lane < laneEnd.length && laneEnd[lane] > x1 + 0.5) lane++;
        laneEnd[lane] = x2;

        const g = ln.parentElement as unknown as SVGGElement | null;
        const color = (g && (g as any).dataset?.color) || ln.getAttribute("stroke") || "#18181b";
        ln.setAttribute("stroke", color);
        ln.setAttribute("stroke-width", "2");
        ln.setAttribute("stroke-opacity", "0.9");
        ln.setAttribute("stroke-linecap", "round");
        ln.setAttribute("transform", `translate(0, ${lane * 3})`);
      }
    }
  };

  useEffect(() => {
    const root = viewerRef.current;
    if (!root || typeof MutationObserver === "undefined") return;
    let alive = true;
    const observer = new MutationObserver(() => {
      if (restyleScheduled.current) return;
      restyleScheduled.current = true;
      requestAnimationFrame(() => {
        restyleScheduled.current = false;
        if (!alive) return;
        observer.disconnect();
        try {
          restyleUnderlines.current();
        } finally {
          observer.observe(root, { childList: true, subtree: true });
        }
      });
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const ePub = (await import("epubjs")).default;
      const { EpubCFI } = await import("epubjs");
      if (cancelled || !viewerRef.current) return;

      const book = ePub(epubUrl);
      bookRef.current = book;
      const rendition = book.renderTo(viewerRef.current, {
        width: "100%",
        height: "100%",
        spread: "auto",
        flow: "paginated",
      });
      renditionRef.current = rendition;

      rendition.hooks.content.register((contents: any) => {
        try {
          contents.addStylesheetCss(READER_CSS, "haenggan-reader-base");
          contents.addStylesheetCss(selectionCss(myColorRef.current), "haenggan-reader-select");
        } catch {
          // 구버전 epub.js 호환: 실패해도 기본 렌더링엔 지장 없음
        }
      });

      await rendition.display(startCfi || undefined);

      book.locations.generate(1600).catch(() => {
        /* 위치 인덱싱 실패해도 읽기 자체엔 문제 없음 */
      });

      rendition.on("selected", (cfiRange: string, contents: any) => {
        const selection = contents.window.getSelection();
        const text = selection ? selection.toString() : "";
        if (!text.trim()) return;
        const chapterHref = rendition.location?.start?.href ?? null;

        let rect: SelectionRect | null = null;
        try {
          const range = selection.getRangeAt(0);
          const r = range.getBoundingClientRect();
          const frame = contents.document?.defaultView?.frameElement as HTMLElement | undefined;
          const frameRect = frame?.getBoundingClientRect();
          rect = {
            x: (frameRect?.left ?? 0) + r.left + r.width / 2,
            y: (frameRect?.top ?? 0) + r.top,
            width: r.width,
            height: r.height,
          };
        } catch {
          rect = null;
        }

        onSelectionRef.current?.({ cfiRange, text, chapterHref, rect });
      });

      rendition.on("relocated", (location: any) => {
        const cfi = location?.end?.cfi;
        const href = location?.start?.href ?? "";
        let percentage = 0;
        try {
          percentage = book.locations.percentageFromCfi(cfi) ?? 0;
        } catch {
          percentage = 0;
        }
        if (cfi) onLocationChangeRef.current?.(cfi, percentage, href);
        restyleUnderlines.current();
      });

      rendition.on("rendered", () => restyleUnderlines.current());

      const compareCfi = (a: string, b: string) => {
        try {
          return new EpubCFI().compare(a, b);
        } catch {
          return 0;
        }
      };

      const goToCfi = (cfi: string) => {
        rendition.display(cfi);
      };

      onReady?.({ compareCfi, goToCfi });
    }

    init();

    return () => {
      cancelled = true;
      try {
        renditionRef.current?.destroy();
        bookRef.current?.destroy();
      } catch {
        // ignore teardown errors
      }
      addedHighlightIds.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [epubUrl]);

  // 내 색이 바뀌면 이미 렌더된 페이지의 선택 색도 즉시 갱신한다.
  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    try {
      const list = typeof rendition.getContents === "function" ? rendition.getContents() : [];
      list.forEach((c: any) => {
        try {
          c.addStylesheetCss(selectionCss(myColor), "haenggan-reader-select");
        } catch {
          // ignore
        }
      });
    } catch {
      // ignore
    }
  }, [myColor]);

  // 새로 "발견"된(잠금 해제된) 하이라이트를 뷰에 얹는다.
  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;

    for (const h of visibleHighlights) {
      if (addedHighlightIds.current.has(h.id)) continue;
      try {
        rendition.annotations.underline(
          h.cfi_range,
          { color: h.color },
          () => onHighlightClickRef.current?.(h.id),
          "exch-underline",
          { "mix-blend-mode": "normal" }
        );
        addedHighlightIds.current.add(h.id);
      } catch {
        // 아직 스파인이 렌더되지 않은 구간일 수 있음 — 다음 relocate 때 자연히 재시도됨
      }
    }
    restyleUnderlines.current();
  }, [visibleHighlights]);

  return <div ref={viewerRef} className="epub-container h-full w-full" />;
}
