import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#faf7f2",
        ink: "#2b2620",
        moss: "#5c6b4f",
        clay: "#b6674a",
        sand: "#e7ddc9",
      },
      fontFamily: {
        hand: ["var(--font-hand)", "cursive"],
        serifKr: ["var(--font-serif-kr)", "serif"],
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
