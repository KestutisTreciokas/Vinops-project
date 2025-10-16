import type { Metadata } from 'next'

export default function CarsLayout({ children }: { children: React.ReactNode }) {
  return children
}

export async function generateMetadata(
  { params }: { params: { lang: 'en'|'ru' } }
): Promise<Metadata> {
  const BASE = 'https://vinops.online'
  const PATH = '/cars'
  const { lang } = params
  const t = (en: string, ru: string) => (lang === 'ru' ? ru : en)

  const title = t('Car catalog', 'Каталог автомобилей')
  const description = t('Browse cars and filter by attributes.', 'Просматривайте автомобили и фильтруйте по параметрам.')

  const canonicalAbs = `${BASE}/${lang}${PATH}`

  return {
    title,
    description,
    metadataBase: new URL(BASE),
    alternates: {
      // можно использовать и относительные пути, но абсолютный каноникал надёжнее
      canonical: canonicalAbs,
      languages: {
        en: `${BASE}/en${PATH}`,
        ru: `${BASE}/ru${PATH}`,
        'x-default': `${BASE}/en${PATH}`,
      },
    },
    openGraph: {
      url: canonicalAbs,
      title: `${title} — vinops`,
      description,
      type: 'website',
    },
    robots: { index: true, follow: true },
  }
}
