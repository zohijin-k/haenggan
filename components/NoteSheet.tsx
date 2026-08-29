"use client";

import { useState } from "react";

type CreateModeProps = {
  mode: "create";
  quote: string;
  myColor: string;
  onSave: (note: string) => void;
  onCancel: () => void;
};

type ViewModeProps = {
  mode: "view";
  quote: string;
  note: string | null;
  nickname: string;
  color: string;
  createdAt: string;
  isMine: boolean;
  onClose: () => void;
  onDelete?: () => void;
};

type Props = CreateModeProps | ViewModeProps;

export default function NoteSheet(props: Props) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4 sm:px-0">
      <div className="w-full max-w-lg animate-reveal rounded-2xl border border-ink/10 bg-white/95 p-5 shadow-note backdrop-blur">
        {props.mode === "create" ? (
          <CreateBody {...props} />
        ) : (
          <ViewBody {...props} />
        )}
      </div>
    </div>
  );
}

function CreateBody({ quote, myColor, onSave, onCancel }: CreateModeProps) {
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
        placeholder="이 문장에 남기고 싶은 말이 있다면… (비워두면 밑줄만 남아요)"
        rows={3}
        className="w-full resize-none rounded-xl border border-ink/10 bg-paper/60 px-3 py-2 font-hand text-lg text-ink placeholder:font-sans placeholder:text-sm placeholder:text-ink/30 focus:outline-none focus:ring-2 focus:ring-ink/15"
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

function ViewBody({ quote, note, nickname, color, createdAt, isMine, onClose, onDelete }: ViewModeProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span
          className="inline-flex items-center gap-1.5 text-xs font-medium"
          style={{ color }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
          {nickname} · {formatNoteDate(createdAt)}
        </span>
        <button onClick={onClose} className="text-ink/30 hover:text-ink/60">
          ✕
        </button>
      </div>
      <p className="border-l-2 pl-3 text-sm leading-relaxed text-ink/70" style={{ borderColor: color }}>
        “{quote}”
      </p>
      {note && (
        <p className="font-hand text-xl leading-snug text-ink" style={{ color }}>
          {note}
        </p>
      )}
      {isMine && onDelete && (
        <div className="flex justify-end">
          <button onClick={onDelete} className="text-xs text-ink/30 hover:text-danger">
            지우기
          </button>
        </div>
      )}
    </div>
  );
}

function formatNoteDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric" }).format(date);
}
