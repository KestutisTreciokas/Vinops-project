# Security Headers — публичный периметр (активно: Caddy)

Статус: baseline включён. Периметр — Caddy (origin); Cloudflare proxy — допускается по SSOT.
Обязательные заголовки:
- Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Защита фрейминга: X-Frame-Options: SAMEORIGIN (или CSP: frame-ancestors 'self')

Охват: `/`, `/robots.txt`, `/sitemap.xml`.
Режим деплоя: правка `caddy/Caddyfile` + `caddy reload` (или `docker compose restart caddy`).

См. evidence в `evidence/S1/security-headers/`.
