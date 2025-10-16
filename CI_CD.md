# CI/CD — минимальные требования (S1 / MS-01-05)

- Node: **>=20.14 <21** (LTS 20.x). `.nvmrc` = `v20`.
- Next: **14.2.5**
- TypeScript: **5.6.x**

## Что печатаем в сборке
- `node -v`, `npm -v`
- `npm --prefix frontend run ci:versions` (печатает версии Node/Next/TS)

## Контроль качества
- `npm --prefix frontend run lint` — должен быть зелёным.
- `npm --prefix frontend run typecheck` — должен быть зелёным.

Workflow: `.github/workflows/toolchain-check.yml`
