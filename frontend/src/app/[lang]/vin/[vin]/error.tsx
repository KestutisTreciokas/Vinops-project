'use client'
export default function VinError({ error }: { error: Error }) {
  console.error(error)
  return (
    <div className="container py-16">
      <h1 className="text-2xl font-semibold mb-2">Не удалось загрузить данные по VIN</h1>
      <p className="text-fg-muted">Попробуйте обновить страницу позже.</p>
    </div>
  )
}
