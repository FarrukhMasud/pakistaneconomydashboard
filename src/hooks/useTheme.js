import { useState, useEffect } from 'react';

const STORAGE_KEY = 'pak-eco-theme';

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || 'system';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme);
    const root = document.documentElement;

    if (theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }, [theme]);

  return { theme, setTheme };
}
