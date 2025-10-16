# Repo Hygiene (Vinops)
_Пересчитано: 2025-10-16 05:02 (Europe/Warsaw)_

## Branch Protection — `main` (snapshot)
```json
{
  "enforce_admins": false,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "reviews_required": 1,
  "strict_status": true,
  "checks_contexts": [
    "build"
  ]
}
```

## CODEOWNERS — active file
**Path:** .github/CODEOWNERS
```
# CODEOWNERS (template) — apply as .github/CODEOWNERS in NEW REPOSITORY
# Syntax: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners
*  @KestutisTreciokas
frontend/**  @KestutisTreciokas
backend/**   @KestutisTreciokas
```
