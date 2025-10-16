'use client'
export type TabItem = { id: string; label: string }
export default function PillTabs({
  items, value, onChange, className=''
}: { items: TabItem[]; value: string; onChange: (id:string)=>void; className?: string }) {
  return (
    <div className={`pill-tabs ${className}`}>
      {items.map(it => (
        <button
          key={it.id}
          type="button"
          className={`pill ${value===it.id ? 'pill-active' : ''}`}
          onClick={()=>onChange(it.id)}
        >{it.label}</button>
      ))}
    </div>
  )
}
