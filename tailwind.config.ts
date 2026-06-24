import type { Config } from "tailwindcss";

// Theme colors resolve to CSS variables (RGB triples) so the whole app can flip
// between dark (default) and light via the [data-theme] attribute — see
// globals.css. The `<alpha-value>` placeholder keeps Tailwind opacity modifiers
// (e.g. bg-slate-950/80, ring-white/5, text-red-400) working.
const v = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

// Build a color scale object for the given shades, each pointing at a var.
const scale = (color: string, shades: number[]) =>
  Object.fromEntries(shades.map((s) => [s, v(`--c-${color}-${s}`)]));

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        white: v("--c-white"),
        slate: scale("slate", [100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
        cyan: scale("cyan", [100, 200, 300, 400, 500]),
        // Status hues: only the shades used as *text* are tokenized so they can
        // be darkened for light mode. Their /opacity background + ring usages
        // keep Tailwind's defaults (light tints read fine on a light surface).
        red: scale("red", [200, 300, 400]),
        emerald: scale("emerald", [200, 400]),
        green: scale("green", [300, 400]),
        amber: scale("amber", [200, 300, 400]),
        purple: scale("purple", [100, 400]),
        violet: scale("violet", [300, 400]),
        yellow: scale("yellow", [200, 400]),
        orange: scale("orange", [300, 400])
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
