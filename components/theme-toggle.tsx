"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

type Theme = "system" | "light" | "dark";

const NEXT: Record<Theme, Theme> = {
  system: "light",
  light: "dark",
  dark: "system"
};

// Resolve a choice to the concrete theme written to <html data-theme>.
function resolve(choice: Theme): "light" | "dark" {
  if (choice === "light" || choice === "dark") return choice;
  return typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Cycles theme System → Light → Dark. The choice is stored in localStorage
 * ("system" = no entry) and resolved to a concrete <html data-theme> so the CSS
 * (and the no-flash boot script in app/layout.tsx) never needs a media query.
 * While on "system" we follow live OS theme changes.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem("theme") as Theme | null) ?? "system";
    setTheme(stored === "light" || stored === "dark" ? stored : "system");
    setMounted(true);

    // When following the system, react to OS light/dark changes live.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem("theme") ?? "system") === "system") {
        document.documentElement.setAttribute("data-theme", resolve("system"));
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    try {
      if (next === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", next);
    } catch {
      /* localStorage unavailable (private mode) — choice just won't persist */
    }
    document.documentElement.setAttribute("data-theme", resolve(next));
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
