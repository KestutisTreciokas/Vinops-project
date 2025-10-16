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
  const [yFrom, setYFrom] = useState(sp.get('yfrom') ?? '')
  const [yTo, setYTo] = useState(sp.get('yto') ?? '')
  const [displayedVehicles, setDisplayedVehicles] = useState(initialVehicles)
  const [canLoadMore, setCanLoadMore] = useState(initialPagination.hasMore)
  const [nextCursor, setNextCursor] = useState<string | null>(initialPagination.nextCursor)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [availableMakes, setAvailableMakes] = useState<string[]>(MAKES)
  const [loadingMakes, setLoadingMakes] = useState(false)
  const [showMoreDropdown, setShowMoreDropdown] = useState(false)

  // Fetch makes when type changes
  useEffect(() => {
    setLoadingMakes(true)
    fetch(`/api/v1/makes-models?type=${encodeURIComponent(type)}`)
      .then(res => res.json())
      .then(data => {
        setAvailableMakes(data.makes || MAKES)
        // Reset make and model if current make is not in the new list
        if (make && data.makes && !data.makes.includes(make)) {
          setMake('')
          setModel('')
        }
      })
      .catch(err => {
        console.error('Failed to fetch makes:', err)
        setAvailableMakes(MAKES)
      })
      .finally(() => setLoadingMakes(false))
  }, [type])

  // Fetch models when make changes
  useEffect(()=>{
    if (!make) {
      setAvailableModels([])
      setModel('')
      return
    }

    setLoadingModels(true)
    fetch(`/api/v1/makes-models?make=${encodeURIComponent(make)}&type=${encodeURIComponent(type)}`)
      .then(res => res.json())
      .then(data => {
        setAvailableModels(data.models || [])
        // Reset model if it's not in the new list
        if (model && data.models && !data.models.includes(model)) {
          setModel('')
        }
      })
      .catch(err => {
        console.error('Failed to fetch models:', err)
        setAvailableModels([])
      })
      .finally(() => setLoadingModels(false))
  },[make, type])

  // табы - основные
  const mainTabs = useMemo(()=>[
    { id:'auto', label: t(lang,'Auto','Авто') },
    { id:'moto', label: t(lang,'Moto','Мото') },
    { id:'atv',  label: 'ATV' },
  ],[lang])

  // More dropdown options
  const moreOptions = useMemo(()=>[
    { id:'dirt_bikes', label: t(lang,'Dirt Bikes','Эндуро') },
    { id:'bus', label: t(lang,'Bus','Автобусы') },
    { id:'pickup', label: t(lang,'Pickup Trucks','Пикапы') },
    { id:'rv', label: t(lang,'RVs','Дома на колесах') },
    { id:'trailer', label: t(lang,'Trailers','Трейлеры') },
    { id:'boat', label: t(lang,'Boats','Лодки') },
    { id:'jet_ski', label: t(lang,'Jet Skis','Гидроциклы') },
    { id:'snowmobile', label: t(lang,'Snowmobile','Снегоходы') },
  ],[lang])

  const isMoreType = !['auto', 'moto', 'atv'].includes(type)
  const tabs = isMoreType
    ? [...mainTabs, { id: type, label: moreOptions.find(o => o.id === type)?.label || t(lang,'More','Еще') }]
    : [...mainTabs, { id:'more', label: t(lang,'More','Еще') }]

  // Применить -> в URL (reset displayed vehicles)
  const apply = () => {
    const q = buildQuery(sp, {
      type, make, model,
      yfrom: yFrom,
      yto: yTo,
    })
    router.replace(`${pathname}${q}` as Route)
  }

  // Сброс -> чистим всё, кроме type
  const reset = () => {
    setMake(''); setModel(''); setYFrom(''); setYTo('')
    const q = buildQuery(sp, { make:'', model:'', yfrom:'', yto:'' })
    router.replace(`${pathname}${q}` as Route)
  }

  // смена таба — сразу в URL
  const onTab = (id:string) => {
    setType(id)
    const q = buildQuery(sp, { type:id })
    router.replace(`${pathname}${q}` as Route)
  }

  // Reset displayed vehicles when filters change
  useEffect(() => {
    setDisplayedVehicles(initialVehicles)
    setCanLoadMore(initialPagination.hasMore)
    setNextCursor(initialPagination.nextCursor)
  }, [initialVehicles, initialPagination.hasMore, initialPagination.nextCursor])

  // Load more functionality with cursor-based pagination
  const loadMore = async () => {
    if (isLoadingMore || !canLoadMore || !nextCursor) return

    setIsLoadingMore(true)
    try {
      const params = new URLSearchParams()
      params.set('vehicle_type', type)
      if (make) params.set('make', make)
      if (model) params.set('model', model)
      if (yFrom) params.set('year_min', yFrom)
      if (yTo) params.set('year_max', yTo)
      params.set('status', 'active')
      params.set('lang', lang)
      params.set('sort', 'auction_date_asc')
      params.set('limit', '50')
      params.set('cursor', nextCursor)

      const response = await fetch(`/api/v1/search?${params}`)
      const data = await response.json()

      if (data.items && data.items.length > 0) {
        // Transform API response to VehicleLite format
        const newVehicles = data.items.map((item: any) => ({
          vin: item.vin,
          year: item.year || 0,
          make: item.make || '',
          model: item.model || '',
          damage: item.damageLabel || item.damageDescription || 'Unknown',
          title: item.titleLabel || item.titleType || 'Unknown',
          location: [item.city, item.region, item.country].filter(Boolean).join(', ') || 'Unknown',
          status: item.status || 'unknown',
          statusLabel: item.statusLabel,
          estMin: item.estRetailValueUsd,
          estMax: item.estRetailValueUsd,
          buyNow: item.buyItNowUsd,
          currentBid: item.currentBidUsd,
        }))

        setDisplayedVehicles(prev => [...prev, ...newVehicles])
        setCanLoadMore(data.pagination?.hasMore || false)
        setNextCursor(data.pagination?.nextCursor || null)
      } else {
        setCanLoadMore(false)
        setNextCursor(null)
      }
    } catch (error) {
      console.error('Failed to load more vehicles:', error)
      setCanLoadMore(false)
    } finally {
      setIsLoadingMore(false)
    }
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
          <div className="mb-3 flex items-center gap-2">
            <PillTabs items={mainTabs} value={type} onChange={onTab} />
            <div className="relative">
              <button
                className={`pill ${isMoreType ? 'pill-active' : ''}`}
                onClick={() => {
                  if (isMoreType) {
                    onTab('auto')
                  } else {
                    setShowMoreDropdown(!showMoreDropdown)
                  }
                }}
              >
                {isMoreType
                  ? (moreOptions.find(o => o.id === type)?.label || t(lang,'More','Еще'))
                  : t(lang,'More','Еще')}
                <ChevronDown className="inline ml-1 w-4 h-4" />
              </button>
              {showMoreDropdown && !isMoreType && (
                <div className="absolute top-full mt-1 left-0 bg-bg-canvas border border-border-muted rounded-lg shadow-lg z-10 min-w-[180px]">
                  {moreOptions.map(opt => (
                    <button
                      key={opt.id}
                      className="block w-full text-left px-4 py-2 hover:bg-bg-muted text-sm"
                      onClick={() => {
                        onTab(opt.id)
                        setShowMoreDropdown(false)
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="filters-bar">
            <div className="select-wrap">
              <select className="select" value={make} onChange={e=>setMake(e.target.value)} disabled={loadingMakes}>
                <option value="">
                  {loadingMakes
                    ? t(lang,'Loading...','Загрузка...')
                    : t(lang,'All makes','Все марки')}
                </option>
                {availableMakes.map(m=><option key={m} value={m}>{m}</option>)}
              </select>
              <span className="chev"><ChevronDown/></span>
            </div>
            <div className="select-wrap">
              <select
                className="select"
                value={model}
                onChange={e=>setModel(e.target.value)}
                disabled={!make || loadingModels}
              >
                <option value="">
                  {loadingModels
                    ? t(lang,'Loading...','Загрузка...')
                    : t(lang,'All models','Все модели')}
                </option>
                {availableModels.map(m=><option key={m} value={m}>{m}</option>)}
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
          {displayedVehicles.map((v,idx)=>(<VehicleCard key={v.vin || idx} v={v} lang={lang}/>))}
        </div>

        {displayedVehicles.length === 0 && (
          <div className="text-center py-12 text-fg-muted">
            {t(lang, 'No vehicles found. Try adjusting your filters.', 'Автомобили не найдены. Попробуйте изменить фильтры.')}
          </div>
        )}

        {displayedVehicles.length > 0 && canLoadMore && (
          <div className="flex justify-center mt-8">
            <button
              className="btn btn-primary px-8"
              onClick={loadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore
                ? t(lang, 'Loading...', 'Загрузка...')
                : t(lang, 'Load more', 'Загрузить ещё')}
            </button>
          </div>
        )}

        {displayedVehicles.length > 0 && !canLoadMore && (
          <div className="text-center py-8 text-fg-muted text-sm">
            {t(lang, 'All vehicles loaded', 'Все автомобили загружены')}
          </div>
        )}
      </section>
    </main>
  )
}

