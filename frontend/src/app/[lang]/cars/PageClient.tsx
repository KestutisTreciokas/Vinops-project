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

// Popular makes from database (top 15)
const MAKES = [
  'FORD', 'TOYOTA', 'CHEVROLET', 'HONDA', 'NISSAN',
  'HYUNDAI', 'KIA', 'JEEP', 'DODGE', 'GMC',
  'BMW', 'VOLKSWAGEN', 'RAM', 'AUDI', 'MERCEDES-BENZ'
]
const MODELS: Record<string,string[]> = {}
const GENERATIONS = ['All','I','II','III']
const YEARS = Array.from({length: 30}).map((_,i)=> String(2025 - i))

interface CatalogPageProps {
  params: { lang: Lang }
  initialVehicles: VehicleLite[]
  initialPagination: {
    hasMore: boolean
    count: number
    nextCursor: string | null
  }
}

export default function CatalogPage({ params, initialVehicles, initialPagination }: CatalogPageProps) {
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
    
    
    
router.replace(`${pathname}${q}` as Route)
  
  
  }

  // Сброс -> чистим всё, кроме type
  const reset = () => {
    setMake(''); setModel(''); setGen(''); setYFrom(''); setYTo(''); setPage(1)
    const q = buildQuery(sp, { make:'', model:'', gen:'', yfrom:'', yto:'', page:'1' })
    
    
    
router.replace(`${pathname}${q}` as Route)
  
  
  }

  // смена таба — сразу в URL (и сбрасываем страницу)
  const onTab = (id:string) => {
    setType(id)
    const q = buildQuery(sp, { type:id, page:'1' })
    
    
    
router.replace(`${pathname}${q}` as Route)
  
  
  }

  // Use real data from server
  const vehicles = initialVehicles
  const hasMore = initialPagination.hasMore

  const goto = (p:number) => {
    const next = Math.max(1, p)
    setPage(next)
    const q = buildQuery(sp, { page:String(next) })
    router.replace(`${pathname}${q}` as Route)
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
          {vehicles.map((v,idx)=>(<VehicleCard key={v.vin || idx} v={v}/>))}
        </div>

        {vehicles.length === 0 && (
          <div className="text-center py-12 text-fg-muted">
            {t(lang, 'No vehicles found. Try adjusting your filters.', 'Автомобили не найдены. Попробуйте изменить фильтры.')}
          </div>
        )}

        {vehicles.length > 0 && (
          <nav className="pager">
            <button className="pager-btn" onClick={()=>goto(page-1)} disabled={page===1}>{t(lang,'Prev','Назад')}</button>
            <span className="pager-info">{t(lang,`Page ${page}`,`Страница ${page}`)}</span>
            <button className="pager-btn" onClick={()=>goto(page+1)} disabled={!hasMore}>{t(lang,'Next','Вперед')}</button>
          </nav>
        )}
      </section>
    </main>
  )
}

