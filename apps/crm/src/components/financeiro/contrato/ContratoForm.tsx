"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Minus, Plus, Trash2 } from "lucide-react";

import { Badge, Button, ToggleField } from "@/components/ui";
import { MoneyInput } from "@/components/ui/MoneyInput";
import {
  composicaoValorTotal,
  ehValorIrrisorio,
  formatarMoeda,
  gerarCronograma,
  metodoDaForma,
  planejarAbertas,
  somarMesesMesmoDia,
  type ParcelaGerada,
} from "@/lib/financeiro/calculo.mjs";
import {
  condicoesContratoSchema,
  FORMA_LABEL,
  FORMA_PLANO_LABEL,
  FORMAS_COM_CARTAO,
  FORMAS_ENTRADA,
  FORMAS_SALDO,
  FORMAS_SALDO_UNICA,
  PLANO_LABEL,
  PLANOS,
  saldoDoContrato,
  type CondicoesContrato,
  type CondicoesContratoInput,
  type FormaPlano,
  type PlanoContrato,
} from "@/lib/financeiro/schemas";
import { cn } from "@/lib/utils";
import type { ContratoCompleto } from "@/types/contrato";

/**
 * Formulário ÚNICO das condições do contrato (T6/T9/T10/T18a), em 3 modos:
 *   • criar          — deal sem contrato (T6; também o PlanoEscolhidoModal sem sinal)
 *   • escolher_plano — contrato AGUARDANDO PLANO: entrada = sinais já recebidos (T10/T11)
 *   • editar         — contrato com plano (T9): justificativa obrigatória
 *
 * Componente de MÓDULO com React Hook Form + Zod (o form antigo era declarado
 * dentro do render e remontava a cada tecla). Formas de pagamento começam
 * SEM seleção; sugestões aparecem como sugestão (chip), nunca como default
 * silencioso. A prévia das parcelas usa calculo.mjs — a MESMA função que o
 * servidor usa para gerar as parcelas que a RPC grava.
 */

export type ModoContratoForm = "criar" | "escolher_plano" | "editar";

export interface ContratoFormProps {
  modo: ModoContratoForm;
  dados: ContratoCompleto;
  /** id do <form> — o botão de envio mora no rodapé do FinModal (form={formId}). */
  formId: string;
  onEnviar: (valores: CondicoesContrato, regerar: { entrada: boolean; saldo: boolean }) => Promise<void>;
  /** Avisa o pai do que bloqueia o envio (texto do title/descrição do botão). */
  onBloqueio?: (motivos: string[]) => void;
}

function valorTabela(dados: ContratoCompleto, plano: PlanoContrato | undefined, forma: FormaPlano): number | null {
  if (!plano || plano === "personalizado") return null;
  const t = dados.planosTabela[plano];
  return forma === "pix_avista" ? t.valor_pix : t.valor;
}

function valoresIniciais(modo: ModoContratoForm, dados: ContratoCompleto): Partial<CondicoesContratoInput> {
  const c = dados.contrato;
  const umMes = somarMesesMesmoDia(dados.hoje, 1);
  if (modo === "criar" || !c) {
    return {
      formaPagamentoPlano: "padrao",
      valorTabela: null,
      justificativa: "",
      sinalAbatido: true,
      itens: [],
      incluiPsicologa: false,
      custoPsicologa: dados.psicologaPadrao,
      entrada: { valor: 0, forma: null, quantidade: 1, jaRecebida: false, dataRecebimento: null, primeiroVencimento: dados.hoje, parcelasCartao: null },
      saldo: { definirDepois: false, forma: null, quantidade: 1, primeiroVencimento: umMes },
      confirmarValorBaixo: false,
      confirmarComPagamentos: false,
      exigirJustificativa: false,
      planoAtual: null,
      pagosNoSaldo: 0,
    };
  }
  const abertasSaldo = dados.parcelas.filter((p) => p.tipo === "saldo" && p.status !== "recebido");
  const abertasEntrada = dados.parcelas.filter((p) => p.tipo === "entrada" && p.status !== "recebido");
  const plano = (c.plano ?? undefined) as PlanoContrato | undefined;
  const forma = (c.forma_pagamento_plano ?? "padrao") as FormaPlano;
  return {
    plano,
    formaPagamentoPlano: forma,
    valorBasePlano:
      c.valor_base_plano ??
      (c.plano ? c.valor_total - dados.itens.reduce((s, i) => s + i.valor, 0) - (c.sinal_abatido ? 0 : c.entrada_valor) : undefined),
    valorTabela: valorTabela(dados, plano, forma),
    justificativa: "",
    sinalAbatido: c.sinal_abatido,
    itens: dados.itens.map((i) => ({
      id: i.id,
      tipo: i.tipo,
      descricao: i.descricao,
      valorAbsoluto: Math.abs(i.valor),
      ajusteNegativo: i.tipo === "ajuste" && i.valor < 0,
      catalogoChave: i.catalogo_chave ?? undefined,
    })),
    incluiPsicologa: c.inclui_psicologa,
    custoPsicologa: c.custo_psicologa ?? dados.psicologaPadrao,
    entrada: {
      valor: c.entrada_valor,
      forma: c.entrada_forma,
      quantidade: Math.max(1, dados.parcelas.filter((p) => p.tipo === "entrada").length),
      jaRecebida: false,
      dataRecebimento: null,
      primeiroVencimento: abertasEntrada[0]?.vencimento ?? dados.hoje,
      parcelasCartao: null,
    },
    saldo: {
      // Saldo R$ 0 (entrada = total) também grava forma NULL — não é "definir depois".
      definirDepois: c.plano !== null && c.saldo_forma === null && c.saldo_remanescente > 0,
      forma: c.saldo_forma,
      quantidade: Math.max(1, abertasSaldo.length),
      primeiroVencimento: abertasSaldo[0]?.vencimento ?? umMes,
    },
    confirmarValorBaixo: false,
    confirmarComPagamentos: false,
    // Editar contrato com plano exige justificativa (o servidor reaplica pelo banco).
    exigirJustificativa: modo === "editar",
    // Trocar de plano com saldo já pago pede confirmação (o servidor reaplica pelo banco).
    planoAtual: modo === "editar" ? ((c.plano ?? null) as PlanoContrato | null) : null,
    pagosNoSaldo: dados.parcelas
      .filter((p) => p.tipo === "saldo" && p.status === "recebido")
      .reduce((s, p) => s + p.valor, 0),
  };
}

/** Campo numérico vazio vira undefined (vale o default do schema), nunca NaN. */
const inteiroOuIndefinido = (x: string) => (x === "" ? undefined : Number(x));

/** Rótulos dos campos de dinheiro (motivo de bloqueio quando o texto é inválido). */
const ROTULO_DINHEIRO: Record<string, string> = {
  valorBasePlano: "Valor do plano",
  entrada: "Valor da entrada",
  psicologa: "Custo interno da psicóloga",
};

function ErroCampo({ id, mensagem }: { id: string; mensagem?: string }) {
  if (!mensagem) return null;
  return (
    <p id={id} role="alert" className="text-[11px] text-sys-red">
      {mensagem}
    </p>
  );
}

const rotulo = "block text-xs font-medium text-muted-foreground";
const campo =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25 sm:h-9 sm:text-sm";
const secao = "space-y-3 rounded-xl border border-border/70 bg-card/60 p-3 sm:p-4";

export function ContratoForm({ modo, dados, formId, onEnviar, onBloqueio }: ContratoFormProps) {
  const form = useForm<CondicoesContratoInput, unknown, CondicoesContrato>({
    // zod v4 + resolvers v5: o cast alinha input×output do schema com o form
    resolver: zodResolver(condicoesContratoSchema) as Resolver<CondicoesContratoInput, unknown, CondicoesContrato>,
    defaultValues: valoresIniciais(modo, dados),
    mode: "onChange",
  });
  const { control, register, handleSubmit, setValue, formState } = form;
  const itens = useFieldArray({ control, name: "itens" });
  const v = useWatch({ control });

  // Texto que não é dinheiro ("4.500.00") TRAVA o envio: o valor nunca vira 0
  // nem fica o último número parcial digitado.
  const [dinheiroInvalido, setDinheiroInvalido] = useState<Record<string, boolean>>({});
  const marcarDinheiro = useCallback((chave: string, invalido: boolean) => {
    setDinheiroInvalido((atual) => (Boolean(atual[chave]) === invalido ? atual : { ...atual, [chave]: invalido }));
  }, []);

  const recebidasEntrada = useMemo(
    () => dados.parcelas.filter((p) => p.tipo === "entrada" && p.status === "recebido"),
    [dados.parcelas],
  );
  const recebidasSaldo = useMemo(
    () => dados.parcelas.filter((p) => p.tipo === "saldo" && p.status === "recebido"),
    [dados.parcelas],
  );
  const sinalRecebido = recebidasEntrada.reduce((s, p) => s + p.valor, 0);
  const entradaTravada = modo === "escolher_plano"; // entrada = sinais (novos sinais: "Registrar sinal")

  // ── Derivados (mesma conta do servidor) ──
  const total = composicaoValorTotal({
    valorBase: v.valorBasePlano ?? 0,
    itens: (v.itens ?? []).flatMap((i) => {
      if (!i?.tipo || !i.valorAbsoluto) return [];
      const negativo = i.tipo === "desconto" || (i.tipo === "ajuste" && Boolean(i.ajusteNegativo));
      return [{ valor: negativo ? -i.valorAbsoluto : i.valorAbsoluto }];
    }),
    entrada: v.entrada?.valor ?? 0,
    sinalAbatido: v.sinalAbatido ?? true,
  });
  const saldoNovo = saldoDoContrato(total, v.entrada?.valor ?? 0);
  // Entrada cobre o total (com plano já escolhido): nada a parcelar no saldo.
  const semSaldo = total > 0 && saldoNovo === 0;
  const tabela = valorTabela(dados, v.plano, v.formaPagamentoPlano ?? "padrao");
  const customizado = v.plano !== undefined && (tabela === null || v.valorBasePlano !== tabela);
  // Regra 3 completa (mesma conta do schema e da RPC): itens ou sinal à parte também negociam.
  const negociado =
    customizado ||
    Math.round((total - (v.valorBasePlano ?? 0) - (v.sinalAbatido === false ? v.entrada?.valor ?? 0 : 0)) * 100) !== 0 ||
    (v.sinalAbatido === false && (v.entrada?.valor ?? 0) > 0);
  const irrisoria = ehValorIrrisorio(v.entrada?.valor ?? 0, total);

  useEffect(() => {
    setValue("valorTabela", tabela, { shouldValidate: true });
  }, [tabela, setValue]);

  // Regerar: no editar, só o grupo que mudou (ou que está incoerente — legado
  // com centavos sobrando, ex. Amanda). Criar/escolher sempre geram.
  const somaSaldoVivo = dados.parcelas.filter((p) => p.tipo === "saldo").reduce((s, p) => s + p.valor, 0);
  const dirty = formState.dirtyFields;
  const regerarEntrada =
    modo === "criar" || (!entradaTravada && Boolean(dirty.entrada));
  const regerarSaldo =
    modo !== "editar" ||
    Boolean(dirty.saldo || dirty.valorBasePlano || dirty.itens || dirty.sinalAbatido || dirty.entrada) ||
    Math.round(somaSaldoVivo * 100) !== Math.round((dados.contrato?.saldo_remanescente ?? 0) * 100);

  const previaSaldo = useMemo<ParcelaGerada[]>(() => {
    const s = v.saldo;
    if (!s || s.definirDepois || !s.forma || !s.primeiroVencimento || saldoNovo <= 0) return [];
    const metodo = metodoDaForma(s.forma) ?? "outro";
    const qtd = FORMAS_SALDO_UNICA.has(s.forma) ? 1 : s.quantidade ?? 1;
    try {
      return planejarAbertas({
        totalGrupo: saldoNovo, recebidas: recebidasSaldo, quantidadeTotal: recebidasSaldo.length + qtd,
        primeiroVencimento: s.primeiroVencimento, metodo,
      }).parcelas;
    } catch {
      return [];
    }
  }, [v.saldo, saldoNovo, recebidasSaldo]);

  const previaEntrada = useMemo<ParcelaGerada[]>(() => {
    const e = v.entrada;
    if (!e || entradaTravada || !e.forma || (e.valor ?? 0) <= 0 || e.jaRecebida || !e.primeiroVencimento) return [];
    try {
      return gerarCronograma({
        total: e.valor ?? 0, quantidade: e.quantidade ?? 1, primeiroVencimento: e.primeiroVencimento,
        metodo: metodoDaForma(e.forma) ?? "outro", rotuloUnico: "Entrada",
      });
    } catch {
      return [];
    }
  }, [v.entrada, entradaTravada]);

  const pagosNoSaldo = recebidasSaldo.reduce((s, p) => s + p.valor, 0);
  const trocouPlano = modo === "editar" && dados.contrato?.plano !== v.plano;

  // Só os campos de dinheiro MONTADOS contam (item removido, psicóloga
  // desligada ou entrada travada não podem prender o botão).
  const camposAtivos = new Set<string>([
    "valorBasePlano",
    ...(entradaTravada ? [] : ["entrada"]),
    ...(v.incluiPsicologa ? ["psicologa"] : []),
    ...itens.fields.map((f) => `item:${f.id}`),
  ]);
  const motivosDinheiro = Object.entries(dinheiroInvalido)
    .filter(([chave, invalido]) => invalido && camposAtivos.has(chave))
    .map(([chave]) => `Valor inválido em “${ROTULO_DINHEIRO[chave] ?? "Valor do item"}” — use o formato 7.800,00.`);

  // Motivos de bloqueio derivados dos VALORES atuais (não de formState.errors,
  // que só existe depois da 1ª validação): o botão já nasce desabilitado com o
  // motivo visível (critério do T6) sem pintar todos os campos de vermelho.
  const validacao = condicoesContratoSchema.safeParse({ ...v, exigirJustificativa: modo === "editar" });
  const motivos = [
    ...motivosDinheiro,
    ...(validacao.success ? [] : validacao.error.issues.map((i) => i.message)),
  ].slice(0, 3);
  const chaveMotivos = motivos.join("|");
  useEffect(() => {
    onBloqueio?.(modo === "editar" && !formState.isDirty ? ["Nada mudou."] : chaveMotivos ? chaveMotivos.split("|") : []);
    // onBloqueio fora das deps: o pai passa um setState (estável); uma callback
    // inline do pai faria o efeito rodar a cada render.
  }, [chaveMotivos, formState.isDirty, modo]); // eslint-disable-line react-hooks/exhaustive-deps

  const escolherPlano = (plano: PlanoContrato) => {
    setValue("plano", plano, { shouldDirty: true, shouldValidate: true });
    const t = valorTabela(dados, plano, v.formaPagamentoPlano ?? "padrao");
    if (t !== null) setValue("valorBasePlano", t, { shouldDirty: true, shouldValidate: true });
    if (plano !== "personalizado" && modo !== "editar") {
      setValue("incluiPsicologa", dados.planosTabela[plano].psicologa, { shouldDirty: true });
    }
  };

  return (
    <form
      id={formId}
      noValidate
      onSubmit={(e) => {
        // Enter num campo também envia: o texto inválido precisa travar aqui.
        if (motivosDinheiro.length > 0) {
          e.preventDefault();
          return;
        }
        return handleSubmit((valores) => onEnviar(valores, { entrada: regerarEntrada, saldo: regerarSaldo }))(e);
      }}
      className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]"
    >
      <div className="min-w-0 space-y-4">
        {/* 1. Plano */}
        <fieldset className={secao}>
          <legend className="px-1 text-sm font-semibold text-foreground">Plano</legend>
          <div role="radiogroup" aria-label="Plano" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PLANOS.map((p) => {
              const ativo = v.plano === p;
              const preco = p === "personalizado" ? null : dados.planosTabela[p];
              return (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  onClick={() => escolherPlano(p)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    ativo ? "border-primary bg-primary/8" : "border-border hover:border-primary/40",
                  )}
                >
                  <span className="block text-sm font-semibold text-foreground">{PLANO_LABEL[p]}</span>
                  <span className="block text-[11px] tabular-nums text-muted-foreground">
                    {preco ? `${formatarMoeda(preco.valor)} · Pix ${formatarMoeda(preco.valor_pix)}` : "valor negociado"}
                  </span>
                </button>
              );
            })}
          </div>
          {formState.errors.plano && <p role="alert" className="text-[11px] text-sys-red">{formState.errors.plano.message}</p>}

          {v.plano && v.plano !== "personalizado" && (
            <div role="radiogroup" aria-label="Forma do plano" className="flex flex-wrap gap-2">
              {(["padrao", "pix_avista"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={v.formaPagamentoPlano === f}
                  onClick={() => {
                    setValue("formaPagamentoPlano", f, { shouldDirty: true });
                    const t = valorTabela(dados, v.plano, f);
                    if (t !== null) setValue("valorBasePlano", t, { shouldDirty: true, shouldValidate: true });
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium",
                    v.formaPagamentoPlano === f ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
                  )}
                >
                  {FORMA_PLANO_LABEL[f]}
                </button>
              ))}
            </div>
          )}

          <Controller
            control={control}
            name="valorBasePlano"
            render={({ field, fieldState }) => (
              <MoneyInput
                label="Valor do plano"
                value={field.value ?? null}
                onValueChange={(x, { invalido }) => {
                  marcarDinheiro("valorBasePlano", invalido);
                  field.onChange(x ?? undefined);
                }}
                onBlur={field.onBlur}
                ref={field.ref}
                erro={fieldState.error?.message}
                ajuda={
                  tabela !== null && customizado
                    ? `Fora da tabela (${formatarMoeda(tabela)}) — justificativa obrigatória.`
                    : tabela !== null
                      ? "Valor de tabela (Configurações → Parâmetros)."
                      : undefined
                }
              />
            )}
          />
          {(negociado || modo === "editar") && (
            <div className="space-y-1.5">
              <label htmlFor={`${formId}-just`} className={rotulo}>
                {modo === "editar" ? "Justificativa da alteração *" : "Justificativa das condições negociadas *"}
              </label>
              <textarea
                id={`${formId}-just`}
                rows={2}
                {...register("justificativa")}
                aria-invalid={Boolean(formState.errors.justificativa) || undefined}
                placeholder="O que foi negociado e por quê (fica no histórico do contrato)"
                className={cn(campo, "h-auto resize-none py-2")}
              />
              {formState.errors.justificativa && (
                <p role="alert" className="text-[11px] text-sys-red">{formState.errors.justificativa.message}</p>
              )}
            </div>
          )}
        </fieldset>

        {/* 2. Itens do aluno (T18a) */}
        <fieldset className={secao}>
          <legend className="px-1 text-sm font-semibold text-foreground">Serviços, descontos e ajustes</legend>
          {itens.fields.length === 0 && (
            <p className="text-xs text-label-tertiary">Nenhum item — o valor é o do plano.</p>
          )}
          <ul className="space-y-2">
            {itens.fields.map((f, idx) => (
              <li key={f.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border border-border p-2 sm:grid-cols-[8rem_1fr_9rem_auto]">
                <select aria-label="Tipo do item" {...register(`itens.${idx}.tipo`)} className={campo}>
                  <option value="servico">Serviço (+)</option>
                  <option value="desconto">Desconto (−)</option>
                  <option value="ajuste">Ajuste (±)</option>
                </select>
                <input aria-label="Descrição do item" {...register(`itens.${idx}.descricao`)} className={cn(campo, "col-span-2 sm:col-span-1")} placeholder="Ex.: Preparação TOEFL" />
                <Controller
                  control={control}
                  name={`itens.${idx}.valorAbsoluto`}
                  render={({ field, fieldState }) => (
                    <MoneyInput
                      aria-label="Valor do item"
                      value={field.value ?? null}
                      onValueChange={(x, { invalido }) => {
                        marcarDinheiro(`item:${f.id}`, invalido);
                        field.onChange(x ?? undefined);
                      }}
                      onBlur={field.onBlur}
                      erro={fieldState.error?.message}
                    />
                  )}
                />
                <div className="flex items-center gap-1">
                  {v.itens?.[idx]?.tipo === "ajuste" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={v.itens?.[idx]?.ajusteNegativo ? "Ajuste subtrai — trocar para somar" : "Ajuste soma — trocar para subtrair"}
                      onClick={() => setValue(`itens.${idx}.ajusteNegativo`, !v.itens?.[idx]?.ajusteNegativo, { shouldDirty: true })}
                    >
                      {v.itens?.[idx]?.ajusteNegativo ? <Minus /> : <Plus />}
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" aria-label="Remover item" onClick={() => itens.remove(idx)}>
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {dados.catalogo.filter((s) => s.ativo).map((s) => (
              <button
                key={s.chave}
                type="button"
                onClick={() => itens.append({ tipo: "servico", descricao: s.nome, valorAbsoluto: s.valor, ajusteNegativo: false, catalogoChave: s.chave })}
                className="rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary"
              >
                + {s.nome} · {formatarMoeda(s.valor)}
              </button>
            ))}
            <button type="button" onClick={() => itens.append({ tipo: "desconto", descricao: "", valorAbsoluto: 0, ajusteNegativo: false })}
              className="rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-primary">
              + Desconto
            </button>
            <button type="button" onClick={() => itens.append({ tipo: "servico", descricao: "", valorAbsoluto: 0, ajusteNegativo: false })}
              className="rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-primary">
              + Item avulso
            </button>
          </div>
        </fieldset>

        {/* 3. Sinal / entrada */}
        <fieldset className={secao}>
          <legend className="px-1 text-sm font-semibold text-foreground">{entradaTravada ? "Sinal recebido" : "Sinal / entrada"}</legend>
          {entradaTravada ? (
            <p className="text-sm text-foreground">
              {formatarMoeda(sinalRecebido)} em {recebidasEntrada.length} pagamento(s).{" "}
              <span className="text-xs text-muted-foreground">Outro pagamento de sinal? Use “Registrar sinal”.</span>
            </p>
          ) : (
            <>
              <Controller
                control={control}
                name="entrada.valor"
                render={({ field, fieldState }) => (
                  <MoneyInput
                    label="Valor da entrada"
                    value={field.value ?? null}
                    onValueChange={(x, { invalido }) => {
                      marcarDinheiro("entrada", invalido);
                      // vazio = sem entrada (0); inválido NUNCA vira 0 (fica vazio e trava).
                      field.onChange(invalido ? undefined : (x ?? 0));
                    }}
                    onBlur={field.onBlur}
                    erro={fieldState.error?.message}
                    ajuda={
                      (field.value ?? 0) === 0 ? (
                        <button type="button" className="font-medium text-primary underline-offset-2 hover:underline"
                          onClick={() => field.onChange(dados.entradaPadrao)}>
                          Usar sugestão {formatarMoeda(dados.entradaPadrao)}
                        </button>
                      ) : undefined
                    }
                  />
                )}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor={`${formId}-ent-forma`} className={rotulo}>Forma da entrada *</label>
                  <select id={`${formId}-ent-forma`} {...register("entrada.forma", { setValueAs: (x: string) => (x === "" ? null : x) })} className={campo}>
                    <option value="">Escolha…</option>
                    {FORMAS_ENTRADA.map((f) => <option key={f} value={f}>{FORMA_LABEL[f]}</option>)}
                  </select>
                  {formState.errors.entrada?.forma && <p role="alert" className="text-[11px] text-sys-red">{formState.errors.entrada.forma.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <label htmlFor={`${formId}-ent-qtd`} className={rotulo}>Parcelas da entrada</label>
                  <input id={`${formId}-ent-qtd`} type="number" inputMode="numeric" min={1} max={12}
                    aria-invalid={Boolean(formState.errors.entrada?.quantidade) || undefined}
                    aria-describedby={formState.errors.entrada?.quantidade ? `${formId}-ent-qtd-erro` : undefined}
                    {...register("entrada.quantidade", { setValueAs: inteiroOuIndefinido })} className={campo} />
                  <ErroCampo id={`${formId}-ent-qtd-erro`} mensagem={formState.errors.entrada?.quantidade?.message} />
                </div>
              </div>
              {modo === "criar" && (
                <ToggleField
                  label="A entrada já foi paga"
                  ajuda="Registra como recebida na data real — entra no caixa nesse dia."
                  ativo={Boolean(v.entrada?.jaRecebida)}
                  onChange={(x) => setValue("entrada.jaRecebida", x, { shouldDirty: true, shouldValidate: true })}
                />
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {v.entrada?.jaRecebida ? (
                  <div className="space-y-1.5">
                    <label htmlFor={`${formId}-ent-data`} className={rotulo}>Data do pagamento *</label>
                    <input id={`${formId}-ent-data`} type="date" max={dados.hoje}
                      {...register("entrada.dataRecebimento", { setValueAs: (x: string) => x || null })} className={campo} />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label htmlFor={`${formId}-ent-venc`} className={rotulo}>Vencimento da entrada *</label>
                    <input id={`${formId}-ent-venc`} type="date"
                      {...register("entrada.primeiroVencimento", { setValueAs: (x: string) => x || null })} className={campo} />
                  </div>
                )}
                {v.entrada?.forma && FORMAS_COM_CARTAO.has(v.entrada.forma) && v.entrada?.jaRecebida && (
                  <div className="space-y-1.5">
                    <label htmlFor={`${formId}-ent-cartao`} className={rotulo}>Vezes no cartão</label>
                    <input id={`${formId}-ent-cartao`} type="number" inputMode="numeric" min={1} max={24}
                      aria-invalid={Boolean(formState.errors.entrada?.parcelasCartao) || undefined}
                      aria-describedby={formState.errors.entrada?.parcelasCartao ? `${formId}-ent-cartao-erro` : undefined}
                      {...register("entrada.parcelasCartao", { setValueAs: (x: string) => (x === "" ? null : Number(x)) })} className={campo} />
                    <ErroCampo id={`${formId}-ent-cartao-erro`} mensagem={formState.errors.entrada?.parcelasCartao?.message} />
                  </div>
                )}
              </div>
            </>
          )}
          <ToggleField
            label="Abater o sinal do valor do plano"
            ajuda={v.sinalAbatido === false ? "O sinal é cobrado À PARTE: total = plano + itens + sinal." : "Padrão: o sinal faz parte do valor do plano."}
            ativo={v.sinalAbatido !== false}
            onChange={(x) => setValue("sinalAbatido", x, { shouldDirty: true, shouldValidate: true })}
          />
          {irrisoria && (
            <label className="flex items-start gap-2 rounded-lg border border-sys-orange/30 bg-sys-orange/8 p-2.5 text-xs text-sys-orange">
              <input type="checkbox" {...register("confirmarValorBaixo")} className="mt-0.5 size-4 accent-current" />
              <span>
                <AlertTriangle aria-hidden className="mr-1 inline size-3.5" />
                Entrada de <strong>{formatarMoeda(v.entrada?.valor ?? 0)}</strong> é muito baixa para um contrato de {formatarMoeda(total)}.
                Confirmo que o valor está certo.
              </span>
            </label>
          )}
        </fieldset>

        {/* 4. Saldo */}
        <fieldset className={secao}>
          <legend className="px-1 text-sm font-semibold text-foreground">Saldo · {formatarMoeda(saldoNovo)}</legend>
          {semSaldo ? (
            <p className="text-xs text-muted-foreground">
              Sem saldo a parcelar: a entrada cobre o valor total do contrato.
            </p>
          ) : (
            <ToggleField
              label="Definir as condições do saldo depois"
              ajuda="O contrato fica com “condições pendentes” até você definir forma e parcelas."
              ativo={Boolean(v.saldo?.definirDepois)}
              onChange={(x) => setValue("saldo.definirDepois", x, { shouldDirty: true, shouldValidate: true })}
            />
          )}
          {!semSaldo && !v.saldo?.definirDepois && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label htmlFor={`${formId}-sal-forma`} className={rotulo}>Forma do saldo *</label>
                <select id={`${formId}-sal-forma`} {...register("saldo.forma", { setValueAs: (x: string) => (x === "" ? null : x) })} className={campo}>
                  <option value="">Escolha…</option>
                  {FORMAS_SALDO.map((f) => <option key={f} value={f}>{FORMA_LABEL[f]}</option>)}
                </select>
                {formState.errors.saldo?.forma && <p role="alert" className="text-[11px] text-sys-red">{formState.errors.saldo.forma.message}</p>}
              </div>
              {v.saldo?.forma && !FORMAS_SALDO_UNICA.has(v.saldo.forma) && (
                <div className="space-y-1.5">
                  <label htmlFor={`${formId}-sal-qtd`} className={rotulo}>Parcelas {recebidasSaldo.length > 0 ? "em aberto" : ""}</label>
                  <input id={`${formId}-sal-qtd`} type="number" inputMode="numeric" min={1} max={24}
                    aria-invalid={Boolean(formState.errors.saldo?.quantidade) || undefined}
                    aria-describedby={formState.errors.saldo?.quantidade ? `${formId}-sal-qtd-erro` : undefined}
                    {...register("saldo.quantidade", { setValueAs: inteiroOuIndefinido })} className={campo} />
                  <ErroCampo id={`${formId}-sal-qtd-erro`} mensagem={formState.errors.saldo?.quantidade?.message} />
                </div>
              )}
              <div className="space-y-1.5">
                <label htmlFor={`${formId}-sal-venc`} className={rotulo}>1º vencimento *</label>
                <input id={`${formId}-sal-venc`} type="date"
                  {...register("saldo.primeiroVencimento", { setValueAs: (x: string) => x || null })} className={campo} />
              </div>
            </div>
          )}
          {modo === "editar" && regerarSaldo && !semSaldo && !v.saldo?.definirDepois && (
            <p className="text-[11px] text-muted-foreground">
              As parcelas EM ABERTO do saldo serão recalculadas
              {recebidasSaldo.length > 0 ? ` — as ${recebidasSaldo.length} já recebidas não mudam` : ""}.
            </p>
          )}
          {trocouPlano && pagosNoSaldo > 0 && (
            <label className="flex items-start gap-2 rounded-lg border border-sys-orange/30 bg-sys-orange/8 p-2.5 text-xs text-sys-orange">
              <input type="checkbox" {...register("confirmarComPagamentos")} className="mt-0.5 size-4 accent-current" />
              <span>Já entraram {formatarMoeda(pagosNoSaldo)} no saldo. Confirmo a troca de plano (pagamentos recebidos não mudam).</span>
            </label>
          )}
        </fieldset>

        {/* 5. Psicóloga */}
        <fieldset className={secao}>
          <legend className="px-1 text-sm font-semibold text-foreground">Psicóloga</legend>
          <ToggleField
            label="Inclui psicóloga intercultural"
            ativo={Boolean(v.incluiPsicologa)}
            onChange={(x) => setValue("incluiPsicologa", x, { shouldDirty: true })}
          />
          {v.incluiPsicologa && (
            <Controller
              control={control}
              name="custoPsicologa"
              render={({ field }) => (
                <MoneyInput label="Custo interno da psicóloga" value={field.value ?? null}
                  onValueChange={(x, { invalido }) => {
                    marcarDinheiro("psicologa", invalido);
                    field.onChange(invalido ? undefined : (x ?? 0));
                  }}
                  onBlur={field.onBlur}
                  ajuda="Custo da BAU (entra na margem do aluno), não é cobrado à parte." />
              )}
            />
          )}
        </fieldset>
      </div>

      {/* Resumo (sticky no desktop; no fim no mobile) */}
      <aside aria-label="Resumo do contrato" className="h-fit space-y-2 rounded-xl border border-primary/20 bg-primary/[0.03] p-3 text-sm lg:sticky lg:top-0">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-primary">Resumo</h3>
        <dl className="space-y-1.5">
          <Linha rotulo="Plano" valor={v.plano ? `${PLANO_LABEL[v.plano]} · ${formatarMoeda(v.valorBasePlano ?? 0)}` : "—"} />
          {(v.itens ?? []).length > 0 && (
            <Linha rotulo="Itens" valor={formatarMoeda(total - (v.valorBasePlano ?? 0) - (v.sinalAbatido === false ? v.entrada?.valor ?? 0 : 0))} />
          )}
          {v.sinalAbatido === false && <Linha rotulo="Sinal à parte" valor={formatarMoeda(v.entrada?.valor ?? 0)} />}
          <Linha rotulo="Valor total" valor={<strong className="text-sys-green">{formatarMoeda(total)}</strong>} />
          <Linha
            rotulo="Entrada"
            valor={
              entradaTravada
                ? `${formatarMoeda(sinalRecebido)} · recebida`
                : `${formatarMoeda(v.entrada?.valor ?? 0)}${v.entrada?.forma ? ` · ${FORMA_LABEL[v.entrada.forma]}` : " · forma?"}${v.entrada?.jaRecebida ? " · já paga" : previaEntrada.length > 1 ? ` · ${previaEntrada.length}×` : ""}`
            }
          />
          <Linha
            rotulo="Saldo"
            valor={
              semSaldo
                ? `${formatarMoeda(0)} · entrada cobre o total`
                : v.saldo?.definirDepois
                ? `${formatarMoeda(saldoNovo)} · a definir`
                : previaSaldo.length > 0
                  ? `${previaSaldo.length}× ${formatarMoeda(previaSaldo[0].valor)}${previaSaldo.length > 1 && previaSaldo[previaSaldo.length - 1].valor !== previaSaldo[0].valor ? ` (última ${formatarMoeda(previaSaldo[previaSaldo.length - 1].valor)})` : ""}`
                  : formatarMoeda(saldoNovo)
            }
          />
          {previaSaldo.length > 0 && (
            <Linha rotulo="Vencimentos" valor={`${fmtData(previaSaldo[0].vencimento)} → ${fmtData(previaSaldo[previaSaldo.length - 1].vencimento)}`} />
          )}
          {v.incluiPsicologa && <Linha rotulo="Psicóloga (custo)" valor={formatarMoeda(v.custoPsicologa ?? 0)} />}
        </dl>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {customizado && <Badge tone="orange" size="sm">Valor fora da tabela</Badge>}
          {irrisoria && <Badge tone="red" size="sm">Entrada muito baixa</Badge>}
          {!semSaldo && v.saldo?.definirDepois && <Badge tone="neutral" size="sm">Condições pendentes</Badge>}
        </div>
      </aside>
    </form>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="min-w-0 text-right text-xs font-medium tabular-nums text-foreground">{valor}</dd>
    </div>
  );
}

const fmtData = (iso: string) => iso.split("-").reverse().join("/");
