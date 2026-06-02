---
name: bausa-gitflow-deploy
description: Use ao fazer commit, abrir PR, fazer merge ou deploy no projeto BAUSA. Codifica o gitflow (feature→develop→main), a regra crítica de nunca usar --delete-branch em PR develop→main, a validação pré-merge obrigatória, branch policies, e a sequência segura de promoção UAT→PRD.
---

# BAUSA — Gitflow & Deploy

## Fluxo de branches
```
feature/* ──→ develop ──→ main
   ↓             ↓          ↓
 (local)       UAT auto   PRD auto
```
- `feature/*` ou `fix/*` ou `chore/*` saem de `develop`
- Nunca commitar direto em `main` ou `develop`
- Branch policy: environment `prd` só deploya de `main`, `uat` só de `develop`. Sem required reviewers (repo solo — gate é CI + review de PR + UAT).

## ⛔ REGRA CRÍTICA: `--delete-branch`
- **NUNCA** use `--delete-branch` em PR cujo HEAD é `develop` (PR `develop→main`). A flag deleta a HEAD = `develop`, branch **permanente**. Incidente 2026-05-17: develop foi deletado e teve que ser restaurado de main.
- `--delete-branch` SÓ em feature/fix/chore branches (PR `feature→develop`).

```bash
gh pr merge <n> --squash --delete-branch   # OK: feature→develop
gh pr merge <n> --squash                    # PR develop→main (SEM a flag)
```

## Sequência completa (feature → produção)

```bash
# 1. Branch a partir de develop ATUALIZADO
git checkout develop && git pull origin develop
git checkout -b feature/minha-feature

# 2. Implementar + VALIDAR LOCAL (ver skill do tipo de mudança)
#    Engine: tsc --noEmit + next build + lint
#    Functions: node --check
#    Schedulers: node --test tests/*.test.js

# 3. Commit (Conventional Commits) + push
git add <arquivos específicos>   # nunca git add -A cego
git commit -m "feat(crm): ..."   # feat/fix/chore/docs/refactor/perf/test/ci/style
git push -u origin feature/minha-feature

# 4. PR para develop
gh pr create --base develop --head feature/minha-feature --title "..." --body "..."

# 5. Aguardar CI (NÃO mergear com check pending)
#    Esperar mergeStateStatus = CLEAN e "CI Passed" = pass
gh pr checks <n>

# 6. Merge em develop (feature branch → pode deletar)
gh pr merge <n> --squash --delete-branch

# 7. Deploy UAT automático → smoke test em UAT

# 8. PR develop→main (SEM --delete-branch)
gh pr create --base main --head develop --title "promote: ..." --body "..."
gh pr merge <n> --squash      # ⛔ sem --delete-branch

# 9. Deploy PRD automático → smoke test PRD
```

## Validação pré-merge (NUNCA pular)
- CI verde: lint, tsc, build, validate-functions, validate-migrations, secrets-scan, **scheduler-invariants**
- `mergeStateStatus` = `CLEAN` (não `UNSTABLE`/`BLOCKED`). `UNSTABLE` com checks SKIPPED não-required (ex: deploy de função não-tocada) é aceitável — inspecionar quais.
- Esperar `CI Passed` resolver com until-loop, nunca mergear com check `pending`.

## Commit messages
- Conventional Commits. Corpo explica o **porquê** + risco + blast radius se for fix de incidente.
- Terminar com: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- PR body termina com: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`

## Nunca commitar
`.env*`, segredos, `node_modules`, build artifacts, `.claude/settings.local.json`. (Skills `.claude/skills/` SÃO versionadas.)

## ⛔ Checklist anti-regressão
- [ ] Branch saiu de `develop` atualizado (`git pull` antes)?
- [ ] PR `develop→main` SEM `--delete-branch`?
- [ ] CI 100% verde + `CI Passed` pass + `mergeStateStatus` inspecionado?
- [ ] Migration passou por UAT antes de PRD?
- [ ] `git add` de arquivos específicos (não `-A` que pode subir `.claude/settings.local.json` ou lixo)?
- [ ] Rebase se develop avançou muito desde a criação da branch (evita merge sujo)?
- [ ] PR descreve o quê/porquê/risco/test plan?

## Emergência (hotfix PRD)
Mesmo em emergência, passar por PR. Se CI estiver indisponível e o fix for crítico, deploy manual da função (ver skill `bausa-cloud-function`) + PR retroativo imediato para não divergir o código do que está em PRD.
