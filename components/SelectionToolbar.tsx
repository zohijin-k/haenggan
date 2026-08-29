"use client";

type Rect = { x: number; y: number; width: number; height: number };

type Props = {
  rect: Rect;
  color: string;
  onClick: () => void;
};

// 텍스트를 드래그로 선택하면 그 위치 근처에 뜨는 작은 알약 버튼.
// 예전엔 선택하자마자 메모 시트가 통째로 튀어나왔는데, 그건 (1) 화면 아래쪽에서
// 갑자기 나타나 놓치기 쉽고 (2) "그냥 다시 읽어보려던" 선택에도 매번 뜨는 게
// 부담스러워서, 선택 지점 바로 옆에 작고 명확한 CTA 하나만 먼저 보여주는 방식으로 바꿈.
export default function SelectionToolbar({ rect, color, onClick }: Props) {
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 800;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 600;

  const preferAbove = rect.y - 46 > 8;
  const top = preferAbove ? rect.y - 46 : Math.min(rect.y + rect.height + 10, viewportHeight - 48);
  const left = Math.min(Math.max(rect.x, 84), viewportWidth - 84);

  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={onClick}
      style={{ top, left, transform: "translateX(-50%)" }}
      className="animate-reveal fixed z-40 flex items-center gap-1.5 rounded-full border border-ink/10 bg-ink px-3.5 py-2 text-xs font-medium text-paper shadow-note transition hover:bg-ink/90"
    >
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      메모 남기기
    </button>
  );
}
