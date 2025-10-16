# RUNBOOKS — DB smokes и запуск S-03 (Europe/Warsaw)

## TLS/сеть
nc -zvw2 192.168.0.5 5432
nc -zvw2 92.255.110.134 5432  # должно FAIL

## Базовое подключение (verify-full)
PSQL_CONN='psql "hostaddr=192.168.0.5 host=418a052549dc7dac1163fd68.twc1.net port=5432 dbname=vinops user=db_admin sslmode=verify-full sslrootcert=/etc/vinops/pg/ca.crt"'
eval $PSQL_CONN -c "select 1"

## Порядок
eval $PSQL_CONN -f db/sql/extensions_enable.sql
eval $PSQL_CONN -f db/sql/bootstrap_roles.sql
eval $PSQL_CONN -f db/migrations/0001_init.sql
eval $PSQL_CONN -f db/migrations/0002_constraints.sql
eval $PSQL_CONN -f db/migrations/0003_indexes.sql
eval $PSQL_CONN -f db/migrations/0004_policy_flags.sql

## Проверки расширений/ролей/таблиц
eval $PSQL_CONN -c "\dx"
eval $PSQL_CONN -c "\du app_ro etl_rw"
eval $PSQL_CONN -c "\dt"

## Проверка матрицы прав без логина под ролями
eval $PSQL_CONN -c "select 'app_ro SELECT vehicles' as check, has_table_privilege('app_ro','public.vehicles','SELECT') as ok"
eval $PSQL_CONN -c "select 'etl_rw INSERT vehicles' as check, has_table_privilege('etl_rw','public.vehicles','INSERT') as ok"
eval $PSQL_CONN -c "select 'etl_rw DELETE vehicles' as check, has_table_privilege('etl_rw','public.vehicles','DELETE') as ok"
