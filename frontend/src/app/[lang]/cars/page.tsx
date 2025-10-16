import { Suspense } from 'react'
import type { Metadata } from 'next'
import PageClient from './PageClient'

export default function Page({ params }: { params: { lang: 'en'|'ru' } }) {
  return (
    <Suspense fallback={<div className="container-prose py-8 text-sm text-fg-muted">Loading…</div>}>
      <PageClient params={params} />
    </Suspense>
  )
}

export async function generateMetadata(
  { params }: { params: { lang: 'en'|'ru' } }
): Promise<Metadata> {
  const { lang } = params
  const t = (en: string, ru: string) => (lang === 'ru' ? ru : en)
  const PATH = '/cars'
  const canonical = `/${lang}${PATH}`
  const title = t('Car catalog', 'Каталог автомобилей')
  const description = t('Browse cars and filter by attributes.', 'Просматривайте автомобили и фильтруйте по параметрам.')

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        en: `/en${PATH}`,
        ru: `/ru${PATH}`,
        'x-default': `/en${PATH}`,
      },
    },
    openGraph: {
      url: canonical,
      title: `${title} — vinops`,
      description,
      type: 'website',
    },
    robots: { index: true, follow: true },
  }
}
