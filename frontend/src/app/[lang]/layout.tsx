import Link from 'next/link'
import { Suspense } from 'react'

import type { Route } from 'next';
import type { Metadata } from 'next'
import NavLink from '../../components/NavLink'
import ThemeToggle from '../../components/ThemeToggle'
import LangSwitcher from '../../components/LangSwitcher'

const NAV = [
  { href: '/[lang]/cars',     label: { en: 'Catalog',  ru: 'Каталог' } },
  { href: '/[lang]/contacts', label: { en: 'Contacts', ru: 'Контакты' } },
  { href: '/[lang]/terms',    label: { en: 'Terms',    ru: 'Условия' } },
]

export const metadata: Metadata = {
  metadataBase: new URL('https://vinops.online'),
  title: { default: 'vinops', template: '%s — vinops' },
}

export default function LangLayout({
  params, children,
}: {
  params: { lang: 'en' | 'ru' }
  children: React.ReactNode
}) {
  const t = (en: string, ru: string) => (params.lang === 'ru' ? ru : en)
  const href = (p: string) => p.replace('[lang]', params.lang)

  return (
    <div className="min-h-screen flex flex-col bg-bg-canvas text-fg-default">
      <header className="site-header">
        <div className="inner">
          <Link href={(params.lang === "ru" ? "/ru" : "/en") as Route} className="logo flex items-center gap-2" aria-label="vinops">
  <img className="logo-img-light" src="/svg/brand/property-1-brand-theme-light-size-56.svg" alt="" aria-hidden={true} width={56} height={56} />
  <img className="logo-img-dark"  src="/svg/brand/property-1-brand-theme-dark-size-56.svg"  alt="" aria-hidden={true} width={56} height={56} />
  <span className="logo-text">vinops</span>
</Link>
          <nav className="flex items-center gap-6">
            {NAV.map((n) => (
              <NavLink key={n.href} href={href(n.href)}>
                {t(n.label.en, n.label.ru)}
              </NavLink>
            ))}
            <ThemeToggle />
            <Suspense fallback={<div className="h-8 w-20" />}>
              <LangSwitcher lang={params.lang} />
            </Suspense>
          </nav>
        </div>
      </header>

      <main className="container-prose py-8 flex-1">{children}</main>

      <footer className="mt-12 border-t border-border-muted">
        <div className="container-prose py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 mb-6">
            <div>
              <h3 className="text-sm font-semibold mb-2">{t('Navigation', 'Навигация')}</h3>
              <nav className="flex flex-col gap-2 text-sm">
                <Link href={href('/[lang]') as Route} className="text-fg-muted hover:text-fg-default">
                  {t('Home', 'Главная')}
                </Link>
                <Link href={href('/[lang]/cars') as Route} className="text-fg-muted hover:text-fg-default">
                  {t('Catalog', 'Каталог')}
                </Link>
                <Link href={href('/[lang]/contacts') as Route} className="text-fg-muted hover:text-fg-default">
                  {t('Contacts', 'Контакты')}
                </Link>
                <Link href={href('/[lang]/terms') as Route} className="text-fg-muted hover:text-fg-default">
                  {t('Terms', 'Условия')}
                </Link>
              </nav>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">{t('Contacts', 'Контакты')}</h3>
              <div className="flex flex-col gap-2 text-sm">
                <a href="mailto:request@vinops.online" className="text-fg-muted hover:text-fg-default">
                  request@vinops.online
                </a>
                <a href="https://t.me/vinops" target="_blank" rel="noopener noreferrer" className="text-fg-muted hover:text-fg-default">
                  Telegram
                </a>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2">{t('About', 'О сервисе')}</h3>
              <p className="text-sm text-fg-muted">
                {t(
                  'VIN lookup service for auction vehicles with real-time data from major US auction sites.',
                  'Сервис проверки VIN для аукционных автомобилей с актуальными данными с крупнейших аукционов США.'
                )}
              </p>
            </div>
          </div>
          <div className="pt-6 border-t border-border-muted text-sm text-fg-muted text-center">
            © {new Date().getFullYear()} vinops. {t('All rights reserved.', 'Все права защищены.')}
          </div>
        </div>
      </footer>
    </div>
  )
}

export const dynamicParams = false
export function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ru' }]
}
