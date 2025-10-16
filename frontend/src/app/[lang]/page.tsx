import type { Metadata } from 'next'
import PageClient from './PageClient'

export default function Page({ params }: { params: { lang: 'en'|'ru' } }) {
  return <PageClient params={params} />
}

export async function generateMetadata(
  { params }: { params: { lang: 'en'|'ru' } }
): Promise<Metadata> {
  const { lang } = params
  const t = (en: string, ru: string) => (lang === 'ru' ? ru : en)
  const PATH = ''
  const canonical = `/${lang}${PATH}`
  const title = t('VIN history & car sales analytics', 'История VIN и аналитика продаж авто')
  const description = t('Search cars, see specs and sales history.', 'Ищите авто, смотрите характеристики и историю продаж.')

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