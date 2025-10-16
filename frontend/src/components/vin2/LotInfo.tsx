'use client'

import Row from './_Row'
import CopyButton from '@/components/common/CopyButton'
import { formatDateISO, formatMiles, formatUsd } from '@/lib/format'

export default function LotInfo({ lot, history, lang='ru' }:{
  lot: any; history?: any[]; lang?: 'ru'|'en'
}) {
  const t = (ru: string, en: string) => (lang === 'ru' ? ru : en)

  // маленькие монохромные иконки (inline SVG)
  const stroke = { stroke: 'currentColor', strokeWidth: 2, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const I = {
    num:    (<svg width="16" height="16" viewBox="0 0 24 24" {...stroke}><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h4"/></svg>),
    auc:    (<svg width="16" height="16" viewBox="0 0 24 24" {...stroke}><path d="M7 10l5-5 5 5M12 5v14"/></svg>),
    seller: (<svg width="16" height="16" viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="8" r="4"/><path d="M4 20c2.5-4 13.5-4 16 0"/></svg>),
    date:   (<svg width="16" height="16" viewBox="0 0 24 24" {...stroke}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>),
    odo:    (<svg width="16" height="16" viewBox="0 0 24 24" {...stroke}><circle cx="12" cy="12" r="8"/><path d="M12 12l4-2"/></svg>),
    status: (<svg width="16" height="16" viewBox="0 0 24 24" {...stroke}><path d="M20 6l-11 11-5-5"/></svg>),
    price:  (<svg width="16" height="16" viewBox="0 0 24 24" {...stroke}><path d="M12 1v22M17 5H9a3 3 0 100 6h6a3 3 0 110 6H7"/></svg>)
  }

  // Фоллбэк lotNumber: lot.lotNumber -> lot.lot -> первый осмысленный lot из history
  const historyLot = Array.isArray(history)
    ? (history.find((r:any)=> r && r.lot)?.lot ?? history[0]?.lot)
    : undefined
  const lotNumber = lot?.lotNumber ?? lot?.lot ?? historyLot ?? null

  return (
    <div className="card p-4">
      <h3 className="card-title mb-3">{t('Информация о лоте', 'Lot info')}</h3>
      <div className="space-y-2 text-sm">
        <Row
          k={<span className="inline-flex items-center gap-2">{I.num}{t('Номер лота','Lot number')}</span>}
          v={
            lotNumber
              ? <span className="inline-flex items-center gap-2">
                  {String(lotNumber)}
                  <CopyButton text={String(lotNumber)} title={t('Скопировать номер','Copy number')} />
                </span>
              : '—'
          }
        />
        <Row k={<span className="inline-flex items-center gap-2">{I.auc}{t('Аукцион','Auction')}</span>}   v={lot?.auction ?? '—'} />
        <Row k={<span className="inline-flex items-center gap-2">{I.seller}{t('Продавец','Seller')}</span>} v={lot?.seller ?? '—'} />
        <Row k={<span className="inline-flex items-center gap-2">{I.date}{t('Дата','Date')}</span>}     v={formatDateISO(lot?.date, lang)} />
        <Row k={<span className="inline-flex items-center gap-2">{I.odo}{t('Пробег','Odometer')}</span>} v={formatMiles(lot?.odometer, lang)} />
        <Row k={<span className="inline-flex items-center gap-2">{I.status}{t('Статус','Status')}</span>} v={lot?.status ?? '—'} />
        <Row k={<span className="inline-flex items-center gap-2">{I.price}{t('Итоговая ставка','Final bid')}</span>} v={formatUsd(lot?.finalBid, lang)} />
      </div>
    </div>
  )
}
