import type { Metadata } from 'next'
import PageClient from './PageClient'

export default function Page({ params }: { params: { lang: 'en'|'ru' } }) {
  return <PageClient params={params} />
}

// --- MS-06 SEO metadata (server) ---
export async function generateMetadata(
  { params }: { params: { lang: 'en'|'ru' } }
): Promise<Metadata> {
  const { lang } = params
  const t = (en: string, ru: string) => (lang === 'ru' ? ru : en)
  const BASE = 'https://vinops.online'
  const PATH = '/cars'
  const canonical = `${BASE}/${lang}${PATH}`
  const title = t('Car catalog', 'Каталог автомобилей')
  const description = t('Browse cars and filter by attributes.', 'Просматривайте автомобили и фильтруйте по параметрам.')

  return {
    title, // layout применит шаблон "%s — vinops"
    description,
    alternates: {
      canonical,
      languages: {
        en: `${BASE}/en${PATH}`,
        ru: `${BASE}/ru${PATH}`,
        'x-default': `${BASE}/en${PATH}`,
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
// --- /MS-06 ---
