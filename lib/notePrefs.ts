// 메모(손글씨) 폰트 개인 취향. 계정이 없는 서비스라 기기(브라우저)별로
// localStorage에만 저장하고, 모든 행간 세션에 공통으로 적용한다.
// (읽기 폰트는 작품 원본 조판을 살리려 따로 두지 않고, 사용자가 고를 수 있는 건
//  자기 메모가 화면에 찍히는 서체다.)
export type NoteFont = "gaegu" | "nanum-pen" | "gowun";

const NOTE_FONT_KEY = "haenggan:pref:note-font";

export const NOTE_FONT_OPTIONS: { value: NoteFont; label: string }[] = [
  { value: "gaegu", label: "동글" },
  { value: "nanum-pen", label: "펜글씨" },
  { value: "gowun", label: "또박" },
];

export function noteFontStack(font: NoteFont): string {
  switch (font) {
    case "nanum-pen":
      return `"Nanum Pen Script", "Gaegu", cursive`;
    case "gowun":
      return `"Gowun Dodum", "Pretendard Variable", "Pretendard", sans-serif`;
    default:
      return `"Gaegu", "Nanum Pen Script", cursive`;
  }
}

export function getNoteFont(): NoteFont {
  if (typeof window === "undefined") return "gaegu";
  try {
    const saved = window.localStorage.getItem(NOTE_FONT_KEY);
    return NOTE_FONT_OPTIONS.some((o) => o.value === saved) ? (saved as NoteFont) : "gaegu";
  } catch {
    return "gaegu";
  }
}

export function setNoteFont(font: NoteFont) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NOTE_FONT_KEY, font);
  } catch {
    // 저장 실패해도 이번 세션 동안엔 적용되니 무시
  }
}
