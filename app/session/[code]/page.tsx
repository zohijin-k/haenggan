"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase, BOOKS_BUCKET } from "@/lib/supabase";
import { getLocalIdentity, newDeviceKey, setLocalIdentity } from "@/lib/identity";
import { MEMBER_PALETTE } from "@/lib/palette";
import { getNoteFont, setNoteFont, type NoteFont } from "@/lib/notePrefs";
import type { Highlight, Member, ReadingProgress, Session } from "@/lib/types";
import EpubReader from "@/components/EpubReader";
import PdfReader from "@/components/PdfReader";
import NoteSheet from "@/components/NoteSheet";
import MemberRail from "@/components/MemberRail";
import SelectionToolbar from "@/components/SelectionToolbar";

const SELECT_HINT_KEY = "haenggan:hint:select-dismissed";

type PendingSelection = {
  cfiRange: string;
  text: string;
  chapterHref: string | null;
  rect: { x: number; y: number; width: number; height: number } | null;
};

export default function SessionPage() {
  const params = useParams<{ code: string }>();
  const code = (params.code as string)?.toUpperCase();

  const [session, setSession] = useState<Session | null>(null);
  const [epubUrl, setEpubUrl] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [progress, setProgress] = useState<Record<string, ReadingProgress>>({});
  const [myMemberId, setMyMemberId] = useState<string | null>(null);
  const [myColor, setMyColor] = useState<string>("#5c6b4f");
  const [needsNickname, setNeedsNickname] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRail, setShowRail] = useState(true);

  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);
  const [noteSheetOpen, setNoteSheetOpen] = useState(false);
  const [viewingHighlightId, setViewingHighlightId] = useState<string | null>(null);
  const [noteFont, setNoteFontState] = useState<NoteFont>("gaegu");
  const [showSelectHint, setShowSelectHint] = useState(false);

  const compareCfiRef = useRef<((a: string, b: string) => number) | null>(null);
  const myFurthestCfiRef = useRef<string | null>(null);
  const progressSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 0) 이 기기의 개인 취향(메모 폰트) + 선택 힌트 노출 여부 로드
  useEffect(() => {
    setNoteFontState(getNoteFont());
    try {
      setShowSelectHint(!window.localStorage.getItem(SELECT_HINT_KEY));
    } catch {
      setShowSelectHint(true);
    }
  }, []);

  // 1) 세션 + 로컬 신원 로드
  useEffect(() => {
    if (!code) return;
    let cancelled = false;

    async function load() {
      const { data: sessionRow, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("code", code)
        .single();

      if (cancelled) return;
      if (error || !sessionRow) {
        setLoadError("존재하지 않는 행간이에요. 코드를 다시 확인해줘.");
        setLoading(false);
        return;
      }
      setSession(sessionRow as Session);

      const { data: urlData } = supabase.storage
        .from(BOOKS_BUCKET)
        .getPublicUrl(sessionRow.epub_path);
      setEpubUrl(urlData.publicUrl);

      const identity = getLocalIdentity(code);
      if (identity) {
        setMyMemberId(identity.memberId);
        setMyColor(identity.color);
      } else {
        setNeedsNickname(true);
      }

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [code]);

  // 2) 멤버 / 하이라이트 / 진행률 로드 + 실시간 구독
  useEffect(() => {
    if (!session) return;
    const currentSession = session;
    let cancelled = false;

    async function loadAll() {
      const [{ data: memberRows }, { data: highlightRows }, { data: progressRows }] =
        await Promise.all([
          supabase.from("session_members").select("*").eq("session_id", currentSession.id),
          supabase.from("highlights").select("*").eq("session_id", currentSession.id),
          supabase.from("reading_progress").select("*").eq("session_id", currentSession.id),
        ]);
      if (cancelled) return;

      setMembers((memberRows as Member[]) ?? []);
      setHighlights((highlightRows as Highlight[]) ?? []);

      const progressMap: Record<string, ReadingProgress> = {};
      for (const p of (progressRows as ReadingProgress[]) ?? []) {
        progressMap[p.member_id] = p;
      }
      setProgress(progressMap);

      if (myMemberId && progressMap[myMemberId]) {
        myFurthestCfiRef.current = progressMap[myMemberId].furthest_cfi;
      }
    }

    loadAll();

    const channel = supabase
      .channel(`session:${currentSession.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "highlights", filter: `session_id=eq.${currentSession.id}` },
        (payload) => {
          setHighlights((prev) => [...prev, payload.new as Highlight]);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "session_members", filter: `session_id=eq.${currentSession.id}` },
        (payload) => {
          setMembers((prev) => [...prev, payload.new as Member]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "session_members", filter: `session_id=eq.${currentSession.id}` },
        (payload) => {
          const updated = payload.new as Member;
          setMembers((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reading_progress", filter: `session_id=eq.${currentSession.id}` },
        (payload) => {
          const row = payload.new as ReadingProgress;
          setProgress((prev) => ({ ...prev, [row.member_id]: row }));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, myMemberId]);

  const membersById = useMemo(() => {
    const map: Record<string, Member> = {};
    for (const m of members) map[m.id] = m;
    return map;
  }, [members]);

  // 나에게 "발견"된(잠금 해제된) 하이라이트만 필터링
  const visibleHighlights = useMemo(() => {
    if (!myMemberId) return [];
    const compare = compareCfiRef.current;
    return highlights.filter((h) => {
      if (h.member_id === myMemberId) return true;
      if (!compare || !myFurthestCfiRef.current) return false;
      try {
        return compare(h.cfi_range, myFurthestCfiRef.current) <= 0;
      } catch {
        return false;
      }
    });
    // myFurthestCfiRef는 위치가 바뀔 때 progressTick으로 재계산을 트리거
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlights, myMemberId, progress]);

  const handleSelection = useCallback((info: PendingSelection) => {
    setPendingSelection(info);
    // rect 계산에 실패했을 때(드물게 있을 수 있음)는 알약 버튼을 띄울 위치가
    // 없으니 예전처럼 메모 시트를 바로 연다.
    setNoteSheetOpen(!info.rect);
    if (showSelectHint) {
      setShowSelectHint(false);
      try {
        window.localStorage.setItem(SELECT_HINT_KEY, "1");
      } catch {
        // ignore
      }
    }
  }, [showSelectHint]);

  const handleNoteFontChange = useCallback((next: NoteFont) => {
    setNoteFontState(next);
    setNoteFont(next);
  }, []);

  const handleColorChange = useCallback(
    async (nextColor: string) => {
      if (!myMemberId) return;
      setMyColor(nextColor);
      setMembers((prev) => prev.map((m) => (m.id === myMemberId ? { ...m, color: nextColor } : m)));
      const identity = getLocalIdentity(code);
      if (identity) setLocalIdentity(code, { ...identity, color: nextColor });
      await supabase.from("session_members").update({ color: nextColor }).eq("id", myMemberId);
    },
    [code, myMemberId]
  );

  // 알약 버튼이 떠 있는 동안 다른 곳을 클릭하면(메모를 남기지 않기로 한 것) 닫아준다.
  useEffect(() => {
    if (!pendingSelection || noteSheetOpen || !pendingSelection.rect) return;
    const dismiss = () => setPendingSelection(null);
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", dismiss, { once: true });
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", dismiss);
    };
  }, [pendingSelection, noteSheetOpen]);

  const handleLocationChange = useCallback(
    (cfi: string, percentage: number, chapterHref: string) => {
      if (!myMemberId || !session) return;
      const compare = compareCfiRef.current;
      const prevFurthest = myFurthestCfiRef.current;
      const isForward = !prevFurthest || !compare ? true : compare(cfi, prevFurthest) > 0;
      if (isForward) {
        myFurthestCfiRef.current = cfi;
        // progress state를 살짝 건드려 visibleHighlights 재계산을 유도
        setProgress((prev) => ({
          ...prev,
          [myMemberId]: {
            ...(prev[myMemberId] ?? {
              id: "",
              session_id: session.id,
              member_id: myMemberId,
              created_at: "",
            }),
            furthest_cfi: cfi,
            percentage,
            updated_at: new Date().toISOString(),
          } as ReadingProgress,
        }));

        if (progressSaveTimer.current) clearTimeout(progressSaveTimer.current);
        progressSaveTimer.current = setTimeout(() => {
          supabase
            .from("reading_progress")
            .upsert(
              {
                session_id: session.id,
                member_id: myMemberId,
                furthest_cfi: cfi,
                percentage,
              },
              { onConflict: "session_id,member_id" }
            )
            .then(() => {});
        }, 1200);
      }
    },
    [myMemberId, session]
  );

  async function saveHighlight(note: string) {
    if (!pendingSelection || !myMemberId || !session) return;
    const { data, error } = await supabase
      .from("highlights")
      .insert({
        session_id: session.id,
        member_id: myMemberId,
        cfi_range: pendingSelection.cfiRange,
        chapter_href: pendingSelection.chapterHref,
        selected_text: pendingSelection.text.slice(0, 2000),
        note: note || null,
        color: myColor,
      })
      .select()
      .single();
    if (!error && data) {
      setHighlights((prev) => [...prev, data as Highlight]);
    }
    setPendingSelection(null);
    setNoteSheetOpen(false);
  }

  async function handleNicknameJoin(nickname: string, color: string) {
    if (!session) return;
    const deviceKey = newDeviceKey();
    const { data: member, error } = await supabase
      .from("session_members")
      .insert({ session_id: session.id, nickname, color, device_key: deviceKey })
      .select()
      .single();
    if (error || !member) return;
    setLocalIdentity(code, {
      memberId: member.id,
      nickname,
      color,
      deviceKey,
    });
    setMyMemberId(member.id);
    setMyColor(color);
    setMembers((prev) => [...prev, member as Member]);
    setNeedsNickname(false);
  }

  const viewingHighlight = highlights.find((h) => h.id === viewingHighlightId) ?? null;
  const viewingMember = viewingHighlight ? membersById[viewingHighlight.member_id] : null;
  const isPdfBook = (session?.epub_path ?? "").toLowerCase().endsWith(".pdf");

  if (loading) {
    return <CenteredMessage text="펼치는 중…" />;
  }
  if (loadError) {
    return <CenteredMessage text={loadError} />;
  }
  if (needsNickname) {
    return <NicknamePrompt bookTitle={session?.book_title ?? ""} onSubmit={handleNicknameJoin} />;
  }
  if (!session || !epubUrl || !myMemberId) {
    return <CenteredMessage text="불러오지 못했어요." />;
  }

  return (
    <div className="flex h-screen w-full flex-col-reverse sm:flex-row">
      <div className="relative flex-1 bg-paper">
        <button
          type="button"
          onClick={() => setShowRail((v) => !v)}
          className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-ink/10 bg-white/80 text-ink/50 shadow-note backdrop-blur transition hover:text-ink"
          aria-label={showRail ? "사이드바 숨기기" : "사이드바 보이기"}
          title={showRail ? "사이드바 숨기기" : "사이드바 보이기"}
        >
          {showRail ? "›" : "‹"}
        </button>

        {showSelectHint && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-4">
            <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-ink/10 bg-white/90 px-4 py-2 text-xs text-ink/60 shadow-note backdrop-blur">
              문장을 드래그해서 선택하면 밑줄・메모를 남길 수 있어요
              <button
                type="button"
                onClick={() => {
                  setShowSelectHint(false);
                  try {
                    window.localStorage.setItem(SELECT_HINT_KEY, "1");
                  } catch {
                    // ignore
                  }
                }}
                className="text-ink/30 transition hover:text-ink/60"
                aria-label="닫기"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {isPdfBook ? (
          <PdfReader
            pdfUrl={epubUrl}
            visibleHighlights={visibleHighlights}
            myColor={myColor}
            startCfi={myFurthestCfiRef.current}
            onReady={({ compareCfi }) => {
              compareCfiRef.current = compareCfi;
            }}
            onSelection={handleSelection}
            onLocationChange={handleLocationChange}
            onHighlightClick={(id) => setViewingHighlightId(id)}
          />
        ) : (
          <EpubReader
            epubUrl={epubUrl}
            visibleHighlights={visibleHighlights}
            myColor={myColor}
            startCfi={myFurthestCfiRef.current}
            onReady={({ compareCfi }) => {
              compareCfiRef.current = compareCfi;
            }}
            onSelection={handleSelection}
            onLocationChange={handleLocationChange}
            onHighlightClick={(id) => setViewingHighlightId(id)}
          />
        )}
      </div>

      {showRail && (
        <MemberRail
          bookTitle={session.book_title}
          code={session.code}
          members={members}
          progressByMember={progress}
          myMemberId={myMemberId}
          myColor={myColor}
          onColorChange={handleColorChange}
          noteFont={noteFont}
          onNoteFontChange={handleNoteFontChange}
        />
      )}

      {pendingSelection && !noteSheetOpen && pendingSelection.rect && (
        <SelectionToolbar
          rect={pendingSelection.rect}
          color={myColor}
          onClick={() => setNoteSheetOpen(true)}
        />
      )}

      {pendingSelection && noteSheetOpen && (
        <NoteSheet
          mode="create"
          quote={pendingSelection.text}
          myColor={myColor}
          noteFont={noteFont}
          onSave={saveHighlight}
          onCancel={() => {
            setPendingSelection(null);
            setNoteSheetOpen(false);
          }}
        />
      )}

      {viewingHighlight && viewingMember && (
        <NoteSheet
          mode="view"
          quote={viewingHighlight.selected_text}
          note={viewingHighlight.note}
          nickname={viewingMember.nickname}
          color={viewingHighlight.color}
          noteFont={noteFont}
          createdAt={viewingHighlight.created_at}
          isMine={viewingHighlight.member_id === myMemberId}
          onClose={() => setViewingHighlightId(null)}
          onDelete={
            viewingHighlight.member_id === myMemberId
              ? async () => {
                  await supabase.from("highlights").delete().eq("id", viewingHighlight.id);
                  setHighlights((prev) => prev.filter((h) => h.id !== viewingHighlight.id));
                  setViewingHighlightId(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function CenteredMessage({ text }: { text: string }) {
  return (
    <div className="flex h-screen items-center justify-center bg-paper px-6 text-center">
      <p className="text-sm text-ink/50">{text}</p>
    </div>
  );
}

function NicknamePrompt({
  bookTitle,
  onSubmit,
}: {
  bookTitle: string;
  onSubmit: (nickname: string, color: string) => void;
}) {
  const [nickname, setNickname] = useState("");
  const [color, setColor] = useState<string>(
    () => MEMBER_PALETTE[Math.floor(Math.random() * MEMBER_PALETTE.length)].hex
  );

  function submit() {
    if (nickname.trim()) onSubmit(nickname.trim(), color);
  }

  return (
    <div className="flex h-screen items-center justify-center bg-paper px-6">
      <div className="w-full max-w-sm rounded-2xl border border-ink/10 bg-white/60 p-6 text-center shadow-note">
        <p className="mb-1 text-[11px] uppercase tracking-[0.2em] text-clay/70">초대받았어요</p>
        <h1 className="mb-6 text-lg font-medium text-ink">{bookTitle}</h1>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="닉네임을 정해주세요"
          className="mb-4 w-full rounded-xl border border-ink/10 bg-white/70 px-4 py-2.5 text-center text-ink placeholder:text-ink/30 focus:outline-none focus:ring-2 focus:ring-clay/25"
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        <div className="mb-6 flex items-center justify-center gap-3">
          <label className="relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-full border border-ink/10 shadow-note">
            <span className="absolute inset-0" style={{ backgroundColor: color }} />
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="하이라이트 색 선택"
            />
          </label>
          <p className="text-xs text-ink/40">내 하이라이트 색</p>
        </div>
        <button
          onClick={submit}
          disabled={!nickname.trim()}
          className="w-full rounded-xl bg-clay px-4 py-3 text-sm font-medium text-paper transition hover:bg-clay/90 disabled:opacity-40"
        >
          같이 읽기 시작
        </button>
      </div>
    </div>
  );
}
