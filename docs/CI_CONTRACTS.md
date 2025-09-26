# OpenAPI v1 — контрактные проверки в CI

- Источник истины спецификации: `contracts/openapi.yaml`
- Workflow GitHub Actions: **Contract tests (OpenAPI v1)**
  - Validate: `@apidevtools/swagger-parser`
  - Lint: `@redocly/cli`
  - Bundle (dereference): `@redocly/cli`
- Локальная проверка (для архивов QA): Python `openapi-spec-validator` + `prance` (артефакты пишутся в `docs/evidence/S1/ci-openapi/`).

Критерий GREEN:
1) Workflow завершён Success.
2) Артефакты содержат `oas-validate.txt`, `oas-lint.txt`, `contracts/openapi.bundled.yaml` (в UI) и локально `openapi.bundled.json`.
