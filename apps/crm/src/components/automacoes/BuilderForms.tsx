"use client";

import { X } from "lucide-react";

import { Button, Input } from "@/components/ui";
import {
  GATILHO_CATALOG,
  type AgendamentoFrequencia,
  type AutomacaoGatilho,
  type CondicaoOperador,
  OPERADOR_LABEL,
} from "@/types/automacao";
import { cn } from "@/lib/utils";

import {
  CONDICAO_CAMPOS,
  DIA_SEMANA_OPCOES,
  EMAIL_CUSTOM_ASSUNTO_MAX,
  EMAIL_CUSTOM_ASSUNTO_MIN,
  EMAIL_CUSTOM_MENSAGEM_MAX,
  EMAIL_CUSTOM_MENSAGEM_MIN,
  ETAPA_OPCOES,
  FIELD_CLASS,
  FREQUENCIA_OPCOES,
  TEMPLATE_OPCOES,
  WHATSAPP_CUSTOM_MAX,
  WHATSAPP_CUSTOM_MIN,
  WHATSAPP_CUSTOM_VARIAVEIS,
  camposCondicaoDoGatilho,
  type BuilderState,
  type UsuarioRow,
} from "./builder-shared";

/**
 * Formulários do builder de automações — MESMOS campos nas duas visões:
 * empilhados na visão Formulário e no painel lateral da visão Fluxo.
 */

// ─── Gatilho ─────────────────────────────────────────────────────────────────

export function GatilhoForm({
  builder,
  onChange,
}: {
  builder: BuilderState;
  onChange: (b: BuilderState) => void;
}) {
  const gatilhoInfo = GATILHO_CATALOG[builder.gatilho];

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <select
          aria-label="Gatilho"
          className={FIELD_CLASS}
          value={builder.gatilho}
          onChange={(e) => {
            const gatilho = e.target.value as AutomacaoGatilho;
            onChange({
              ...builder,
              gatilho,
              gatilhoDias: GATILHO_CATALOG[gatilho].configDias?.padrao ?? builder.gatilhoDias,
              condicoes: [], // catálogo de campos muda com o gatilho
            });
          }}
        >
          {Object.entries(GATILHO_CATALOG).map(([value, info]) => (
            <option key={value} value={value}>
              {info.origem === "evento" ? "⚡" : "⏱"} {info.label}
            </option>
          ))}
        </select>
        {gatilhoInfo.configDias && (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              aria-label={gatilhoInfo.configDias.label}
              value={String(builder.gatilhoDias)}
              onChange={(e) => onChange({ ...builder, gatilhoDias: Number(e.target.value) })}
            />
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {gatilhoInfo.configDias.label}
            </span>
          </div>
        )}
      </div>
      {gatilhoInfo.configAgendamento && (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <select
              aria-label="Frequência"
              className={FIELD_CLASS}
              value={builder.agFrequencia}
              onChange={(e) =>
                onChange({ ...builder, agFrequencia: e.target.value as AgendamentoFrequencia })
              }
            >
              {FREQUENCIA_OPCOES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={23}
                aria-label="Hora do disparo (0-23, horário de Brasília)"
                className="text-center tabular-nums"
                value={String(builder.agHora)}
                onChange={(e) => onChange({ ...builder, agHora: Number(e.target.value) })}
              />
              <span className="shrink-0 text-[11px] text-muted-foreground">h (BRT, 0-23)</span>
            </div>
            {builder.agFrequencia === "semanal" && (
              <select
                aria-label="Dia da semana"
                className={FIELD_CLASS}
                value={String(builder.agDiaSemana)}
                onChange={(e) => onChange({ ...builder, agDiaSemana: Number(e.target.value) })}
              >
                {DIA_SEMANA_OPCOES.map((d) => (
                  <option key={d.value} value={String(d.value)}>
                    {d.label}
                  </option>
                ))}
              </select>
            )}
            {builder.agFrequencia === "mensal" && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={28}
                  aria-label="Dia do mês (1-28)"
                  className="text-center tabular-nums"
                  value={String(builder.agDiaMes)}
                  onChange={(e) => onChange({ ...builder, agDiaMes: Number(e.target.value) })}
                />
                <span className="shrink-0 text-[11px] text-muted-foreground">dia do mês (1-28)</span>
              </div>
            )}
          </div>
          <p className="rounded-md bg-secondary/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            O disparo não tem lead/deal associado — ações de WhatsApp e mover deal são ignoradas.
            Use <strong>criar tarefa</strong> ou <strong>notificar</strong> para rotinas
            recorrentes. Dispara 1x por período, no tick da hora escolhida (min 30).
          </p>
        </>
      )}
      <p className="text-[11px] text-muted-foreground">{gatilhoInfo.descricao}</p>
    </div>
  );
}

// ─── Condição ────────────────────────────────────────────────────────────────

export function CondicaoForm({
  builder,
  index,
  onChange,
  onRemove,
}: {
  builder: BuilderState;
  index: number;
  onChange: (b: BuilderState) => void;
  /** Quando presente, renderiza o X de remover inline (visão Formulário). */
  onRemove?: () => void;
}) {
  const cond = builder.condicoes[index];
  if (!cond) return null;

  const camposDisponiveis = camposCondicaoDoGatilho(builder.gatilho);
  const campoInfo = CONDICAO_CAMPOS.find((c) => c.value === cond.campo);

  const setCondicao = (patch: Partial<(typeof builder.condicoes)[number]>) => {
    const next = builder.condicoes.map((c, idx) => (idx === index ? { ...c, ...patch } : c));
    onChange({ ...builder, condicoes: next });
  };

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Campo"
        className={FIELD_CLASS}
        value={cond.campo}
        onChange={(e) => {
          const novo = CONDICAO_CAMPOS.find((c) => c.value === e.target.value);
          setCondicao({ campo: e.target.value, valor: novo?.opcoes?.[0]?.value ?? "" });
        }}
      >
        {camposDisponiveis.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Operador"
        className={cn(FIELD_CLASS, "max-w-24")}
        value={cond.operador}
        onChange={(e) => setCondicao({ operador: e.target.value as CondicaoOperador })}
      >
        {(["eq", "neq", "in"] as CondicaoOperador[]).map((op) => (
          <option key={op} value={op}>
            {OPERADOR_LABEL[op]}
          </option>
        ))}
      </select>
      {campoInfo?.opcoes ? (
        <select
          aria-label="Valor"
          className={FIELD_CLASS}
          value={String(cond.valor)}
          onChange={(e) => setCondicao({ valor: e.target.value })}
        >
          {campoInfo.opcoes.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <Input
          aria-label="Valor"
          value={String(cond.valor)}
          onChange={(e) => setCondicao({ valor: e.target.value })}
        />
      )}
      {onRemove && (
        <Button variant="ghost" size="sm" aria-label="Remover condição" onClick={onRemove}>
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

// ─── Ação ────────────────────────────────────────────────────────────────────

export function AcaoForm({
  builder,
  index,
  usuarios,
  onChange,
}: {
  builder: BuilderState;
  index: number;
  usuarios: UsuarioRow[];
  onChange: (b: BuilderState) => void;
}) {
  const acao = builder.acoes[index];
  if (!acao) return null;

  const setParametro = (campo: string, valor: string | number) => {
    const next = builder.acoes.map((a, idx) =>
      idx === index
        ? ({ ...a, parametros: { ...a.parametros, [campo]: valor } } as typeof a)
        : a,
    );
    onChange({ ...builder, acoes: next });
  };

  return (
    <>
      {acao.tipo === "criar_tarefa" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            placeholder="Título da tarefa"
            value={acao.parametros.titulo}
            onChange={(e) => setParametro("titulo", e.target.value)}
          />
          <select
            aria-label="Responsável"
            className={FIELD_CLASS}
            value={acao.parametros.responsavel_id}
            onChange={(e) => setParametro("responsavel_id", e.target.value)}
          >
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
          <select
            aria-label="Prioridade"
            className={FIELD_CLASS}
            value={acao.parametros.prioridade}
            onChange={(e) => setParametro("prioridade", e.target.value)}
          >
            <option value="critica">Crítica</option>
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
          </select>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              aria-label="Prazo em dias"
              value={String(acao.parametros.prazo_dias)}
              onChange={(e) => setParametro("prazo_dias", Number(e.target.value))}
            />
            <span className="shrink-0 text-[11px] text-muted-foreground">dias de prazo</span>
          </div>
        </div>
      )}

      {acao.tipo === "criar_notificacao" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            placeholder="Título"
            value={acao.parametros.titulo}
            onChange={(e) => setParametro("titulo", e.target.value)}
          />
          <select
            aria-label="Destinatário"
            className={FIELD_CLASS}
            value={acao.parametros.destinatario}
            onChange={(e) => setParametro("destinatario", e.target.value)}
          >
            <option value="ceo">CEO</option>
            <option value="head_sucesso">Head de Sucesso</option>
            <option value="responsavel">Responsável do registro</option>
          </select>
          <Input
            className="sm:col-span-2"
            placeholder="Mensagem"
            value={acao.parametros.mensagem}
            onChange={(e) => setParametro("mensagem", e.target.value)}
          />
          <select
            aria-label="Severidade"
            className={FIELD_CLASS}
            value={acao.parametros.severidade}
            onChange={(e) => setParametro("severidade", e.target.value)}
          >
            <option value="critica">Crítica</option>
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
          </select>
        </div>
      )}

      {acao.tipo === "enviar_whatsapp" && (
        <div className="space-y-1.5">
          <select
            aria-label="Template"
            className={FIELD_CLASS}
            value={acao.parametros.template}
            onChange={(e) => setParametro("template", e.target.value)}
          >
            {TEMPLATE_OPCOES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">
            A engine reaplica a elegibilidade (QUENTE/MORNO, anti-ban) — FRIO nunca recebe.
          </p>
        </div>
      )}

      {acao.tipo === "enviar_whatsapp_custom" && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor={`whatsapp-custom-${index}`}
              className="text-[11px] font-semibold text-foreground"
            >
              Mensagem (texto livre)
            </label>
            <span
              className={cn(
                "text-[11px] tabular-nums",
                acao.parametros.mensagem.length >= WHATSAPP_CUSTOM_MIN &&
                  acao.parametros.mensagem.length <= WHATSAPP_CUSTOM_MAX
                  ? "text-muted-foreground"
                  : "text-sys-red",
              )}
            >
              {acao.parametros.mensagem.length}/{WHATSAPP_CUSTOM_MAX}
            </span>
          </div>
          <textarea
            id={`whatsapp-custom-${index}`}
            className={cn(FIELD_CLASS, "min-h-28 resize-y leading-relaxed")}
            placeholder="Ex.: Olá {responsavel_nome}, temos novidades sobre o projeto de {atleta_nome}…"
            value={acao.parametros.mensagem}
            onChange={(e) => setParametro("mensagem", e.target.value)}
          />
          <p className="rounded-md bg-secondary/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            Variáveis disponíveis:{" "}
            {WHATSAPP_CUSTOM_VARIAVEIS.map((v) => (
              <code key={v} className="mr-1.5 font-mono text-foreground">
                {v}
              </code>
            ))}
            — substituídas no envio. Formatação WhatsApp: *negrito* e _itálico_.
          </p>
          <p className="text-[11px] text-muted-foreground">
            Enviada ao <strong>responsável</strong> do lead. Só QUENTE/MORNO recebem — FRIO nunca,
            nem mensagem custom (invariante da engine).
          </p>
        </div>
      )}

      {acao.tipo === "enviar_email_custom" && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor={`email-custom-assunto-${index}`}
              className="text-[11px] font-semibold text-foreground"
            >
              Assunto
            </label>
            <span
              className={cn(
                "text-[11px] tabular-nums",
                acao.parametros.assunto.length >= EMAIL_CUSTOM_ASSUNTO_MIN &&
                  acao.parametros.assunto.length <= EMAIL_CUSTOM_ASSUNTO_MAX
                  ? "text-muted-foreground"
                  : "text-sys-red",
              )}
            >
              {acao.parametros.assunto.length}/{EMAIL_CUSTOM_ASSUNTO_MAX}
            </span>
          </div>
          <Input
            id={`email-custom-assunto-${index}`}
            placeholder="Ex.: Novidades sobre o projeto de {atleta_nome}"
            value={acao.parametros.assunto}
            onChange={(e) => setParametro("assunto", e.target.value)}
          />
          <div className="flex items-center justify-between">
            <label
              htmlFor={`email-custom-mensagem-${index}`}
              className="text-[11px] font-semibold text-foreground"
            >
              Mensagem (texto livre)
            </label>
            <span
              className={cn(
                "text-[11px] tabular-nums",
                acao.parametros.mensagem.length >= EMAIL_CUSTOM_MENSAGEM_MIN &&
                  acao.parametros.mensagem.length <= EMAIL_CUSTOM_MENSAGEM_MAX
                  ? "text-muted-foreground"
                  : "text-sys-red",
              )}
            >
              {acao.parametros.mensagem.length}/{EMAIL_CUSTOM_MENSAGEM_MAX}
            </span>
          </div>
          <textarea
            id={`email-custom-mensagem-${index}`}
            className={cn(FIELD_CLASS, "min-h-28 resize-y leading-relaxed")}
            placeholder="Ex.: Olá {responsavel_nome}, temos novidades sobre o projeto de {atleta_nome}…"
            value={acao.parametros.mensagem}
            onChange={(e) => setParametro("mensagem", e.target.value)}
          />
          <p className="rounded-md bg-secondary/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            Variáveis disponíveis:{" "}
            {WHATSAPP_CUSTOM_VARIAVEIS.map((v) => (
              <code key={v} className="mr-1.5 font-mono text-foreground">
                {v}
              </code>
            ))}
            — valem no assunto e na mensagem. O e-mail sai com o layout padrão da Bolsa Atleta
            USA (Resend, com fallback Brevo); quebras de linha viram parágrafos.
          </p>
          <p className="text-[11px] text-muted-foreground">
            Enviado ao <strong>e-mail do responsável</strong> pelo lead. Só QUENTE/MORNO recebem
            — FRIO nunca, nem e-mail custom (invariante da engine).
          </p>
        </div>
      )}

      {acao.tipo === "mover_deal" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            aria-label="Etapa de destino"
            className={FIELD_CLASS}
            value={acao.parametros.etapa_destino}
            onChange={(e) => setParametro("etapa_destino", e.target.value)}
          >
            {ETAPA_OPCOES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              aria-label="Próxima ação em dias"
              value={String(acao.parametros.proxima_acao_dias)}
              onChange={(e) => setParametro("proxima_acao_dias", Number(e.target.value))}
            />
            <span className="shrink-0 text-[11px] text-muted-foreground">dias p/ próxima ação</span>
          </div>
          <Input
            className="sm:col-span-2"
            placeholder="Próxima ação (obrigatória — regra do pipeline)"
            value={acao.parametros.next_action}
            onChange={(e) => setParametro("next_action", e.target.value)}
          />
        </div>
      )}
    </>
  );
}
