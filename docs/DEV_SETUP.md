# DEV_SETUP — Claude Code on VPS-NL

## What we installed
- Node.js 20 LTS
- Claude Code CLI (`@anthropic-ai/claude-code`)

## Login (device flow)
1. Run `claude login` on the VPS.
2. Open the printed URL in your browser and complete login with Claude **Pro/Max**.
3. CLI stores auth profile under `~/.config/claude/`.

## GitHub access for the agent
- Auth method: **Fine-grained PAT** (scoped to repo `KestutisTreciokas/Vinops-project`).
- Minimal scopes: `contents:read/write`, `pull_requests:read/write`, `workflows:read/write`.
- Storage: `credential.helper=store`, file: `~/.git-credentials` (machine user recommended).

## Autonomy mode (ALL PERMISSIONS)
- The agent acts on PROD (push, PRs, run Actions).
- Safety guardrails are enforced by branch protection and CI checks.
- Auto-approve / full autonomy planned in **MS-CC-02/03** (policy + allowlist of operations).

## Smoke verification
- `claude --version` prints CLI version.
- `git push` from the agent context succeeds to a feature branch.
