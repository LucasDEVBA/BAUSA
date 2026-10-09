# Scripts de dados pendentes de autorização do CEO

Scripts que **mudam dado de produção** e só rodam com a autorização explícita do CEO.
Fonte: PLANO.md §5 (onda 2, 08/10). Banco único: o que roda aqui vale para PRD.

## Regras (valem para todos)

1. **Todo arquivo termina em `ROLLBACK`.** Trocar por `COMMIT` **só** depois do "pode aplicar"
   explícito do CEO para aquele script — nunca por dedução, nunca em lote.
2. No dia da execução, **rodar de novo em `ROLLBACK`** antes (o estado do banco muda) e conferir a
   prévia e a conferência embutida.
3. Rodar os **blocos separados** no SQL editor: ele só mostra o resultado do último `SELECT`.
4. Prévia é somente leitura; a execução é idempotente (CAS) e a conferência roda **dentro** da transação.
5. Respeitar a **ordem e os pré-requisitos** abaixo — fora de ordem = cobrança indevida ou dado incoerente.
6. Nada de telefone, e-mail ou segredo em log, print ou mensagem.

## Ordem e autorização

| # | Script | Tarefa | Autorização (pergunta) | Pré-requisitos | Efeito |
|---|---|---|---|---|---|
| 1 | `t4-faixa-valor/01_previa.sql` | T4 | — (só leitura) | — | Antes × depois para o CEO decidir |
| 2 | `t4-faixa-valor/02_backfill.sql` | T4 | 4a | PR-03 em PRD | Faixa dos atletas + valor dos deals nunca customizados; fora do horário comercial |
| 3 | `t4-faixa-valor/03_escala_legada_OPCIONAL.sql` | T4 | separada | 2 | Estimativas legadas |
| 4 | `t4-faixa-valor/04_lead_score_OPCIONAL.sql` | T4 | separada | 2 | Recalcula `lead_score` (sem tocar classificação) |
| 5 | `t4-faixa-valor/05_reverter.sql` | T4 | decisão | 2/3/4 | Reversão por audit com CAS |
| 6 | `t1-exclusao-lead/01_vicente_concluir_exclusao.sql` | T1 | 3c | PR-02 em PRD | Plano B — o preferível é o CEO excluir pelo card |
| 7 | `escolas/01_relatorio_validacao_tipos.sql` | T15/T16 | — (leitura) | PR-04 | Lista das escolas para validar tipo/perfil |
| 8 | `escolas/02_correcao_pos_validacao.sql` | T15/T16 | sim (opcional; o padrão é corrigir pela tela) | 7 | Correção em lote com executor no audit |
| 9 | `t19-incompletos/01_reclassificar_incompletos_com_dados.sql` | T19 | 4b | PR-01 e PR-06 em PRD | INCOMPLETO com profissão+faixa → FRIO (CAS em `aprovacao_status IS NULL`) |
| 10 | `t23-nascimento/01_relatorio_e_correcao_nascimento.sql` | T23 | 3b | lead aprovado antes; conferência via `fs_motivo_nascimento_invalido` exige o PR-09 | Relatório sem PII + correção de 1 lead com CAS |
| 11 | `financeiro/03_descartar_contrato_teste_lucas_leo.sql` | T9 | 3d | PR-07 em PRD | Descarta (soft delete) o contrato de teste; recusa se houver parcela recebida |
| 12 | `financeiro/02_corrigir_contrato_amanda.sql` | T5/T9 | 3a (valores reais: 26.000 × 28.000) | **11** | Estorna os R$ 7,80, grava as condições reais pelas RPCs, baixa a entrada real, quita se for o caso |
| 13 | `financeiro/01_backfill_entrada_paga.sql` | T5 | **só se o 12 NÃO rodar** | PR-07 | `entrada_paga` onde toda entrada foi recebida |
| 14 | `financeiro/04_previa_regua_cobranca.sql` | T9/T11 | — (leitura) | 11 e 12 | O que a régua cobraria hoje |
| 15 | `t21-proxima-acao/01_trocar_acao_vencida_pos_reuniao.sql` | T21 | 4c | PR-07 em PRD | Deals pós-reunião recebem a ação padrão da coluna (nunca sobre ação manual) |

Fora dos arquivos (comando inline, mesma regra de autorização): soft delete da escola de teste do QA
do PR-04 (`ZZ QA Escola Teste`), depois do QA.

## Régua de cobrança (`billing-reminders`) — sequência obrigatória

A régua está **pausada** e só pode ser discutida depois de:

**11 → 12 → 14** (`03_descartar…` → `02_corrigir…` → `04_previa…`), com o `04` saindo **limpo**
(nenhuma família que já pagou, nenhum contrato de teste). O `01_backfill…` só entra se o `02` não rodar.

Retomar o job é decisão do CEO (ação operacional, fora deste diretório). Antes disso, revisar o
`casMark` do `billing-reminders`, que grava `status = 'atrasado'` sem filtrar o status atual
(corrida com uma baixa simultânea).
