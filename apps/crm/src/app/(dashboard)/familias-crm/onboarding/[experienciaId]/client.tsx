"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  CheckSquare,
  Clock,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  MessageCircle,
  Paperclip,
  Play,
  Plus,
  SkipForward,
  Square,
  Trash2,
  Video,
  X,
} from "lucide-react";
import {
  adicionarAnexoEtapa,
  adicionarItemChecklist,
  adicionarLinkEtapa,
  getOnboardingByExperiencia,
  marcarEtapaConcluida,
  marcarEtapaEmAndamento,
  pularEtapa,
  removerAnexoEtapa,
  removerItemChecklist,
  removerLinkEtapa,
  toggleChecklistItem,
  type OnboardingEtapaEstado,
  type OnboardingInstancia,
} from "@/lib/actions/onboarding";
import {
  criarReuniao,
  listarReunioesFamilia,
  type ReuniaoFamilia,
} from "@/lib/actions/reunioes";
import { getFileSignedUrl, uploadFile } from "@/lib/actions/uploads";
import { registrarContato } from "@/lib/actions/experiencia";
import {
  Badge,
  BrandTabs,
  Button,
  Card,
  PageHeader,
  useConfirm,
  type BrandTab,
} from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";
import { toast } from "sonner";

// ─── Tipos ───────────────────────────────────────────────────

interface FamiliaResumo {
  atletaNome: string;
  responsavelNome: string | null;
  responsavelEmail: string | null;
  responsavelWhatsapp: string | null;
}

interface OnboardingExecucaoClientProps {
  experienciaId: string;
  instanciaInicial: OnboardingInstancia;
  etapasIniciais: OnboardingEtapaEstado[];
  reunioesIniciais: ReuniaoFamilia[];
  familia: FamiliaResumo;
}

// ─── Helpers ─────────────────────────────────────────────────

const MIN_OBSERVACAO = 10;
const MAX_LABEL_ABA = 26;

function etapaAberta(e: OnboardingEtapaEstado) {
  return e.status === "pendente" || e.status === "em_andamento";
}

function etapaAtrasada(e: OnboardingEtapaEstado) {
  return etapaAberta(e) && new Date(e.prazo) < new Date();
}

function truncarLabel(titulo: string) {
  return titulo.length > MAX_LABEL_ABA
    ? `${titulo.slice(0, MAX_LABEL_ABA - 1).trimEnd()}…`
    : titulo;
}

function indicadorEtapa(e: OnboardingEtapaEstado): React.ReactNode {
  if (e.status === "concluida") {
    return <CheckCircle2 aria-hidden className="h-3.5 w-3.5 text-sys-green" />;
  }
  if (e.status === "pulada") {
    return <SkipForward aria-hidden className="h-3.5 w-3.5 text-label-tertiary" />;
  }
  if (etapaAtrasada(e)) {
    return <AlertTriangle aria-hidden className="h-3.5 w-3.5 text-sys-red" />;
  }
  if (e.status === "em_andamento") {
    return <span aria-hidden className="h-2 w-2 rounded-full bg-sys-blue" />;
  }
  // pendente: o número no rótulo é o indicador neutro
  return null;
}

function formatBytes(bytes: number) {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Tela ────────────────────────────────────────────────────

export function OnboardingExecucaoClient({
  experienciaId,
  instanciaInicial,
  etapasIniciais,
  reunioesIniciais,
  familia,
}: OnboardingExecucaoClientProps) {
  const router = useRouter();
  const [instancia, setInstancia] = useState(instanciaInicial);
  const [etapas, setEtapas] = useState(etapasIniciais);
  const [reunioes, setReunioes] = useState(reunioesIniciais);
  const [activeId, setActiveId] = useState<string>(() => {
    const aberta = etapasIniciais.find(etapaAberta);
    return aberta?.id ?? etapasIniciais[0]?.id ?? "";
  });
  const [, startReload] = useTransition();

  const reload = () => {
    startReload(async () => {
      try {
        const [data, reunioesData] = await Promise.all([
          getOnboardingByExperiencia(experienciaId),
          listarReunioesFamilia(experienciaId),
        ]);
        if (data.instancia) setInstancia(data.instancia);
        setEtapas(data.etapas);
        setReunioes(reunioesData);
      } catch {
        toast.error("Falha ao recarregar o onboarding");
      }
    });
    router.refresh();
  };

  const patchEtapa = (id: string, patch: Partial<OnboardingEtapaEstado>) => {
    setEtapas((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const total = etapas.length;
  const finalizadas = etapas.filter((e) => !etapaAberta(e)).length;
  const percent = total === 0 ? 0 : Math.round((finalizadas / total) * 100);

  const tabs: BrandTab[] = etapas.map((e) => ({
    id: e.id,
    label: `${e.ordem}. ${truncarLabel(e.titulo)}`,
    indicator: indicadorEtapa(e),
  }));

  const ativa = etapas.find((e) => e.id === activeId) ?? etapas[0];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Famílias · Onboarding"
        title={familia.atletaNome}
        description={`Responsável: ${familia.responsavelNome ?? "—"} · Iniciado em ${formatDate(instancia.iniciado_at)}`}
        actions={
          <div className="w-44">
            <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>
                Progresso
                {instancia.status === "concluido" && (
                  <span className="ml-1.5 font-semibold text-sys-green">✓ Concluído</span>
                )}
              </span>
              <span className="font-semibold tabular-nums text-foreground">
                {finalizadas}/{total}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Progresso do onboarding"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-1.5 overflow-hidden rounded-full bg-fill-4"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  percent === 100 ? "bg-sys-green" : "bg-primary",
                )}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        }
      />

      <BrandTabs
        variant="underline"
        items={tabs}
        activeId={ativa?.id ?? ""}
        onSelect={setActiveId}
        ariaLabel="Etapas do onboarding"
      />

      {ativa ? (
        <EtapaPanel
          key={ativa.id}
          etapa={ativa}
          experienciaId={experienciaId}
          reunioes={reunioes.filter((r) => r.etapa_estado_id === ativa.id)}
          familia={familia}
          onPatch={patchEtapa}
          onReload={reload}
        />
      ) : (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Sem etapas nesta instância de onboarding.
        </p>
      )}
    </div>
  );
}

// ─── Painel da etapa ativa ───────────────────────────────────

function EtapaPanel({
  etapa,
  experienciaId,
  reunioes,
  familia,
  onPatch,
  onReload,
}: {
  etapa: OnboardingEtapaEstado;
  experienciaId: string;
  reunioes: ReuniaoFamilia[];
  familia: FamiliaResumo;
  onPatch: (id: string, patch: Partial<OnboardingEtapaEstado>) => void;
  onReload: () => void;
}) {
  const aberta = etapaAberta(etapa);

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      {/* Coluna principal */}
      <div className="min-w-0 space-y-4">
        <EtapaHeaderCard etapa={etapa} />
        <ChecklistCard etapa={etapa} aberta={aberta} onPatch={onPatch} />
        <InformacoesCard
          etapa={etapa}
          aberta={aberta}
          reunioesVinculadas={reunioes}
          onReload={onReload}
        />
      </div>

      {/* Coluna lateral */}
      <div className="space-y-4">
        <ReunioesEtapaCard
          etapa={etapa}
          aberta={aberta}
          experienciaId={experienciaId}
          reunioes={reunioes}
          familia={familia}
          onReload={onReload}
        />
        <LinksEtapaCard etapa={etapa} aberta={aberta} onPatch={onPatch} />
        <AnexosEtapaCard etapa={etapa} aberta={aberta} onPatch={onPatch} />
        <ContatoCard experienciaId={experienciaId} familia={familia} onReload={onReload} />
      </div>
    </div>
  );
}

// ─── Cabeçalho da etapa (o que fazer) ────────────────────────

function EtapaHeaderCard({ etapa }: { etapa: OnboardingEtapaEstado }) {
  const atrasada = etapaAtrasada(etapa);

  return (
    <Card variant="plain" padding="lg">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-foreground">
          Etapa {etapa.ordem} — {etapa.titulo}
        </h2>
        {etapa.status === "concluida" && <Badge tone="green" size="sm">Concluída</Badge>}
        {etapa.status === "pulada" && <Badge tone="neutral" size="sm">Pulada</Badge>}
        {etapa.status === "em_andamento" && <Badge tone="blue" size="sm">Em andamento</Badge>}
        {etapa.status === "pendente" && <Badge tone="neutral" size="sm">Pendente</Badge>}
        {atrasada && <Badge tone="red" size="sm">Atrasada</Badge>}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock aria-hidden className="h-3 w-3" />
          Prazo: {formatDate(etapa.prazo)}
        </span>
        {etapa.requer_reuniao && <Badge tone="blue" size="sm">Exige reunião</Badge>}
        {etapa.requer_documentos && <Badge tone="purple" size="sm">Documentos</Badge>}
        {etapa.concluida_at && <span>Finalizada em {formatDate(etapa.concluida_at)}</span>}
      </div>

      {etapa.descricao && (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {etapa.descricao}
        </p>
      )}
    </Card>
  );
}

// ─── Checklist interativo (Head define os itens) ─────────────

function ChecklistCard({
  etapa,
  aberta,
  onPatch,
}: {
  etapa: OnboardingEtapaEstado;
  aberta: boolean;
  onPatch: (id: string, patch: Partial<OnboardingEtapaEstado>) => void;
}) {
  const [novoItem, setNovoItem] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const feitos = etapa.checklist_estado.filter((c) => c.concluido).length;

  const handleToggle = (index: number) => {
    const atual = etapa.checklist_estado[index];
    if (!atual) return;
    const key = `toggle:${index}`;
    setBusyKey(key);
    // Otimista — o estado autoritativo volta do server
    onPatch(etapa.id, {
      checklist_estado: etapa.checklist_estado.map((c, i) =>
        i === index ? { ...c, concluido: !atual.concluido } : c,
      ),
    });
    startTransition(async () => {
      try {
        const result = await toggleChecklistItem(etapa.id, index, !atual.concluido);
        if (result.success) {
          onPatch(etapa.id, { checklist_estado: result.checklist });
        } else {
          toast.error(result.error);
          onPatch(etapa.id, { checklist_estado: etapa.checklist_estado });
        }
      } catch {
        toast.error("Falha de conexão ao atualizar o item");
        onPatch(etapa.id, { checklist_estado: etapa.checklist_estado });
      } finally {
        setBusyKey(null);
      }
    });
  };

  const handleAdd = () => {
    const item = novoItem.trim();
    if (!item) return;
    setBusyKey("add");
    startTransition(async () => {
      try {
        const result = await adicionarItemChecklist(etapa.id, item);
        if (result.success) {
          onPatch(etapa.id, { checklist_estado: result.checklist });
          setNovoItem("");
          toast.success("Item adicionado ao checklist");
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error("Falha de conexão ao adicionar o item");
      } finally {
        setBusyKey(null);
      }
    });
  };

  const handleRemove = (index: number) => {
    const key = `remove:${index}`;
    setBusyKey(key);
    startTransition(async () => {
      try {
        const result = await removerItemChecklist(etapa.id, index);
        if (result.success) {
          onPatch(etapa.id, { checklist_estado: result.checklist });
          toast.success("Item removido");
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error("Falha de conexão ao remover o item");
      } finally {
        setBusyKey(null);
      }
    });
  };

  return (
    <Card variant="plain" padding="lg">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Checklist da etapa
        </p>
        <span className="text-[10px] font-bold tabular-nums text-muted-foreground">
          {feitos}/{etapa.checklist_estado.length}
        </span>
      </div>

      {etapa.checklist_estado.length === 0 ? (
        <p className="py-2 text-xs text-muted-foreground">
          Sem itens no checklist desta etapa.
        </p>
      ) : (
        <ul className="space-y-1">
          {etapa.checklist_estado.map((item, idx) => {
            const CheckIcon = item.concluido ? CheckSquare : Square;
            return (
              <li key={idx} className="group flex items-start gap-1">
                <button
                  type="button"
                  disabled={!aberta || isPending}
                  onClick={() => handleToggle(idx)}
                  className={cn(
                    "flex min-w-0 flex-1 items-start gap-2 rounded-md px-1.5 py-1 text-left text-xs transition-colors",
                    aberta ? "hover:bg-accent" : "cursor-default",
                    item.concluido ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  <CheckIcon
                    aria-hidden
                    className={cn(
                      "mt-px h-3.5 w-3.5 shrink-0",
                      item.concluido ? "text-sys-green" : "text-muted-foreground",
                    )}
                  />
                  <span className={cn(item.concluido && "line-through opacity-70")}>
                    {item.item}
                  </span>
                </button>
                {aberta && !item.concluido && (
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    disabled={busyKey === `remove:${idx}`}
                    aria-label={`Remover item "${item.item}"`}
                    className="mt-0.5 rounded p-1 text-label-tertiary opacity-0 transition-opacity hover:bg-accent hover:text-sys-red focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-40"
                  >
                    {busyKey === `remove:${idx}` ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {aberta && (
        <div className="mt-3 flex gap-1.5 border-t border-border pt-3">
          <input
            type="text"
            value={novoItem}
            onChange={(e) => setNovoItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            maxLength={300}
            placeholder="Adicionar item ao checklist..."
            className="flex-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={handleAdd}
            disabled={!novoItem.trim() || busyKey === "add"}
          >
            {busyKey === "add" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Adicionar
          </Button>
        </div>
      )}
    </Card>
  );
}

// ─── Informações da etapa + ações (Iniciar/Concluir/Pular) ───

function InformacoesCard({
  etapa,
  aberta,
  reunioesVinculadas,
  onReload,
}: {
  etapa: OnboardingEtapaEstado;
  aberta: boolean;
  reunioesVinculadas: ReuniaoFamilia[];
  onReload: () => void;
}) {
  const confirm = useConfirm();
  const [observacao, setObservacao] = useState("");
  const [motivoPular, setMotivoPular] = useState("");
  const [pulando, setPulando] = useState(false);
  const [isPending, startTransition] = useTransition();

  const checklistAberto = etapa.checklist_estado.filter((c) => !c.concluido).length;
  const reuniaoOk = !etapa.requer_reuniao ||
    reunioesVinculadas.some((r) => r.status === "agendada" || r.status === "realizada");

  const handleIniciar = () => {
    startTransition(async () => {
      const result = await marcarEtapaEmAndamento(etapa.id);
      if (result.success) {
        toast.success("Etapa iniciada");
        onReload();
      } else {
        toast.error(result.error ?? "Falha ao iniciar a etapa");
      }
    });
  };

  const handleConcluir = async () => {
    const obs = observacao.trim();
    if (obs.length < MIN_OBSERVACAO) {
      toast.error(
        `Registre as informações da etapa (mín. ${MIN_OBSERVACAO} caracteres) antes de concluir.`,
      );
      return;
    }
    const ok = await confirm({
      title: `Concluir a etapa ${etapa.ordem}?`,
      description:
        "O registro de informações será salvo e a etapa não poderá mais ser editada. O CEO é notificado.",
      confirmLabel: "Concluir etapa",
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await marcarEtapaConcluida(etapa.id, obs);
      if (result.success) {
        toast.success("Etapa concluída");
        setObservacao("");
        onReload();
      } else {
        toast.error(result.error ?? "Falha ao concluir a etapa");
      }
    });
  };

  const handlePular = () => {
    if (!motivoPular.trim()) {
      toast.error("Informe o motivo para pular a etapa");
      return;
    }
    startTransition(async () => {
      const result = await pularEtapa(etapa.id, motivoPular);
      if (result.success) {
        toast.success("Etapa pulada");
        setPulando(false);
        setMotivoPular("");
        onReload();
      } else {
        toast.error(result.error ?? "Falha ao pular a etapa");
      }
    });
  };

  return (
    <Card variant="plain" padding="lg">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <FileText aria-hidden className="h-3 w-3" />
        Informações da etapa
      </p>

      {aberta ? (
        <>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={5}
            placeholder="Registre o que foi feito nesta etapa: contatos, decisões, combinados com a família... (obrigatório para concluir, mín. 10 caracteres) *"
            className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40"
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            Salvo ao concluir a etapa — é o registro permanente do que aconteceu.
          </p>

          {(checklistAberto > 0 || !reuniaoOk) && (
            <div className="mt-3 space-y-1 rounded-lg border border-sys-orange/30 bg-sys-orange/5 px-3 py-2 text-[11px] text-sys-orange">
              {checklistAberto > 0 && (
                <p>• Conclua o checklist ({checklistAberto} item{checklistAberto > 1 ? "s" : ""} em aberto).</p>
              )}
              {!reuniaoOk && (
                <p>• Esta etapa exige uma reunião vinculada — agende no card Reuniões ao lado.</p>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
            {etapa.status === "pendente" && (
              <Button size="sm" variant="secondary" onClick={handleIniciar} disabled={isPending}>
                <Play className="h-3.5 w-3.5" />
                Iniciar etapa
              </Button>
            )}
            <Button size="sm" onClick={handleConcluir} disabled={isPending}>
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Concluir etapa
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPulando((v) => !v)}
              disabled={isPending}
            >
              <SkipForward className="h-3.5 w-3.5" />
              Pular
            </Button>
          </div>

          {pulando && (
            <div className="mt-3 space-y-2">
              <textarea
                value={motivoPular}
                onChange={(e) => setMotivoPular(e.target.value)}
                rows={2}
                placeholder="Por que esta etapa não se aplica? *"
                className="w-full rounded-md border border-border bg-card px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-sys-orange/40"
              />
              <Button size="sm" variant="destructive" onClick={handlePular} disabled={isPending}>
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirmar — pular etapa
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
          {etapa.observacao ? (
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
              {etapa.observacao}
            </p>
          ) : (
            <p className="text-xs italic text-muted-foreground">
              Etapa finalizada sem registro de informações.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Reuniões vinculadas à etapa ─────────────────────────────

const REUNIAO_TONE: Record<ReuniaoFamilia["status"], "blue" | "green" | "neutral" | "orange"> = {
  agendada: "blue",
  realizada: "green",
  cancelada: "neutral",
  reagendada: "orange",
};

function ReunioesEtapaCard({
  etapa,
  aberta,
  experienciaId,
  reunioes,
  familia,
  onReload,
}: {
  etapa: OnboardingEtapaEstado;
  aberta: boolean;
  experienciaId: string;
  reunioes: ReuniaoFamilia[];
  familia: FamiliaResumo;
  onReload: () => void;
}) {
  const [agendando, setAgendando] = useState(false);

  return (
    <Card variant="plain" padding="md">
      <div className="mb-2.5 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Video aria-hidden className="h-3 w-3" />
          Reuniões da etapa
        </p>
        {aberta && !agendando && (
          <button
            type="button"
            onClick={() => setAgendando(true)}
            className="flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/20"
          >
            <CalendarPlus className="h-3 w-3" />
            Agendar
          </button>
        )}
      </div>

      {agendando && (
        <AgendarReuniaoEtapaForm
          etapa={etapa}
          experienciaId={experienciaId}
          familia={familia}
          onSaved={() => {
            setAgendando(false);
            onReload();
          }}
          onCancel={() => setAgendando(false)}
        />
      )}

      {reunioes.length === 0 ? (
        !agendando && (
          <p className="py-1 text-[11px] text-muted-foreground">
            Nenhuma reunião vinculada a esta etapa.
            {etapa.requer_reuniao && aberta && " Esta etapa exige uma."}
          </p>
        )
      ) : (
        <ul className="space-y-2">
          {reunioes.map((r) => (
            <li key={r.id} className="rounded-lg border border-border bg-card px-2.5 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-xs font-semibold text-foreground">
                  {r.titulo}
                </p>
                <Badge tone={REUNIAO_TONE[r.status]} size="sm">
                  {r.status}
                </Badge>
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {new Date(r.data_hora).toLocaleString("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}{" "}
                · {r.duracao_minutos}min
              </p>
              {r.link_reuniao && (
                <a
                  href={r.link_reuniao}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-sys-blue hover:underline"
                >
                  <ExternalLink className="h-2.5 w-2.5" />
                  Abrir reunião
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function AgendarReuniaoEtapaForm({
  etapa,
  experienciaId,
  familia,
  onSaved,
  onCancel,
}: {
  etapa: OnboardingEtapaEstado;
  experienciaId: string;
  familia: FamiliaResumo;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [titulo, setTitulo] = useState(
    `Etapa ${etapa.ordem} — ${familia.atletaNome.split(" ")[0]}`,
  );
  const [data, setData] = useState(() => {
    const d = new Date(Date.now() + 86400000);
    d.setHours(10, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [duracao, setDuracao] = useState(30);
  const [criarNoCalendar, setCriarNoCalendar] = useState(true);
  const [convidadoEmail, setConvidadoEmail] = useState(familia.responsavelEmail ?? "");

  const handleSubmit = () => {
    if (!titulo.trim()) {
      toast.error("Título obrigatório");
      return;
    }
    if (!data) {
      toast.error("Data e hora obrigatórias");
      return;
    }
    const email = convidadoEmail.trim();
    if (criarNoCalendar && email && !email.includes("@")) {
      toast.error("E-mail do convidado inválido");
      return;
    }
    startTransition(async () => {
      const result = await criarReuniao(experienciaId, {
        titulo,
        assuntos: [],
        data_hora: new Date(data).toISOString(),
        duracao_minutos: duracao,
        etapa_estado_id: etapa.id,
        criar_no_calendar: criarNoCalendar,
        convidado_email: criarNoCalendar && email ? email : undefined,
      });
      if (result.success) {
        if (result.calendarCriado) {
          toast.success("Reunião agendada e evento criado no Calendar");
        } else if (result.calendarCriado === false) {
          toast.warning("Reunião agendada — sem evento no Calendar", {
            description:
              result.calendarAviso ?? "Crie o evento manualmente no Google Calendar.",
          });
        } else {
          toast.success("Reunião agendada");
        }
        onSaved();
      } else {
        toast.error(result.error ?? "Falha ao agendar a reunião");
      }
    });
  };

  return (
    <div className="mb-3 space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
          Nova reunião — vinculada à etapa {etapa.ordem}
        </p>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Fechar agendamento"
          className="rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <input
        type="text"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        placeholder="Título *"
        className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary/40"
      />
      <div className="grid grid-cols-2 gap-1.5">
        <input
          type="datetime-local"
          value={data}
          onChange={(e) => setData(e.target.value)}
          aria-label="Data e hora"
          className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-[11px] text-foreground outline-none focus:border-primary/40"
        />
        <input
          type="number"
          value={duracao}
          onChange={(e) => setDuracao(Number(e.target.value))}
          min={5}
          step={5}
          aria-label="Duração em minutos"
          className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-[11px] text-foreground outline-none focus:border-primary/40"
        />
      </div>
      <label className="flex items-start gap-1.5 text-[10px] text-foreground">
        <input
          type="checkbox"
          checked={criarNoCalendar}
          onChange={(e) => setCriarNoCalendar(e.target.checked)}
          className="mt-0.5 h-3 w-3 accent-primary"
        />
        Criar evento no Google Calendar (Meet automático)
      </label>
      {criarNoCalendar && (
        <input
          type="email"
          value={convidadoEmail}
          onChange={(e) => setConvidadoEmail(e.target.value)}
          placeholder="E-mail do convidado (opcional)"
          className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40"
        />
      )}
      <Button size="sm" className="w-full" onClick={handleSubmit} disabled={isPending}>
        {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Agendar reunião
      </Button>
    </div>
  );
}

// ─── Links úteis da etapa ────────────────────────────────────

function LinksEtapaCard({
  etapa,
  aberta,
  onPatch,
}: {
  etapa: OnboardingEtapaEstado;
  aberta: boolean;
  onPatch: (id: string, patch: Partial<OnboardingEtapaEstado>) => void;
}) {
  const [url, setUrl] = useState("");
  const [titulo, setTitulo] = useState("");
  const [busyIdx, setBusyIdx] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAdd = () => {
    if (!url.trim() || !titulo.trim()) {
      toast.error("Informe URL e título do link");
      return;
    }
    startTransition(async () => {
      try {
        const result = await adicionarLinkEtapa(etapa.id, url, titulo);
        if (result.success) {
          onPatch(etapa.id, { links: result.links });
          setUrl("");
          setTitulo("");
          toast.success("Link adicionado");
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error("Falha de conexão ao adicionar o link");
      }
    });
  };

  const handleRemove = (index: number) => {
    setBusyIdx(index);
    startTransition(async () => {
      try {
        const result = await removerLinkEtapa(etapa.id, index);
        if (result.success) {
          onPatch(etapa.id, { links: result.links });
          toast.success("Link removido");
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error("Falha de conexão ao remover o link");
      } finally {
        setBusyIdx(null);
      }
    });
  };

  return (
    <Card variant="plain" padding="md">
      <p className="mb-2.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Link2 aria-hidden className="h-3 w-3" />
        Links úteis
      </p>

      {etapa.links.length === 0 ? (
        <p className="py-1 text-[11px] text-muted-foreground">
          Nenhum link registrado nesta etapa.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {etapa.links.map((l, idx) => (
            <li
              key={`${l.url}-${idx}`}
              className="group flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5"
            >
              <a
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 flex-1 items-center gap-1.5 text-xs font-medium text-sys-blue hover:underline"
                title={l.url}
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                <span className="truncate">{l.titulo}</span>
              </a>
              {aberta && (
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  disabled={isPending}
                  aria-label={`Remover link "${l.titulo}"`}
                  className="rounded p-0.5 text-label-tertiary opacity-0 transition-opacity hover:text-sys-red focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-40"
                >
                  {busyIdx === idx ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {aberta && (
        <div className="mt-3 space-y-1.5 border-t border-border pt-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40"
          />
          <div className="flex gap-1.5">
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              maxLength={120}
              placeholder="Título do link"
              className="flex-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={handleAdd}
              disabled={isPending || !url.trim() || !titulo.trim()}
            >
              {isPending && busyIdx === null ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Anexos e prints da etapa ────────────────────────────────

function AnexosEtapaCard({
  etapa,
  aberta,
  onPatch,
}: {
  etapa: OnboardingEtapaEstado;
  aberta: boolean;
  onPatch: (id: string, patch: Partial<OnboardingEtapaEstado>) => void;
}) {
  const [busy, setBusy] = useState<"upload" | number | null>(null);
  const [, startTransition] = useTransition();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy("upload");
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("scope", "onboarding");
        fd.append("scopeId", etapa.id);
        const up = await uploadFile(fd);
        if (!up.success) {
          toast.error(up.error);
          return;
        }
        const result = await adicionarAnexoEtapa(etapa.id, up.file);
        if (result.success) {
          onPatch(etapa.id, { anexos: result.anexos });
          toast.success("Anexo adicionado", { description: file.name });
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error("Falha no upload do anexo");
      } finally {
        setBusy(null);
      }
    });
  };

  const handleOpen = (path: string) => {
    startTransition(async () => {
      try {
        const { url, error } = await getFileSignedUrl(path);
        if (url) {
          window.open(url, "_blank", "noopener");
        } else {
          toast.error(error ?? "Falha ao gerar o link do arquivo");
        }
      } catch {
        toast.error("Falha ao abrir o anexo");
      }
    });
  };

  const handleRemove = (index: number) => {
    setBusy(index);
    startTransition(async () => {
      try {
        const result = await removerAnexoEtapa(etapa.id, index);
        if (result.success) {
          onPatch(etapa.id, { anexos: result.anexos });
          toast.success("Anexo removido");
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error("Falha de conexão ao remover o anexo");
      } finally {
        setBusy(null);
      }
    });
  };

  return (
    <Card variant="plain" padding="md">
      <div className="mb-2.5 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Paperclip aria-hidden className="h-3 w-3" />
          Anexos e prints
        </p>
        {aberta && (
          <label
            className={cn(
              "flex cursor-pointer items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[10px] font-semibold text-foreground hover:bg-accent",
              busy === "upload" && "pointer-events-none opacity-50",
            )}
          >
            {busy === "upload" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            Enviar arquivo
            <input
              type="file"
              onChange={handleFile}
              className="sr-only"
              accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
            />
          </label>
        )}
      </div>

      {etapa.anexos.length === 0 ? (
        <p className="py-1 text-[11px] text-muted-foreground">
          Nenhum anexo nesta etapa. Suba prints e documentos de apoio (máx. 20MB).
        </p>
      ) : (
        <ul className="space-y-1.5">
          {etapa.anexos.map((a, idx) => (
            <li
              key={`${a.path}-${idx}`}
              className="group flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5"
            >
              <button
                type="button"
                onClick={() => handleOpen(a.path)}
                className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                title={`Abrir ${a.name}`}
              >
                <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground group-hover:text-sys-blue">
                  {a.name}
                </span>
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {formatBytes(a.size)}
                </span>
              </button>
              {aberta && (
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  disabled={busy !== null}
                  aria-label={`Remover anexo "${a.name}"`}
                  className="rounded p-0.5 text-label-tertiary opacity-0 transition-opacity hover:text-sys-red focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-40"
                >
                  {busy === idx ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ─── Contato com a família ───────────────────────────────────

const TIPOS_CONTATO = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "E-mail" },
  { value: "ligacao", label: "Ligação" },
  { value: "presencial", label: "Presencial" },
] as const;

type TipoContato = (typeof TIPOS_CONTATO)[number]["value"];

function ContatoCard({
  experienciaId,
  familia,
  onReload,
}: {
  experienciaId: string;
  familia: FamiliaResumo;
  onReload: () => void;
}) {
  const [registrando, setRegistrando] = useState(false);
  const [tipo, setTipo] = useState<TipoContato>("whatsapp");
  const [resumo, setResumo] = useState("");
  const [proximoContato, setProximoContato] = useState(() => {
    const d = new Date(Date.now() + 7 * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [isPending, startTransition] = useTransition();

  const whatsappDigits = familia.responsavelWhatsapp?.replace(/\D/g, "") ?? "";

  const handleRegistrar = () => {
    if (!resumo.trim()) {
      toast.error("Resumo do contato é obrigatório");
      return;
    }
    if (!proximoContato) {
      toast.error("Data do próximo contato é obrigatória");
      return;
    }
    startTransition(async () => {
      const result = await registrarContato(experienciaId, {
        tipo,
        resumo,
        proximo_contato: proximoContato,
      });
      if (result.success) {
        toast.success("Contato registrado na timeline da família");
        setRegistrando(false);
        setResumo("");
        onReload();
      } else {
        toast.error(result.error ?? "Falha ao registrar o contato");
      }
    });
  };

  return (
    <Card variant="plain" padding="md">
      <p className="mb-2.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <MessageCircle aria-hidden className="h-3 w-3" />
        Contato com a família
      </p>

      <div className="flex flex-wrap gap-2">
        {whatsappDigits && (
          <a
            href={`https://wa.me/${whatsappDigits}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 rounded-md border border-sys-green/30 bg-sys-green/10 px-2 py-1 text-[10px] font-semibold text-sys-green hover:bg-sys-green/20"
          >
            <MessageCircle className="h-3 w-3" />
            WhatsApp {familia.responsavelNome ? `· ${familia.responsavelNome.split(" ")[0]}` : ""}
          </a>
        )}
        <button
          type="button"
          onClick={() => setRegistrando((v) => !v)}
          className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[10px] font-semibold text-foreground hover:bg-accent"
        >
          <Plus className="h-3 w-3" />
          Registrar contato
        </button>
      </div>

      {registrando && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoContato)}
            aria-label="Tipo de contato"
            className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary/40"
          >
            {TIPOS_CONTATO.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <textarea
            value={resumo}
            onChange={(e) => setResumo(e.target.value)}
            rows={3}
            placeholder="Resumo do contato *"
            className="w-full rounded-md border border-border bg-card px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40"
          />
          <div>
            <label className="mb-1 block text-[10px] text-muted-foreground">
              Próximo contato *
            </label>
            <input
              type="date"
              value={proximoContato}
              onChange={(e) => setProximoContato(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-primary/40"
            />
          </div>
          <Button size="sm" className="w-full" onClick={handleRegistrar} disabled={isPending}>
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Salvar na timeline
          </Button>
        </div>
      )}
    </Card>
  );
}
