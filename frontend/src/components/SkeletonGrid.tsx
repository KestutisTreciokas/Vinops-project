export default function SkeletonGrid({ count = 8 }: { count?: number }) {
  const items = Array.from({ length: count })
  return (
    <div className="grid-catalog">
      {items.map((_, i) => (
        <div key={i} className="card p-3 card-hover">
          <div className="media-4x3 skeleton" />
          <div className="mt-3 space-y-2">
            <div className="skeleton" style={{ height: 16, borderRadius: 6 }} />
            <div className="skeleton" style={{ height: 12, width: '70%', borderRadius: 6 }} />
          </div>
        </div>
      ))}
    </div>
  )
}
