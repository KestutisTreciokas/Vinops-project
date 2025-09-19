// src/app/[lang]/layout.tsx
import * as React from 'react';
import type { Metadata } from 'next';

type Lang = 'en' | 'ru';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  applicationName: 'vinops',
  title: 'vinops — vinops',
};

function otherLangHref(lang: Lang) {
  return lang === 'en' ? '/ru' : '/en';
}
function otherLangCode(lang: Lang) {
  return lang === 'en' ? 'RU' : 'EN';
}

export default function RootLayout({
  children,
  params: { lang },
}: {
  children: React.ReactNode;
  params: { lang: Lang };
}) {
  return (
    <html lang={lang} suppressHydrationWarning>
      <body className="font-sans __variable_52ad5f __variable_f9e569">
        <div className="min-h-screen flex flex-col bg-bg-canvas text-fg-default">
          {/* Site Header */}
          <header className="site-header">
            <div className="inner">
              <a className="logo flex items-center gap-2" aria-label="vinops home" href={`/${lang}`}>
                <img className="logo-img-light" src="/svg/brand/property-1-brand-theme-light-size-56.svg" alt="vinops" width={56} height={56} />
                <img className="logo-img-dark" src="/svg/brand/property-1-brand-theme-dark-size-56.svg" alt="vinops" width={56} height={56} />
                <span className="hidden sm:inline-block font-semibold tracking-wide leading-none text-fg-default">vinops</span>
              </a>
              <nav className="flex items-center gap-6">
                <a className="nav-link" href={`/${lang}/cars`}>{lang === 'en' ? 'Catalog' : 'Каталог'}</a>
                <a className="nav-link" href={`/${lang}/contacts`}>{lang === 'en' ? 'Contacts' : 'Контакты'}</a>
                <a className="nav-link" href={`/${lang}/terms`}>{lang === 'en' ? 'Terms' : 'Условия'}</a>
                {/* Простая кнопка-тоггл темы (заглушка, чтобы не тянуть зависимости) */}
                <button type="button" className="btn btn-secondary h-8 px-3 text-xs">Dark</button>
                <div className="flex items-center gap-2">
                  <span className="text-fg-muted text-sm">Lang</span>
                  <a className="btn btn-secondary h-8 px-3 text-xs" href={otherLangHref(lang)}>
                    {otherLangCode(lang)}
                  </a>
                </div>
              </nav>
            </div>
          </header>

          {/* Страница */}
          {children}

          {/* Footer */}
          <footer className="mt-12 border-t border-border-muted">
            <div className="container-prose py-8 text-sm text-fg-muted flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>© {new Date().getFullYear()} vinops</div>
              <div className="flex items-center gap-4">
                <a href="mailto:request@vinops.online">request@vinops.online</a>
                <a href="https://t.me/keustis" target="_blank" rel="noreferrer">@keustis</a>
              </div>
            </div>
          </footer>
        </div>
        {/* Лёгкая инициализация темы (необязательно) */}
        <script
          id="theme-init"
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  try{
    var t = localStorage.getItem('theme');
    var sys = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark':'light';
    document.documentElement.setAttribute('data-theme', t || sys);
  }catch(e){}
})();
`,
          }}
        />
      </body>
    </html>
  );
}
