type Row = { date: string; price: string; status: string; auction?: string; lot?: string }

export default function SalesHistory({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <section className="panel">
      <h3>{title}</h3>
      <table className="table">
        <thead>
          <tr>
            <th>Дата</th><th>Цена</th><th>Статус</th><th>Аукцион</th><th>Лот</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r,i)=>(
            <tr key={i}>
              <td>{r.date}</td>
              <td style={{color:'var(--brand)'}}>{r.price}</td>
              <td>{r.status}</td>
              <td>{r.auction ?? '—'}</td>
              <td>{r.lot ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
