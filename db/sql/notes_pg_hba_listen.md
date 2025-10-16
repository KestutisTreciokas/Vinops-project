# Применение listen_addresses/pg_hba.conf
- listen_addresses: '127.0.0.1,192.168.0.5'
- pg_hba (фрагменты):
  local   all  db_admin                   scram-sha-256
  host    all  app_ro   192.168.0.4/32    scram-sha-256
  host    all  etl_rw   192.168.0.4/32    scram-sha-256
  host    all  all      0.0.0.0/0         reject
  host    all  all      ::0/0             reject
