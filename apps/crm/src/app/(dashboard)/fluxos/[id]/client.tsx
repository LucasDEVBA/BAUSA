"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Trash2, Sparkles, AlertTriangle, ArrowDown, Flag, MessageSquare,
  HelpCircle, ListChecks, GitBranch, Bot, Clock, Tag, UserPlus, PhoneForwarded, Wrench, Check,
} from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { definirBlocoInicial, excluirBloco, salvarBloco } from "@/lib/actions/fluxos";
import { aplicarSugestao, sugerirFluxo, type BlocoSugerido } from "@/lib/actions/fluxos-ia";
import {
  BLOCO_CATALOG, CAMPO_CAPTURA_LABEL,
  type BlocoConteudo, type CampoCaptura, type Fluxo, type FluxoBloco,
  type FluxoBlocoTipo, type FluxoMetricas,
} from "@/types/fluxo";

// Builder do fluxo: lista vertical de blocos (a ordem de execução segue
// proximo_id, mas o encadeamento linear cobre 90% dos casos e é o que o CEO
// monta na mão). Cada bloco mostra o FUNIL REAL ao lado — quantos chegaram e
// quantos seguiram — para o gargalo ficar visível onde ele acontece.

const ICONES: Record<FluxoBlocoTipo, typeof MessageSquare> = {
  mensagem: MessageSquare,
  pergunta: HelpCircle,
  botoes: ListChecks,
  condicao: GitBranch,
  ia_resposta: Bot,
  ia_condicao: Bot,
  delay: Clock,
  tag: Tag,
  captura: UserPlus,
  handoff: PhoneForwarded,
  acao_crm: Wrench,
  fim: Flag,
};

const TIPOS: FluxoBlocoTipo[] = [
  "mensagem", "pergunta", "botoes", "captura", "condicao",
  "ia_resposta", "ia_condicao", "delay", "tag", "handoff", "acao_crm", "fim",
];

export function BuilderClient({
  fluxo,
  blocosIniciais,
  metricas,
  agents,
}: {
  fluxo: Fluxo;
  blocosIniciais: FluxoBloco[];
  metricas: FluxoMetricas | null;
  agents: Array<{ id: string; nome: string }>;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState<string | null>(null);
  const [adicionando, setAdicionando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const temCaptura = blocosIniciais.some((b) => b.tipo === "captura");
  const metricaDe = (id: string) => metricas?.blocos.find((m) => m.blocoId === id) ?? null;

  const agir = (fn: () => Promise<{ success: boolean; error?: string }>) => {
    setErro(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.success) setErro(r.error ?? "Não foi possível concluir.");
      else {
        setEditando(null);
        setAdicionando(false);
        router.refresh();
      }
    });
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_22rem]">
      <div className="space-y-3">
        {!temCaptura && blocosIniciais.length > 0 ? (
          <p className="flex items-start gap-2 rounded-lg border border-sys-orange/20 bg-sys-orange/10 p-3 text-xs text-sys-orange">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              <strong>Este fluxo não captura contato.</strong> Sem um bloco de captura (e-mail ou telefone) a conversa
              não vira lead no funil — foi exatamente isso que aconteceu no ManyChat antigo: 213 disparos, 0 contatos.
            </span>
          </p>
        ) : null}

        {erro ? (
          <p className="flex items-center gap-1.5 text-xs text-sys-red">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> {erro}
          </p>
        ) : null}

        {blocosIniciais.length === 0 && !adicionando ? (
          <EmptyState
            icon={MessageSquare}
            title="Nenhum bloco ainda"
            description="Comece com uma mensagem de boas-vindas, faça 1–2 perguntas de qualificação e termine capturando o contato."
          />
        ) : null}

        {blocosIniciais.map((b, i) => {
          const Icone = ICONES[b.tipo];
          const info = BLOCO_CATALOG[b.tipo];
          const m = metricaDe(b.id);
          const inicial = fluxo.blocoInicialId === b.id;
          return (
            <div key={b.id}>
              {editando === b.id ? (
                <EditorBloco
                  bloco={b}
                  agents={agents}
                  blocos={blocosIniciais}
                  pending={pending}
                  onCancelar={() => setEditando(null)}
                  onSalvar={(input) => agir(() => salvarBloco(fluxo.id, { ...input, id: b.id, ordem: b.ordem }))}
                />
              ) : (
                <Card className="flex items-start gap-3 p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icone className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-bold text-foreground">{info.label}</span>
                      {inicial ? <Badge tone="brand" size="sm">Entrada</Badge> : null}
                      {b.tipo === "captura" && b.conteudo.campo ? (
                        <Badge tone="green" size="sm">{CAMPO_CAPTURA_LABEL[b.conteudo.campo]}</Badge>
                      ) : null}
                      {m && m.chegaram > 0 ? (
                        <Badge tone={m.taxaAvanco !== null && m.taxaAvanco < 0.5 ? "red" : "neutral"} size="sm">
                          {m.chegaram} chegaram · {m.taxaAvanco !== null ? `${Math.round(m.taxaAvanco * 100)}%` : "—"} seguiram
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                      {b.conteudo.texto || b.conteudo.prompt || info.descricao}
                    </p>
                    {b.ramos.length > 0 ? (
                      <p className="mt-1 text-[10px] text-label-tertiary">
                        Ramos: {b.ramos.map((r) => r.valor).join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="secondary" onClick={() => setEditando(b.id)}>Editar</Button>
                    {!inicial ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={() => agir(() => definirBlocoInicial(fluxo.id, b.id))}
                        title="Tornar este o primeiro bloco"
                      >
                        <Flag className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => {
                        if (confirm("Excluir este bloco?")) agir(() => excluirBloco(fluxo.id, b.id));
                      }}
                      aria-label="Excluir bloco"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </div>
                </Card>
              )}
              {i < blocosIniciais.length - 1 ? (
                <div className="flex justify-center py-1" aria-hidden>
                  <ArrowDown className="h-4 w-4 text-label-tertiary" />
                </div>
              ) : null}
            </div>
          );
        })}

        {adicionando ? (
          <EditorBloco
            agents={agents}
            blocos={blocosIniciais}
            pending={pending}
            onCancelar={() => setAdicionando(false)}
            onSalvar={(input) => agir(() => salvarBloco(fluxo.id, { ...input, ordem: blocosIniciais.length }))}
          />
        ) : (
          <Button variant="secondary" onClick={() => setAdicionando(true)}>
            <Plus className="h-4 w-4" aria-hidden /> Adicionar bloco
          </Button>
        )}
      </div>

      <PainelIA fluxo={fluxo} temBlocos={blocosIniciais.length > 0} />
    </div>
  );
}

// ─── Editor de bloco ─────────────────────────────────────────────────────

interface EditorInput {
  tipo: FluxoBlocoTipo;
  conteudo: BlocoConteudo;
  proximoId: string | null;
  ramos: Array<{ valor: string; blocoId: string | null }>;
}

function EditorBloco({
  bloco,
  agents,
  blocos,
  pending,
  onSalvar,
  onCancelar,
}: {
  bloco?: FluxoBloco;
  agents: Array<{ id: string; nome: string }>;
  blocos: FluxoBloco[];
  pending: boolean;
  onSalvar: (input: EditorInput) => void;
  onCancelar: () => void;
}) {
  const [tipo, setTipo] = useState<FluxoBlocoTipo>(bloco?.tipo ?? "mensagem");
  const [c, setC] = useState<BlocoConteudo>(bloco?.conteudo ?? {});
  const [proximoId, setProximoId] = useState<string | null>(bloco?.proximoId ?? null);

  const set = (patch: Partial<BlocoConteudo>) => setC((v) => ({ ...v, ...patch }));
  const info = BLOCO_CATALOG[tipo];
  const precisaTexto = tipo === "mensagem" || tipo === "pergunta" || tipo === "botoes" || tipo === "captura";
  const ehIA = tipo === "ia_resposta" || tipo === "ia_condicao";

  // Ramos derivam das opções (botoes) ou dos rótulos (ia_condicao).
  const valoresRamo = tipo === "botoes" ? c.opcoes ?? [] : tipo === "ia_condicao" ? c.rotulos ?? [] : [];
  const [ramos, setRamos] = useState<Record<string, string | null>>(
    Object.fromEntries((bloco?.ramos ?? []).map((r) => [r.valor, r.blocoId])),
  );

  const salvar = () => {
    onSalvar({
      tipo,
      conteudo: c,
      proximoId,
      ramos: valoresRamo.map((v) => ({ valor: v, blocoId: ramos[v] ?? null })),
    });
  };

  const outros = blocos.filter((b) => b.id !== bloco?.id);

  return (
    <Card className="space-y-3 border-primary/30 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground">Tipo de bloco</span>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as FluxoBlocoTipo)}
            className="mt-1 w-full rounded-lg border border-border bg-card px-2.5 py-2 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {TIPOS.map((t) => (
              <option key={t} value={t}>{BLOCO_CATALOG[t].label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground">Próximo bloco</span>
          <select
            value={proximoId ?? ""}
            onChange={(e) => setProximoId(e.target.value || null)}
            className="mt-1 w-full rounded-lg border border-border bg-card px-2.5 py-2 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">(encerra aqui)</option>
            {outros.map((b) => (
              <option key={b.id} value={b.id}>
                {BLOCO_CATALOG[b.tipo].label} — {(b.conteudo.texto ?? "").slice(0, 30) || b.id.slice(0, 6)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-[11px] text-muted-foreground">{info.descricao}</p>

      {precisaTexto ? (
        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground">Mensagem</span>
          <textarea
            value={c.texto ?? ""}
            onChange={(e) => set({ texto: e.target.value })}
            rows={3}
            placeholder="Use {nome} para personalizar."
            className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
      ) : null}

      {tipo === "botoes" ? (
        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground">Opções (até 3, separadas por vírgula)</span>
          <Input
            value={(c.opcoes ?? []).join(", ")}
            onChange={(e) => set({ opcoes: e.target.value.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 3) })}
            placeholder="Sim, quero saber, Ainda não"
            className="mt-1"
          />
        </label>
      ) : null}

      {tipo === "captura" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">Campo capturado</span>
            <select
              value={c.campo ?? ""}
              onChange={(e) => set({ campo: (e.target.value || undefined) as CampoCaptura | undefined })}
              className="mt-1 w-full rounded-lg border border-border bg-card px-2.5 py-2 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Escolha…</option>
              {(Object.keys(CAMPO_CAPTURA_LABEL) as CampoCaptura[]).map((k) => (
                <option key={k} value={k}>{CAMPO_CAPTURA_LABEL[k]}</option>
              ))}
            </select>
          </label>
          <label className="flex items-end gap-2 pb-1">
            <input
              type="checkbox"
              checked={c.criarLead === true}
              onChange={(e) => set({ criarLead: e.target.checked })}
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-xs text-muted-foreground">Criar lead no funil ao capturar</span>
          </label>
        </div>
      ) : null}

      {(tipo === "pergunta" || tipo === "captura") ? (
        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground">Guardar em (nome da variável)</span>
          <Input
            value={c.variavel ?? ""}
            onChange={(e) => set({ variavel: e.target.value })}
            placeholder="esporte, email_responsavel…"
            className="mt-1"
          />
        </label>
      ) : null}

      {ehIA ? (
        <>
          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">
              Instrução para a IA <span className="text-sys-red">(obrigatória)</span>
            </span>
            <textarea
              value={c.prompt ?? ""}
              onChange={(e) => set({ prompt: e.target.value })}
              rows={3}
              placeholder="Ex.: responda em 1 frase, cordial, retomando o esporte citado."
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">
              Esta instrução é o fallback: se o agent for apagado ou a IA falhar, o fluxo continua com ela.
            </span>
          </label>
          {agents.length > 0 ? (
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">Agent (opcional)</span>
              <select
                value={c.agentId ?? ""}
                onChange={(e) => set({ agentId: e.target.value || undefined })}
                className="mt-1 w-full rounded-lg border border-border bg-card px-2.5 py-2 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Nenhum (usa a instrução acima)</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.nome}</option>
                ))}
              </select>
            </label>
          ) : null}
          {tipo === "ia_condicao" ? (
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">Rótulos possíveis (viram os ramos)</span>
              <Input
                value={(c.rotulos ?? []).join(", ")}
                onChange={(e) => set({ rotulos: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })}
                placeholder="interessado, curioso, fora de perfil"
                className="mt-1"
              />
            </label>
          ) : null}
          {tipo === "ia_resposta" ? (
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground">Texto de fallback</span>
              <Input value={c.fallback ?? ""} onChange={(e) => set({ fallback: e.target.value })} className="mt-1" />
            </label>
          ) : null}
        </>
      ) : null}

      {tipo === "delay" ? (
        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground">Esperar (minutos)</span>
          <Input
            type="number"
            min={1}
            value={c.minutos ?? 2}
            onChange={(e) => set({ minutos: Number(e.target.value) || 1 })}
            className="mt-1 w-32"
          />
        </label>
      ) : null}

      {tipo === "tag" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">Adicionar tags</span>
            <Input
              value={(c.adicionar ?? []).join(", ")}
              onChange={(e) => set({ adicionar: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })}
              className="mt-1"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">Remover tags</span>
            <Input
              value={(c.remover ?? []).join(", ")}
              onChange={(e) => set({ remover: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })}
              className="mt-1"
            />
          </label>
        </div>
      ) : null}

      {valoresRamo.length > 0 ? (
        <div className="space-y-1.5 rounded-lg border border-border p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-label-tertiary">Para onde cada resposta leva</p>
          {valoresRamo.map((v) => (
            <label key={v} className="flex items-center gap-2">
              <span className="w-32 shrink-0 truncate text-xs text-muted-foreground">{v}</span>
              <select
                value={ramos[v] ?? ""}
                onChange={(e) => setRamos((r) => ({ ...r, [v]: e.target.value || null }))}
                className="flex-1 rounded-lg border border-border bg-card px-2 py-1.5 text-xs text-foreground"
              >
                <option value="">(segue o próximo bloco)</option>
                {outros.map((b) => (
                  <option key={b.id} value={b.id}>
                    {BLOCO_CATALOG[b.tipo].label} — {(b.conteudo.texto ?? "").slice(0, 24) || b.id.slice(0, 6)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button onClick={salvar} disabled={pending}>
          <Check className="h-4 w-4" aria-hidden /> {pending ? "Salvando…" : "Salvar bloco"}
        </Button>
        <Button variant="secondary" onClick={onCancelar} disabled={pending}>Cancelar</Button>
      </div>
    </Card>
  );
}

// ─── Painel de IA ────────────────────────────────────────────────────────

function PainelIA({ fluxo, temBlocos }: { fluxo: Fluxo; temBlocos: boolean }) {
  const router = useRouter();
  const [objetivo, setObjetivo] = useState("");
  const [sugestao, setSugestao] = useState<{ nome: string; blocos: BlocoSugerido[]; avisos: string[] } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const gerar = () => {
    setMsg(null);
    setSugestao(null);
    startTransition(async () => {
      const r = await sugerirFluxo({ objetivo, canal: fluxo.canal, gatilho: fluxo.gatilho });
      if (!r.success || !r.fluxo) setMsg(r.error ?? "Não foi possível gerar.");
      else setSugestao({ nome: r.fluxo.nome, blocos: r.fluxo.blocos, avisos: r.fluxo.avisos });
    });
  };

  const aplicar = () => {
    if (!sugestao) return;
    startTransition(async () => {
      const r = await aplicarSugestao(fluxo.id, sugestao.blocos);
      if (!r.success) setMsg(r.error ?? "Não foi possível aplicar.");
      else {
        setSugestao(null);
        router.refresh();
      }
    });
  };

  return (
    <Card className="h-fit space-y-3 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="text-sm font-bold text-foreground">Montar com IA</h2>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Descreva o objetivo. A IA propõe a conversa inteira usando o seu funil real como referência — você revisa antes
        de aplicar.
      </p>
      <textarea
        value={objetivo}
        onChange={(e) => setObjetivo(e.target.value)}
        rows={3}
        placeholder="Ex.: quem comentar EUA recebe o guia, eu descubro o esporte e a série, e capturo o e-mail do responsável."
        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <Button onClick={gerar} disabled={pending || objetivo.trim().length < 10} className="w-full">
        {pending ? "Pensando…" : "Gerar sugestão"}
      </Button>

      {msg ? <p className="text-xs text-sys-red">{msg}</p> : null}

      {sugestao ? (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-xs font-bold text-foreground">{sugestao.nome}</p>
          {sugestao.avisos.map((a, i) => (
            <p key={i} className="flex items-start gap-1.5 text-[11px] text-sys-orange">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden /> {a}
            </p>
          ))}
          <ol className="space-y-1.5">
            {sugestao.blocos.map((b, i) => (
              <li key={i} className="rounded-lg border border-border p-2">
                <p className="text-[11px] font-semibold text-foreground">
                  {i + 1}. {BLOCO_CATALOG[b.tipo as FluxoBlocoTipo]?.label ?? b.tipo}
                </p>
                {b.texto ? <p className="mt-0.5 text-[11px] text-muted-foreground">{b.texto}</p> : null}
                <p className="mt-0.5 text-[10px] italic text-label-tertiary">{b.porque}</p>
              </li>
            ))}
          </ol>
          <Button onClick={aplicar} disabled={pending} className="w-full">
            {temBlocos ? "Aplicar (adiciona aos blocos atuais)" : "Aplicar sugestão"}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
