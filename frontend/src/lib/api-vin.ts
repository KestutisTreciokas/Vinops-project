import type { VinData, Specs, LotInfo, HistoryItem, Photo } from '@/components/vin2/types'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || ''

// попытка привести произвольный ответ API к нашему VinData
function normalize(input: any): VinData {
  const photos: Photo[] = (input?.photos || input?.images || []).map((p: any, i: number) => ({
    id: p?.id ?? i+1,
    title: p?.title ?? `Фото #${i+1}`,
    url:  p?.url  ?? p?.src ?? undefined,
  }))

  const specs: Specs = {
    year: Number(input?.specs?.year ?? input?.year ?? 0),
    make: String(input?.specs?.make ?? input?.make ?? ''),
    model: String(input?.specs?.model ?? input?.model ?? ''),
    body: String(input?.specs?.body ?? input?.body ?? ''),
    engine: String(input?.specs?.engine ?? input?.engine ?? ''),
    transmission: String(input?.specs?.transmission ?? input?.transmission ?? ''),
    drive: String(input?.specs?.drive ?? input?.drive ?? ''),
    fuel: String(input?.specs?.fuel ?? input?.fuel ?? ''),
  }

  const lot: LotInfo = {
    lotNumber: String(input?.lot?.number ?? input?.lotNumber ?? ''),
    auction: String(input?.lot?.auction ?? input?.auction ?? ''),
    seller: String(input?.lot?.seller ?? input?.seller ?? ''),
    date: String(input?.lot?.date ?? input?.date ?? ''),
    odometer: String(input?.lot?.odometer ?? input?.odometer ?? ''),
    status: String(input?.lot?.status ?? input?.status ?? ''),
    finalBid: Number(input?.lot?.finalBid ?? input?.finalBid ?? 0),
  }

  const history: HistoryItem[] = (input?.history ?? input?.sales ?? []).map((h: any) => ({
    date: String(h?.date ?? ''),
    auction: String(h?.auction ?? ''),
    lot: String(h?.lot ?? ''),
    status: String(h?.status ?? ''),
    price: Number(h?.price ?? 0),
  }))

  return { photos, specs, lot, history }
}

export async function fetchVin(vin: string, lang: 'ru'|'en'): Promise<VinData> {
  if (!API_BASE) throw new Error('API base is not set')

  const url = `${API_BASE.replace(/\/$/,'')}/vin/${encodeURIComponent(vin)}?lang=${lang}`
  const res = await fetch(url, { next: { revalidate: 300 } })

  if (!res.ok) {
    throw new Error(`VIN API error: ${res.status}`)
  }

  const json = await res.json()
  return normalize(json)
}
