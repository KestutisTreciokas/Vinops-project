# SEO Policy — robots & sitemap
**Updated:** 2025-09-23 20:56 (Europe/Warsaw)

## Robots
- Metadata route: `/robots.txt` (Next App Router).
- Содержит одну строку `Sitemap: https://vinops.online/sitemap.xml`.
- Кэш: `Cache-Control: public, max-age=0, must-revalidate`.

## Sitemap
- Metadata route: `/sitemap.xml`.
- Содержит только статические маршруты (EN/RU: `/`, `/cars`, `/contacts`, `/terms`).
- Кэш: `Cache-Control: public, max-age=0, must-revalidate`.
- VIN-шарды (`/sitemaps/vin.xml`, `/sitemaps/vin/{lang}-{n}.xml`) **не публикуются в S1** — будут реализованы в S3.

## Инварианты
- Никаких файлов `robots.txt`/`sitemap.xml` в `frontend/public/`.
- SEO-инварианты VIN-страниц (canonical/hreflang/JSON-LD) не затрагиваются.
