export default function StatusBadge({ status }: { status: 'active' | 'sold' }) {
  const text = status === 'sold' ? 'Sold' : 'Active'
  const cls =
    status === 'sold'
      ? 'badge badge-neutral'
      : 'badge badge-success'
  return <span className={cls}>{text}</span>
}
