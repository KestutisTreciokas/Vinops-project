# VIN — правило, нормализация и поиск (S-02)

Дата (Europe/Warsaw): FIX BY COMMIT  
Источник: MS-02-03.

## Правило
- Допустимая длина: **11–17** символов.
- Допустимый алфавит: **A–Z (без I, O, Q)** и цифры **0–9** → класс `^[A-HJ-NPR-Z0-9]{11,17}$`.
- Хранение:
  - `vehicles.vin` — нормализованное значение (UPPERCASE), **PK**.
  - `vehicles.vin_normalized` — `GENERATED ALWAYS AS (upper(vin)) STORED`, **UNIQUE** (для поиска).
  - `vehicles.vin_raw` — опционально, исходный ввод.

## Поиск/индексация
- Поиск осуществляется по `vin` или `vin_normalized`.
- Индексы для связей: `lots_vin_idx`, `sale_events_vin_date_idx`, `images_vin_idx`.

## UI-правки (для S-03)
- Текст «VIN must be 17 characters» заменить на «VIN must be **11–17** characters».
- Поле ввода нормализовать к UPPERCASE и фильтровать I/O/Q.
