"use client";

import { useRef, useTransition } from "react";
import { Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button, Input } from "@/components/ui";
import { uploadAutomacaoImagem } from "@/lib/actions/automacoes-media";
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
  CUSTOM_LINK_TITULO_MAX,
  CUSTOM_LINK_TITULO_MIN,
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
import { MensagemPreview } from "./MensagemPreview";

/**
 * Formulários do builder de automações — MESMOS campos nas duas visões:
 * empilhados na visão Formulário e no painel lateral da visão Fluxo.
 */

/** Campo com rótulo visível — o <label> nativo associa nome acessível ao controle. */
function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1", className)}>
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">
        {label}
      </span>
      {children}
    </label>
  );
}

// ─── Gatilho ─────────────────────────────────────────────────────────────────

export function GatilhoForm({
  builder,
  onChange,
}: {
  builder: BuilderState;
  onChange: (b: BuilderState) => void;
}) {
  const gatilhoInfo = GATILHO_CATALOG[builder.gatilho];
  const gatilhosEvento = Object.entries(GATILHO_CATALOG).filter(([, i]) => i.origem === "evento");
  const gatilhosTempo = Object.entries(GATILHO_CATALOG).filter(([, i]) => i.origem === "tempo");
  const etapaEscolhida = ETAPA_OPCOES.find((o) => o.value === builder.gatilhoEtapaPara);

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Quando isto acontecer">
          <select
            className={FIELD_CLASS}
            value={builder.gatilho}
            onChange={(e) => {
              const gatilho = e.target.value as AutomacaoGatilho;
              onChange({
                ...builder,
                gatilho,
                gatilhoDias: GATILHO_CATALOG[gatilho].configDias?.padrao ?? builder.gatilhoDias,
                gatilhoEtapaPara: "", // filtro de etapa só vale p/ deal_etapa_mudou
                condicoes: [], // catálogo de campos muda com o gatilho
              });
            }}
          >
            <optgroup label="⚡ Evento — dispara na hora">
              {gatilhosEvento.map(([value, info]) => (
                <option key={value} value={value}>
                  {info.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="⏱ Tempo — verificado a cada hora">
              {gatilhosTempo.map(([value, info]) => (
                <option key={value} value={value}>
                  {info.label}
                </option>
              ))}
            </optgroup>
          </select>
        </Field>
        {gatilhoInfo.configDias && (
          <Field label={gatilhoInfo.configDias.label}>
            <Input
              type="number"
              min={0}
              value={String(builder.gatilhoDias)}
              onChange={(e) => onChange({ ...builder, gatilhoDias: Number(e.target.value) })}
            />
          </Field>
        )}
        {gatilhoInfo.configEtapa && (
          <Field label="Etapa de destino">
            <select
              className={FIELD_CLASS}
              value={builder.gatilhoEtapaPara}
              onChange={(e) => onChange({ ...builder, gatilhoEtapaPara: e.target.value })}
            >
              <option value="">Qualquer etapa (todas as transições)</option>
              {ETAPA_OPCOES.map((o) => (
                <option key={o.value} value={o.value}>
                  → {o.label}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
      {gatilhoInfo.configEtapa && (
        <p className="rounded-md bg-secondary/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          {etapaEscolhida ? (
            <>
              Dispara <strong>só quando o deal entrar em {etapaEscolhida.label}</strong> — para
              cobrir outra coluna, crie outra automação com a etapa dela.
            </>
          ) : (
            <>
              Dispara em <strong>qualquer transição</strong> do pipeline. Escolha uma etapa de
              destino para reagir só quando o deal entrar naquela coluna.
            </>
          )}
        </p>
      )}
      {gatilhoInfo.configAgendamento && (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="Frequência">
              <select
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
            </Field>
            <Field label="Hora (BRT, 0-23)">
              <Input
                type="number"
                min={0}
                max={23}
                className="text-center tabular-nums"
                value={String(builder.agHora)}
                onChange={(e) => onChange({ ...builder, agHora: Number(e.target.value) })}
              />
            </Field>
            {builder.agFrequencia === "semanal" && (
              <Field label="Dia da semana">
                <select
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
              </Field>
            )}
            {builder.agFrequencia === "mensal" && (
              <Field label="Dia do mês (1-28)">
                <Input
                  type="number"
                  min={1}
                  max={28}
                  className="text-center tabular-nums"
                  value={String(builder.agDiaMes)}
                  onChange={(e) => onChange({ ...builder, agDiaMes: Number(e.target.value) })}
                />
              </Field>
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
      <span
        aria-hidden
        className="w-5 shrink-0 text-center text-[10px] font-semibold uppercase text-label-tertiary"
      >
        {index === 0 ? "Se" : "e"}
      </span>
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
          <Field label="Título da tarefa" className="sm:col-span-2">
            <Input
              placeholder="Ex.: Ligar para a família"
              value={acao.parametros.titulo}
              onChange={(e) => setParametro("titulo", e.target.value)}
            />
          </Field>
          <Field label="Responsável">
            <select
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
          </Field>
          <Field label="Prioridade">
            <select
              className={FIELD_CLASS}
              value={acao.parametros.prioridade}
              onChange={(e) => setParametro("prioridade", e.target.value)}
            >
              <option value="critica">Crítica</option>
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
          </Field>
          <Field label="Prazo (dias após o disparo)">
            <Input
              type="number"
              min={0}
              value={String(acao.parametros.prazo_dias)}
              onChange={(e) => setParametro("prazo_dias", Number(e.target.value))}
            />
          </Field>
        </div>
      )}

      {acao.tipo === "criar_notificacao" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Título">
            <Input
              placeholder="Ex.: Deal parado em Negociação"
              value={acao.parametros.titulo}
              onChange={(e) => setParametro("titulo", e.target.value)}
            />
          </Field>
          <Field label="Destinatário">
            <select
              className={FIELD_CLASS}
              value={acao.parametros.destinatario}
              onChange={(e) => setParametro("destinatario", e.target.value)}
            >
              <option value="ceo">CEO</option>
              <option value="head_sucesso">Head de Sucesso</option>
              <option value="responsavel">Responsável do registro</option>
            </select>
          </Field>
          <Field label="Mensagem" className="sm:col-span-2">
            <Input
              placeholder="Texto exibido na notificação"
              value={acao.parametros.mensagem}
              onChange={(e) => setParametro("mensagem", e.target.value)}
            />
          </Field>
          <Field label="Severidade">
            <select
              className={FIELD_CLASS}
              value={acao.parametros.severidade}
              onChange={(e) => setParametro("severidade", e.target.value)}
            >
              <option value="critica">Crítica</option>
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
          </Field>
        </div>
      )}

      {acao.tipo === "enviar_whatsapp" && (
        <div className="space-y-1.5">
          <Field label="Template aprovado">
            <select
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
          </Field>
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

          {/* Link + imagem (opcionais) — como na tela de remarketing */}
          <p className="pt-1 text-[11px] font-semibold text-foreground">
            Link e imagem (opcional)
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              type="url"
              aria-label="URL do link (opcional)"
              placeholder="URL do link (https://…)"
              value={acao.parametros.link_url ?? ""}
              onChange={(e) => setParametro("link_url", e.target.value)}
            />
            <Input
              aria-label="Título do card do link"
              placeholder={`Título do card (${CUSTOM_LINK_TITULO_MIN}-${CUSTOM_LINK_TITULO_MAX})`}
              maxLength={CUSTOM_LINK_TITULO_MAX}
              value={acao.parametros.link_titulo ?? ""}
              onChange={(e) => setParametro("link_titulo", e.target.value)}
            />
          </div>
          <ImagemUploadField
            label="Imagem do card (opcional — exige o link)"
            url={acao.parametros.imagem_url ?? ""}
            onChange={(url) => setParametro("imagem_url", url)}
          />
          <p className="text-[11px] text-muted-foreground">
            Com link, a mensagem sai como <strong>card clicável</strong> (como no remarketing) e a
            URL é anexada ao final quando não está no texto. Sem link, sai como texto simples.
          </p>

          <MensagemPreview
            canal="whatsapp"
            mensagem={acao.parametros.mensagem}
            imagemUrl={acao.parametros.imagem_url}
            linkUrl={acao.parametros.link_url}
            linkTitulo={acao.parametros.link_titulo}
            className="pt-1"
          />
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

          {/* Imagem + botão/CTA (opcionais) — como na tela de remarketing */}
          <p className="pt-1 text-[11px] font-semibold text-foreground">
            Imagem e botão (opcional)
          </p>
          <ImagemUploadField
            label="Imagem do e-mail (topo do corpo)"
            url={acao.parametros.imagem_url ?? ""}
            onChange={(url) => setParametro("imagem_url", url)}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              type="url"
              aria-label="URL do botão (opcional)"
              placeholder="URL do botão (https://…)"
              value={acao.parametros.link_url ?? ""}
              onChange={(e) => setParametro("link_url", e.target.value)}
            />
            <Input
              aria-label="Texto do botão"
              placeholder={`Texto do botão (${CUSTOM_LINK_TITULO_MIN}-${CUSTOM_LINK_TITULO_MAX})`}
              maxLength={CUSTOM_LINK_TITULO_MAX}
              value={acao.parametros.link_titulo ?? ""}
              onChange={(e) => setParametro("link_titulo", e.target.value)}
            />
          </div>

          <MensagemPreview
            canal="email"
            assunto={acao.parametros.assunto}
            mensagem={acao.parametros.mensagem}
            imagemUrl={acao.parametros.imagem_url}
            linkUrl={acao.parametros.link_url}
            linkTitulo={acao.parametros.link_titulo}
            className="pt-1"
          />
        </div>
      )}

      {acao.tipo === "mover_deal" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Mover para a etapa">
            <select
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
          </Field>
          <Field label="Próxima ação em (dias)">
            <Input
              type="number"
              min={0}
              value={String(acao.parametros.proxima_acao_dias)}
              onChange={(e) => setParametro("proxima_acao_dias", Number(e.target.value))}
            />
          </Field>
          <Field label="Próxima ação (obrigatória — regra do pipeline)" className="sm:col-span-2">
            <Input
              placeholder="Ex.: Enviar proposta revisada"
              value={acao.parametros.next_action}
              onChange={(e) => setParametro("next_action", e.target.value)}
            />
          </Field>
        </div>
      )}
    </>
  );
}

// ─── Upload de imagem das ações custom ───────────────────────────────────────
// Mesmo padrão da tela de remarketing (MediaImageField): botão de upload +
// colar URL + thumbnail com remover. Action CEO-only uploadAutomacaoImagem
// (bucket público remarketing-media, path automacoes/ — URL estável).

function ImagemUploadField({
  label,
  url,
  onChange,
}: {
  label: string;
  url: string;
  onChange: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, startUpload] = useTransition();

  const handleFile = (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    startUpload(async () => {
      const r = await uploadAutomacaoImagem(fd);
      if (r.success) {
        onChange(r.url);
        toast.success("Imagem enviada");
      } else {
        toast.error(r.error);
      }
    });
  };

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      {url.trim() && (
        <div className="relative overflow-hidden rounded-lg border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Pré-visualização da imagem" className="max-h-28 w-full object-cover" />
          <button
            type="button"
            aria-label="Remover imagem"
            onClick={() => onChange("")}
            className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white transition hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" />
          {uploading ? "Enviando…" : "Enviar"}
        </Button>
        <Input
          type="url"
          aria-label={`${label} — URL da imagem`}
          placeholder="ou cole uma URL https://…"
          value={url}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}
