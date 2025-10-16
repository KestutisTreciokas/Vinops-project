# API v1 — Catalog (read-only DTO)

Дата (Europe/Warsaw): FIX BY COMMIT  
Источник: MS-02-03.

## DTO: `CatalogItem`
Минимальный набор под текущие карточки.

```ts
type CatalogItem = {
  vin: string;                    // normalized
  year?: number | null;
  make?: string | null;
  model?: string | null;
  status?: 'sold'|'active'|'upcoming'|'cancelled'|'withdrawn' | null;
  auctionDateUTC?: string | null; // ISO8601
  city?: string | null;
  region?: string | null;
  country?: string | null;
  previewUrl?: string | null;     // первая доступная картинка
  finalBidUSD?: number | null;    // если sold
  currentBidUSD?: number | null;  // если active (опц., может быть NULL в v1)
};
```
