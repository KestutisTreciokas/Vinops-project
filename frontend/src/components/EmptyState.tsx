export default function EmptyState({
  title = 'Ничего не найдено',
  subtitle = 'Измените фильтры и попробуйте снова.',
}: { title?: string; subtitle?: string }) {
  return (
    <div className="card p-8 text-center">
      <div className="mx-auto mb-4" style={{ width: 64, height: 64, borderRadius: 16, border: '1px solid var(--border-muted)' }} />
      <h3 className="h3 mb-1">{title}</h3>
      <p className="text-muted">{subtitle}</p>
    </div>
  )
}
