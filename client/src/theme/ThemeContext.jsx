import { createContext, useContext, useMemo, useState } from "react";

const STORAGE_KEY = "playlist-tracker-theme";

const ThemeContext = createContext(null);

function getInitialTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme);

  function setTheme(nextTheme) {
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;

    try {
      localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // The selected theme still works for the current page.
    }

    setThemeState(nextTheme);
  }

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [theme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return context;
}
