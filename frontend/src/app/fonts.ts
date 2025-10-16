import localFont from 'next/font/local'

// PT Sans: 400 (Regular) and 700 (Bold)
export const ptSans = localFont({
  src: [
    {
      path: '../../public/fonts/pt-sans-400.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/pt-sans-700.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-sans',
  display: 'swap',
  preload: true,
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
})

// PT Mono: 400 (Regular) for VINs and numeric data
export const ptMono = localFont({
  src: '../../public/fonts/pt-mono-400.woff2',
  weight: '400',
  style: 'normal',
  variable: '--font-mono',
  display: 'swap',
  preload: true,
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
})

// Backward compatibility with existing imports
export const inter = ptSans
export const mono  = ptMono
