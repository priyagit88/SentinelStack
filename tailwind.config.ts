import type { Config } from "tailwindcss";

// Theme colors resolve to CSS variables (RGB triples) so the whole app can flip
// between dark (default) and light via prefers-color-scheme — see globals.css.
// The `<alpha-value>` placeholder keeps Tailwind opacity modifiers (e.g.
// bg-slate-950/80, ring-white/5) working.
const v = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        white: v("--c-white"),
        slate: {
          100: v("--c-slate-100"),
          200: v("--c-slate-200"),
          300: v("--c-slate-300"),
          400: v("--c-slate-400"),
          500: v("--c-slate-500"),
          600: v("--c-slate-600"),
          700: v("--c-slate-700"),
          800: v("--c-slate-800"),
          900: v("--c-slate-900"),
          950: v("--c-slate-950")
        },
        cyan: {
          100: v("--c-cyan-100"),
          200: v("--c-cyan-200"),
          300: v("--c-cyan-300"),
          400: v("--c-cyan-400"),
          500: v("--c-cyan-500")
        }
      },
      boxShadow: {
        glow: "0 0 24px rgba(34, 211, 238, 0.22)",
        danger: "0 0 30px rgba(248, 113, 113, 0.35)"
      }
    }
  },
  plugins: []
};

export default config;
