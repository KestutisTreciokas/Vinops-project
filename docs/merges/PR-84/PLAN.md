# PLAN — PR #84 (конфликтные пути и решения)

- Generated: 2025-09-27 19:27:21 CEST
- Merge-base: efa8656a7e88   main: 4f945e7efdc0   pr: 3e6de7349665

## Правило выбора версии по конфликтным файлам

| Путь | Зона | Правило | Обоснование |
|------|------|---------|-------------|
| caddy/Caddyfile | infra | main | infra/deploy — канон main |
| contracts/openapi.yaml | code | main | SSOT/policy/OpenAPI — канон main |
| db/migrations/0001_init.sql | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| docker-compose.db.yml | infra | main | infra/deploy — канон main |
| docker-compose.prod.yml | infra | main | infra/deploy — канон main |
| frontend/Dockerfile | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/.dockerignore | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/next.config.js | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/next.config.ts | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/next-env.d.ts | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/package.json | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/package-lock.json | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/public/placeholders/car-1.svg | seo | main | public/* (self-hosted/invariants) — канон main |
| frontend/public/placeholders/car-2.svg | seo | main | public/* (self-hosted/invariants) — канон main |
| frontend/public/placeholders/car-3.svg | seo | main | public/* (self-hosted/invariants) — канон main |
| frontend/public/placeholders/car-4.svg | seo | main | public/* (self-hosted/invariants) — канон main |
| frontend/public/placeholders/car-5.svg | seo | main | public/* (self-hosted/invariants) — канон main |
| frontend/public/vin-sample/1.svg | seo | main | public/* (self-hosted/invariants) — канон main |
| frontend/public/vin-sample/2.svg | seo | main | public/* (self-hosted/invariants) — канон main |
| frontend/public/vin-sample/3.svg | seo | main | public/* (self-hosted/invariants) — канон main |
| frontend/public/vin-sample/4.svg | seo | main | public/* (self-hosted/invariants) — канон main |
| frontend/public/vin-sample/5.svg | seo | main | public/* (self-hosted/invariants) — канон main |
| frontend/public/vin-sample/6.svg | seo | main | public/* (self-hosted/invariants) — канон main |
| frontend/public/vin-sample/7.svg | seo | main | public/* (self-hosted/invariants) — канон main |
| frontend/public/vin-sample/8.svg | seo | main | public/* (self-hosted/invariants) — канон main |
| frontend/src/app/demo/page.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/app/[lang]/cars/page.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/app/[lang]/demo/page.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/app/[lang]/_home/Features.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/app/[lang]/layout.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/app/[lang]/layout.tsx.bak | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/app/[lang]/page.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/app/[lang]/vin/[vin]/details/page.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/app/[lang]/vin/[vin]/error.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/app/[lang]/vin/[vin]/loading.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/app/[lang]/vin/[vin]/page.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/app/[lang]/vin/[vin]/page.tsx.bak | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/app/[lang]/vin/[vin]/page.tsx.bak.1757865872 | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/app/[lang]/vin/[vin]/page.tsx.bak-multi-leftcol | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/app/sitemap.ts | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/catalog/PriceBadge.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/common/AuctionIcon.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/common/Badge.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/common/CopyButton.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/common/StatusBadge.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/EmptyState.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/NavLink.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/PillTabs.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/SkeletonCard.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/SkeletonGrid.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/ui/Badge.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/VehicleCard.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/vin2/Badge.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/vin2/Gallery.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/vin2/History.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/vin2/Lightbox.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/vin2/LotInfo.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/vin2/_Row.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/vin2/Skeleton.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/vin2/Specs.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/vin2/StatusBadge.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/vin2/types.ts | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/vin2/ui.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/vin2/VinGallery.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/vin2/VinSpecs.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/vin/AsideSummary.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/vin/CopyButton.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/vin/Gallery.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/vin/SalesHistory.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/vin/SpecList.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/vin/SpecsList.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/vin/StatusBadge.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/vin/VinGallery.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/vin/VinHistory.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/vin/VinLeftColumn.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/vin/VinLot.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/vin/VinSidebar.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/components/vin/VinSpecs.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/icons/CheckIcon.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/icons/ChevronDown.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/icons/DocIcon.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/icons/DotIcon.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/icons/HistoryIcon.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/icons/SearchIcon.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/icons/ShieldIcon.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/icons/TagIcon.tsx | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/lib/api-vin.ts | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/lib/format.ts | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/lib/site.ts | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/lib/url.ts | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/mock/vin-sample.ts | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/src/styles/globals.css | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| frontend/tsconfig.json | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |
| README.md | code | pr | функциональные изменения (код) — канон PR при соблюдении инвариантов |

## Примечания
- **manual-merge**: собрать итог из канона SEO (main) и визуальных правок PR.
- **pr**: принять версию PR при соблюдении инвариантов (URL/SEO/self-hosted).
- **main**: жёсткий канон (SSOT/policy/OpenAPI/infra/public).
