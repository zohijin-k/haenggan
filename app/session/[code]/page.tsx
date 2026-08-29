"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase, BOOKS_BUCKET } from "@/lib/supabase";
import { getLocalIdentity, newDeviceKey, setLocalIdentity } from "@/lib/identity";
import { pickNextColor } from "@/lib/palette";
import type { Highlight, Member, ReadingProgress, Session } from "@/lib/types";
import EpubReader from "@/components/EpubReader";
import NoteSheet from "@/components/NoteSheet";
import MemberRail from "@/components/MemberRail";

type PendingSelection = {
  cfiRange: string;
  text: string;
  chapterHref: string | null;
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

  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);
  const [viewingHighlightId, setViewingHighlightId] = useState<string | null>(null);

  const compareCfiRef = useRef<((a: string, b: string) => number) | null>(null);
  const myFurthestCfiRef = useRef<string | null>(null);
  const progressSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  }, []);

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
  }

  async function handleNicknameJoin(nickname: string) {
    if (!session) return;
    const usedColors = members.map((m) => m.color);
    const color = pickNextColor(usedColors);
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
        <EpubReader
          epubUrl={epubUrl}
          visibleHighlights={visibleHighlights}
          startCfi={myFurthestCfiRef.current}
          onReady={({ compareCfi }) => {
            compareCfiRef.current = compareCfi;
          }}
          onSelection={handleSelection}
          onLocationChange={handleLocationChange}
          onHighlightClick={(id) => setViewingHighlightId(id)}
        />
      </div>

      <MemberRail
        bookTitle={session.book_title}
        code={session.code}
        members={members}
        progressByMember={progress}
        myMemberId={myMemberId}
      />

      {pendingSelection && (
        <NoteSheet
          mode="create"
          quote={pendingSelection.text}
          myColor={myColor}
          onSave={saveHighlight}
          onCancel={() => setPendingSelection(null)}
        />
      )}

      {viewingHighlight && viewingMember && (
        <NoteSheet
          mode="view"
          quote={viewingHighlight.selected_text}
          note={viewingHighlight.note}
          nickname={viewingMember.nickname}
          color={viewingHighlight.color}
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
  onSubmit: (nickname: string) => void;
}) {
  const [nickname, setNickname] = useState("");
  return (
    <div className="flex h-screen items-center justify-center bg-paper px-6">
      <div className="w-full max-w-sm rounded-2xl border border-ink/10 bg-white/60 p-6 text-center shadow-note">
        <p className="mb-1 font-hand text-lg text-clay">초대받았어요</p>
        <h1 className="mb-6 text-lg font-medium text-ink">{bookTitle}</h1>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="닉네임을 정해주세요"
          className="mb-4 w-full rounded-xl border border-ink/10 bg-white/70 px-4 py-2.5 text-center text-ink placeholder:text-ink/30 focus:outline-none focus:ring-2 focus:ring-clay/40"
          onKeyDown={(e) => {
            if (e.key === "Enter" && nickname.trim()) onSubmit(nickname.trim());
          }}
        />
        <button
          onClick={() => nickname.trim() && onSubmit(nickname.trim())}
          disabled={!nickname.trim()}
          className="w-full rounded-xl bg-ink px-4 py-3 text-sm font-medium text-paper disabled:opacity-40"
        >
          같이 읽기 시작
        </button>
      </div>
    </div>
  );
}
