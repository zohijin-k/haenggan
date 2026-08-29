import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

// 배포 환경(예: Vercel)에서 환경변수를 안 넣으면 아래 placeholder로 폴백되는데,
// 그러면 모든 호출이 "세션을 만들지 못했어요"로 뭉뚱그려져 원인 파악이 어렵다.
// 이 플래그로 UI에서 "환경변수부터 넣어라"라고 콕 집어 안내한다.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!supabaseUrl || !supabaseAnonKey) {
  // 개발 중 흔한 실수를 바로 알아챌 수 있도록 콘솔에만 경고.
  // (빌드/프리렌더 자체를 막지는 않도록 placeholder로 폴백 — 실제 호출은 당연히 실패함)
  if (typeof window !== "undefined") {
    // eslint-disable-next-line no-console
    console.warn(
      "[행간] Supabase 환경변수가 비어있어요. 로컬은 .env.local에, Vercel은 Project Settings → Environment Variables에 " +
        "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 를 넣고 다시 배포해주세요."
    );
  }
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key"
);

export const BOOKS_BUCKET = "books";
