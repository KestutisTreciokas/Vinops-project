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

  return (
    <div className="flex items-center gap-2">
      <Link
        href={getPathForLang('en') as Route}
        className={`btn btn-secondary h-8 px-3 text-xs ${lang === 'en' ? 'opacity-50 cursor-default' : ''}`}
        onClick={(e) => lang === 'en' && e.preventDefault()}
      >
        EN
      </Link>
      <Link
        href={getPathForLang('ru') as Route}
        className={`btn btn-secondary h-8 px-3 text-xs ${lang === 'ru' ? 'opacity-50 cursor-default' : ''}`}
        onClick={(e) => lang === 'ru' && e.preventDefault()}
      >
        RU
      </Link>
    </div>
  )
}
