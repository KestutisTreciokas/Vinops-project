'use client'
function Line({ w='100%', h='1rem' }: { w?: string; h?: string }) {
  return <div className="rounded bg-[color:var(--bg-surface)]/60 animate-pulse" style={{width:w, height:h}} />
}
export function CardSkeleton({ rows=5 }: { rows?: number }) {
  return (
    <section className="card p-4">
      <div className="mb-3"><Line w="40%" h="1rem" /></div>
      <div className="space-y-2">
        {Array.from({length: rows}).map((_,i)=> <Line key={i} />)}
      </div>
    </section>
  )
}
export default function VinSkeleton() {
  return (
    <div className="container py-6">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-6">
        {/* Левая колонка: галерея */}
        <section className="card p-4">
          <div className="aspect-[4/3] w-full rounded-xl overflow-hidden bg-[color:var(--bg-surface)]/60 animate-pulse" />
          <div className="mt-3 grid grid-cols-8 gap-2">
            {Array.from({length:8}).map((_,i)=>(
              <div key={i} className="aspect-square rounded-md bg-[color:var(--bg-surface)]/60 animate-pulse" />
            ))}
          </div>
        </section>
        {/* Правая колонка: три карточки */}
        <div className="space-y-6">
          <CardSkeleton rows={7}/>
          <CardSkeleton rows={7}/>
          <CardSkeleton rows={5}/>
        </div>
      </div>
    </div>
  )
}
