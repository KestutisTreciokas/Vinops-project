type Item = { k: string; v: string | number }

export default function SpecsList({ title, items }: { title: string; items: Item[] }) {
  return (
    <section className="panel">
      <h3>{title}</h3>
      <div className="specs-grid">
        {items.map((it,i)=>(
          <div key={i} className="contents">
            <div className="k">{it.k}</div>
            <div className="v">{String(it.v)}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
