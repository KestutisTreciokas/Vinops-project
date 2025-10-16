import SkeletonGrid from '@/components/SkeletonGrid'
import EmptyState from '@/components/EmptyState'

export default function Demo() {
  return (
    <main className="container mx-auto px-4 py-8 space-y-10" data-page="catalog">
      <h1 className="h2">Demo · Catalog UI</h1>
      <section>
        <h2 className="h3 mb-3">SkeletonGrid</h2>
        <SkeletonGrid count={8} />
      </section>
      <section>
        <h2 className="h3 mb-3">EmptyState</h2>
        <EmptyState />
      </section>
    </main>
  )
}
