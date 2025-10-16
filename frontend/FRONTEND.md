## Fonts (S1/MS-01-06 — Europe/Warsaw 2025-09-24 00:36)

- **PT Sans**: weights 400, 700; subsets: latin + cyrillic; display=swap; variable: `--font-sans`.
- **PT Mono**: weight 400; subsets: latin + cyrillic; display=swap; variable: `--font-mono`.
- Подключение: `next/font/local` в `src/app/fonts.ts` (self-host).
- Алиасы совместимости: `inter` → PT Sans, `mono` → PT Mono.
- Fallback стек: системные шрифты (см. `fonts.ts`).
- Политика: **никаких** запросов к `fonts.googleapis.com`/`fonts.gstatic.com` в рантайме.
