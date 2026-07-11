"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronDown,
  Gift,
  Handshake,
  Loader2,
  Plus,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  BrandTabs,
  Button,
  Card,
  EmptyState,
  PageHeader,
  ScrollList,
  StatCard,
} from "@/components/ui";
import {
  atualizarStatusIndicacao,
  criarIndicacao,
  marcarRecompensaEntregue,
  type IndicacaoStatus,
} from "@/lib/actions/indicacoes";
import { cn } from "@/lib/utils";

interface IndicadorData {
  id: string;
  nome: string;
  email: string;
}

interface AtletaData {
  id: string;
  nome_completo: string;
  esporte: string;
}

interface IndicacaoRow {
  id: string;
  status: IndicacaoStatus;
  recompensa_devida: boolean;
  recompensa_entregue: boolean;
  recompensa_entregue_at: string | null;
  recompensa_descricao: string | null;
  observacao: string | null;
  indicador_experiencia_id: string | null;
  indicador_nome: string | null;
  indicado_nome: string | null;
  indicado_whatsapp: string | null;
  created_at: string;
  indicador: IndicadorData | null;
  atleta: AtletaData | null;
}

interface FamiliaOption {
  id: string;
  atletaNome: string;
}

const STATUS_OPTIONS = [
  { value: "todas", label: "Todas" },
  { value: "pendente", label: "Pendente" },
  { value: "em_negociacao", label: "Em negociacao" },
  { value: "convertido", label: "Convertido" },
  { value: "perdido", label: "Perdido" },
] as const;

const STATUS_CONFIG: Record<IndicacaoStatus, { bg: string; text: string; label: string }> = {
  pendente: { bg: "bg-secondary", text: "text-muted-foreground", label: "Pendente" },
  em_negociacao: { bg: "bg-sys-orange/15", text: "text-sys-orange", label: "Em negociacao" },
  convertido: { bg: "bg-sys-green/15", text: "text-sys-green", label: "Convertido" },
  perdido: { bg: "bg-sys-red/15", text: "text-sys-red", label: "Perdido" },
};

/** Espelho client-side das transições — o servidor valida com autoridade. */
const TRANSICOES: Record<IndicacaoStatus, IndicacaoStatus[]> = {
  pendente: ["em_negociacao", "convertido", "perdido"],
  em_negociacao: ["convertido", "perdido"],
  convertido: [],
  perdido: [],
};

interface TopIndicador {
  id: string;
  nome: string;
  total: number;
  convertidos: number;
  taxa: number;
}

interface OrigemChannel {
  canal: string;
  label: string;
  count: number;
  pct: number;
}

interface IndicacoesClientProps {
  indicacoesIniciais: IndicacaoRow[];
  topIndicadores: TopIndicador[];
  origemLeads: OrigemChannel[];
  familias: FamiliaOption[];
  podeGerenciar: boolean;
}

function nomeIndicador(ind: IndicacaoRow): string {
  return ind.indicador?.nome ?? ind.indicador_nome ?? "—";
}

function nomeIndicado(ind: IndicacaoRow): string {
  return ind.atleta?.nome_completo ?? ind.indicado_nome ?? "—";
}

export function IndicacoesClient({
  indicacoesIniciais,
  topIndicadores,
  origemLeads,
  familias,
  podeGerenciar,
}: IndicacoesClientProps) {
  const router = useRouter();
  const [indicacoes, setIndicacoes] = useState<IndicacaoRow[]>(indicacoesIniciais);
  const [statusFiltro, setStatusFiltro] = useState("todas");
  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null);
  const [modalNovaAberto, setModalNovaAberto] = useState(false);
  const [isPending, startTransition] = useTransition();

  // KPIs derivados do estado local — refletem criações/transições sem reload.
  const kpis = useMemo(() => {
    const total = indicacoes.length;
    const emNegociacao = indicacoes.filter((i) => i.status === "em_negociacao").length;
    const convertidos = indicacoes.filter((i) => i.status === "convertido").length;
    const taxaConversao = total > 0 ? Math.round((convertidos / total) * 100) : 0;
    const recompensasPendentes = indicacoes.filter(
      (i) => i.recompensa_devida && !i.recompensa_entregue,
    ).length;
    return { total, emNegociacao, convertidos, taxaConversao, recompensasPendentes };
  }, [indicacoes]);

  const handleEntregarRecompensa = (indicacaoId: string) => {
    const descricao = prompt("Descreva a recompensa entregue:");
    if (!descricao) return;

    startTransition(async () => {
      const result = await marcarRecompensaEntregue(indicacaoId, descricao);
      if (result.success) {
        setIndicacoes((prev) =>
          prev.map((ind) =>
            ind.id === indicacaoId
              ? {
                  ...ind,
                  recompensa_entregue: true,
                  recompensa_entregue_at: new Date().toISOString(),
                  recompensa_descricao: descricao,
                }
              : ind,
          ),
        );
        toast.success("Recompensa marcada como entregue");
      } else {
        toast.error(result.error ?? "Erro ao marcar recompensa");
      }
    });
  };

  const handleMudarStatus = (ind: IndicacaoRow, novoStatus: IndicacaoStatus) => {
    setMenuAbertoId(null);
    const extra =
      novoStatus === "convertido"
        ? "\n\nIsso marca a recompensa como devida e incrementa o contador de indicações da família indicadora."
        : "";
    const confirmado = window.confirm(
      `Mudar o status da indicação de ${nomeIndicado(ind)} para "${STATUS_CONFIG[novoStatus].label}"?${extra}`,
    );
    if (!confirmado) return;

    startTransition(async () => {
      const result = await atualizarStatusIndicacao(ind.id, novoStatus);
      if (result.success) {
        setIndicacoes((prev) =>
          prev.map((i) =>
            i.id === ind.id
              ? {
                  ...i,
                  status: novoStatus,
                  recompensa_devida:
                    novoStatus === "convertido" ? true : i.recompensa_devida,
                }
              : i,
          ),
        );
        toast.success(`Status atualizado para ${STATUS_CONFIG[novoStatus].label}`);
        if (result.warning) toast.warning(result.warning);
        router.refresh();
      } else {
        toast.error(result.error ?? "Erro ao atualizar status");
      }
    });
  };

  const filtradas = statusFiltro === "todas"
    ? indicacoes
    : indicacoes.filter((i) => i.status === statusFiltro);

  return (
    <div className="flex h-full flex-col gap-5">
      <PageHeader
        eyebrow="Comercial"
        title="Indicações"
        description="Programa de indicações e recompensas"
        actions={
          podeGerenciar ? (
            <Button onClick={() => setModalNovaAberto(true)}>
              <Plus className="h-4 w-4" />
              Nova indicação
            </Button>
          ) : undefined
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total indicações" value={kpis.total} icon={Users} accent="brand" />
        <StatCard
          label="Em negociação"
          value={kpis.emNegociacao}
          icon={Handshake}
          accent="blue"
        />
        <StatCard
          label="Convertidas"
          value={kpis.convertidos}
          context={`${kpis.taxaConversao}% de conversão`}
          icon={TrendingUp}
          accent="green"
        />
        <StatCard
          label="Recompensas pendentes"
          value={kpis.recompensasPendentes}
          icon={Gift}
          accent="orange"
        />
      </div>

      {/* Filter tabs */}
      <BrandTabs
        items={STATUS_OPTIONS.map((opt) => ({ id: opt.value, label: opt.label }))}
        activeId={statusFiltro}
        onSelect={setStatusFiltro}
        variant="segmented"
        ariaLabel="Filtrar indicações por status"
      />

      {/* Table */}
      <Card padding="none" className="flex-1 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Quem indicou
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Indicado
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Recompensa
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Data
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Acao
              </th>
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10">
                  <EmptyState
                    icon={Users}
                    title="Nenhuma indicação encontrada"
                    description={
                      podeGerenciar
                        ? "Registre a primeira indicação com o botão \"Nova indicação\"."
                        : "Ajuste o filtro de status ou aguarde novas indicações."
                    }
                  />
                </td>
              </tr>
            ) : (
              filtradas.map((ind) => {
                const cfg = STATUS_CONFIG[ind.status] ?? STATUS_CONFIG.pendente;
                const proximos = TRANSICOES[ind.status] ?? [];
                const podeTransicionar = podeGerenciar && proximos.length > 0;
                return (
                  <tr key={ind.id} className="border-b border-border last:border-0 hover:bg-accent">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{nomeIndicador(ind)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {ind.indicador?.email ?? (ind.indicador_experiencia_id ? "Família cliente" : "")}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{nomeIndicado(ind)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {ind.atleta?.esporte ?? ind.indicado_whatsapp ?? ""}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative inline-block">
                        {podeTransicionar ? (
                          <button
                            type="button"
                            onClick={() =>
                              setMenuAbertoId(menuAbertoId === ind.id ? null : ind.id)
                            }
                            disabled={isPending}
                            aria-haspopup="menu"
                            aria-expanded={menuAbertoId === ind.id}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-opacity hover:opacity-80 disabled:opacity-50",
                              cfg.bg,
                              cfg.text,
                            )}
                          >
                            {cfg.label}
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        ) : (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              cfg.bg,
                              cfg.text,
                            )}
                          >
                            {cfg.label}
                          </span>
                        )}
                        {menuAbertoId === ind.id && (
                          <>
                            <button
                              type="button"
                              aria-label="Fechar menu de status"
                              className="fixed inset-0 z-40 cursor-default"
                              onClick={() => setMenuAbertoId(null)}
                            />
                            <div
                              role="menu"
                              className="absolute left-0 top-full z-50 mt-1 w-44 rounded-lg border border-border bg-popover p-1 shadow-xl"
                            >
                              {proximos.map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  role="menuitem"
                                  onClick={() => handleMudarStatus(ind, s)}
                                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-foreground hover:bg-accent"
                                >
                                  <span
                                    className={cn(
                                      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                                      STATUS_CONFIG[s].bg,
                                      STATUS_CONFIG[s].text,
                                    )}
                                  >
                                    {STATUS_CONFIG[s].label}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {ind.recompensa_devida ? (
                        ind.recompensa_entregue ? (
                          <span className="flex items-center gap-1 text-xs text-sys-green">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Entregue
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-sys-orange">Pendente</span>
                        )
                      ) : (
                        <span className="text-xs text-label-tertiary">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(ind.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      {podeGerenciar && ind.recompensa_devida && !ind.recompensa_entregue && (
                        <button
                          onClick={() => handleEntregarRecompensa(ind.id)}
                          disabled={isPending}
                          className="rounded-md bg-sys-green/15 px-2.5 py-1 text-[11px] font-semibold text-sys-green transition-colors hover:bg-sys-green/25 disabled:opacity-50"
                        >
                          Entregar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>

      {/* Top Indicadores */}
      {topIndicadores.length > 0 && (
        <Card padding="sm" className="flex h-[18rem] flex-col">
          <div className="flex items-center gap-2 mb-4 shrink-0">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Top Indicadores</h3>
          </div>
          <ScrollList className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nome</th>
                  <th className="py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total</th>
                  <th className="py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Convertidos</th>
                  <th className="py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Taxa</th>
                </tr>
              </thead>
              <tbody>
                {topIndicadores.map((topInd, i) => (
                  <tr key={topInd.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                          {i + 1}
                        </span>
                        <span className="font-medium text-foreground">{topInd.nome}</span>
                      </div>
                    </td>
                    <td className="py-2 text-right text-muted-foreground">{topInd.total}</td>
                    <td className="py-2 text-right text-sys-green">{topInd.convertidos}</td>
                    <td className="py-2 text-right text-primary">{topInd.taxa}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollList>
        </Card>
      )}

      {/* Origem dos Leads (CAC proxy) */}
      {origemLeads.length > 0 && (
        <Card padding="sm" className="flex h-[18rem] flex-col">
          <div className="flex items-center gap-2 mb-4 shrink-0">
            <TrendingUp className="h-4 w-4 text-sys-green" />
            <h3 className="text-sm font-semibold text-foreground">Origem dos Leads</h3>
          </div>
          <ScrollList className="space-y-2">
            {origemLeads.map((ch) => (
              <div key={ch.canal} className="flex items-center gap-3">
                <span className="w-32 text-sm text-foreground">{ch.label}</span>
                <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, ch.pct)}%` }}
                  />
                </div>
                <span className="w-10 text-right text-xs font-semibold text-muted-foreground">{ch.count}</span>
                <span className="w-12 text-right text-xs text-muted-foreground">{ch.pct}%</span>
              </div>
            ))}
          </ScrollList>
        </Card>
      )}

      {modalNovaAberto && (
        <NovaIndicacaoModal
          familias={familias}
          onClose={() => setModalNovaAberto(false)}
          onCriada={(nova) => {
            setIndicacoes((prev) => [nova, ...prev]);
            setModalNovaAberto(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ─── Modal de nova indicação (CEO) ───────────────────────────────────────
interface NovaIndicacaoModalProps {
  familias: FamiliaOption[];
  onClose: () => void;
  onCriada: (nova: IndicacaoRow) => void;
}

function NovaIndicacaoModal({ familias, onClose, onCriada }: NovaIndicacaoModalProps) {
  const [familiaId, setFamiliaId] = useState("");
  const [indicadorNome, setIndicadorNome] = useState("");
  const [indicadoNome, setIndicadoNome] = useState("");
  const [indicadoWhatsapp, setIndicadoWhatsapp] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, startSalvar] = useTransition();

  const semVinculo = familiaId === "";

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!indicadoNome.trim()) {
      toast.error("Informe o nome do indicado");
      return;
    }
    if (semVinculo && !indicadorNome.trim()) {
      toast.error("Selecione a família indicadora ou informe quem indicou");
      return;
    }

    startSalvar(async () => {
      const result = await criarIndicacao({
        indicador_experiencia_id: familiaId || null,
        indicador_nome: semVinculo ? indicadorNome.trim() : null,
        indicado_nome: indicadoNome.trim(),
        indicado_whatsapp: indicadoWhatsapp.trim() || null,
        observacao: observacao.trim() || null,
      });

      if (!result.success || !result.id) {
        toast.error(result.error ?? "Erro ao criar indicação");
        return;
      }

      toast.success("Indicação registrada");
      onCriada({
        id: result.id,
        status: "pendente",
        recompensa_devida: false,
        recompensa_entregue: false,
        recompensa_entregue_at: null,
        recompensa_descricao: null,
        observacao: observacao.trim() || null,
        indicador_experiencia_id: familiaId || null,
        indicador_nome:
          result.indicadorNome ?? (indicadorNome.trim() || null),
        indicado_nome: indicadoNome.trim(),
        indicado_whatsapp: indicadoWhatsapp.trim() || null,
        created_at: new Date().toISOString(),
        indicador: null,
        atleta: null,
      });
    });
  };

  const inputClass =
    "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none placeholder:text-label-tertiary focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 backdrop-blur-md"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="nova-indicacao-titulo"
        className="w-full max-w-md rounded-2xl liquid-glass"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
              <Gift className="h-4 w-4 text-primary" />
            </div>
            <p id="nova-indicacao-titulo" className="text-sm font-bold text-foreground">
              Nova indicação
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-fill-4 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 p-5">
          <div>
            <label htmlFor="familia-indicadora" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Família indicadora
            </label>
            <select
              id="familia-indicadora"
              value={familiaId}
              onChange={(e) => setFamiliaId(e.target.value)}
              className={inputClass}
            >
              <option value="">Sem vínculo (informar nome abaixo)</option>
              {familias.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.atletaNome}
                </option>
              ))}
            </select>
          </div>

          {semVinculo && (
            <div>
              <label htmlFor="indicador-nome" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Quem indicou *
              </label>
              <input
                id="indicador-nome"
                type="text"
                value={indicadorNome}
                onChange={(e) => setIndicadorNome(e.target.value)}
                maxLength={160}
                placeholder="Nome de quem indicou"
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label htmlFor="indicado-nome" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Nome do indicado *
            </label>
            <input
              id="indicado-nome"
              type="text"
              value={indicadoNome}
              onChange={(e) => setIndicadoNome(e.target.value)}
              maxLength={160}
              required
              placeholder="Atleta/família indicada"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="indicado-whatsapp" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              WhatsApp do indicado
            </label>
            <input
              id="indicado-whatsapp"
              type="tel"
              value={indicadoWhatsapp}
              onChange={(e) => setIndicadoWhatsapp(e.target.value)}
              maxLength={30}
              placeholder="+55 (71) 99999-9999"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="indicacao-observacao" className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Observação
            </label>
            <textarea
              id="indicacao-observacao"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Contexto da indicação (opcional)"
              className={cn(inputClass, "resize-none")}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={salvando}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {salvando ? "Salvando..." : "Registrar indicação"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
