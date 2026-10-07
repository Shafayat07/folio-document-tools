import type { Config } from "tailwindcss";

/**
 * Design tokens for a professional document utility.
 * Neutral surfaces, ink typography, a single restrained accent (document red).
 * Deliberately no gradients, no glow, no neon.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F5F6F7",
        surface: "#FFFFFF",
        subtle: "#FAFAFB",
        line: {
          DEFAULT: "#E2E4E7",
          strong: "#CDD0D5",
        },
        ink: {
          DEFAULT: "#16181D",
          700: "#2A2D33",
          500: "#5A6069",
          400: "#7B8189",
          300: "#A2A8B0",
        },
        accent: {
          DEFAULT: "#C2342A",
          hover: "#A82B22",
          soft: "#FDF2F1",
          line: "#F0C9C5",
        },
        danger: {
          DEFAULT: "#B42318",
          soft: "#FEF3F2",
        },
        success: {
          DEFAULT: "#1A7F4B",
          soft: "#F0FAF4",
        },
        warn: {
          DEFAULT: "#B54708",
          soft: "#FFFAEB",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Consolas", "Liberation Mono", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      borderRadius: {
        DEFAULT: "4px",
        md: "5px",
        lg: "6px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.04)",
        raised: "0 1px 3px rgba(16, 24, 40, 0.08), 0 1px 2px rgba(16, 24, 40, 0.04)",
        pop: "0 8px 24px rgba(16, 24, 40, 0.12), 0 2px 6px rgba(16, 24, 40, 0.06)",
        bar: "0 -1px 3px rgba(16, 24, 40, 0.06)",
      },
      transitionDuration: {
        120: "120ms",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "pop-in": {
          from: { opacity: "0", transform: "translateY(4px) scale(0.99)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "sheet-up": {
          from: { transform: "translateY(8px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        indeterminate: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(400%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 120ms ease-out",
        "pop-in": "pop-in 140ms ease-out",
        "sheet-up": "sheet-up 160ms ease-out",
        indeterminate: "indeterminate 1.1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
