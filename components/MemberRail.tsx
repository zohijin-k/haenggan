"use client";

import type { Member, ReadingProgress } from "@/lib/types";
import { NOTE_FONT_OPTIONS, noteFontStack, type NoteFont } from "@/lib/notePrefs";

type Props = {
  bookTitle: string;
  code: string;
  members: Member[];
  progressByMember: Record<string, ReadingProgress | undefined>;
  myMemberId: string;
  myColor: string;
  onColorChange: (color: string) => void;
  noteFont: NoteFont;
  onNoteFontChange: (font: NoteFont) => void;
};

export default function MemberRail({
  bookTitle,
  code,
  members,
  progressByMember,
  myMemberId,
  myColor,
  onColorChange,
  noteFont,
  onNoteFontChange,
}: Props) {
  return (
    <aside className="flex h-full w-full flex-col gap-6 border-l border-ink/10 bg-white/30 p-5 backdrop-blur-sm sm:w-64">
      <div>
        <p className="text-xs text-ink/40">지금 함께 읽는 책</p>
        <h2 className="mt-1 text-sm font-medium leading-snug text-ink">{bookTitle}</h2>
      </div>

      <div>
        <p className="mb-2 text-xs text-ink/40">초대 코드</p>
        <button
          onClick={() => navigator.clipboard?.writeText(code)}
          className="w-full rounded-lg border border-dashed border-ink/20 px-3 py-2 text-left text-sm font-semibold tracking-[0.15em] text-ink/70 transition hover:border-ink/30"
          title="복사하기"
        >
          {code}
        </button>
      </div>

      <div className="space-y-3.5 rounded-xl border border-ink/10 bg-white/40 p-3.5">
        <div className="flex items-center justify-between">
          <p className="text-xs text-ink/40">내 하이라이트 색</p>
          <label className="relative h-6 w-6 shrink-0 cursor-pointer overflow-hidden rounded-full border border-ink/10 shadow-note">
            <span className="absolute inset-0" style={{ backgroundColor: myColor }} />
            <input
              type="color"
              value={myColor}
              onChange={(e) => onColorChange(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="하이라이트 색 바꾸기"
            />
          </label>
        </div>

        <div>
          <p className="mb-1.5 text-xs text-ink/40">메모 폰트</p>
          <div className="flex gap-1.5">
            {NOTE_FONT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onNoteFontChange(opt.value)}
                style={{ fontFamily: noteFontStack(opt.value) }}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-sm leading-none transition ${
                  noteFont === opt.value
                    ? "border-ink/0 bg-ink text-paper"
                    : "border-ink/10 text-ink/60 hover:border-ink/25"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink/30">
            내가 남기는 메모가 이 글씨체로 보여요
          </p>
        </div>
      </div>

      <div className="flex-1">
        <p className="mb-3 text-xs text-ink/40">같이 읽는 사람들</p>
        <ul className="space-y-3">
          {members.map((m) => {
            const progress = progressByMember[m.id];
            const pct = Math.round((progress?.percentage ?? 0) * 100);
            return (
              <li key={m.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-ink/80">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: m.id === myMemberId ? myColor : m.color }}
                    />
                    {m.nickname}
                    {m.id === myMemberId && (
                      <span className="text-xs text-ink/30">(나)</span>
                    )}
                  </span>
                  <span className="text-xs text-ink/40">{pct}%</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-ink/5">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: m.id === myMemberId ? myColor : m.color }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
