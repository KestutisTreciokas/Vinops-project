'use client'

type Lang = 'ru' | 'en'
type Num = number | null | undefined

// Format currency with proper locale
function nfUsd(v: number, lang: Lang) {
  return new Intl.NumberFormat(lang === 'ru' ? 'ru-RU' : 'en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(v)
}

// Convert string/number to number or undefined
function num(x: any): number | undefined {
  if (x == null) return undefined
  const n = +x
  return Number.isFinite(n) ? n : undefined
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

interface BadgeResult {
  price: string
  label: string
  cssVar: string
  show: boolean
}

/**
 * PriceBadge - Displays price with a small label underneath
 *
 * Returns:
 * - Price value (e.g., "$16,541")
 * - Small gray label (e.g., "Retail Value", "Current Bid")
 */
export default function PriceBadge({
  item,
  lang = 'ru',
  className = ''
}: {
  item: any
  lang?: Lang
  className?: string
}) {
  const status = String(item?.status ?? '').toLowerCase()

  // Parse all available price fields
  const finalBid = num(item?.finalBid ?? item?.finalPrice ?? item?.soldPrice ?? item?.final_bid_usd)
  const buyNow = num(item?.buyNow ?? item?.buy_price ?? item?.buyNowPrice ?? item?.buy_it_now_usd)
  const currentBid = num(item?.currentBid ?? item?.bid ?? item?.latestBid ?? item?.current_bid_usd)
  const startingBid = num(item?.startingBid ?? item?.startBid ?? item?.starting_price)
  const estMin = num(item?.estMin ?? item?.estimateMin ?? item?.est?.min ?? item?.retail_value_usd)
  const estMax = num(item?.estMax ?? item?.estimateMax ?? item?.est?.max ?? item?.retail_value_usd)

  const result = selectPriceBadge(status, {
    finalBid,
    buyNow,
    currentBid,
    startingBid,
    estMin,
    estMax
  }, lang)

  if (!result.show) return null

  return (
    <div className={`price-badge-container ${className}`}>
      <span
        className="price pill"
        data-price="true"
        style={{
          backgroundColor: `var(${result.cssVar})`,
          color: '#ffffff',
          borderColor: `var(${result.cssVar})`,
          fontWeight: 600
        }}
        title={lang === 'ru' ? 'Не включает аукционные сборы' : 'Excludes auction fees'}
      >
        {result.price}
      </span>
      <span className="price-label">{result.label}</span>
    </div>
  )
}

/**
 * Core logic for selecting price badge content and styling
 */
function selectPriceBadge(
  status: string,
  prices: {
    finalBid?: number
    buyNow?: number
    currentBid?: number
    startingBid?: number
    estMin?: number
    estMax?: number
  },
  lang: Lang
): BadgeResult {
  const { finalBid, buyNow, currentBid, startingBid, estMin, estMax } = prices

  switch (status) {
    // ========== SOLD ==========
    case 'sold':
      if (finalBid != null && finalBid > 0) {
        return {
          price: nfUsd(finalBid, lang),
          label: lang === 'ru' ? 'Финальная ставка' : 'Final Bid',
          cssVar: '--price-success',
          show: true
        }
      }
      return {
        price: lang === 'ru' ? 'Продано' : 'Sold',
        label: '',
        cssVar: '--price-success',
        show: true
      }

    // ========== ON APPROVAL / PENDING RESULT ==========
    case 'on_approval':
    case 'pending_result':
    case 'approval':
      const highBidApproval = finalBid ?? currentBid
      if (highBidApproval != null && highBidApproval > 0) {
        return {
          price: nfUsd(highBidApproval, lang),
          label: lang === 'ru' ? 'Высшая ставка' : 'High Bid',
          cssVar: '--price-pending',
          show: true
        }
      }
      return {
        price: lang === 'ru' ? 'На утверждении' : 'On Approval',
        label: '',
        cssVar: '--price-pending',
        show: true
      }

    // ========== NOT SOLD ==========
    case 'not_sold':
    case 'unsold':
    case 'no_sale':
      const highBidNotSold = finalBid ?? currentBid
      if (highBidNotSold != null && highBidNotSold > 0) {
        return {
          price: nfUsd(highBidNotSold, lang),
          label: lang === 'ru' ? 'Последняя ставка' : 'Last Bid',
          cssVar: '--price-neutral',
          show: true
        }
      }
      return {
        price: lang === 'ru' ? 'Не продано' : 'Not Sold',
        label: '',
        cssVar: '--price-neutral',
        show: true
      }

    // ========== LIVE / ACTIVE ==========
    case 'live':
    case 'active':
      // Priority: Buy Now > Current Bid > Retail Value
      if (buyNow != null && buyNow > 0) {
        return {
          price: nfUsd(buyNow, lang),
          label: lang === 'ru' ? 'Купить сейчас' : 'Buy Now',
          cssVar: '--price-accent',
          show: true
        }
      }
      if (currentBid != null && currentBid > 0) {
        return {
          price: nfUsd(currentBid, lang),
          label: lang === 'ru' ? 'Текущая ставка' : 'Current Bid',
          cssVar: '--price-live',
          show: true
        }
      }
      // Show retail value
      if (estMin != null && estMin > 0) {
        return {
          price: nfUsd(estMin, lang),
          label: lang === 'ru' ? 'Розничная цена' : 'Retail Value',
          cssVar: '--price-info',
          show: true
        }
      }
      // No price data at all
      return {
        price: '',
        label: '',
        cssVar: '--price-info',
        show: false
      }

    // ========== UPCOMING ==========
    case 'upcoming':
    case 'scheduled':
      if (buyNow != null && buyNow > 0) {
        return {
          price: nfUsd(buyNow, lang),
          label: lang === 'ru' ? 'Купить сейчас' : 'Buy Now',
          cssVar: '--price-accent',
          show: true
        }
      }
      if (currentBid != null && currentBid > 0) {
        return {
          price: nfUsd(currentBid, lang),
          label: lang === 'ru' ? 'Предварительная ставка' : 'Pre-Bid',
          cssVar: '--price-info',
          show: true
        }
      }
      if (startingBid != null && startingBid > 0) {
        return {
          price: nfUsd(startingBid, lang),
          label: lang === 'ru' ? 'Стартовая цена' : 'Starting Bid',
          cssVar: '--price-info',
          show: true
        }
      }
      if (estMin != null && estMin > 0) {
        return {
          price: nfUsd(estMin, lang),
          label: lang === 'ru' ? 'Розничная цена' : 'Retail Value',
          cssVar: '--price-info',
          show: true
        }
      }
      return {
        price: lang === 'ru' ? 'Скоро' : 'Upcoming',
        label: '',
        cssVar: '--price-info',
        show: true
      }

    // ========== RELISTED ==========
    case 'relisted':
      if (buyNow != null && buyNow > 0) {
        return {
          price: nfUsd(buyNow, lang),
          label: lang === 'ru' ? 'Купить сейчас' : 'Buy Now',
          cssVar: '--price-accent',
          show: true
        }
      }
      if (currentBid != null && currentBid > 0) {
        return {
          price: nfUsd(currentBid, lang),
          label: lang === 'ru' ? 'Текущая ставка' : 'Current Bid',
          cssVar: '--price-info',
          show: true
        }
      }
      if (startingBid != null && startingBid > 0) {
        return {
          price: nfUsd(startingBid, lang),
          label: lang === 'ru' ? 'Стартовая цена' : 'Starting Bid',
          cssVar: '--price-info',
          show: true
        }
      }
      return {
        price: lang === 'ru' ? 'Повторно' : 'Relisted',
        label: '',
        cssVar: '--status-teal',
        show: true
      }

    // ========== MIN_BID / ON MINIMUM BID ==========
    case 'min_bid':
    case 'minimum_bid':
      if (currentBid != null && currentBid > 0) {
        return {
          price: nfUsd(currentBid, lang),
          label: lang === 'ru' ? 'Минимальная ставка' : 'Minimum Bid',
          cssVar: '--price-warning',
          show: true
        }
      }
      return {
        price: lang === 'ru' ? 'Мин. ставка' : 'Min Bid',
        label: '',
        cssVar: '--price-warning',
        show: true
      }

    // ========== BUY NOW ONLY ==========
    case 'buy_now_only':
    case 'buy_now':
      if (buyNow != null && buyNow > 0) {
        return {
          price: nfUsd(buyNow, lang),
          label: lang === 'ru' ? 'Купить сейчас' : 'Buy Now',
          cssVar: '--price-accent',
          show: true
        }
      }
      return {
        price: lang === 'ru' ? 'Купить сейчас' : 'Buy Now',
        label: '',
        cssVar: '--price-accent',
        show: true
      }

    // ========== CANCELLED / WITHDRAWN ==========
    case 'cancelled':
    case 'withdrawn':
      return {
        price: '',
        label: '',
        cssVar: '--status-muted',
        show: false
      }

    // ========== PENDING PAYMENT ==========
    case 'pending_payment':
    case 'awarded':
      if (finalBid != null && finalBid > 0) {
        return {
          price: nfUsd(finalBid, lang),
          label: lang === 'ru' ? 'Финальная ставка' : 'Final Bid',
          cssVar: '--price-success',
          show: true
        }
      }
      return {
        price: lang === 'ru' ? 'Продано' : 'Awarded',
        label: '',
        cssVar: '--price-success',
        show: true
      }

    // ========== OPEN / PRE_BID ==========
    case 'open':
    case 'pre_bid':
    case 'prebid':
      if (startingBid != null && startingBid > 0) {
        return {
          price: nfUsd(startingBid, lang),
          label: lang === 'ru' ? 'Стартовая цена' : 'Starting Bid',
          cssVar: '--price-info',
          show: true
        }
      }
      if (estMin != null && estMin > 0) {
        return {
          price: nfUsd(estMin, lang),
          label: lang === 'ru' ? 'Розничная цена' : 'Retail Value',
          cssVar: '--price-info',
          show: true
        }
      }
      return {
        price: lang === 'ru' ? 'Приём ставок' : 'Pre-Bid',
        label: '',
        cssVar: '--price-info',
        show: true
      }

    // ========== UNKNOWN / DEFAULT ==========
    default:
      return {
        price: '',
        label: '',
        cssVar: '--status-muted',
        show: false
      }
  }
}
