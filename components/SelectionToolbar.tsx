"use client";

type Rect = { x: number; y: number; width: number; height: number };

type Props = {
  rect: Rect;
  color: string;
  onClick: () => void;
};

const CARD_W = 148;

// 문장을 드래그로 선택하면 그 자리에 뜨는 "메모 남기기" 버튼.
// 바깥 div가 위치(translateX(-50%))를 잡고, 안쪽이 등장 애니메이션(기울기 없음)을 맡는다.
export default function SelectionToolbar({ rect, color, onClick }: Props) {
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 800;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 600;

  const preferAbove = rect.y - 60 > 8;
  const top = preferAbove
    ? rect.y - 56
    : Math.min(rect.y + rect.height + 12, viewportHeight - 60);
  const left = Math.min(
    Math.max(rect.x, CARD_W / 2 + 8),
    viewportWidth - CARD_W / 2 - 8
  );
  const caretLeft = Math.max(16, Math.min(CARD_W - 16, rect.x - left + CARD_W / 2));

  return (
    <div
      data-selection-toolbar
      className="fixed z-40"
      style={{ top, left, width: CARD_W, transform: "translateX(-50%)" }}
    >
      <div className="animate-inkSpread relative">
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={onClick}
          className="flex w-full items-center gap-2 rounded-xl border border-ink/10 bg-white px-3 py-2.5 shadow-note transition hover:border-ink/20 hover:bg-paper"
        >
          <span
            aria-hidden
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] text-white"
            style={{ backgroundColor: color }}
          >
            ✏️
          </span>
          <span className="text-sm font-semibold text-ink">메모 남기기</span>
        </button>
        <span
          aria-hidden
          className="absolute block h-3 w-3 rotate-45 bg-white"
          style={{
            left: caretLeft,
            marginLeft: -6,
            ...(preferAbove ? { bottom: -5 } : { top: -5 }),
            borderColor: "rgba(24, 24, 27, 0.10)",
            borderStyle: "solid",
            borderWidth: preferAbove ? "0 1px 1px 0" : "1px 0 0 1px",
          }}
        />
      </div>
    </div>
  );
}
