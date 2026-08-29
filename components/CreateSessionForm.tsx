"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase, BOOKS_BUCKET } from "@/lib/supabase";
import { extractEpubMeta } from "@/lib/epubMeta";
import { extractPdfPreview } from "@/lib/pdfjs";
import { generateSessionCode } from "@/lib/sessionCode";
import { MEMBER_PALETTE } from "@/lib/palette";
import { newDeviceKey, setLocalIdentity } from "@/lib/identity";

type Step = "idle" | "reading" | "uploading" | "error";

function extForMime(mime: string) {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("gif")) return "gif";
  return "jpg";
}

async function blobUrlToFile(blobUrl: string, filename: string): Promise<File> {
  const res = await fetch(blobUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}

export default function CreateSessionForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [nickname, setNickname] = useState("");
  const [color, setColor] = useState<string>(MEMBER_PALETTE[0].hex);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setCoverPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  async function handleFile(f: File) {
    setError(null);
    const isPdf = /\.pdf$/i.test(f.name) || f.type === "application/pdf";
    const isEpub = /\.epub$/i.test(f.name) || f.type === "application/epub+zip";

    if (!isPdf && !isEpub) {
      setError("EPUB 또는 PDF 파일만 올릴 수 있어요.");
      return;
    }

    setStep("reading");

    if (isEpub) {
      try {
        const meta = await extractEpubMeta(f);
        setFile(f);
        setTitle(meta.title);
        setAuthor(meta.author);
        if (meta.coverUrl) {
          try {
            setCoverFile(await blobUrlToFile(meta.coverUrl, "cover.jpg"));
          } catch {
            setCoverFile(null);
          }
        } else {
          setCoverFile(null);
        }
      } catch (e) {
        console.error(e);
        setFile(f);
        setTitle(f.name.replace(/\.epub$/i, ""));
        setCoverFile(null);
      } finally {
        setStep("idle");
      }
      return;
    }

    // PDF는 변환 없이 그대로 올린다. 제목/저자/표지 썸네일만 미리 뽑아서 보여준다.
    try {
      const preview = await extractPdfPreview(f);
      setFile(f);
      setTitle(preview.title);
      setAuthor(preview.author);
      setCoverFile(preview.coverFile);
    } catch (e) {
      console.error(e);
      setFile(f);
      setTitle(f.name.replace(/\.pdf$/i, ""));
      setCoverFile(null);
    } finally {
      setStep("idle");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !nickname.trim()) return;
    setStep("uploading");
    setError(null);

    try {
      const isPdfFile = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
      const code = generateSessionCode();
      const bookPath = `${code}/book.${isPdfFile ? "pdf" : "epub"}`;

      const { error: uploadError } = await supabase.storage
        .from(BOOKS_BUCKET)
        .upload(bookPath, file, {
          contentType: isPdfFile ? "application/pdf" : "application/epub+zip",
        });
      if (uploadError) throw uploadError;

      let uploadedCoverUrl: string | null = null;
      if (coverFile) {
        const coverPath = `${code}/cover.${extForMime(coverFile.type)}`;
        const { error: coverError } = await supabase.storage
          .from(BOOKS_BUCKET)
          .upload(coverPath, coverFile, { contentType: coverFile.type || "image/jpeg" });
        if (!coverError) {
          const { data: coverUrlData } = supabase.storage.from(BOOKS_BUCKET).getPublicUrl(coverPath);
          uploadedCoverUrl = coverUrlData.publicUrl;
        }
      }

      const finalTitle = title.trim() || file.name.replace(/\.(epub|pdf)$/i, "");

      const { data: session, error: sessionError } = await supabase
        .from("sessions")
        .insert({
          code,
          book_title: finalTitle,
          book_author: author.trim() || null,
          epub_path: bookPath,
          cover_url: uploadedCoverUrl,
          created_by: nickname.trim(),
        })
        .select()
        .single();
      if (sessionError) throw sessionError;

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

  const busy = step === "reading" || step === "uploading";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm text-ink/60 mb-1.5">내 닉네임</label>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="닉네임을 입력해주세요"
          className="w-full rounded-xl border border-ink/10 bg-white/70 px-4 py-2.5 text-ink placeholder:text-ink/30 focus:outline-none focus:ring-2 focus:ring-moss/25"
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

      <div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full items-center gap-4 rounded-xl border border-dashed border-ink/20 bg-white/50 px-4 py-4 text-left transition hover:border-moss/40 hover:bg-white/70"
        >
          {coverPreviewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverPreviewUrl}
              alt=""
              className="h-16 w-11 rounded-sm object-cover shadow-note"
            />
          ) : (
            <div className="flex h-16 w-11 items-center justify-center rounded-sm bg-moss/10 text-moss/60 text-xs">
              책
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm text-ink">
              {file ? title || file.name : "함께 읽을 책을 올려주세요"}
            </p>
            {author && <p className="truncate text-xs text-ink/50">{author}</p>}
            {step === "reading" && (
              <p className="text-xs text-ink/45">책 정보를 읽는 중…</p>
            )}
          </div>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".epub,application/epub+zip,.pdf,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>

      {file && (
        <div className="space-y-3 rounded-xl border border-ink/10 bg-white/40 p-4">
          <div>
            <label className="block text-sm text-ink/60 mb-1.5">책 제목</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="책 제목"
              className="w-full rounded-xl border border-ink/10 bg-white/70 px-4 py-2.5 text-ink placeholder:text-ink/30 focus:outline-none focus:ring-2 focus:ring-moss/25"
            />
          </div>
          <div>
            <label className="block text-sm text-ink/60 mb-1.5">저자</label>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="저자 (선택)"
              className="w-full rounded-xl border border-ink/10 bg-white/70 px-4 py-2.5 text-ink placeholder:text-ink/30 focus:outline-none focus:ring-2 focus:ring-moss/25"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              className="text-xs text-moss/80 underline decoration-moss/30 underline-offset-4 hover:text-moss"
            >
              표지 직접 올리기
            </button>
            {coverFile && (
              <button
                type="button"
                onClick={() => setCoverFile(null)}
                className="text-xs text-ink/30 hover:text-danger"
              >
                표지 지우기
              </button>
            )}
          </div>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setCoverFile(f);
            }}
          />
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={!file || !nickname.trim() || busy}
        className="w-full rounded-xl bg-moss px-4 py-3 text-sm font-medium text-paper transition hover:bg-moss/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {step === "uploading" ? "만드는 중…" : "행간 시작하기"}
      </button>
    </form>
  );
}
