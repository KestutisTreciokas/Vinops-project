export default function DemoPage({ params }: { params: { lang: 'ru'|'en' } }) {
  const { lang } = params
  const t = (ru: string, en: string) => (lang === 'ru' ? ru : en)

  const items = Array.from({ length: 12 })

  return (
    <main className="container mx-auto px-4">
      <h1 className="text-2xl font-semibold mb-6">
        {t('Демо каталога', 'Catalog demo')}
      </h1>

      {/* Skeleton Grid (превью сетки и карточек-заглушек) */}
      <section className="mb-10">
        <h2 className="text-base font-semibold mb-3">
          {t('Скелетоны карточек', 'Skeleton cards')}
        </h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((_, i) => (
            <div key={i} className="card p-4">
              <div className="aspect-[4/3] rounded-xl bg-muted animate-pulse" />
              <div className="mt-3 h-4 w-2/3 bg-muted/70 rounded animate-pulse" />
              <div className="mt-2 h-3 w-1/2 bg-muted/60 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </section>

      {/* Empty State (превью пустого результата) */}
      <section className="card p-8 text-center">
        <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-muted/70 animate-pulse" />
        <h2 className="text-base font-semibold mb-1">
          {t('Нет результатов', 'No results')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('Попробуйте изменить фильтры каталога.',
             'Try adjusting your catalog filters.')}
        </p>
      </section>
    </main>
  )
}
