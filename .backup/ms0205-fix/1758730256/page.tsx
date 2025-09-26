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

function isComplex(sp: Record<string, string | string[] | undefined>): boolean {
  const keys = Object.keys(sp).filter(k => sp[k] !== undefined)
  if (keys.includes('cursor')) return true
  const WHITELIST = new Set(['make','model','year_from','year_to'])
  const allowed = keys.filter(k => WHITELIST.has(k))
  // индексируемые: пустые /cars, либо ≤2 параметров из белого списка
  return !(keys.length === 0 || allowed.length <= 2 && keys.every(k => WHITELIST.has(k)))
}

export async function generateMetadata(
  { params, searchParams } : { params: { lang: 'en'|'ru' }, searchParams: Record<string,string|undefined> }
): Promise<Metadata> {
  const { lang } = params
  const t = (en: string, ru: string) => (lang === 'ru' ? ru : en)
  const PATH = '/cars'
  const canonical = `/${lang}${PATH}`
  const title = t('Car catalog', 'Каталог автомобилей')
  const description = t('Browse cars and filter by attributes.', 'Просматривайте автомобили и фильтруйте по параметрам.')

  const robots = isComplex(searchParams) ? { index: false, follow: true } : { index: true, follow: true }

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
    robots,
  }
}
