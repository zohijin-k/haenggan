"use client";

import { useState } from "react";
import { noteFontStack, type NoteFont } from "@/lib/notePrefs";

// 남의 메모는 항상 이 기본 서체로 보여준다 — "메모 폰트" 설정은 내 손글씨에만
// 적용되는 개인 취향이라, 내가 바꾼다고 상대방 메모의 서체까지 바뀌면 안 된다.
const DEFAULT_NOTE_FONT: NoteFont = "gaegu";

type CreateModeProps = {
  mode: "create";
  quote: string;
  myColor: string;
  noteFont: NoteFont;
  onSave: (note: string) => void;
  onCancel: () => void;
};

export type ViewEntry = {
  id: string;
  quote: string;
  note: string | null;
  nickname: string;
  color: string;
  createdAt: string;
  isMine: boolean;
};

type ViewModeProps = {
  mode: "view";
  entries: ViewEntry[];
  noteFont: NoteFont;
  onClose: () => void;
  onDelete?: (highlightId: string) => void;
};

type Props = CreateModeProps | ViewModeProps;

export default function NoteSheet(props: Props) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4 sm:px-0">
      <div className="w-full max-w-lg animate-inkSpread rounded-2xl border border-ink/10 bg-white/95 p-5 shadow-note backdrop-blur">
        {props.mode === "create" ? (
          <CreateBody {...props} />
        ) : (
          <ViewBody {...props} />
        )}
      </div>
    </div>
  );
}

function CreateBody({ quote, myColor, noteFont, onSave, onCancel }: CreateModeProps) {
  const [note, setNote] = useState("");
  return (
    <div className="space-y-3">
      <p
        className="border-l-2 pl-3 text-sm leading-relaxed text-ink/70"
        style={{ borderColor: myColor }}
      >
        “{quote}”
      </p>
      <textarea
        autoFocus
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        style={{ fontFamily: noteFontStack(noteFont) }}
        className="w-full resize-none rounded-xl border border-ink/10 bg-paper/60 px-3 py-2 text-lg text-ink focus:outline-none focus:ring-2 focus:ring-ink/15"
      />
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm text-ink/50 hover:text-ink"
        >
          취소
        </button>
        <button
          onClick={() => onSave(note.trim())}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm"
          style={{ backgroundColor: myColor }}
        >
          밑줄 긋기
        </button>
      </div>
    </div>
  );
}

function ViewBody({ entries, noteFont, onClose, onDelete }: ViewModeProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink/40">
          {entries.length > 1 ? `겹친 밑줄 ${entries.length}개` : "밑줄"}
        </span>
        <button onClick={onClose} className="text-ink/30 hover:text-ink/60">
          ✕
        </button>
      </div>
      <div className="max-h-[60vh] space-y-4 overflow-y-auto">
        {entries.map((entry, i) => (
          <div
            key={entry.id}
            className={i > 0 ? "space-y-3 border-t border-ink/10 pt-4" : "space-y-3"}
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: entry.color }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
                {entry.nickname} · {formatNoteDate(entry.createdAt)}
              </span>
            </div>
            <p className="border-l-2 pl-3 text-sm leading-relaxed text-ink/70" style={{ borderColor: entry.color }}>
              “{entry.quote}”
            </p>
            {entry.note && (
              <p
                className="text-xl leading-snug text-ink"
                style={{
                  color: entry.color,
                  // 메모 폰트는 "내" 취향이라 내 메모에만 적용하고, 남의 메모는
                  // 고정된 기본 서체로 보여준다.
                  fontFamily: noteFontStack(entry.isMine ? noteFont : DEFAULT_NOTE_FONT),
                }}
              >
                {entry.note}
              </p>
            )}
            {entry.isMine && onDelete && (
              <div className="flex justify-end">
                <button onClick={() => onDelete(entry.id)} className="text-xs text-ink/30 hover:text-danger">
                  지우기
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatNoteDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(date);
}
