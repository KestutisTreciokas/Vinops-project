'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'theme'; // 'light' | 'dark'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // применяем тему только к <html>
  useEffect(() => {
    const saved = (typeof window !== 'undefined'
      ? (localStorage.getItem(STORAGE_KEY) as 'light' | 'dark' | null)
      : null) || 'light';
    applyTheme(saved);
  }, []);

  function applyTheme(next: 'light' | 'dark') {
    setTheme(next);
    const root = document.documentElement;
    // убираем возможные «старые» механизмы, если они вдруг остались
    root.classList.remove('dark');
    root.removeAttribute('class'); // если где-то ставили 'dark' как единственный класс
    root.setAttribute('data-theme', next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <button
      type="button"
      className="btn btn-secondary h-8 px-3 text-xs"
      onClick={() => applyTheme(theme === 'light' ? 'dark' : 'light')}
      aria-pressed={theme === 'dark'}
    >
      {theme === 'dark' ? 'Light' : 'Dark'}
    </button>
  );
}
