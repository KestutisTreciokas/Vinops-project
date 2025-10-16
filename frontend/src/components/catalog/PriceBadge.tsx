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
  let tone: 'tone-violet'|'tone-green'|'tone-blue'|'tone-amber'|'tone-neutral'|'tone-gray'|'tone-red' = 'tone-neutral'
  let show = true
  let icon = ''

  // Priority 1: SOLD (with final price if available)
  if (status==='sold'){
    icon = '✓'
    if (finalBid!=null){
      text = `${icon} ${nfUsd(finalBid,lang)}`
    }else{
      text = (lang==='ru') ? `${icon} Продано` : `${icon} Sold`
    }
    tone = 'tone-violet'
  }
  // Priority 2: ON APPROVAL / PENDING RESULT (awaiting final decision)
  else if (status==='pending_result' || status==='on_approval' || status==='approval'){
    icon = '⏳'
    text = (lang==='ru') ? `${icon} На утверждении` : `${icon} On Approval`
    tone = 'tone-amber'
  }
  // Priority 3: NOT SOLD (auction ended but didn't sell)
  else if (status==='not_sold' || status==='unsold' || status==='no_sale'){
    icon = '✗'
    text = (lang==='ru') ? `${icon} Не продано` : `${icon} Not Sold`
    tone = 'tone-gray'
  }
  // Priority 4: CANCELLED / WITHDRAWN
  else if (status==='cancelled' || status==='withdrawn'){
    icon = '⊘'
    text = (lang==='ru') ? `${icon} Отменён` : `${icon} Cancelled`
    tone = 'tone-gray'
  }
  // Priority 5: LIVE NOW / ACTIVE (with BUY IT NOW option first)
  else if (status==='active' || status==='live'){
    if (buyNow!=null){
      icon = '⚡'
      text = (lang==='ru') ? `${icon} Купить ${nfUsd(buyNow,lang)}` : `${icon} Buy Now ${nfUsd(buyNow,lang)}`
      tone = 'tone-green'
    } else if (currentBid!=null){
      icon = '🔴'
      text = (lang==='ru') ? `${icon} Ставка ${nfUsd(currentBid,lang)}` : `${icon} Bid ${nfUsd(currentBid,lang)}`
      tone = 'tone-blue'
    } else if (estMin!=null || estMax!=null){
      icon = '🔴'
      text = `${icon} ${usdRange(estMin,estMax,lang)}`
      tone = 'tone-blue'
    } else {
      icon = '🔴'
      text = (lang==='ru') ? `${icon} Идут торги` : `${icon} Live Now`
      tone = 'tone-blue'
    }
  }
  // Priority 6: OPEN / PRE-BID (accepting pre-bids before live auction)
  else if (status==='open' || status==='pre_bid' || status==='prebid'){
    icon = '📝'
    if (startingBid!=null){
      text = (lang==='ru') ? `${icon} От ${nfUsd(startingBid,lang)}` : `${icon} From ${nfUsd(startingBid,lang)}`
    } else if (estMin!=null || estMax!=null){
      text = `${icon} ${usdRange(estMin,estMax,lang)}`
    } else {
      text = (lang==='ru') ? `${icon} Приём ставок` : `${icon} Pre-Bid`
    }
    tone = 'tone-blue'
  }
  // Priority 7: UPCOMING (scheduled but not yet started)
  else if (status==='upcoming' || status==='scheduled'){
    icon = '📅'
    if (startingBid!=null){
      text = (lang==='ru') ? `${icon} От ${nfUsd(startingBid,lang)}` : `${icon} From ${nfUsd(startingBid,lang)}`
    } else if (estMin!=null || estMax!=null){
      text = `${icon} ${usdRange(estMin,estMax,lang)}`
    } else {
      text = (lang==='ru') ? `${icon} Скоро` : `${icon} Upcoming`
    }
    tone = 'tone-amber'
  }
  else {
    // Unknown status - hide badge
    show = false
  }

  if (!show) return null
  return <span className={`price pill ${tone} ${className}`} data-price>{text}</span>
}
