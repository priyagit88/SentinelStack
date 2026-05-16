import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        glow: "0 0 24px rgba(34, 211, 238, 0.22)",
        danger: "0 0 30px rgba(248, 113, 113, 0.35)"
      }
    }
  },
  plugins: []
};

export default config;
