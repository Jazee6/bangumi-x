import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "bangumi-x-theme";
const THEMES = new Set<Theme>(["light", "dark", "system"]);

export const themeInitializationScript = `(function(){var v=null;try{v=localStorage.getItem("${THEME_STORAGE_KEY}")}catch(e){}var t=v==="light"||v==="dark"||v==="system"?v:"system",d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches),r=document.documentElement;r.classList.add("js");r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light"})();`;

function isTheme(value: string | null): value is Theme {
  return value !== null && THEMES.has(value as Theme);
}

function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored !== null && !isTheme(stored)) {
        localStorage.removeItem(THEME_STORAGE_KEY);
      }
    } catch {
      // Storage can be unavailable in privacy-restricted browsing contexts.
    }
    const initial = isTheme(stored) ? stored : "system";
    applyTheme(initial);
    setThemeState(initial);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;

    applyTheme(theme);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    if (theme !== "system") return;

    const handleChange = () => applyTheme("system");
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [ready, theme]);

  function setTheme(nextTheme: Theme) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // The current session can still use the selected theme without persistence.
    }
    setThemeState(nextTheme);
  }

  return { theme, setTheme };
}
