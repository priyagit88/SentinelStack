"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

type Theme = "system" | "light" | "dark";

const NEXT: Record<Theme, Theme> = {
  system: "light",
  light: "dark",
  dark: "system"
};

/**
 * Cycles theme System → Light → Dark. "system" follows the device
 * prefers-color-scheme (no data-theme attribute); light/dark force the choice
 * via <html data-theme> and persist it in localStorage. The matching no-flash
 * init script lives in app/layout.tsx.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem("theme") as Theme | null) ?? "system";
    setTheme(stored === "light" || stored === "dark" ? stored : "system");
    setMounted(true);
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    try {
      if (next === "system") {
        localStorage.removeItem("theme");
        document.documentElement.removeAttribute("data-theme");
      } else {
        localStorage.setItem("theme", next);
        document.documentElement.setAttribute("data-theme", next);
      }
    } catch {
      /* localStorage unavailable (private mode) — choice just won't persist */
    }
  }

  const label =
    theme === "system" ? "System theme" : theme === "light" ? "Light theme" : "Dark theme";
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;

  return (
    <button
      type="button"
      onClick={() => apply(NEXT[theme])}
      aria-label={`Theme: ${label}. Click to change.`}
      title={`${label} — click to change`}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-cyan-300 ring-1 ring-inset ring-white/10 transition-colors hover:bg-slate-700 hover:text-cyan-200"
    >
      {/* Avoid hydration mismatch: render a stable icon until mounted */}
      {mounted ? <Icon className="h-[18px] w-[18px]" /> : <Monitor className="h-[18px] w-[18px]" />}
    </button>
  );
}
