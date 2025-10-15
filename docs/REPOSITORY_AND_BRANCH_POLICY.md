# Репозиторий и политика веток (Vinops)

## Репозиторий
- Хостинг: GitHub
- Организация/владелец: `KestutisTreciokas`
- Репозиторий: `Vinops-project`
- Дефолтная ветка: `main`
- Кодовая база: зеркало из исходного репозитория с полной историей (ветки=38, теги=18 нормализовано)

## CODEOWNERS
- Путь: `.github/CODEOWNERS`
- Содержимое (сводка):
  - Глобально: `*  @KestutisTreciokas`
  - `frontend/**  @KestutisTreciokas`
  - `backend/**   @KestutisTreciokas`

## Политика защиты ветки `main` (актуальная, вариант 2)
- **Require a pull request before merging:** ВКЛ
  - **Required approving reviews:** `1`
  - **Dismiss stale approvals:** ВКЛ
  - **Require review from Code Owners:** ВЫКЛ
- **Require linear history:** ВКЛ
- **Require conversation resolution before merging:** ВЫКЛ
- **Allow force pushes:** ВЫКЛ
- **Allow deletions:** ВЫКЛ
- **Restrict who can push:** ВКЛ (админы не принудительно ограничены политикой защиты)
- **Require status checks to pass:** ВЫКЛ (будет включено после настройки CI)
- **Include administrators (enforce_admins):** ВЫКЛ (ЖЁСТКОЕ РЕШЕНИЕ — см. DL-SEC-006)

## Стратегия ветвления и мерджа
- Типовые ветки:  
  `feat/*`, `fix/*`, `chore/*`, `docs/*`, `ops/*`, `release/*`, `rebase/*`, `rollback/*`, `stable/prod`, `production`.
- Мердж в `main`: только через PR, **linear history** (допустимы squash/rebase merge, merge-commit запрещён).
- Минимальные требования к PR: ≥1 approval; Code Owners review — **не требуется**.
- Коммиты: конвенция `type(scope): message [MS-<ID>]` (пример: `feat(seo): add sitemap [MS-MIG-01-01]`).

## Связанные решения и артефакты
- Decision Log: `docs/DECISION_LOG.md`, запись **DL-SEC-006**:
  - `enforce_admins=OFF`, `require_code_owner_reviews=OFF`, `required_conversation_resolution=OFF`
  - Последствия: админы могут обходить защиту; требуется дисциплина и аудит PR.
- План включения статус-проверок (после CI): создать правило со списком обязательных чеков GitHub Actions.

## Изменение политики
Любое изменение флагов защиты или процесса мерджа — только через новую запись Decision Log и отдельный мини-спринт с обратной совместимостью.

