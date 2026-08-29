"use client";

import { useEffect, useRef } from "react";
import type { Highlight } from "@/lib/types";

type SelectionInfo = {
  cfiRange: string;
  text: string;
  chapterHref: string | null;
};

type ReaderApi = {
  compareCfi: (a: string, b: string) => number;
  goToCfi: (cfi: string) => void;
};

type Props = {
  epubUrl: string;
  visibleHighlights: Highlight[];
  startCfi?: string | null;
  onReady?: (api: ReaderApi) => void;
  onSelection?: (info: SelectionInfo) => void;
  onLocationChange?: (cfi: string, percentage: number, chapterHref: string) => void;
  onHighlightClick?: (highlightId: string) => void;
};

// epub.js가 mark 태그에 붙이는 밑줄/형광펜 스타일. iframe 내부 문서는
// 우리 Tailwind 스타일시트가 닿지 않기 때문에 순수 CSS로 직접 주입한다.
const READER_CSS = `
  mark { background: transparent !important; }
  .exch-underline {
    text-decoration: underline;
    text-decoration-thickness: 2px;
    text-underline-offset: 3px;
    cursor: pointer;
  }
`;

export default function EpubReader({
  epubUrl,
  visibleHighlights,
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

  onSelectionRef.current = onSelection;
  onHighlightClickRef.current = onHighlightClick;
  onLocationChangeRef.current = onLocationChange;

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
        } catch {
          // 구버전 epub.js 호환: 실패해도 기본 렌더링엔 지장 없음
        }
      });

      await rendition.display(startCfi || undefined);

      book.locations
        .generate(1600)
        .catch(() => {
          /* 위치 인덱싱 실패해도 읽기 자체엔 문제 없음 */
        });

      rendition.on("selected", (cfiRange: string, contents: any) => {
        const selection = contents.window.getSelection();
        const text = selection ? selection.toString() : "";
        if (!text.trim()) return;
        const chapterHref = rendition.location?.start?.href ?? null;
        onSelectionRef.current?.({ cfiRange, text, chapterHref });
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
      });

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

  // 새로 "발견"된(잠금 해제된) 하이라이트를 뷰에 얹는다.
  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;

    for (const h of visibleHighlights) {
      if (addedHighlightIds.current.has(h.id)) continue;
      try {
        rendition.annotations.underline(
          h.cfi_range,
          {},
          () => onHighlightClickRef.current?.(h.id),
          "exch-underline",
          { stroke: h.color, "stroke-width": "2px" }
        );
        addedHighlightIds.current.add(h.id);
      } catch {
        // 아직 스파인이 렌더되지 않은 구간일 수 있음 — 다음 relocate 때 자연히 재시도됨
      }
    }
  }, [visibleHighlights]);

  return <div ref={viewerRef} className="epub-container h-full w-full" />;
}
