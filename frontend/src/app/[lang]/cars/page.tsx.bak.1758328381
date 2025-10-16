import type { Route } from "next";
'use client'
import ChevronDown from '@/icons/ChevronDown'
import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import PillTabs from '@/components/PillTabs'
import VehicleCard, { VehicleLite } from '@/components/VehicleCard'
import { buildQuery } from '@/lib/url'

type Lang = 'en'|'ru'
const t = (lang:Lang, en:string, ru:string)=> lang==='ru'?ru:en

// Мок-источники опций (достаточно для M1)
const MAKES = ['Toyota','BMW','Audi','Ford']
const MODELS: Record<string,string[]> = {
  Toyota: ['Camry','Corolla','RAV4'],
  BMW: ['3 Series','5 Series'],
  Audi: ['A4','A6'],
  Ford: ['Focus','Fusion'],
}
const GENERATIONS = ['All','I','II','III']
const YEARS = Array.from({length: 30}).map((_,i)=> String(2025 - i))

// Мок-данные карточек
const MOCK_ROWS: VehicleLite[] = Array.from({length:18}).map((_,i)=>({
  year: 2016 + (i % 8),
  make: ['Toyota','BMW','Audi'][i % 3],
  model: ['Camry','3 Series','A4'][i % 3],
  damage:'Front End', title:'Salvage', location:'Dallas, TX',
  vin: `4T1B11HK0000${3456+i}`,
  status: i % 3 === 0 ? 'SOLD' : 'ACTIVE',
  price: i % 3 === 0 ? '$8,900' : '$12,300'
}))

export default function CatalogPage({ params }: { params: { lang: Lang } }) {
  const lang = params.lang
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()

  // URL -> initial state
  const [type, setType] = useState(sp.get('type') ?? 'auto')
  const [make, setMake] = useState(sp.get('make') ?? '')
  const [model, setModel] = useState(sp.get('model') ?? '')
  const [gen, setGen] = useState(sp.get('gen') ?? '')
  const [yFrom, setYFrom] = useState(sp.get('yfrom') ?? '')
  const [yTo, setYTo] = useState(sp.get('yto') ?? '')
  const [page, setPage] = useState(Number(sp.get('page') ?? '1') || 1)

  // если make сменился — сбрасываем model, если её нет среди опций
  useEffect(()=>{
    if (!make) { setModel(''); return }
    const list = MODELS[make] || []
    if (model && !list.includes(model)) setModel('')
  },[make])

  // табы
  const tabs = useMemo(()=>[
    { id:'auto', label: t(lang,'Auto','Авто') },
    { id:'moto', label: t(lang,'Moto','Мото') },
    { id:'atv',  label: 'ATV' },
    { id:'more', label: t(lang,'More','Еще') },
  ],[lang])

  // Применить -> в URL
  const apply = () => {
    const q = buildQuery(sp, {
      type, make, model,
      gen,
      yfrom: yFrom,
      yto: yTo,
      page: String(page),
    })
    
    
    router.replace((`${pathname}${q}` as unknown as Route))
  
  
  }

  // Сброс -> чистим всё, кроме type
  const reset = () => {
    setMake(''); setModel(''); setGen(''); setYFrom(''); setYTo(''); setPage(1)
    const q = buildQuery(sp, { make:'', model:'', gen:'', yfrom:'', yto:'', page:'1' })
    
    
    router.replace((`${pathname}${q}` as unknown as Route))
  
  
  }

  // смена таба — сразу в URL (и сбрасываем страницу)
  const onTab = (id:string) => {
    setType(id)
    const q = buildQuery(sp, { type:id, page:'1' })
    
    
    router.replace((`${pathname}${q}` as unknown as Route))
  
  
  }

  // Данные после фильтрации (клиентская имитация)
  const rowsFiltered = useMemo(()=>{
    return MOCK_ROWS.filter(r=>{
      if (make && r.make !== make) return false
      if (model && r.model !== model) return false
      // gen на моках не влияет
      const yf = yFrom ? Number(yFrom) : 0
      const yt = yTo ? Number(yTo) : 9999
      if (yf && r.year < yf) return false
      if (yt && r.year > yt) return false
      return true
    })
  },[make, model, yFrom, yTo])

  // пагинация
  const pageSize = 9
  const totalPages = Math.max(1, Math.ceil(rowsFiltered.length / pageSize))
  const currPage = Math.min(page, totalPages)
  const paged = rowsFiltered.slice((currPage-1)*pageSize, currPage*pageSize)

  const goto = (p:number) => {
    const next = Math.min(Math.max(1,p), totalPages)
    setPage(next)
    const q = buildQuery(sp, { page:String(next) })
    
    
    router.replace((`${pathname}${q}` as unknown as Route))
  
  
  }

  return (
    <main>
      <section className="container catalog-head">
        <h1 className="text-xl font-semibold mb-1">{t(lang,'Catalog • VIN', 'Каталог • VIN')}</h1>
        <p className="text-fg-muted">{t(lang,
          'Live lots: photos, specs, statuses, sale prices and history.',
          'Актуальные лоты: фото, характеристики, статусы, цены продаж и история.'
        )}</p>
      </section>

      {/* sticky */}
      <div className="filters-sticky">
        <section className="container">
          <PillTabs items={tabs} value={type} onChange={onTab} className="mb-3" />
          <div className="filters-bar">
            <div className="select-wrap">
              <select className="select" value={make} onChange={e=>setMake(e.target.value)}>
                <option value="">{t(lang,'All makes','Все марки')}</option>
                {MAKES.map(m=><option key={m} value={m}>{m}</option>)}
              </select>
              <span className="chev"><ChevronDown/></span>
            </div>
            <div className="select-wrap">
              <select className="select" value={model} onChange={e=>setModel(e.target.value)}>
                <option value="">{t(lang,'All models','Все модели')}</option>
                {(MODELS[make]||[]).map(m=><option key={m} value={m}>{m}</option>)}
              </select>
              <span className="chev"><ChevronDown/></span>
            </div>
            <div className="select-wrap">
              <select className="select" value={gen} onChange={e=>setGen(e.target.value)}>
                <option value="">{t(lang,'All generations','Все поколения')}</option>
                {GENERATIONS.map(g=><option key={g} value={g}>{g}</option>)}
              </select>
              <span className="chev"><ChevronDown/></span>
            </div>
            <div className="select-wrap" data-size="sm">
              <select className="select" value={yFrom} onChange={e=>setYFrom(e.target.value)}>
                <option value="">{t(lang,'Year from','От')}</option>
                {YEARS.map(y=><option key={y} value={y}>{y}</option>)}
              </select>
              <span className="chev"><ChevronDown/></span>
            </div>
            <div className="select-wrap" data-size="sm">
              <select className="select" value={yTo} onChange={e=>setYTo(e.target.value)}>
                <option value="">{t(lang,'Year to','До')}</option>
                {YEARS.map(y=><option key={y} value={y}>{y}</option>)}
              </select>
              <span className="chev"><ChevronDown/></span>
            </div>
            <div data-filters="bar" className="flex gap-2">
              <button className="btn" onClick={reset}>{t(lang,'Reset','Сбросить')}</button>
              <button className="btn btn-primary" onClick={apply}>{t(lang,'Apply','Применить')}</button>
            </div>
          </div>
        </section>
      </div>

      <section className="container mt-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paged.map((v,idx)=>(<VehicleCard key={idx} v={v}/>))}
        </div>

        <nav className="pager">
          <button className="pager-btn" onClick={()=>goto(currPage-1)}>{t(lang,'Prev','Prev')}</button>
          <button className={`pager-btn ${currPage===1?'pager-btn-active':''}`} onClick={()=>goto(1)}>1</button>
          {totalPages>=2 && <button className={`pager-btn ${currPage===2?'pager-btn-active':''}`} onClick={()=>goto(2)}>2</button>}
          {totalPages>=3 && <button className={`pager-btn ${currPage===3?'pager-btn-active':''}`} onClick={()=>goto(3)}>3</button>}
          <button className="pager-btn" onClick={()=>goto(currPage+1)}>{t(lang,'Next','Next')}</button>
        </nav>
      </section>
    </main>
  )
}