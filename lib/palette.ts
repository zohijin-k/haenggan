// 참여자별 형광펜/손글씨 색. 감성적이되 채도를 낮춰 종이 위 손글씨 느낌을 유지.
export const MEMBER_PALETTE = [
  { name: "moss", hex: "#5c6b4f" },
  { name: "clay", hex: "#b6674a" },
  { name: "dusk", hex: "#6b5b7b" },
  { name: "amber", hex: "#c99a3e" },
  { name: "teal", hex: "#3f7d75" },
  { name: "rose", hex: "#b05a6b" },
] as const;

export function colorForIndex(i: number) {
  return MEMBER_PALETTE[i % MEMBER_PALETTE.length].hex;
}

export function pickNextColor(usedColors: string[]) {
  const free = MEMBER_PALETTE.find((c) => !usedColors.includes(c.hex));
  return (free ?? MEMBER_PALETTE[usedColors.length % MEMBER_PALETTE.length]).hex;
}
