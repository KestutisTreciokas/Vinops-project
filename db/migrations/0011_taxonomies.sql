-- Migration 0011: Taxonomies (RU/EN)
-- Sprint: S1B ETL — CSV Domain Normalization
-- Purpose: Create lookup tables for bilingual taxonomies
-- Date: 2025-10-16

-- Create taxonomies schema
CREATE SCHEMA IF NOT EXISTS taxonomies;

-- Helper function to create taxonomy tables with standard structure
CREATE OR REPLACE FUNCTION create_taxonomy_table(table_name TEXT) RETURNS VOID AS $$
BEGIN
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS taxonomies.%I (
      code TEXT PRIMARY KEY,
      en TEXT NOT NULL,
      ru TEXT NOT NULL,
      category TEXT,
      sort_order INT DEFAULT 999,
      deprecated BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      CONSTRAINT %I_code_format_ck CHECK (code ~ ''^[a-z0-9_]+$'')
    )
  ', table_name, table_name);
END;
$$ LANGUAGE plpgsql;

-- Create all taxonomy tables
SELECT create_taxonomy_table('damage_types');
SELECT create_taxonomy_table('title_types');
SELECT create_taxonomy_table('statuses');
SELECT create_taxonomy_table('odometer_brands');
SELECT create_taxonomy_table('body_styles');
SELECT create_taxonomy_table('fuel_types');
SELECT create_taxonomy_table('transmission_types');
SELECT create_taxonomy_table('drive_types');
SELECT create_taxonomy_table('colors');
SELECT create_taxonomy_table('runs_drives_status');

-- Seed damage types
INSERT INTO taxonomies.damage_types (code, en, ru, category, sort_order) VALUES
  ('damage_flood', 'Water/Flood Damage', 'Повреждение водой/наводнением', 'water', 1),
  ('damage_rear_end', 'Rear End Damage', 'Повреждение задней части', 'collision', 2),
  ('damage_front_end', 'Front End Damage', 'Повреждение передней части', 'collision', 3),
  ('damage_mechanical', 'Mechanical Damage', 'Механические повреждения', 'mechanical', 4),
  ('damage_normal_wear', 'Normal Wear', 'Нормальный износ', 'wear', 5),
  ('damage_minor_dent', 'Minor Dents/Scratches', 'Небольшие вмятины/царапины', 'wear', 6),
  ('damage_all_over', 'All Over Damage', 'Повреждения по всему кузову', 'collision', 7),
  ('damage_hail', 'Hail Damage', 'Повреждение градом', 'weather', 8),
  ('damage_undercarriage', 'Undercarriage Damage', 'Повреждение днища', 'mechanical', 9),
  ('damage_side', 'Side Damage', 'Боковое повреждение', 'collision', 10),
  ('damage_frame', 'Frame Damage', 'Повреждение рамы', 'structural', 11),
  ('damage_burn_engine', 'Burn — Engine', 'Возгорание двигателя', 'fire', 12),
  ('damage_burn_interior', 'Burn — Interior', 'Возгорание салона', 'fire', 13),
  ('damage_vandalism', 'Vandalism', 'Вандализм', 'other', 14),
  ('damage_biohazard', 'Biohazard/Chemical', 'Биологическая/химическая опасность', 'other', 15),
  ('damage_roof', 'Top/Roof Damage', 'Повреждение крыши', 'structural', 16),
  ('damage_rollover', 'Rollover Damage', 'Опрокидывание', 'collision', 17),
  ('damage_unknown', 'Unknown Damage', 'Неизвестное повреждение', 'other', 999);

-- Seed title types
INSERT INTO taxonomies.title_types (code, en, ru, category, sort_order) VALUES
  ('title_clear', 'Clear Title (CL)', 'Чистый титул (CL)', 'clear', 1),
  ('title_certificate_of_title', 'Certificate of Title (CT)', 'Свидетельство о праве собственности (CT)', 'clear', 2),
  ('title_salvage', 'Salvage (SV)', 'Утилизация (SV)', 'salvage', 3),
  ('title_salvage_certificate', 'Salvage Certificate (SC)', 'Свидетельство об утилизации (SC)', 'salvage', 4),
  ('title_non_repairable', 'Non-Repairable (NR)', 'Не подлежит ремонту (NR)', 'salvage', 5),
  ('title_rebuilt', 'Rebuilt (RB)', 'Восстановленный (RB)', 'rebuilt', 6),
  ('title_junk', 'Junk (JK)', 'На запчасти (JK)', 'salvage', 7),
  ('title_parts_only', 'Parts Only (PR)', 'Только запчасти (PR)', 'salvage', 8),
  ('title_bond_title', 'Bond Title (BN)', 'Титул под залогом (BN)', 'special', 9),
  ('title_certificate_of_destruction', 'Certificate of Destruction (WT)', 'Свидетельство об уничтожении (WT)', 'salvage', 10),
  ('title_unknown', 'Unknown Title', 'Неизвестный титул', 'other', 999);

-- Seed statuses
INSERT INTO taxonomies.statuses (code, en, ru, category, sort_order) VALUES
  ('status_active', 'Active for Sale', 'Активный лот', 'active', 1),
  ('status_scheduled', 'Scheduled/Future Sale', 'Запланирован', 'future', 2),
  ('status_pending_result', 'Pending Result', 'Ожидание результата', 'pending', 3),
  ('status_sold', 'Sold', 'Продан', 'closed', 4),
  ('status_on_hold', 'On Hold', 'На удержании', 'paused', 5),
  ('status_cancelled', 'Cancelled', 'Отменён', 'closed', 6),
  ('status_unknown', 'Unknown Status', 'Неизвестный статус', 'other', 999);

-- Seed odometer brands
INSERT INTO taxonomies.odometer_brands (code, en, ru, category, sort_order) VALUES
  ('odometer_actual', 'Actual Mileage', 'Фактический пробег', 'reliable', 1),
  ('odometer_not_actual', 'Not Actual Mileage', 'Не фактический пробег', 'unreliable', 2),
  ('odometer_exempt', 'Exempt from Reporting', 'Освобождён от отчётности', 'exempt', 3),
  ('odometer_tmu', 'True Mileage Unknown (TMU)', 'Настоящий пробег неизвестен', 'unreliable', 4),
  ('odometer_replaced', 'Odometer Replaced', 'Одометр заменён', 'unreliable', 5),
  ('odometer_mechanical', 'Mechanical Odometer', 'Механический одометр', 'other', 6),
  ('odometer_unknown', 'Unknown', 'Неизвестно', 'other', 999);

-- Seed body styles
INSERT INTO taxonomies.body_styles (code, en, ru, category, sort_order) VALUES
  ('body_sedan', 'Sedan', 'Седан', 'passenger', 1),
  ('body_suv', 'SUV', 'Внедорожник', 'suv', 2),
  ('body_pickup_truck', 'Pickup Truck', 'Пикап', 'truck', 3),
  ('body_van', 'Van', 'Фургон', 'commercial', 4),
  ('body_coupe', 'Coupe', 'Купе', 'passenger', 5),
  ('body_convertible', 'Convertible', 'Кабриолет', 'passenger', 6),
  ('body_hatchback', 'Hatchback', 'Хэтчбек', 'passenger', 7),
  ('body_wagon', 'Wagon', 'Универсал', 'passenger', 8),
  ('body_crossover', 'Crossover', 'Кроссовер', 'suv', 9);

-- Seed fuel types
INSERT INTO taxonomies.fuel_types (code, en, ru, category, sort_order) VALUES
  ('fuel_gasoline', 'Gasoline', 'Бензин', 'fossil', 1),
  ('fuel_diesel', 'Diesel', 'Дизель', 'fossil', 2),
  ('fuel_hybrid', 'Hybrid', 'Гибрид', 'alternative', 3),
  ('fuel_electric', 'Electric', 'Электрический', 'alternative', 4),
  ('fuel_flex_fuel', 'Flex Fuel', 'Многотопливный', 'fossil', 5),
  ('fuel_plug_in_hybrid', 'Plug-in Hybrid', 'Подключаемый гибрид', 'alternative', 6),
  ('fuel_hydrogen', 'Hydrogen', 'Водород', 'alternative', 7),
  ('fuel_cng', 'CNG (Compressed Natural Gas)', 'СПГ (сжатый природный газ)', 'alternative', 8);

-- Seed transmission types
INSERT INTO taxonomies.transmission_types (code, en, ru, category, sort_order) VALUES
  ('transmission_automatic', 'Automatic', 'Автоматическая', 'automatic', 1),
  ('transmission_manual', 'Manual', 'Механическая', 'manual', 2),
  ('transmission_cvt', 'CVT (Continuously Variable)', 'CVT (бесступенчатая)', 'automatic', 3),
  ('transmission_dct', 'DCT (Dual-Clutch)', 'DCT (с двойным сцеплением)', 'automatic', 4);

-- Seed drive types
INSERT INTO taxonomies.drive_types (code, en, ru, category, sort_order) VALUES
  ('drive_fwd', 'Front-Wheel Drive (FWD)', 'Передний привод (FWD)', '2wd', 1),
  ('drive_rwd', 'Rear-Wheel Drive (RWD)', 'Задний привод (RWD)', '2wd', 2),
  ('drive_awd', 'All-Wheel Drive (AWD)', 'Полный привод (AWD)', '4wd', 3),
  ('drive_4wd', 'Four-Wheel Drive (4WD)', 'Полный привод (4WD)', '4wd', 4);

-- Seed colors
INSERT INTO taxonomies.colors (code, en, ru, category, sort_order) VALUES
  ('color_black', 'Black', 'Чёрный', 'neutral', 1),
  ('color_white', 'White', 'Белый', 'neutral', 2),
  ('color_silver', 'Silver', 'Серебристый', 'neutral', 3),
  ('color_gray', 'Gray', 'Серый', 'neutral', 4),
  ('color_blue', 'Blue', 'Синий', 'cool', 5),
  ('color_red', 'Red', 'Красный', 'warm', 6),
  ('color_green', 'Green', 'Зелёный', 'cool', 7),
  ('color_beige', 'Beige', 'Бежевый', 'neutral', 8),
  ('color_brown', 'Brown', 'Коричневый', 'warm', 9),
  ('color_gold', 'Gold', 'Золотой', 'warm', 10),
  ('color_yellow', 'Yellow', 'Жёлтый', 'warm', 11),
  ('color_orange', 'Orange', 'Оранжевый', 'warm', 12),
  ('color_purple', 'Purple', 'Фиолетовый', 'cool', 13),
  ('color_other', 'Other', 'Другой', 'other', 999);

-- Seed runs/drives status
INSERT INTO taxonomies.runs_drives_status (code, en, ru, category, sort_order) VALUES
  ('runs_drives_yes', 'Runs and Drives', 'Заводится и едет', 'operational', 1),
  ('runs_drives_no', 'Does Not Run or Drive', 'Не заводится/не едет', 'non_operational', 2),
  ('runs_drives_unknown', 'Unknown', 'Неизвестно', 'unknown', 999);

-- Create helper function for localized lookups
CREATE OR REPLACE FUNCTION get_taxonomy_label(
  domain TEXT,
  code TEXT,
  lang TEXT DEFAULT 'en'
) RETURNS TEXT AS $$
DECLARE
  label TEXT;
BEGIN
  EXECUTE format('SELECT %I FROM taxonomies.%I WHERE code = $1', lang, domain)
  INTO label
  USING code;

  RETURN COALESCE(label, code);
END;
$$ LANGUAGE plpgsql STABLE;

-- Create API schema if not exists
CREATE SCHEMA IF NOT EXISTS api;

-- Create view for API consumption
CREATE OR REPLACE VIEW api.taxonomies_all AS
SELECT
  'damage_types' AS domain,
  code,
  jsonb_build_object('en', en, 'ru', ru) AS label,
  category,
  sort_order
FROM taxonomies.damage_types
WHERE NOT deprecated
UNION ALL
SELECT 'title_types', code, jsonb_build_object('en', en, 'ru', ru), category, sort_order FROM taxonomies.title_types WHERE NOT deprecated
UNION ALL
SELECT 'statuses', code, jsonb_build_object('en', en, 'ru', ru), category, sort_order FROM taxonomies.statuses WHERE NOT deprecated
UNION ALL
SELECT 'odometer_brands', code, jsonb_build_object('en', en, 'ru', ru), category, sort_order FROM taxonomies.odometer_brands WHERE NOT deprecated
UNION ALL
SELECT 'body_styles', code, jsonb_build_object('en', en, 'ru', ru), category, sort_order FROM taxonomies.body_styles WHERE NOT deprecated
UNION ALL
SELECT 'fuel_types', code, jsonb_build_object('en', en, 'ru', ru), category, sort_order FROM taxonomies.fuel_types WHERE NOT deprecated
UNION ALL
SELECT 'transmission_types', code, jsonb_build_object('en', en, 'ru', ru), category, sort_order FROM taxonomies.transmission_types WHERE NOT deprecated
UNION ALL
SELECT 'drive_types', code, jsonb_build_object('en', en, 'ru', ru), category, sort_order FROM taxonomies.drive_types WHERE NOT deprecated
UNION ALL
SELECT 'colors', code, jsonb_build_object('en', en, 'ru', ru), category, sort_order FROM taxonomies.colors WHERE NOT deprecated
UNION ALL
SELECT 'runs_drives_status', code, jsonb_build_object('en', en, 'ru', ru), category, sort_order FROM taxonomies.runs_drives_status WHERE NOT deprecated
ORDER BY domain, sort_order, code;

-- Grant permissions
GRANT USAGE ON SCHEMA taxonomies TO gen_user;
GRANT SELECT ON ALL TABLES IN SCHEMA taxonomies TO gen_user;
GRANT EXECUTE ON FUNCTION get_taxonomy_label(TEXT, TEXT, TEXT) TO gen_user;

-- Create audit table for unknown taxonomy values
CREATE TABLE IF NOT EXISTS audit.unknown_taxonomy_values (
  id BIGSERIAL PRIMARY KEY,
  domain TEXT NOT NULL,
  raw_value TEXT NOT NULL,
  occurrence_count INT DEFAULT 1,
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(domain, raw_value)
);

CREATE INDEX idx_unknown_taxonomy_domain ON audit.unknown_taxonomy_values(domain);
CREATE INDEX idx_unknown_taxonomy_count ON audit.unknown_taxonomy_values(occurrence_count DESC);

GRANT INSERT, UPDATE, SELECT ON audit.unknown_taxonomy_values TO gen_user;
GRANT USAGE, SELECT ON SEQUENCE audit.unknown_taxonomy_values_id_seq TO gen_user;

-- Update INDEX.md registry
COMMENT ON SCHEMA taxonomies IS 'Migration 0011: Taxonomy lookup tables for RU/EN bilingual support';
