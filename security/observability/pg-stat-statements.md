# pg_stat_statements — статус: ENABLED
Зона времени: Europe/Warsaw

## Факт
- Расширение активно в кластере и создано в БД `vinops`.
- Проверка:  
  - `select extname from pg_extension where extname='pg_stat_statements';` → `pg_stat_statements`  
  - `select count(*) from pg_stat_statements;` → число записей (>0 под нагрузкой)

## Политика
- Используем для профилирования запросов API/SSR/ETL.
- Доступ на чтение — через роли приложения (минимально `gen_user` для техпроверок; для расширенного доступа — отдельные роли по необходимости).

## Диагностика
- Если запрос к представлению падает с `relation does not exist` — эскалировать в SRE: проверить preload/extension.
