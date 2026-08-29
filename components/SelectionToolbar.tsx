"use client";

type Rect = { x: number; y: number; width: number; height: number };

type Props = {
  rect: Rect;
  color: string;
  onClick: () => void;
};

const CARD_W = 232;

// 문장을 드래그로 선택하면 그 자리에 뜨는 "메모 남기기" 배너.
// 예전엔 선택하자마자 메모 시트가 통째로 튀어나왔는데, 그건 (1) 화면 아래쪽에서
// 갑자기 나타나 놓치기 쉽고 (2) "그냥 다시 읽어보려던" 선택에도 매번 뜨는 게
// 부담스러워서, 선택 지점 옆에 눌러야 열리는 배너 하나만 먼저 보여주는 방식으로 바꿈.
// 작은 알약이라 "눌러야 한다"는 게 잘 안 읽혀서 아이콘 + 설명이 붙은 카드로 키웠다.
//
// 바깥 div가 위치(translateX(-50%))를 잡고, 안쪽 div가 등장 애니메이션을 맡는다.
// (animate-reveal의 마지막 transform이 바깥의 translateX를 덮어써 위치가 틀어지던 문제)
export default function SelectionToolbar({ rect, color, onClick }: Props) {
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 800;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 600;

  const preferAbove = rect.y - 80 > 8;
  const top = preferAbove
    ? rect.y - 76
    : Math.min(rect.y + rect.height + 14, viewportHeight - 88);
  const left = Math.min(
    Math.max(rect.x, CARD_W / 2 + 8),
    viewportWidth - CARD_W / 2 - 8
  );
  const caretLeft = Math.max(18, Math.min(CARD_W - 18, rect.x - left + CARD_W / 2));

  return (
    <div
      data-selection-toolbar
      className="fixed z-40"
      style={{ top, left, width: CARD_W, transform: "translateX(-50%)" }}
    >
      <div className="animate-reveal relative">
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={onClick}
          className="flex w-full items-center gap-3 rounded-2xl border border-ink/10 bg-white px-4 py-3 text-left shadow-note transition hover:border-ink/20 hover:bg-paper"
        >
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm text-white"
            style={{ backgroundColor: color }}
          >
            ✏️
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold leading-tight text-ink">메모 남기기</span>
            <span className="mt-0.5 block truncate text-[11px] leading-tight text-ink/45">
              눌러서 밑줄 긋고 생각 적기
            </span>
          </span>
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
