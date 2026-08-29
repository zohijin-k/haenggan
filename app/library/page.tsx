"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { forgetLocalSession, listLocalSessions } from "@/lib/identity";
import type { Session } from "@/lib/types";

type Entry = {
  code: string;
  nickname: string;
  color: string;
  session: Session | null;
};

export default function LibraryPage() {
  const [entries, setEntries] = useState<Entry[] | null>(null);

  useEffect(() => {
    const locals = listLocalSessions();
    if (locals.length === 0) {
      setEntries([]);
      return;
    }

    let cancelled = false;
    const codes = locals.map((l) => l.code);

    supabase
      .from("sessions")
      .select("*")
      .in("code", codes)
      .then(({ data }) => {
        if (cancelled) return;
        const byCode: Record<string, Session> = {};
        for (const s of (data as Session[]) ?? []) byCode[s.code] = s;

        const merged: Entry[] = locals
          .map((l) => ({
            code: l.code,
            nickname: l.identity.nickname,
            color: l.identity.color,
            session: byCode[l.code] ?? null,
          }))
          .sort((a, b) => {
            const ta = a.session ? Date.parse(a.session.created_at) : 0;
            const tb = b.session ? Date.parse(b.session.created_at) : 0;
            return tb - ta;
          });
        setEntries(merged);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function forget(code: string) {
    forgetLocalSession(code);
    setEntries((prev) => prev?.filter((e) => e.code !== code) ?? null);
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-ink/30">space between lines</p>
          <h1 className="mt-1 text-2xl font-medium tracking-tight text-ink">저장소</h1>
          <p className="mt-1.5 text-sm text-ink/50">이 기기로 함께 읽은 행간들</p>
        </div>
        <Link
          href="/"
          className="rounded-lg border border-ink/10 bg-white/50 px-3 py-1.5 text-xs text-ink/60 transition hover:border-ink/25"
        >
          + 새 행간
        </Link>
      </div>

      {entries === null && <p className="text-sm text-ink/40">불러오는 중…</p>}

      {entries !== null && entries.length === 0 && (
        <div className="rounded-2xl border border-dashed border-ink/15 bg-white/30 p-10 text-center">
          <p className="text-sm text-ink/50">아직 저장된 행간이 없어요.</p>
          <Link
            href="/"
            className="mt-3 inline-block text-sm font-medium text-moss transition hover:text-moss/80"
          >
            새로 시작하거나 코드로 참여하기 →
          </Link>
        </div>
      )}

      {entries !== null && entries.length > 0 && (
        <ul className="space-y-3">
          {entries.map((e) => (
            <li
              key={e.code}
              className="group flex items-center gap-4 rounded-2xl border border-ink/10 bg-white/40 p-4 shadow-note backdrop-blur-sm"
            >
              <div className="h-16 w-11 shrink-0 overflow-hidden rounded-sm bg-moss/10">
                {e.session?.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={e.session.cover_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-xs text-moss/50">
                    작품
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                {e.session ? (
                  <>
                    <p className="truncate text-sm font-medium text-ink">{e.session.book_title}</p>
                    {e.session.book_author && (
                      <p className="truncate text-xs text-ink/50">{e.session.book_author}</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-ink/40">사라진 행간이에요</p>
                )}
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-ink/40">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: e.color }}
                  />
                  {e.nickname} · {e.code}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1.5">
                {e.session ? (
                  <Link
                    href={`/session/${e.code}`}
                    className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-paper transition hover:bg-ink/90"
                  >
                    이어 읽기
                  </Link>
                ) : (
                  <span className="text-[11px] text-ink/30">열 수 없음</span>
                )}
                <button
                  type="button"
                  onClick={() => forget(e.code)}
                  className="text-[11px] text-ink/30 transition hover:text-danger"
                >
                  지우기
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
