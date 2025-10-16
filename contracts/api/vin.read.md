# API v1 — VIN page (read-only DTO)

Дата (Europe/Warsaw): FIX BY COMMIT  
Источник: MS-02-03.

## DTO: `VinResponse`
Основные блоки страницы VIN.

```ts
type VinResponse = {
  vin: string;   // normalized (UPPERCASE)
  specs: {
    year?: number|null;
    make?: string|null;
    model?: string|null;
    body?: string|null;
    fuel?: string|null;
    transmission?: string|null;
    drive?: string|null;
    engine?: string|null;
  };
  lot?: {
    id: number;
    status?: 'sold'|'active'|'upcoming'|'cancelled'|'withdrawn'|null;
    source?: string|null;
    siteCode?: string|null;
    city?: string|null;
    region?: string|null;
    country?: string|null;
    tz?: string|null;
    auctionDateUTC?: string|null;   // ISO8601
    retailValueUSD?: number|null;
  } | null;
  history: Array<{
    date?: string|null;             // ISO8601
    status?: string|null;           // канонизировать к домену (см. domains/status.md)
    finalBidUSD?: number|null;
    currency?: string|null;         // ISO-4217 (CHAR(3))
    lotId?: number|null;
    collectedVia?: string|null;
  }>;
  photos: Array<{
    id: number;
    lotId?: number|null;
    seq?: number|null;
    variant?: string|null;
    url?: string|null;              // из source_url либо построение по storage_key
    width?: number|null;
    height?: number|null;
    bytes?: number|null;
    contentHash?: string|null;
    title?: string|null;
  }>;
};
```

---

## Маппинг «БД → DTO»

> Эта секция фиксирует соответствие между полями БД (DDL v1 / S-02) и полями ответа `VinResponse`.

### 1) vehicles → `vin` и `specs`
| БД                                   | DTO                                   | Примечания |
|--------------------------------------|----------------------------------------|------------|
| `vehicles.vin`                       | `vin`                                  | Нормализованный VIN (UPPERCASE). |
| `vehicles.year`                      | `specs.year`                           | `number \| null` |
| `vehicles.make`                      | `specs.make`                           | `string \| null` |
| `vehicles.model`                     | `specs.model`                          | `string \| null` |
| `vehicles.body`                      | `specs.body`                           | `string \| null` |
| `vehicles.fuel`                      | `specs.fuel`                           | `string \| null` |
| `vehicles.transmission`              | `specs.transmission`                   | `string \| null` |
| `vehicles.drive`                     | `specs.drive`                          | `string \| null` |
| `vehicles.engine`                    | `specs.engine`                         | `string \| null` |

### 2) lots (актуальный/последний) → `lot`
| БД                                   | DTO                                   | Примечания |
|--------------------------------------|----------------------------------------|------------|
| `lots.id`                            | `lot.id`                               | `number` |
| `lots.status`                        | `lot.status`                           | Канонизация в `sold\|active\|upcoming\|cancelled\|withdrawn` (см. `contracts/domains/status.md`). |
| `lots.source`                        | `lot.source`                           | `string \| null` |
| `lots.site_code`                     | `lot.siteCode`                         | `string \| null` |
| `lots.city`                          | `lot.city`                             | `string \| null` |
| `lots.region`                        | `lot.region`                           | `string \| null` |
| `lots.country`                       | `lot.country`                          | `string \| null` |
| `lots.tz`                            | `lot.tz`                               | `string \| null` |
| `lots.auction_datetime_utc`          | `lot.auctionDateUTC`                   | ISO 8601 строка \| null |
| `lots.retail_value_usd`              | `lot.retailValueUSD`                   | `number \| null` |

### 3) sale_events (лента) → `history[]`
| БД                                   | DTO                                   | Примечания |
|--------------------------------------|----------------------------------------|------------|
| `sale_events.sale_date`              | `history[].date`                       | ISO 8601 строка \| null |
| `sale_events.status`                 | `history[].status`                     | Канонизация к домену статусов. |
| `sale_events.final_bid_usd`          | `history[].finalBidUSD`                | `number \| null` |
| `sale_events.currency`               | `history[].currency`                   | `string(3) \| null` (ISO-4217) |
| `sale_events.lot_id`                 | `history[].lotId`                      | `number \| null` |
| `sale_events.collected_via`          | `history[].collectedVia`               | `string \| null` |

### 4) images → `photos[]`
| БД                                   | DTO                                   | Примечания |
|--------------------------------------|----------------------------------------|------------|
| `images.id`                          | `photos[].id`                          | `number` |
| `images.lot_id`                      | `photos[].lotId`                       | `number \| null` |
| `images.seq`                         | `photos[].seq`                         | `number \| null` |
| `images.variant`                     | `photos[].variant`                     | `string \| null` |
| `images.source_url`                  | `photos[].url`                         | Приоритет: `source_url`. |
| `images.storage_key`                 | `photos[].url`                         | **UNKNOWN**: if `source_url` отсутствует — URL строится по `storage_key`. **Как проверить:** предоставить правило построения (база CDN/storage) в S-03. |
| `images.width`                       | `photos[].width`                       | `number \| null` |
| `images.height`                      | `photos[].height`                      | `number \| null` |
| `images.bytes`                       | `photos[].bytes`                       | `number \| null` |
| `images.content_hash`                | `photos[].contentHash`                 | `string \| null` |

### Совместимость с текущими моками (отметки для S-03)
- **VIN длина:** UI текст «VIN must be 17 characters» заменить на «VIN must be **11–17** characters».  
- **Статусы:** синонимы (`ACTIVE`, `live`, `pending`, `no_sale`) канонизировать к домену (`active`, `upcoming`, `withdrawn`).  
- **Локализация:** английская версия не должна содержать русские подписи (исправляется в фронтенд-спринте, вне S-02).

