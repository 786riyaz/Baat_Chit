"use client";

import { createContext, useContext, useEffect, useState } from "react";

const THEME_KEY = "chatapp_theme";
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  // The inline script in layout.js already set the correct attribute on
  // <html> before paint (avoiding a flash of the wrong theme) - this just
  // mirrors that into React state so components can read/toggle it.
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_KEY);
    setTheme(stored === "light" ? "light" : "dark");
  }, []);

  function applyTheme(nextTheme) {
    setTheme(nextTheme);
    window.localStorage.setItem(THEME_KEY, nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
  }

  function toggleTheme() {
    applyTheme(theme === "dark" ? "light" : "dark");
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
