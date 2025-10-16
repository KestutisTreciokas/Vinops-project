# Политики данных: soft-delete, privacy, retention (S-02)

## Цели
- Сохранность исторических данных и возможность депубликации записей без физического удаления.
- Единое поведение для каталога и VIN-страницы.

## Флаги и их смысл
- `vehicles.is_removed BOOLEAN NOT NULL DEFAULT false`  
  - true → VIN **не публикуется** (карточка и все связанные разделы должны быть скрыты на уровне API/UI).
- `lots.is_removed BOOLEAN NOT NULL DEFAULT false`  
  - true → лот **не показывается** в каталоге и в карточке VIN.
- `images.is_removed BOOLEAN NOT NULL DEFAULT false`  
  - true → изображение **не отображается** в галереях.

> Жёсткое: в S-02 не удаляем строки физически.

## Поведение (read-only API v1 — подготовка)
- Каталог: выдаём только `lots.is_removed=false`.  
- VIN-страница: допустимо показывать, если `vehicles.is_removed=false`.  
- Фото: берём только `images.is_removed=false`.  
- Статусы (`sold|active|upcoming|cancelled|withdrawn`) — неизменны.

## Retention
- `sale_events` **не** удаляем и **без** флага `is_removed` — остаются для аналитики и агрегаций, но публикация регулируется правилами отображения VIN/лот/изображений.

## Privacy removal (подготовка)
- При запросе удаления: ставим `vehicles.is_removed=true` (и при необходимости `lots/images.is_removed=true`).  
- В S-05+: реализовать депубликацию в SEO (sitemap/robots) и поведение HTTP (рекомендация — **410 Gone** для удалённого VIN).

## Откат
- Возврат публикации: выставление `is_removed=false`.  
- Физическое удаление строк — запрещено в S-02 (только отдельной миграцией с согласованием).

