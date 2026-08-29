"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { MEMBER_PALETTE } from "@/lib/palette";
import { newDeviceKey, setLocalIdentity } from "@/lib/identity";

export default function JoinSessionForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [color, setColor] = useState<string>(
    () => MEMBER_PALETTE[Math.floor(Math.random() * MEMBER_PALETTE.length)].hex
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const normalizedCode = code.trim().toUpperCase();
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
    </form>
  );
}
