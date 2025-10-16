'use client'

type Lang = 'ru'|'en'
type Num = number | null | undefined

function nfUsd(v: number, lang: Lang){
  return new Intl.NumberFormat(lang==='ru'?'ru-RU':'en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v)
}
function shortUsd(v: number, lang: Lang){
  if (v>=1000 && v%1000===0) return (lang==='ru' ? `${(v/1000).toString()} 000 $` : `$${(v/1000).toString()}000`)
  if (v>=1000) return (lang==='ru' ? `${Math.round(v/1000)}–${Math.round(v/1000)}k $` : `$${Math.round(v/1000)}k`)
  return nfUsd(v,lang)
}
function usdRange(min?: Num, max?: Num, lang: Lang='en'){
  if (min==null && max==null) return ''
  if (min!=null && max!=null){
    const a = Math.round(min/1000), b = Math.round(max/1000)
    return (lang==='ru') ? `Оценка $${a}–${b}k` : `Est. $${a}–${b}k`
  }
  const v = (min ?? max) as number
  return (lang==='ru') ? `Оценка ${nfUsd(v,lang)}` : `Est. ${nfUsd(v,lang)}`
}

export type PriceBadgeInput = {
  status?: string
  finalBid?: Num | string
  buyNow?: Num | string
  currentBid?: Num | string
  startingBid?: Num | string
  estMin?: Num | string
  estMax?: Num | string
}

function num(x: any): number | undefined{
  if (x==null) return undefined
  const n = +x
  return Number.isFinite(n) ? n : undefined
}

export default function PriceBadge({
  item, lang='ru', className=''
}: { item: any, lang?: Lang, className?: string }){
  const status = String(item?.status ?? '').toLowerCase()

  const finalBid    = num(item?.finalBid    ?? item?.finalPrice ?? item?.soldPrice)
  const buyNow      = num(item?.buyNow      ?? item?.buy_price ?? item?.buyNowPrice)
  const currentBid  = num(item?.currentBid  ?? item?.bid       ?? item?.latestBid)
  const startingBid = num(item?.startingBid ?? item?.startBid  ?? item?.starting_price)

  const estMin = num(item?.estMin ?? item?.estimateMin ?? item?.est?.min)
  const estMax = num(item?.estMax ?? item?.estimateMax ?? item?.est?.max)

  let text = ''
  let tone: 'tone-violet'|'tone-green'|'tone-blue'|'tone-amber'|'tone-neutral'|'tone-gray' = 'tone-neutral'
  let show = true

  if (status==='sold'){
    if (finalBid!=null){
      text = nfUsd(finalBid,lang)
    }else{
      text = (lang==='ru') ? 'Продано' : 'Sold'
    }
    tone = 'tone-violet'
  }
  else if (status==='active'){
    if (buyNow!=null){
      text = (lang==='ru') ? `Купить ${nfUsd(buyNow,lang)}` : `Buy ${nfUsd(buyNow,lang)}`
      tone = 'tone-green'
    } else if (currentBid!=null){
      text = (lang==='ru') ? `Ставка ${nfUsd(currentBid,lang)}` : `Bid ${nfUsd(currentBid,lang)}`
      tone = 'tone-blue'
    } else if (estMin!=null || estMax!=null){
      text = usdRange(estMin,estMax,lang)
      tone = 'tone-neutral'
    } else {
      text = (lang==='ru') ? 'Идут торги' : 'Active'
      tone = 'tone-blue'
    }
  }
  else if (status==='upcoming'){
    if (startingBid!=null){
      text = (lang==='ru') ? `От ${nfUsd(startingBid,lang)}` : `From ${nfUsd(startingBid,lang)}`
      tone = 'tone-amber'
    } else if (estMin!=null || estMax!=null){
      text = usdRange(estMin,estMax,lang)
      tone = 'tone-neutral'
    } else {
      text = (lang==='ru') ? 'Скоро' : 'Upcoming'
      tone = 'tone-amber'
    }
  }
  else if (status==='cancelled' || status==='withdrawn'){
    text = (lang==='ru') ? 'Отменён' : 'Cancelled'
    tone = 'tone-gray'
  }
  else {
    // «прочее» — можно скрыть, если хочется «чистую» карточку
    show = false
  }

  if (!show) return null
  return <span className={`price pill ${tone} ${className}`} data-price>{text}</span>
}
