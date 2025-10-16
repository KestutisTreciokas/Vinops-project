# vinops — Схема БД (DDL v1 / S-02 Freeze)

Дата фиксации: Europe/Warsaw (зафиксировать коммитом).
Источник: MS-02-01 (Freeze схемы и целостность).

## Общие принципы
- Все VIN приводятся к **верхнему регистру**, запрещены буквы **I, O, Q**; допустимая длина **11–17**.
- Хранится: `vin` (PK, нормализованное значение) и `vin_normalized` (генерируемый столбец для поиска), опционально `vin_raw` (первичный ввод).
- Статусы лотов и продаж — строки из **допустимого домена**: `sold | active | upcoming | cancelled | withdrawn`.
- Миграции **не содержат** деструктивных операций (DROP/TRUNCATE/ALTER ... DROP).

---

## Таблицы

### 1) `vehicles`
**Назначение:** справочник авто по VIN.

| Поле           | Тип         | Ключ/индекс | Правила/описание |
|----------------|-------------|-------------|------------------|
| `vin`          | TEXT        | **PK**      | Нормализованный VIN (верхний регистр). |
| `vin_raw`      | TEXT        | —           | Исходный ввод (опционально). |
| `vin_normalized` | TEXT      | **UNIQUE**  | `GENERATED ALWAYS AS (upper(vin)) STORED`. |
| `make`         | TEXT        | —           | Марка. |
| `model`        | TEXT        | —           | Модель. |
| `year`         | INTEGER     | —           | CHECK: `1900..2100` (nullable). |
| `body`         | TEXT        | —           | Тип кузова. |
| `fuel`         | TEXT        | —           | Тип топлива. |
| `transmission` | TEXT        | —           | КПП. |
| `drive`        | TEXT        | —           | Привод. |
| `engine`       | TEXT        | —           | Двигатель. |
| `created_at`   | TIMESTAMPTZ | —           | `DEFAULT now()`. |
| `updated_at`   | TIMESTAMPTZ | —           | `DEFAULT now()`. |

**CHECK:**
- `vehicles_vin_format_ck` — `vin ~ '^[A-HJ-NPR-Z0-9]{11,17}$'`
- `vehicles_year_ck` — `year BETWEEN 1900 AND 2100` (nullable)
- `vehicles_vin_normalized_format_ck` — `vin_normalized ~ '^[A-HJ-NPR-Z0-9]{11,17}$'`

**Индексы:**
- `vehicles_vin_normalized_uidx` (UNIQUE) — `(vin_normalized)`

---

### 2) `lots`
**Назначение:** аукционные лоты.

| Поле                    | Тип         | Ключ/индекс | Правила/описание |
|-------------------------|-------------|-------------|------------------|
| `id`                    | BIGSERIAL   | **PK**      | Идентификатор лота. |
| `vin`                   | TEXT        | **FK**      | → `vehicles(vin)` (CASCADE UPDATE, RESTRICT DELETE). |
| `source`                | TEXT        | —           | Источник. |
| `site_code`             | TEXT        | —           | Площадка/код. |
| `city`                  | TEXT        | —           | Город. |
| `region`                | TEXT        | —           | Регион/штат. |
| `country`               | TEXT        | —           | Страна. |
| `tz`                    | TEXT        | —           | Таймзона площадки. |
| `auction_datetime_utc`  | TIMESTAMPTZ | **IDX**     | Дата/время аукциона (UTC). |
| `retail_value_usd`      | NUMERIC(12,2) | —         | CHECK: `>= 0` (nullable). |
| `status`                | TEXT        | **IDX**     | CHECK-домен (см. ниже). |
| `created_at`, `updated_at` | TIMESTAMPTZ | —        | `DEFAULT now()`.

**FK:**
- `lots_vin_fkey` — → `vehicles(vin)` (ON UPDATE CASCADE, ON DELETE RESTRICT)

**CHECK:**
- `lots_status_ck` — `status IN ('sold','active','upcoming','cancelled','withdrawn')`
- `lots_retail_nonneg_ck` — `retail_value_usd >= 0` (nullable)

**Индексы (чтение каталога):**
- `lots_status_auction_idx` — `(status, auction_datetime_utc DESC)`
- `lots_vin_idx` — `(vin)`

---

### 3) `sale_events`
**Назначение:** факты продажи/ставок по VIN/лоту.

| Поле            | Тип           | Ключ/индекс | Правила/описание |
|-----------------|---------------|-------------|------------------|
| `id`            | BIGSERIAL     | **PK**      | Идентификатор события. |
| `vin`           | TEXT          | **FK**, IDX | → `vehicles(vin)`. |
| `lot_id`        | BIGINT        | **FK**      | → `lots(id)`; ON DELETE SET NULL. |
| `sale_date`     | TIMESTAMPTZ   | **IDX**     | Дата события. |
| `status`        | TEXT          | —           | CHECK-домен (см. ниже). |
| `final_bid_usd` | NUMERIC(12,2) | —           | CHECK: `>= 0` (nullable). |
| `currency`      | CHAR(3)       | —           | CHECK: `^[A-Z]{3}$` (nullable). |
| `collected_via` | TEXT          | —           | Канал сбора. |
| `created_at`, `updated_at` | TIMESTAMPTZ | — | `DEFAULT now()`.

**FK:**
- `sale_events_vin_fkey` — → `vehicles(vin)` (CASCADE UPDATE, RESTRICT DELETE)
- `sale_events_lot_id_fkey` — → `lots(id)` (CASCADE UPDATE, DELETE SET NULL)

**CHECK:**
- `sale_events_status_ck` — `status IN ('sold','active','upcoming','cancelled','withdrawn')`
- `sale_events_currency_ck` — `currency ~ '^[A-Z]{3}$'`
- `sale_events_final_bid_nonneg_ck` — `final_bid_usd >= 0` (nullable)

**Индексы (карточка VIN/лента событий):**
- `sale_events_vin_date_idx` — `(vin, sale_date DESC)`

---

### 4) `images`
**Назначение:** изображения по VIN/лоту.

| Поле          | Тип     | Ключ/индекс | Правила/описание               |
|---------------|---------|-------------|--------------------------------|
| `id`          | BIGSERIAL | **PK**    | Идентификатор изображения.     |
| `vin`         | TEXT    | **FK**, IDX | → `vehicles(vin)`.             |
| `lot_id`      | BIGINT  | **FK**, IDX | → `lots(id)`.                  |
| `seq`         | INTEGER | —           | Порядковый номер.              |
| `variant`     | TEXT    | —           | Тип/вариант.                   |
| `storage_key` | TEXT    | —           | Ключ в хранилище.              |
| `source_url`  | TEXT    | —           | Источник.                      |
| `width`       | INTEGER | —           | CHECK: `>= 0` (nullable).      |
| `height`      | INTEGER | —           | CHECK: `>= 0` (nullable).      |
| `bytes`       | BIGINT  | —           | CHECK: `>= 0` (nullable).      |
| `content_hash`| TEXT    | —           | Хеш содержимого (опц.).        |
| `created_at`, `updated_at` | TIMESTAMPTZ | — | `DEFAULT now()`.

**FK:**
- `images_vin_fkey` — → `vehicles(vin)` (CASCADE UPDATE, RESTRICT DELETE)
- `images_lot_id_fkey` — → `lots(id)` (CASCADE UPDATE, DELETE SET NULL)

**CHECK:**
- `images_wh_nonneg_ck` — `(width >= 0) AND (height >= 0) AND (bytes >= 0)` (nullable-поля учитываются)

**Уникальность:**
- `images_uni_vin_lot_seq_variant` — UNIQUE `(vin, lot_id, seq, COALESCE(variant, ''))`

**Индексы (чтение карточки/галерея):**
- `images_vin_idx` — `(vin)`
- `images_lot_id_idx` — `(lot_id)`

---

## Домены/словари
- **VIN:** `'^[A-HJ-NPR-Z0-9]{11,17}$'` (верхний регистр; исключены I/O/Q).
- **Статусы:** `'sold' | 'active' | 'upcoming' | 'cancelled' | 'withdrawn'`.
- **Валюта (ISO-4217):** `'^[A-Z]{3}$'`.

## Отсутствие деструктивных операций
Миграция `0002_constraints.sql` не содержит `DROP`, `TRUNCATE`, `ALTER ... DROP ...`. В рамках S-02 — только `ALTER TABLE ADD ...`, `ADD CONSTRAINT`, `CREATE INDEX`.

