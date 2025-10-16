type Row = { label: string; value?: string | number | null }
export default function SpecList({ rows }: { rows: Row[] }) {
  return (
    <div className="card p-4 rounded-2xl bg-surface border border-border-muted">
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {rows.map((r, i) => (
          <div key={i} className="min-w-0">
            <dt className="text-sm text-fg-muted truncate">{r.label}</dt>
            <dd className="text-fg-default">{r.value ?? '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
