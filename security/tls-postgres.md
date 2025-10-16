# TLS для PostgreSQL (prod включён)
Зона времени: Europe/Warsaw

## Политика подключений (libpq)
Prod (VPS ↔ DB по приватной сети):
- Использовать TLS: `sslmode=verify-full`
- Корневой сертификат: `/etc/vinops/pg/ca.crt`
- Маршрутизация по приватке: `hostaddr=192.168.0.5`
- Верификация имени сертификата: `host=418a052549dc7dac1163fd68.twc1.net`

Пример строки соединения:
  psql "hostaddr=192.168.0.5 host=418a052549dc7dac1163fd68.twc1.net port=5432 dbname=vinops user=app_ro sslmode=verify-full sslrootcert=/etc/vinops/pg/ca.crt"

## Примечания
- Связка `hostaddr` (для маршрута по приватному IP) + `host` (для проверки имени) обязательна при `verify-full`.
- CA-файл публичный (корень провайдера), приватных ключей на VPS нет.
