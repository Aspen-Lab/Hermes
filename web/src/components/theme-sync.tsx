"use client";

import { useEffect } from "react";
import { applyColorTheme } from "@/lib/theme";
import { useProfileStore } from "@/store/profile";

export function ThemeSync() {
  const colorTheme = useProfileStore((s) => s.profile.colorTheme);

  useEffect(() => {
    applyColorTheme(colorTheme);
  }, [colorTheme]);

  return null;
}
