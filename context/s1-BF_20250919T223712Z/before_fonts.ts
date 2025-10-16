import localFont from 'next/font/local';

// Vars должны совпадать с использованием в стилях: var(--font-sans), var(--font-mono)
export const inter = localFont({
  variable: '--font-sans',
  display: 'swap',
  preload: true,
  src: [
    { path: '../../public/fonts/inter/inter-400.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/inter/inter-500.woff2', weight: '500', style: 'normal' },
    { path: '../../public/fonts/inter/inter-600.woff2', weight: '600', style: 'normal' },
    { path: '../../public/fonts/inter/inter-700.woff2', weight: '700', style: 'normal' },
  ],
});

export const mono = localFont({
  variable: '--font-mono',
  display: 'swap',
  preload: true,
  src: [
    { path: '../../public/fonts/jetbrains/jetbrains-mono-400.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/jetbrains/jetbrains-mono-500.woff2', weight: '500', style: 'normal' },
    { path: '../../public/fonts/jetbrains/jetbrains-mono-600.woff2', weight: '600', style: 'normal' },
    { path: '../../public/fonts/jetbrains/jetbrains-mono-700.woff2', weight: '700', style: 'normal' },
  ],
});
