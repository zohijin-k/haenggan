"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { MEMBER_PALETTE } from "@/lib/palette";
import { getLocalIdentity, newDeviceKey, setLocalIdentity } from "@/lib/identity";

export default function JoinSessionForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  // 서버/클라이언트 렌더가 어긋나지 않게 초기값은 고정하고, 마운트 후 랜덤으로 바꾼다.
  const [color, setColor] = useState<string>(MEMBER_PALETTE[0].hex);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setColor(MEMBER_PALETTE[Math.floor(Math.random() * MEMBER_PALETTE.length)].hex);
  }, []);

  // 이 브라우저가 이미 그 행간에 다른 신원으로 들어가 있으면, 그냥 참여시키면
  // 그 신원이 덮어써진다(= 원래 사람의 흔적이 이 브라우저에서 안 보이게 됨).
  // 그래서 먼저 알려주고 "이어 읽기 / 다른 사람으로" 를 고르게 한다.
  const [existingNick, setExistingNick] = useState<string | null>(null);
  const [asNewPerson, setAsNewPerson] = useState(false);

  useEffect(() => {
    const c = code.trim().toUpperCase();
    const id = c.length >= 4 ? getLocalIdentity(c) : null;
    setExistingNick(id?.nickname ?? null);
    setAsNewPerson(false);
  }, [code]);

  const normalizedCode = code.trim().toUpperCase();
  const showConflictGate = existingNick && !asNewPerson;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || !nickname.trim()) return;

    if (!isSupabaseConfigured) {
      setError(
        "Supabase 환경변수가 비어 있어요. Vercel Project Settings → Environment Variables에 " +
          "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 를 넣고 다시 배포해주세요."
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .select("id")
        .eq("code", normalizedCode)
        .single();
      if (sessionError || !session) {
        setError("그 코드로 만들어진 행간을 찾지 못했어요.");
        setLoading(false);
        return;
      }

      const deviceKey = newDeviceKey();

      const { data: member, error: memberError } = await supabase
        .from("session_members")
        .insert({
          session_id: session.id,
          nickname: nickname.trim(),
          color,
          device_key: deviceKey,
        })
        .select()
        .single();

      if (memberError) {
        setError("이미 같은 닉네임이 이 세션에 있어요. 다른 닉네임을 써주세요.");
        setLoading(false);
        return;
      }

      setLocalIdentity(normalizedCode, {
        memberId: member.id,
        nickname: nickname.trim(),
        color,
        deviceKey,
      });

      router.push(`/session/${normalizedCode}`);
    } catch (err) {
      console.error(err);
      setError("참여하지 못했어요. 잠시 후 다시 시도해줘.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm text-ink/60 mb-1.5">초대 코드</label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="예: 3F7K9Q"
          className="w-full rounded-xl border border-ink/10 bg-white/70 px-4 py-2.5 tracking-widest text-ink placeholder:text-ink/30 placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-clay/25"
          required
        />
      </div>

      {showConflictGate ? (
        <div className="space-y-3 rounded-xl border border-clay/25 bg-clay/5 p-4">
          <p className="text-sm leading-relaxed text-ink/70">
            이 브라우저는 이미 <b className="text-ink">{existingNick}</b>으로 이 행간에
            들어가 있어요.
          </p>
          <button
            type="button"
            onClick={() => router.push(`/session/${normalizedCode}`)}
            className="w-full rounded-xl bg-clay px-4 py-3 text-sm font-medium text-paper transition hover:bg-clay/90"
          >
            {existingNick}으로 이어 읽기
          </button>
          <button
            type="button"
            onClick={() => setAsNewPerson(true)}
            className="w-full text-center text-xs text-ink/40 underline-offset-2 hover:text-ink/60 hover:underline"
          >
            이 브라우저에서 다른 사람으로 참여하기
          </button>
        </div>
      ) : (
        <>
          {existingNick && asNewPerson && (
            <p className="rounded-lg bg-clay/5 px-3 py-2 text-[11px] leading-relaxed text-clay/80">
              계속하면 이 브라우저에서 &lsquo;{existingNick}&rsquo;의 흔적은 안 보이게 돼요.
              (서버엔 그대로 남아 있어요)
            </p>
          )}

          <div>
            <label className="block text-sm text-ink/60 mb-1.5">내 닉네임</label>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="닉네임을 입력해주세요"
              className="w-full rounded-xl border border-ink/10 bg-white/70 px-4 py-2.5 text-ink placeholder:text-ink/30 focus:outline-none focus:ring-2 focus:ring-clay/25"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-ink/60 mb-1.5">내 하이라이트 색</label>
            <div className="flex items-center gap-3">
              <label className="relative h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-full border border-ink/10 shadow-note">
                <span className="absolute inset-0" style={{ backgroundColor: color }} />
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  aria-label="하이라이트 색 선택"
                />
              </label>
              <p className="text-xs leading-relaxed text-ink/40">
                앞으로 이 행간 안에서는 이 색이 계속 내 밑줄·손글씨 색이 돼요
              </p>
            </div>
          </div>

          {error && <p className="whitespace-pre-line text-sm text-danger">{error}</p>}

          <button
            type="submit"
            disabled={!code.trim() || !nickname.trim() || loading}
            className="w-full rounded-xl border border-clay/30 bg-white/60 px-4 py-3 text-sm font-medium text-clay transition hover:bg-clay/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "들어가는 중…" : "코드로 참여하기"}
          </button>
        </>
      )}
    </form>
  );
}
