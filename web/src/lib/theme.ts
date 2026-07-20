import type { ColorTheme, ThemeAccent, ThemeMode } from "@/types";

// Theme = mode x accent, stored as one "mode:accent" string. CSS derives the
// full palette from the accent seed via color-mix (see globals.css) — setting
// the two data attributes is the whole mechanism. A pre-paint boot script in
// app/layout.tsx applies the persisted value before first paint.

const MODES: readonly ThemeMode[] = ["system", "light", "dark"];
const ACCENTS: readonly ThemeAccent[] = [
  "ember",
  "rose",
  "marigold",
  "sage",
  "indigo",
  "violet",
];

/** Pre-v2 single-name themes map onto the nearest mode x accent pair. */
const LEGACY: Record<string, ColorTheme> = {
  system: "system:ember",
  cream: "light:ember",
  white: "light:indigo",
  pink: "light:rose",
  blue: "light:indigo",
  sage: "light:sage",
  lavender: "light:violet",
  black: "dark:ember",
  slate: "dark:indigo",
  plum: "dark:violet",
};

export function normalizeColorTheme(value: string | null | undefined): ColorTheme {
  if (!value) return "system:ember";
  if (LEGACY[value]) return LEGACY[value];
  const [mode, accent] = value.split(":");
  if (MODES.includes(mode as ThemeMode) && ACCENTS.includes(accent as ThemeAccent)) {
    return value as ColorTheme;
  }
  return "system:ember";
}

export function applyColorTheme(theme: ColorTheme | string) {
  if (typeof document === "undefined") return;
  const [mode, accent] = normalizeColorTheme(theme).split(":");
  const root = document.documentElement;
  root.setAttribute("data-mode", mode);
  root.setAttribute("data-accent", accent);
}
