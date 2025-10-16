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
  const PATH = '/terms'
  const canonical = `/${lang}${PATH}`
  const title = t('Terms of Service', 'Условия сервиса')
  const description = t('Terms and conditions for using vinops.', 'Условия использования сервиса vinops.')

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