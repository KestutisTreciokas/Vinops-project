import Link from 'next/link'
import type { Metadata } from 'next'

const NAV = [
  { href: '/[lang]/cars',    label: { en: 'Catalog',  ru: 'Каталог' } },
  { href: '/[lang]/contacts',label: { en: 'Contacts', ru: 'Контакты' } },
  { href: '/[lang]/terms',   label: { en: 'Terms',    ru: 'Условия' } },
]

export const metadata: Metadata = {
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
      <header className="border-b border-border-muted">
        <div className="container-prose flex items-center justify-between py-4">
          <Link href={`/${params.lang}`} className="text-lg font-semibold">vinops</Link>
          <nav className="flex items-center gap-6">
            {NAV.map((n) => (
              <Link key={n.href} href={href(n.href)} className="hover:underline">
                {t(n.label.en, n.label.ru)}
              </Link>
            ))}
            <LangSwitcher lang={params.lang} />
          </nav>
        </div>
      </header>

      <main className="container-prose py-8 flex-1">{children}</main>

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
  )
}

function LangSwitcher({ lang }: { lang: 'en' | 'ru' }) {
  const other = lang === 'en' ? 'ru' : 'en'
  return (
    <div className="flex items-center gap-2">
      <span className="text-fg-muted text-sm">Lang</span>
      <a className="btn btn-secondary h-8 px-3 text-xs" href={`/${other}`}>
        {other.toUpperCase()}
      </a>
    </div>
  )
}
