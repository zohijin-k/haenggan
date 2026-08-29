import type { Config } from "tailwindcss";
import { MEMBER_PALETTE } from "./lib/palette";

const memberColors = Object.fromEntries(
  MEMBER_PALETTE.map((c) => [c.name, c.hex])
) as Record<(typeof MEMBER_PALETTE)[number]["name"], string>;

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#FAFAFA",
        ink: "#18181B",
        danger: "#C0392B",
        // lib/palette.ts의 참여자 색상을 그대로 Tailwind 유틸리티로도 노출
        // (moss / clay / dusk / amber / teal / rose)
        ...memberColors,
      },
      fontFamily: {
        hand: ["var(--font-hand)", "cursive"],
        sans: ["var(--font-pretendard)", "Pretendard Variable", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        note: "0 6px 20px -8px rgba(43, 38, 32, 0.35)",
      },
      keyframes: {
        reveal: {
          "0%": { opacity: "0", transform: "translateY(6px) rotate(-2deg)", clipPath: "inset(0 100% 0 0)" },
          "60%": { opacity: "1", transform: "translateY(0) rotate(-1deg)" },
          "100%": { opacity: "1", transform: "translateY(0) rotate(-1deg)", clipPath: "inset(0 0 0 0)" },
        },
        inkSpread: {
          "0%": { opacity: "0", filter: "blur(2px)" },
          "100%": { opacity: "1", filter: "blur(0)" },
        },
      },
      animation: {
        reveal: "reveal 700ms cubic-bezier(0.22,1,0.36,1) forwards",
        inkSpread: "inkSpread 500ms ease-out forwards",
      },
    },
  },
  plugins: [],
};

export default config;
