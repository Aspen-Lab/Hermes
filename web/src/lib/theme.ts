"use client";

import type { ColorTheme } from "@/types";

type ThemeVars = Record<string, string>;

const themeVars: Record<Exclude<ColorTheme, "system">, ThemeVars> = {
  cream: {
    "--color-bg": "#faf5e8",
    "--color-bg-secondary": "#f1e8d0",
    "--color-surface": "#ffffff",
    "--color-surface-hover": "#fffcf2",
    "--color-border": "rgba(20, 20, 20, 0.07)",
    "--color-border-strong": "rgba(20, 20, 20, 0.14)",
    "--color-heading": "#141414",
    "--color-text": "#2a2620",
    "--color-text-muted": "#5c564c",
    "--color-text-faint": "#8a8275",
    "--color-accent": "#f58414",
    "--color-accent-dim": "rgba(245, 132, 20, 0.10)",
    "--color-link": "#7a4412",
    "--color-link-dim": "rgba(122, 68, 18, 0.09)",
    "--color-tag": "#c2630e",
    "--color-tag-dim": "rgba(194, 99, 14, 0.09)",
    "--color-peach": "#d97a30",
    "--color-peach-dim": "rgba(217, 122, 48, 0.10)",
    "--color-yellow": "#a76a10",
    "--color-yellow-dim": "rgba(167, 106, 16, 0.10)",
    "--color-red": "#b91c1c",
  },
  white: {
    "--color-bg": "#f8fafc",
    "--color-bg-secondary": "#eef2f7",
    "--color-surface": "#ffffff",
    "--color-surface-hover": "#f8fbff",
    "--color-border": "rgba(15, 23, 42, 0.08)",
    "--color-border-strong": "rgba(15, 23, 42, 0.16)",
    "--color-heading": "#0f172a",
    "--color-text": "#1e293b",
    "--color-text-muted": "#475569",
    "--color-text-faint": "#7c8aa0",
    "--color-accent": "#2563eb",
    "--color-accent-dim": "rgba(37, 99, 235, 0.10)",
    "--color-link": "#1d4ed8",
    "--color-link-dim": "rgba(29, 78, 216, 0.10)",
    "--color-tag": "#0f766e",
    "--color-tag-dim": "rgba(15, 118, 110, 0.10)",
    "--color-peach": "#db2777",
    "--color-peach-dim": "rgba(219, 39, 119, 0.10)",
    "--color-yellow": "#a16207",
    "--color-yellow-dim": "rgba(161, 98, 7, 0.10)",
    "--color-red": "#b91c1c",
  },
  black: {
    "--color-bg": "#09090b",
    "--color-bg-secondary": "#111217",
    "--color-surface": "#16181d",
    "--color-surface-hover": "#1c2027",
    "--color-border": "rgba(255, 255, 255, 0.08)",
    "--color-border-strong": "rgba(255, 255, 255, 0.16)",
    "--color-heading": "#f8fafc",
    "--color-text": "#e5e7eb",
    "--color-text-muted": "#b4bbc7",
    "--color-text-faint": "#8f98a8",
    "--color-accent": "#f59e0b",
    "--color-accent-dim": "rgba(245, 158, 11, 0.14)",
    "--color-link": "#7dd3fc",
    "--color-link-dim": "rgba(125, 211, 252, 0.12)",
    "--color-tag": "#34d399",
    "--color-tag-dim": "rgba(52, 211, 153, 0.12)",
    "--color-peach": "#f472b6",
    "--color-peach-dim": "rgba(244, 114, 182, 0.12)",
    "--color-yellow": "#facc15",
    "--color-yellow-dim": "rgba(250, 204, 21, 0.12)",
    "--color-red": "#ef4444",
  },
  pink: {
    "--color-bg": "#fff3f8",
    "--color-bg-secondary": "#ffe5f0",
    "--color-surface": "#ffffff",
    "--color-surface-hover": "#fff8fb",
    "--color-border": "rgba(131, 24, 67, 0.08)",
    "--color-border-strong": "rgba(131, 24, 67, 0.15)",
    "--color-heading": "#4a1530",
    "--color-text": "#6b2148",
    "--color-text-muted": "#8a4466",
    "--color-text-faint": "#ad6f8c",
    "--color-accent": "#ec4899",
    "--color-accent-dim": "rgba(236, 72, 153, 0.12)",
    "--color-link": "#be185d",
    "--color-link-dim": "rgba(190, 24, 93, 0.10)",
    "--color-tag": "#db2777",
    "--color-tag-dim": "rgba(219, 39, 119, 0.10)",
    "--color-peach": "#fb7185",
    "--color-peach-dim": "rgba(251, 113, 133, 0.10)",
    "--color-yellow": "#c2410c",
    "--color-yellow-dim": "rgba(194, 65, 12, 0.10)",
    "--color-red": "#be123c",
  },
  blue: {
    "--color-bg": "#eff6ff",
    "--color-bg-secondary": "#dbeafe",
    "--color-surface": "#ffffff",
    "--color-surface-hover": "#f7fbff",
    "--color-border": "rgba(30, 64, 175, 0.08)",
    "--color-border-strong": "rgba(30, 64, 175, 0.15)",
    "--color-heading": "#0f2747",
    "--color-text": "#16345d",
    "--color-text-muted": "#42658e",
    "--color-text-faint": "#708cb1",
    "--color-accent": "#2563eb",
    "--color-accent-dim": "rgba(37, 99, 235, 0.11)",
    "--color-link": "#1d4ed8",
    "--color-link-dim": "rgba(29, 78, 216, 0.10)",
    "--color-tag": "#0f766e",
    "--color-tag-dim": "rgba(15, 118, 110, 0.10)",
    "--color-peach": "#7c3aed",
    "--color-peach-dim": "rgba(124, 58, 237, 0.10)",
    "--color-yellow": "#ca8a04",
    "--color-yellow-dim": "rgba(202, 138, 4, 0.10)",
    "--color-red": "#dc2626",
  },
};

function clearThemeOverrides(root: HTMLElement) {
  for (const vars of Object.values(themeVars)) {
    for (const key of Object.keys(vars)) {
      root.style.removeProperty(key);
    }
  }
}

export function applyColorTheme(theme: ColorTheme) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.setAttribute("data-color-theme", theme);
  clearThemeOverrides(root);

  if (theme === "system") return;

  const vars = themeVars[theme];
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}
