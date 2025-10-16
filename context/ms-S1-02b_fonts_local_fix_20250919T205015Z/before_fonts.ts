import localFont from 'next/font/local';

/**
 * Self-hosted fonts to avoid network fetch on build.
 * Files live in /public/fonts/... (served by Next), stable names below.
 * Adjust weights/styles if дизайн изменится.
 */

export const inter = localFont({
  src: [
    { path: '/fonts/inter/inter-400.woff2', weight: '400', style: 'normal' },
    { path: '/fonts/inter/inter-500.woff2', weight: '500', style: 'normal' },
    { path: '/fonts/inter/inter-600.woff2', weight: '600', style: 'normal' },
    { path: '/fonts/inter/inter-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-inter',
  display: 'swap',
  preload: true,
});

export const mono = localFont({
  src: [
    { path: '/fonts/jetbrains/jetbrains-mono-400.woff2', weight: '400', style: 'normal' },
    { path: '/fonts/jetbrains/jetbrains-mono-500.woff2', weight: '500', style: 'normal' },
    { path: '/fonts/jetbrains/jetbrains-mono-600.woff2', weight: '600', style: 'normal' },
    { path: '/fonts/jetbrains/jetbrains-mono-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-mono',
  display: 'swap',
  preload: true,
});
