"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { supabase, BOOKS_BUCKET } from "@/lib/supabase";
import { extractEpubMeta } from "@/lib/epubMeta";
import { generateSessionCode } from "@/lib/sessionCode";
import { MEMBER_PALETTE } from "@/lib/palette";
import { newDeviceKey, setLocalIdentity } from "@/lib/identity";

type Step = "idle" | "reading" | "uploading" | "error";

export default function CreateSessionForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [nickname, setNickname] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleFile(f: File) {
    setFile(f);
    setStep("reading");
    setError(null);
    try {
      const meta = await extractEpubMeta(f);
      setTitle(meta.title);
      setAuthor(meta.author);
      setCoverUrl(meta.coverUrl);
      setStep("idle");
    } catch (e) {
      console.error(e);
      setStep("idle");
      setTitle(f.name.replace(/\.epub$/i, ""));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !nickname.trim()) return;
    setStep("uploading");
    setError(null);

    try {
      const code = generateSessionCode();
      const epubPath = `${code}/book.epub`;

      const { error: uploadError } = await supabase.storage
        .from(BOOKS_BUCKET)
        .upload(epubPath, file, { contentType: "application/epub+zip" });
      if (uploadError) throw uploadError;

      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .insert({
          code,
          book_title: title || file.name,
          book_author: author || null,
          epub_path: epubPath,
          cover_url: coverUrl ?? null,
          created_by: nickname.trim(),
        })
        .select()
        .single();
      if (sessionError) throw sessionError;

      const color = MEMBER_PALETTE[0].hex;
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
      if (memberError) throw memberError;

      setLocalIdentity(code, {
        memberId: member.id,
        nickname: nickname.trim(),
        color,
        deviceKey,
      });

      router.push(`/session/${code}`);
    } catch (err) {
      console.error(err);
      setError(
        "세션을 만들지 못했어요. .env.local의 Supabase 설정과 'books' 스토리지 버킷을 확인해주세요."
      );
      setStep("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm text-ink/60 mb-1.5">내 닉네임</label>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="예: 지니"
          className="w-full rounded-xl border border-ink/10 bg-white/70 px-4 py-2.5 text-ink placeholder:text-ink/30 focus:outline-none focus:ring-2 focus:ring-clay/40"
          required
        />
      </div>

      <div>
        <label className="block text-sm text-ink/60 mb-1.5">
          EPUB 파일 (DRM 없는 파일)
        </label>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full items-center gap-4 rounded-xl border border-dashed border-ink/20 bg-white/50 px-4 py-4 text-left transition hover:border-clay/40 hover:bg-white/70"
        >
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverUrl}
              alt=""
              className="h-16 w-11 rounded-sm object-cover shadow-note"
            />
          ) : (
            <div className="flex h-16 w-11 items-center justify-center rounded-sm bg-sand text-ink/30 text-xs">
              EPUB
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm text-ink">
              {file ? title || file.name : "여기를 눌러 EPUB 선택"}
            </p>
            {author && <p className="truncate text-xs text-ink/50">{author}</p>}
            {step === "reading" && (
              <p className="text-xs text-clay">책 정보를 읽는 중…</p>
            )}
          </div>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".epub,application/epub+zip"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>

      {error && <p className="text-sm text-clay">{error}</p>}

      <button
        type="submit"
        disabled={!file || !nickname.trim() || step === "uploading" || step === "reading"}
        className="w-full rounded-xl bg-ink px-4 py-3 text-sm font-medium text-paper transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {step === "uploading" ? "만드는 중…" : "행간 시작하기"}
      </button>
    </form>
  );
}
