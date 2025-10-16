# MERGE_REPORT — PR #84 (консолидация по CONFLICT_POLICY)

- Regenerated: 2025-09-27 23:02 CEST
- Base: main 34c4cbaae1ca
- PR head: 3e6de7349665
- Policy: docs/merges/PR-84/CONFLICT_POLICY.md

## Таблица разрешений

| Путь | Зона | Решение | Источник | Примечание |
|------|------|---------|----------|------------|
| caddy/Caddyfile | infra | MAIN | MAIN |  |
| contracts/openapi.yaml | contracts | MAIN | MAIN |  |
| db/migrations/0001_init.sql | db | PR | PR |  |
| docker-compose.db.yml | infra | MAIN | MAIN |  |
| docker-compose.prod.yml | infra | MAIN | MAIN |  |
| frontend/Dockerfile | code | PR | PR |  |
| frontend/.dockerignore | code | PR | PR |  |
| frontend/next.config.js | code | PR | PR |  |
| frontend/next.config.ts | code | PR | PR |  |
| frontend/next-env.d.ts | code | PR | PR |  |
| frontend/package.json | code | PR | PR |  |
| frontend/package-lock.json | code | PR | PR |  |
| frontend/public/placeholders/car-1.svg | seo | MAIN | MAIN |  |
| frontend/public/placeholders/car-2.svg | seo | MAIN | MAIN |  |
| frontend/public/placeholders/car-3.svg | seo | MAIN | MAIN |  |
| frontend/public/placeholders/car-4.svg | seo | MAIN | MAIN |  |
| frontend/public/placeholders/car-5.svg | seo | MAIN | MAIN |  |
| frontend/public/vin-sample/1.svg | seo | MAIN | MAIN |  |
| frontend/public/vin-sample/2.svg | seo | MAIN | MAIN |  |
| frontend/public/vin-sample/3.svg | seo | MAIN | MAIN |  |
| frontend/public/vin-sample/4.svg | seo | MAIN | MAIN |  |
| frontend/public/vin-sample/5.svg | seo | MAIN | MAIN |  |
| frontend/public/vin-sample/6.svg | seo | MAIN | MAIN |  |
| frontend/public/vin-sample/7.svg | seo | MAIN | MAIN |  |
| frontend/public/vin-sample/8.svg | seo | MAIN | MAIN |  |
| frontend/src/app/demo/page.tsx | code | PR | PR |  |
| frontend/src/app/[lang]/cars/page.tsx | code | PR | PR |  |
| frontend/src/app/[lang]/demo/page.tsx | code | PR | PR |  |
| frontend/src/app/[lang]/_home/Features.tsx | code | PR | PR |  |
| frontend/src/app/[lang]/layout.tsx | code | PR | PR |  |
| frontend/src/app/[lang]/layout.tsx.bak | code | PR | PR |  |
| frontend/src/app/[lang]/page.tsx | code | PR | PR |  |
| frontend/src/app/[lang]/vin/[vin]/details/page.tsx | code | PR | PR |  |
| frontend/src/app/[lang]/vin/[vin]/error.tsx | code | PR | PR |  |
| frontend/src/app/[lang]/vin/[vin]/loading.tsx | code | PR | PR |  |
| frontend/src/app/[lang]/vin/[vin]/page.tsx | code | PR | PR |  |
| frontend/src/app/[lang]/vin/[vin]/page.tsx.bak | code | PR | PR |  |
| frontend/src/app/[lang]/vin/[vin]/page.tsx.bak.1757865872 | code | PR | PR |  |
| frontend/src/app/[lang]/vin/[vin]/page.tsx.bak-multi-leftcol | code | PR | PR |  |
| frontend/src/app/sitemap.ts | code | PR | PR |  |
| frontend/src/components/catalog/PriceBadge.tsx | code | PR | PR |  |
| frontend/src/components/common/AuctionIcon.tsx | code | PR | PR |  |
| frontend/src/components/common/Badge.tsx | code | PR | PR |  |
| frontend/src/components/common/CopyButton.tsx | code | PR | PR |  |
| frontend/src/components/common/StatusBadge.tsx | code | PR | PR |  |
| frontend/src/components/EmptyState.tsx | code | PR | PR |  |
| frontend/src/components/NavLink.tsx | code | PR | PR |  |
| frontend/src/components/PillTabs.tsx | code | PR | PR |  |
| frontend/src/components/SkeletonCard.tsx | code | PR | PR |  |
| frontend/src/components/SkeletonGrid.tsx | code | PR | PR |  |
| frontend/src/components/ui/Badge.tsx | code | PR | PR |  |
| frontend/src/components/VehicleCard.tsx | code | PR | PR |  |
| frontend/src/components/vin2/Badge.tsx | code | PR | PR |  |
| frontend/src/components/vin2/Gallery.tsx | code | PR | PR |  |
| frontend/src/components/vin2/History.tsx | code | PR | PR |  |
| frontend/src/components/vin2/Lightbox.tsx | code | PR | PR |  |
| frontend/src/components/vin2/LotInfo.tsx | code | PR | PR |  |
| frontend/src/components/vin2/_Row.tsx | code | PR | PR |  |
| frontend/src/components/vin2/Skeleton.tsx | code | PR | PR |  |
| frontend/src/components/vin2/Specs.tsx | code | PR | PR |  |
| frontend/src/components/vin2/StatusBadge.tsx | code | PR | PR |  |
| frontend/src/components/vin2/types.ts | code | PR | PR |  |
| frontend/src/components/vin2/ui.tsx | code | PR | PR |  |
| frontend/src/components/vin2/VinGallery.tsx | code | PR | PR |  |
| frontend/src/components/vin2/VinSpecs.tsx | code | PR | PR |  |
| frontend/src/components/vin/AsideSummary.tsx | code | PR | PR |  |
| frontend/src/components/vin/CopyButton.tsx | code | PR | PR |  |
| frontend/src/components/vin/Gallery.tsx | code | PR | PR |  |
| frontend/src/components/vin/SalesHistory.tsx | code | PR | PR |  |
| frontend/src/components/vin/SpecList.tsx | code | PR | PR |  |
| frontend/src/components/vin/SpecsList.tsx | code | PR | PR |  |
| frontend/src/components/vin/StatusBadge.tsx | code | PR | PR |  |
| frontend/src/components/vin/VinGallery.tsx | code | PR | PR |  |
| frontend/src/components/vin/VinHistory.tsx | code | PR | PR |  |
| frontend/src/components/vin/VinLeftColumn.tsx | code | PR | PR |  |
| frontend/src/components/vin/VinLot.tsx | code | PR | PR |  |
| frontend/src/components/vin/VinSidebar.tsx | code | PR | PR |  |
| frontend/src/components/vin/VinSpecs.tsx | code | PR | PR |  |
| frontend/src/icons/CheckIcon.tsx | code | PR | PR |  |
| frontend/src/icons/ChevronDown.tsx | code | PR | PR |  |
| frontend/src/icons/DocIcon.tsx | code | PR | PR |  |
| frontend/src/icons/DotIcon.tsx | code | PR | PR |  |
| frontend/src/icons/HistoryIcon.tsx | code | PR | PR |  |
| frontend/src/icons/SearchIcon.tsx | code | PR | PR |  |
| frontend/src/icons/ShieldIcon.tsx | code | PR | PR |  |
| frontend/src/icons/TagIcon.tsx | code | PR | PR |  |
| frontend/src/lib/api-vin.ts | code | PR | PR |  |
| frontend/src/lib/format.ts | code | PR | PR |  |
| frontend/src/lib/site.ts | code | PR | PR |  |
| frontend/src/lib/url.ts | code | PR | PR |  |
| frontend/src/mock/vin-sample.ts | code | PR | PR |  |
| frontend/src/styles/globals.css | code | PR | PR |  |
| frontend/tsconfig.json | code | PR | PR |  |
| README.md | code | PR | PR |  |

## DoD
- Coverage: 94/94
- Canonical guards: see CANONICAL_PROOF.md
- Dev smoke note: NOOP pg-pool guard for /en without DB

### Post-merge note
- Merged into `main` at: d892cd4ee478
