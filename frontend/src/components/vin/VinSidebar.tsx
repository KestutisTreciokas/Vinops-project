'use client'
import Link from 'next/link'
import type { Route } from 'next';
export default function VinSidebar() {
  return (
    <aside className="card sticky top-4">
      <div className="space-y-3">
        <div className="text-2xl font-semibold">Связаться</div>
        <p className="text-[var(--fg-muted)]">
          Оставьте заявку — мы пришлём детальную информацию по лоту.
        </p>
        <Link href={"/ru/contacts" as Route} className="btn btn-primary btn-lg w-full">
          Связаться
        </Link>

        <ul className="mt-2 text-sm text-[var(--fg-muted)] list-disc pl-4">
          <li>Фото, характеристики, статус</li>
          <li>История и цены продаж</li>
          <li>Сроки и логистика</li>
        </ul>
      </div>
    </aside>
  )
}
