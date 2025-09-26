# SEO Baseline (robots/sitemap) — vinops.online

**Статус:** Активно. Источник истины — **Next.js metadata routes**:
- `frontend/src/app/robots.ts` — формирует `robots.txt` (включая строку `Sitemap:` с абсолютным URL).
- `frontend/src/app/sitemap.ts` — формирует базовый `sitemap.xml` (без VIN-шардов в рамках базового уровня).

**Требования (DoD S1):**
- `/robots.txt` отдает `200 OK`, `Content-Type: text/plain`, содержит строку `Sitemap: https://vinops.online/sitemap.xml`.
- `/sitemap.xml` отдает `200 OK`, `Content-Type: application/xml`, валидный XML.
- Security-headers (см. `docs/nginx-security-headers.md`) присутствуют на `/`, `/robots.txt`, `/sitemap.xml`.

**Операционные заметки:**
- Любые правки в `robots.ts`/`sitemap.ts` требуют **пересборки фронтенда** и перезапуска сервиса `web` (Caddy/nginx — без правок).
- Кэширование: базовые файлы `robots.txt` и `sitemap.xml` — `public, max-age=0, must-revalidate`.
- VIN-шардинг sitemap и JSON-LD для VIN-страниц внедряются **в отдельных спринтах** (не входят в этот документ).

**Смоки (ручная проверка):**
curl -sSIX GET https://vinops.online/robots.txt | egrep -i '^(http/|content-type:|strict-transport-security:|x-content-type-options:|referrer-policy:|x-frame-options:)'
curl -sSIX GET https://vinops.online/sitemap.xml | egrep -i '^(http/|content-type:|strict-transport-security:|x-content-type-options:|referrer-policy:|x-frame-options:)'
curl -sS https://vinops.online/robots.txt | grep -i '^sitemap:'

bash
Skopiuj kod
