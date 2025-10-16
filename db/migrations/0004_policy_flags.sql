-- 0004_policy_flags.sql — Soft-delete flags + partial indexes (S-02)
-- Вводит is_removed на vehicles/lots/images и частичные индексы WHERE is_removed=false
-- Rollback strategy:
--   - DROP INDEX IF EXISTS lots_status_auction_active_idx;
--   - DROP INDEX IF EXISTS lots_vin_not_removed_idx;
--   - DROP INDEX IF EXISTS images_vin_not_removed_idx;
--   - DROP INDEX IF EXISTS images_lot_id_not_removed_idx;
--   - Колонки is_removed не удаляем в рамках S-02 (чтобы избежать потери данных); удаление колонок допускается только в отдельной согласованной миграции.

BEGIN;

-- Флаги soft-delete
ALTER TABLE IF EXISTS vehicles
  ADD COLUMN IF NOT EXISTS is_removed BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS lots
  ADD COLUMN IF NOT EXISTS is_removed BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE IF EXISTS images
  ADD COLUMN IF NOT EXISTS is_removed BOOLEAN NOT NULL DEFAULT false;

-- Частичные индексы под частые чтения
-- Каталог: фильтр по статусу и дате + исключение is_removed
CREATE INDEX IF NOT EXISTS lots_status_auction_active_idx
  ON lots (status, auction_datetime_utc DESC)
  WHERE is_removed = false;

-- Привязка лотов к VIN при условии публикации
CREATE INDEX IF NOT EXISTS lots_vin_not_removed_idx
  ON lots (vin)
  WHERE is_removed = false;

-- Галереи изображений (карточка VIN/лот) только непомеченные
CREATE INDEX IF NOT EXISTS images_vin_not_removed_idx
  ON images (vin)
  WHERE is_removed = false;

CREATE INDEX IF NOT EXISTS images_lot_id_not_removed_idx
  ON images (lot_id)
  WHERE is_removed = false;

COMMIT;
