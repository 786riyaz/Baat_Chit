"use client";

import { useTheme } from "../../hooks/useTheme";

export default function ThemeToggle({ className }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      type="button"
      className={className || "icon-btn"}
      onClick={toggleTheme}
      title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      aria-label="Toggle theme"
    >
      {theme === "dark" ? "\u2600" : "\u263D"}
    </button>
  );
}
