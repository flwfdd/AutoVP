/*
 * @Author: flwfdd
 * @Date: 2025-02-06 23:29:55
 * @LastEditTime: 2025-02-07 00:06:32
 * @Description: _(:з」∠)_
 */
import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeProps = {
  key: "theme",
  light: "light",
  dark: "dark",
} as const;

type Theme = typeof ThemeProps.light | typeof ThemeProps.dark;

const ThemeContext = createContext<{
  theme: Theme;
  isDark: boolean;
  isLight: boolean;
  setLightTheme: () => void;
  setDarkTheme: () => void;
  toggleTheme: () => void;
} | null>(null);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const storedTheme = localStorage.getItem(ThemeProps.key) as Theme | null;
    return storedTheme || ThemeProps.light;
  });

  const isDark = useMemo(() => {
    return theme === ThemeProps.dark;
  }, [theme]);

  const isLight = useMemo(() => {
    return theme === ThemeProps.light;
  }, [theme]);

  const _setTheme = (newTheme: Theme) => {
    localStorage.setItem(ThemeProps.key, newTheme);
    document.documentElement.classList.remove(
      ThemeProps.light,
      ThemeProps.dark
    );
    document.documentElement.classList.add(newTheme);
    setTheme(newTheme);
  };

  const setLightTheme = () => _setTheme(ThemeProps.light);

  const setDarkTheme = () => _setTheme(ThemeProps.dark);

  const toggleTheme = () =>
    theme === ThemeProps.dark ? setLightTheme() : setDarkTheme();

  useEffect(() => {
    _setTheme(theme);
  }, [theme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark,
        isLight,
        setLightTheme,
        setDarkTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};