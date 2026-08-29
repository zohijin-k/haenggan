import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // 개발 중 흔한 실수를 바로 알아챌 수 있도록 콘솔에만 경고.
  // (빌드/프리렌더 자체를 막지는 않도록 placeholder로 폴백 — 실제 호출은 당연히 실패함)
  if (typeof window !== "undefined") {
    // eslint-disable-next-line no-console
    console.warn(
      "[행간] Supabase 환경변수가 비어있어요. .env.local에 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY를 채워주세요."
    );
  }
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key"
);

export const BOOKS_BUCKET = "books";
