"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";

type ThemeContextType = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext =
  createContext<ThemeContextType | null>(null);

export function ThemeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [theme, setThemeState] =
    useState<Theme>("dark");

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const savedTheme =
      localStorage.getItem("doener-pos-theme");

    if (
      savedTheme === "light" ||
      savedTheme === "dark"
    ) {
      setThemeState(savedTheme);
    }

    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;

    localStorage.setItem(
      "doener-pos-theme",
      theme
    );

    document.documentElement.classList.toggle(
      "dark",
      theme === "dark"
    );
  }, [theme, loaded]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme: setThemeState,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(
      "useTheme muss innerhalb von ThemeProvider verwendet werden."
    );
  }

  return context;
}