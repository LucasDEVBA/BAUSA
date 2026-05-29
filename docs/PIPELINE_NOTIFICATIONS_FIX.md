# Pipeline — Notificações e Erros (Fix completo)

> Documento de plano técnico para resolver o sintoma "movo o card, mas ele
> volta para a coluna anterior sem mensagem" no `/pipeline` (CEO) e no
> `/familias-pipeline` (Head de Sucesso).

---

## 1. Diagnóstico — por que o card volta?

O `handleDragEnd` em `PipelineBoard.tsx` faz **optimistic update**: move o
card no estado local antes da resposta do servidor. Se a server action
`moverDeal` retorna `{ success: false }`, o componente faz **rollback** e
chama `toast.error(...)`.

### Achado crítico — Toaster ausente

Em **toda** a árvore React do CRM (`apps/crm/src`) **não existe** nenhum
`<Toaster />` montado. Portanto, todos os `toast.success(...)` e
`toast.error(...)` do `sonner` caem no vazio. O usuário só vê o card
voltando, sem entender o motivo.

### Os 8 motivos de `success: false` em `moverDeal`

| # | Condição | Mensagem hoje | Cenário típico |
|---|---|---|---|
| 1 | `papel !== "ceo"` | "Apenas o CEO pode mover deals." | Usuário sem perfil CEO ativo |
| 2 | `fetchError \|\| !deal` | "Deal nao encontrado." | RLS bloqueou SELECT ou deal apagado |
| 3 | Avanço sem `next_action` | "Preencha 'Next Action' e 'Data...' antes de avancar." | **Causa mais provável** — deals legados sem campo preenchido |
| 4 | Avanço de `reuniao_realizada` sem notas | "Preencha as notas..." | Reunião sem notas |
| 5 | Mover para `contrato_assinado` sem contrato | "Crie um contrato financeiro..." | Pular etapa financeira |
| 6 | Retrocesso sem motivo | "Retrocesso exige justificativa obrigatoria." | Drag bidirecional (direita → esquerda) |
| 7 | `perdido` sem motivo | "Marcar como perdido exige motivo." | Drag direto para Perdido |
| 8 | `updateError` Supabase | "Erro ao mover deal: {message}" | Falha SQL/RLS/trigger |

---

## 2. Solução — arquitetura

### 2.1 Contrato de erro discriminado

Hoje `moverDeal` retorna `{ success: boolean; error?: string }`. A UI não
consegue reagir programaticamente (abrir modal de motivo, focar campo).

Vamos usar um **discriminated union** com `code` + `field` + `action`:

```ts
type MoveDealResult =
  | {
      success: true;
      dealId: string;
      novaEtapa: StatusDeal;
    }
  | {
      success: false;
      code: MoveDealErrorCode;
      error: string;           // PT-BR para humanos
      field?: string;          // qual campo está faltando
      action?: MoveDealAction; // CTA que o toast pode acionar
    };

type MoveDealErrorCode =
  | "PERMISSION_DENIED"
  | "DEAL_NOT_FOUND"
  | "MISSING_NEXT_ACTION"
  | "MISSING_MEETING_NOTES"
  | "MISSING_CONTRACT"
  | "REQUIRE_RETROCESSO_REASON"
  | "REQUIRE_LOST_REASON"
  | "DB_ERROR";

type MoveDealAction =
  | { type: "open_deal"; dealId: string }
  | { type: "open_retrocesso_modal"; dealId: string; fromStage: string; toStage: string }
  | { type: "open_lost_modal"; dealId: string }
  | { type: "create_contract"; dealId: string }
  | { type: "reload" };
```

Camadas:

1. **`lib/move-deal-result.ts`** — types, helpers `okMove(...)` e `failMove(code, ...)`,
   labels PT-BR para cada `code`.
2. **`actions/deals.ts`** — `moverDeal` retorna `MoveDealResult`. Logs estruturados
   nos early-returns via `console.error("[moverDeal]", { code, ... })`.
3. **`PipelineBoard.tsx`** — interpreta `result.code`:
   - `MISSING_NEXT_ACTION` → toast com botão **"Abrir deal"** que abre
     `DealDetailSheet` no modo edit-resumo.
   - `REQUIRE_RETROCESSO_REASON` → abre `RetrocessoModal` que solicita motivo
     e re-chama `moverDeal(dealId, novaEtapa, motivo)`.
   - `REQUIRE_LOST_REASON` → abre `LossModal` (motivo + categoria + reativável).
   - `MISSING_CONTRACT` → toast com botão **"Criar contrato"** que abre o
     `DealDetailSheet` na aba Contrato.
   - Sucesso → toast verde com nome do atleta e nova etapa.

### 2.2 Toaster montado no layout do dashboard

`<Toaster richColors closeButton position="top-right" />` em
`app/(dashboard)/layout.tsx`. Posição top-right é segura para drag-drop
(não cobre o Kanban). `richColors=true` ativa o esquema vermelho/verde
nativo, `closeButton=true` adiciona X. Duração default 4 s; toasts com
action duram até clique ou 10 s.

### 2.3 Modais

- **`RetrocessoModal`**: textarea obrigatório (mínimo 5 caracteres), mostra
  "{Atleta}" + transição "{coluna atual} → {coluna nova}", botão "Confirmar
  retrocesso" e "Cancelar".
- **`LossModal`** (drag para Perdido): select de `motivo_perda` enum
  (financeiro / timing / desistencia_familia / atleta_nao_qualificado /
  concorrencia / outro), textarea de detalhe, checkbox "Pode reativar?" +
  data, botão "Confirmar perda" e "Cancelar".

Implementação: modal controlado pelo `PipelineBoard` via state
`pendingAction: { type, dealId, novaEtapa, fromStage } | null`. Após o
usuário confirmar, fecha o modal e re-chama `moverDeal(...)` passando o
motivo/lossData.

### 2.4 Badge visual em `DealCard`

Pequeno ponto vermelho pulsante no canto superior direito quando
`!deal.next_action || !deal.next_action_date`. Tooltip: "Próxima ação não
preenchida — não é possível avançar". Previne o erro antes do drag.

### 2.5 Pipeline da Família — mesmo padrão

`familias-pipeline/client.tsx` recebe o mesmo Toaster (via layout). A
action `moverFaseFamilia` é mais simples (não exige next_action), então
o único caminho de erro é a permissão e o DB. Apenas garantir toasts
visíveis.

---

## 3. Passo a passo de execução

| # | Tarefa | Arquivo(s) |
|---|---|---|
| 1 | Criar este documento | `docs/PIPELINE_NOTIFICATIONS_FIX.md` |
| 2 | Criar `lib/move-deal-result.ts` com types + helpers + labels | `apps/crm/src/lib/move-deal-result.ts` |
| 3 | Refatorar `moverDeal` para retornar `MoveDealResult` + logs | `apps/crm/src/lib/actions/deals.ts` |
| 4 | Montar `<Toaster />` no layout dashboard | `apps/crm/src/app/(dashboard)/layout.tsx` |
| 5 | Criar `RetrocessoModal` e `LossModal` | `apps/crm/src/components/pipeline/RetrocessoModal.tsx`, `LossModal.tsx` |
| 6 | Refatorar `PipelineBoard.handleDragEnd` para usar `MoveDealResult` + dispatch para modais | `apps/crm/src/components/pipeline/PipelineBoard.tsx` |
| 7 | Adicionar badge "sem next action" em `DealCard` | `apps/crm/src/components/pipeline/DealCard.tsx` |
| 8 | Aplicar toasts ricos em `/familias-pipeline` | `apps/crm/src/app/(dashboard)/familias-pipeline/client.tsx` |
| 9 | `pnpm lint` + `pnpm build` | — |
| 10 | Commit + PR para `main` | — |
| 11 | Aguardar deploy Vercel | — |
| 12 | Validação manual no preview/PRD | — |

---

## 4. Critérios de aceitação

- [ ] Card movido entre **quaisquer** colunas no Pipeline da CEO mostra toast
      verde de sucesso E persiste a mudança após reload.
- [ ] Tentar avançar deal sem `next_action` mostra toast vermelho **legível**,
      com botão que abre o `DealDetailSheet` para preencher.
- [ ] Arrastar para coluna anterior abre `RetrocessoModal`; ao preencher
      motivo, o deal move e mostra toast verde.
- [ ] Arrastar para "Perdido" abre `LossModal`; ao preencher, o deal vai
      para Perdido e mostra toast verde.
- [ ] Card sem `next_action` exibe **badge vermelho** visível no Kanban.
- [ ] Pipeline da Família mostra toast em ambos os fluxos (sucesso e erro).
- [ ] Sem regressão visual (Kanban continua usando dnd-kit, mesma estética).
- [ ] `pnpm build` e `pnpm lint` verdes.

---

## 5. Rollout

Single feature branch `feat/pipeline-notifications-fix` → PR para `main`
→ auto-deploy Vercel (CRM `bolsa-atleta-crm`) → validação manual.

**Nenhuma migration SQL** — toda a mudança é UI/server action TypeScript.
Reverter é simples (revert do PR).
