import Script from 'next/script'
import { inter, mono } from './fonts'
import '../styles/globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'vinops',
    template: '%s — vinops',
  },
  description: 'VIN lookup and auction history by vinops',
  applicationName: 'vinops',
  metadataBase: new URL('https://vinops.online'),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning>
      <body className={`${inter.variable} ${mono.variable} font-sans`}>{children}<Script id="theme-init" strategy="beforeInteractive">{`
(function(){try{
  var t = localStorage.getItem('theme');
  var sys = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark':'light';
  document.documentElement.setAttribute('data-theme', t || sys);
}catch(e){}})();
`}</Script>
</body>
    </html>
  )
}
