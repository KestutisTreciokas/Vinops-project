'use client'
import Link from 'next/link'
import type { Route } from 'next';
import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'

export default function NavLink({
  href,
  children,
  className = '',
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  const pathname = usePathname()
  const isActive =
    pathname === href || (href !== '/' && pathname?.startsWith(href + '/'))

  const cls = `nav-link ${className}${isActive ? ' nav-link-active' : ''}`

  return (
    <Link href={typeof href === "string" ? { pathname: href } : href} className={cls} aria-current={isActive ? 'page' : undefined}>
      {children}
    </Link>
  )
}
