// 읽기 폰트 개인 취향. 계정이 없는 서비스라 기기(브라우저)별로 localStorage에만
// 저장하고, 모든 행간 세션에 공통으로 적용한다(책마다 다르게 할 이유가 없어서).
export type ReaderFont = "gothic" | "serif";

const FONT_KEY = "haenggan:pref:font";

export const FONT_OPTIONS: { value: ReaderFont; label: string }[] = [
  { value: "gothic", label: "고딕" },
  { value: "serif", label: "명조" },
];

export function fontStack(font: ReaderFont): string {
  return font === "serif"
    ? `"Noto Serif KR", "Nanum Myeongjo", "Batang", "Apple SD Gothic Neo", serif`
    : `"Pretendard Variable", "Pretendard", -apple-system, BlinkMacSystemFont, sans-serif`;
}

export function getReaderFont(): ReaderFont {
  if (typeof window === "undefined") return "gothic";
  try {
    return window.localStorage.getItem(FONT_KEY) === "serif" ? "serif" : "gothic";
  } catch {
    return "gothic";
  }
}

export function setReaderFont(font: ReaderFont) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FONT_KEY, font);
  } catch {
    // 저장 실패해도 읽기 자체엔 지장 없음 (이번 세션 동안만 적용됨)
  }
}
