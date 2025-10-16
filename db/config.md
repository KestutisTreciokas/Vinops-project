# Конфигурация PostgreSQL (целевые политики)
Зона времени: Europe/Warsaw

## listen_addresses
'127.0.0.1,192.168.0.5' (не слушать публичный IPv4/IPv6)

## pg_hba.conf (норматив)
local   all        db_admin                    scram-sha-256
host    all        all         127.0.0.1/32    scram-sha-256
host    all        app_ro      192.168.0.4/32  scram-sha-256
host    all        etl_rw      192.168.0.4/32  scram-sha-256
host    all        all         0.0.0.0/0       reject
host    all        all         ::0/0           reject

## Расширения (ON)
pg_stat_statements, pg_trgm, pgcrypto, citext
