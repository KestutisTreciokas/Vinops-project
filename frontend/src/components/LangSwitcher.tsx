'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { Route } from 'next'

interface LangSwitcherProps {
  lang: 'en' | 'ru'
}

export default function LangSwitcher({ lang }: LangSwitcherProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Replace language in pathname, preserving the rest of the URL
  const getPathForLang = (targetLang: 'en' | 'ru') => {
    const newPath = pathname.replace(`/${lang}`, `/${targetLang}`)
    const queryString = searchParams.toString()
    return queryString ? `${newPath}?${queryString}` : newPath
  }

  const targetLang = lang === 'en' ? 'ru' : 'en'
  const targetUrl = getPathForLang(targetLang)

  return (
    <Link
      href={targetUrl as Route}
      className="btn btn-secondary h-8 px-3 text-xs"
    >
      {lang === 'en' ? 'RU' : 'EN'}
    </Link>
  )
}
