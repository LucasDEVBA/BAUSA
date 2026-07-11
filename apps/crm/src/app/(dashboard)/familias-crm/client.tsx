"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  User,
  Bell,
  HeartHandshake,
  Smile,
  Activity,
  Users2,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { Badge, Button, Card, EmptyState, StatCard } from "@/components/ui";
import type { BadgeTone, StatCardProps } from "@/components/ui";
import {
  JOURNEY_STAGE_CONFIG,
  FAMILY_STATUS_CONFIG,
  TEMPERATURE_CONFIG,
  type Family,
  type FamilyStatus,
  type FamilyTemperature,
  type RiskDimension,
} from "@/types/family";
import {
  FamilyDetailModal,
  type FamilyModalData,
} from "@/components/familias-shared/FamilyDetailModal";
import { type JourneyConfigMap } from "@/lib/fases-familia";
import { type AlertaInatividade } from "@/lib/actions/experiencia";
import { NovaFamiliaModal } from "@/components/familias-shared/NovaFamiliaModal";
import { cn } from "@/lib/utils";

interface FamiliasCrmClientProps {
  families: Family[];
  tiposRiscoByFamilia: Record<string, RiskDimension[]>;
  metrics: {
    total: number;
    satisfeita: number;
    atencao: number;
    crise: number;
    avg_satisfaction: number;
    avg_anxiety: number;
    temperatura_verde: number;
    temperatura_amarelo: number;
    temperatura_vermelho: number;
    em_alerta: number;
  };
  alertas: AlertaInatividade[];
  /** Nível CEO/CTO — controla ações de gestão (Nova Família é CEO-only) */
  canManage: boolean;
  /** Deep-link ?familia=<experiencia_id>: abre a modal da família direto */
  familiaInicial: string | null;
  /** Config das fases (rótulo/ordem configurados pelo CEO). Default: estático. */
  journeyConfig?: JourneyConfigMap;
}

const STATUS_TONE: Record<FamilyStatus, BadgeTone> = {
  satisfeita: "green",
  atencao: "orange",
  crise: "red",
};

const TEMP_DOT: Record<FamilyTemperature, string> = {
  verde: "bg-sys-green",
  amarelo: "bg-sys-orange",
  vermelho: "bg-sys-red",
};

const ALERT_PREVIEW_COUNT = 3;

function formatRelative(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diff === 0) return "hoje";
  if (diff === 1) return "ontem";
  return `há ${diff}d`;
}

function ScoreBar({
  value,
  max = 5,
  color,
}: {
  value: number;
  max?: number;
  color: string;
}) {
  const pct = (value / max) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 flex-1 rounded-full bg-secondary">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-3 text-right text-[10px] font-semibold tabular-nums text-muted-foreground">
        {value}
      </span>
    </div>
  );
}

function FamilyCard({
  family,
  journeyConfig,
  emAlerta,
  onSelect,
}: {
  family: Family;
  journeyConfig: JourneyConfigMap;
  emAlerta: boolean;
  onSelect: (f: Family) => void;
}) {
  const statusCfg = FAMILY_STATUS_CONFIG[family.family_status];
  const tempCfg = TEMPERATURE_CONFIG[family.temperature];
  const stageCfg = journeyConfig[family.journey_stage];
  const accent =
    family.family_status === "crise"
      ? "red"
      : family.family_status === "atencao"
        ? "orange"
        : undefined;
  const contatoAtrasado =
    family.days_without_contact >= stageCfg.alertDays && stageCfg.alertDays > 0;

  return (
    <Card
      padding="none"
      accent={accent}
      interactive
      role="button"
      tabIndex={0}
      className="cursor-pointer p-4"
      onClick={() => onSelect(family)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(family);
        }
      }}
    >
      {/* Identidade: hierarquia por tipografia — nome forte, contexto muted */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-muted-foreground">
            {family.athlete_name.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {family.athlete_name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {family.guardian_name}
              {family.address_state ? ` · ${family.address_state}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {family.family_status === "satisfeita" ? (
            <span className="text-[11px] font-medium text-label-tertiary">
              {statusCfg.label}
            </span>
          ) : (
            <Badge tone={STATUS_TONE[family.family_status]} size="sm">
              <AlertTriangle aria-hidden className="h-2.5 w-2.5" />
              {statusCfg.label}
            </Badge>
          )}
          <span
            title={`Temperatura: ${tempCfg.label}`}
            className={cn("h-2 w-2 rounded-full", TEMP_DOT[family.temperature])}
          >
            <span className="sr-only">Temperatura {tempCfg.label}</span>
          </span>
        </div>
      </div>

      {/* Fase + plano: texto muted, sem badges competindo */}
      <p className="mt-2.5 text-[11px] text-label-tertiary">
        {stageCfg.label} · {family.plan}
      </p>

      {/* Scores finos e discretos — cor só quando o valor pede atenção */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1 text-[10px] text-label-tertiary">Satisfação</p>
          <ScoreBar value={family.satisfaction_level} color="bg-primary/60" />
        </div>
        <div>
          <p className="mb-1 text-[10px] text-label-tertiary">Ansiedade</p>
          <ScoreBar
            value={family.anxiety_level}
            color={
              family.anxiety_level >= 4
                ? "bg-sys-red"
                : family.anxiety_level >= 3
                  ? "bg-sys-orange"
                  : "bg-label-quaternary"
            }
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5 text-[11px]">
        <span className="text-muted-foreground">
          Último contato{" "}
          <span className="font-medium text-foreground/80">
            {formatRelative(family.last_contact_at)}
          </span>
        </span>
        <span
          className={cn(
            "flex items-center gap-1 tabular-nums",
            emAlerta || contatoAtrasado
              ? "font-semibold text-sys-orange"
              : "text-label-tertiary"
          )}
          title={emAlerta ? "Em alerta de inatividade" : undefined}
        >
          {emAlerta && (
            <>
              <Bell aria-hidden className="h-3 w-3" />
              <span className="sr-only">Em alerta de inatividade —</span>
            </>
          )}
          {family.days_without_contact}d sem contato
        </span>
      </div>

      {family.family_status === "crise" && (
        <p className="mt-2.5 flex items-center gap-1.5 text-[11px] font-medium text-sys-red">
          <AlertTriangle aria-hidden className="h-3 w-3 flex-shrink-0" />
          Crise{" "}
          {family.psicologa_acionada
            ? "— psicóloga acionada"
            : "— acionar protocolo"}
        </p>
      )}
    </Card>
  );
}

/** Strip fino de alertas: contagem + famílias mais críticas inline, expansível. */
function AlertasStrip({ alertas }: { alertas: AlertaInatividade[] }) {
  const [expanded, setExpanded] = useState(false);
  const ordenados = [...alertas].sort((a, b) => b.dias - a.dias);
  const preview = ordenados.slice(0, ALERT_PREVIEW_COUNT);

  return (
    <div className="rounded-xl border border-sys-orange/20 bg-sys-orange/5 px-3.5 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5 font-semibold text-sys-orange">
          <Bell aria-hidden className="h-3.5 w-3.5" />
          {alertas.length} em alerta de inatividade
        </span>
        {!expanded &&
          preview.map((a) => (
            <span
              key={a.experiencia_id}
              className="truncate text-muted-foreground"
            >
              {a.atleta_nome}{" "}
              <span className="font-semibold tabular-nums text-sys-orange">
                {a.dias}d
              </span>
            </span>
          ))}
        {alertas.length > ALERT_PREVIEW_COUNT && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="ml-auto flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-sys-orange transition-colors hover:bg-sys-orange/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {expanded ? "Recolher" : "Ver todas"}
            <ChevronDown
              aria-hidden
              className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")}
            />
          </button>
        )}
      </div>
      {expanded && (
        <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 border-t border-sys-orange/15 pt-2 sm:grid-cols-2 lg:grid-cols-3">
          {ordenados.map((a) => (
            <div
              key={a.experiencia_id}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="truncate text-foreground/80">{a.atleta_nome}</span>
              <span className="whitespace-nowrap text-[10px] font-semibold tabular-nums text-sys-orange">
                {a.dias}d / {a.threshold}d · {a.fase}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Mapeia a Family (tela Experiência) → FamilyModalData (modal detalhado compartilhado).
function familyToModalData(
  f: Family,
  tiposRisco: RiskDimension[],
): FamilyModalData {
  return {
    experiencia_id: f.id,
    atleta_id: f.atleta_id ?? "",
    athlete_name: f.athlete_name,
    guardian_name: f.guardian_name,
    whatsapp: f.whatsapp,
    whatsapp_atleta: null,
    whatsapp_responsavel: f.whatsapp || null,
    email: f.email ?? null,
    email_responsavel: null,
    plano: f.plan,
    esporte: f.target_sport ?? null,
    fase: f.journey_stage,
    status: f.family_status,
    temperatura: f.temperature,
    ansiedade: f.anxiety_level,
    satisfacao: f.satisfaction_level,
    risco_percebido: f.perceived_risk,
    tipos_risco: tiposRisco,
    descricao_problema: null,
    acao_em_andamento: null,
    tipo_crise: f.tipo_crise ?? null,
    nivel_crise: f.nivel_crise ?? null,
    psicologa_acionada: f.psicologa_acionada ?? false,
    data_prevista_embarque: f.expected_departure_date ?? null,
    proximo_contato: f.next_contact_date ?? null,
    data_ultimo_contato: f.last_contact_at ?? null,
    dias_sem_contato: f.days_without_contact ?? null,
    nps_6meses: f.nps_6meses ?? null,
    nps_enviado_at: f.nps_enviado_at ?? null,
  };
}

// ─── Painel principal ────────────────────────────────────────
export function FamiliasCrmClient({
  families,
  tiposRiscoByFamilia,
  metrics,
  alertas,
  canManage,
  familiaInicial,
  journeyConfig = JOURNEY_STAGE_CONFIG,
}: FamiliasCrmClientProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Family | null>(
    () =>
      (familiaInicial
        ? families.find((f) => f.id === familiaInicial)
        : null) ?? null,
  );
  const [showNovaModal, setShowNovaModal] = useState(false);
  const [filter, setFilter] = useState<
    "todas" | "satisfeita" | "atencao" | "crise"
  >("todas");

  const filtered =
    filter === "todas"
      ? families
      : families.filter((f) => f.family_status === filter);

  const alertasByExperiencia = new Map(alertas.map((a) => [a.experiencia_id, a]));

  const STAT_CARDS: {
    label: string;
    value: string;
    icon: LucideIcon;
    accent: StatCardProps["accent"];
  }[] = [
    { label: "Famílias", value: metrics.total.toString(), icon: Users2, accent: "brand" },
    { label: "Satisfeitas", value: metrics.satisfeita.toString(), icon: Smile, accent: "green" },
    { label: "Atenção", value: metrics.atencao.toString(), icon: AlertTriangle, accent: "orange" },
    { label: "Crise", value: metrics.crise.toString(), icon: HeartHandshake, accent: "red" },
    { label: "Em alerta", value: metrics.em_alerta.toString(), icon: Bell, accent: "orange" },
    { label: "Satisfação média", value: `${metrics.avg_satisfaction}/5`, icon: Activity, accent: "blue" },
  ];

  const FILTER_OPTIONS: {
    value: typeof filter;
    label: string;
    count: number | null;
  }[] = [
    { value: "todas", label: "Todas", count: null },
    { value: "satisfeita", label: "Satisfeitas", count: metrics.satisfeita },
    { value: "atencao", label: "Atenção", count: metrics.atencao },
    { value: "crise", label: "Crise", count: metrics.crise },
  ];

  const TEMPERATURAS: {
    key: FamilyTemperature;
    label: string;
    count: number;
  }[] = [
    { key: "verde", label: "Verde", count: metrics.temperatura_verde },
    { key: "amarelo", label: "Amarelo", count: metrics.temperatura_amarelo },
    { key: "vermelho", label: "Vermelho", count: metrics.temperatura_vermelho },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end gap-2 flex-wrap">
        {/* criarFamiliaManual é CEO-only — o Head via o botão mas o submit falhava */}
        {canManage && (
          <Button onClick={() => setShowNovaModal(true)}>
            <User className="h-4 w-4" />
            Nova Família
          </Button>
        )}
        <Button variant="secondary" asChild>
          <a href="/familias-pipeline">Pipeline da Família</a>
        </Button>
      </div>

      {canManage && (
        <NovaFamiliaModal
          open={showNovaModal}
          journeyConfig={journeyConfig}
          onClose={() => setShowNovaModal(false)}
        />
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STAT_CARDS.map((kpi) => (
          <StatCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            icon={kpi.icon}
            accent={kpi.accent}
          />
        ))}
      </div>

      {/* Alertas de inatividade — strip fino */}
      {alertas.length > 0 && <AlertasStrip alertas={alertas} />}

      {/* Controles: filtro de status + indicadores de temperatura numa linha */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-border bg-card p-0.5">
          {FILTER_OPTIONS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                filter === f.value
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
              {f.count !== null && (
                <span
                  className={cn(
                    "text-[10px] tabular-nums",
                    filter === f.value ? "text-primary/80" : "text-label-tertiary"
                  )}
                >
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[10px] uppercase tracking-wider text-label-tertiary">
            Temperatura
          </span>
          {TEMPERATURAS.map((t) => (
            <span
              key={t.key}
              title={`Temperatura ${t.label}`}
              className="flex items-center gap-1.5 text-xs"
            >
              <span aria-hidden className={cn("h-2 w-2 rounded-full", TEMP_DOT[t.key])} />
              <span className="sr-only">{t.label}:</span>
              <span className="font-medium tabular-nums text-foreground/80">
                {t.count}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((family) => (
          <FamilyCard
            key={family.id}
            family={family}
            journeyConfig={journeyConfig}
            emAlerta={alertasByExperiencia.has(family.id)}
            onSelect={setSelected}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <EmptyState
          icon={User}
          title="Nenhuma família encontrada"
          description="Nenhuma família corresponde ao filtro selecionado."
        />
      )}

      {selected && (
        <FamilyDetailModal
          family={familyToModalData(
            selected,
            tiposRiscoByFamilia[selected.id] ?? [],
          )}
          journeyConfig={journeyConfig}
          onClose={() => setSelected(null)}
          onChanged={() => router.refresh()}
        />
      )}
    </div>
  );
}
