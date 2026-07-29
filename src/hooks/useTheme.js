import { useState, useEffect } from 'react';

const STORAGE_KEY = 'pak-eco-theme';

function systemPrefersDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? true;
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'system') {
    root.removeAttribute('data-theme');
    // Mirror resolved scheme for components that read data-theme only.
    root.dataset.resolvedTheme = systemPrefersDark() ? 'dark' : 'light';
  } else {
    root.setAttribute('data-theme', theme);
    root.dataset.resolvedTheme = theme;
  }
}

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'system';
    } catch {
      return 'system';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore quota / private mode */
    }
    applyTheme(theme);

    if (theme !== 'system') return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [theme]);

  return { theme, setTheme };
}
