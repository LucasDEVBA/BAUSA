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
  type RiskDimension,
} from "@/types/family";
import {
  FamilyDetailModal,
  type FamilyModalData,
} from "@/components/familias-shared/FamilyDetailModal";
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
}

const STATUS_TONE: Record<FamilyStatus, BadgeTone> = {
  satisfeita: "green",
  atencao: "orange",
  crise: "red",
};

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
      <div className="flex-1 h-1.5 rounded-full bg-secondary">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-foreground w-4 text-right">
        {value}
      </span>
    </div>
  );
}

function FamilyCard({
  family,
  onSelect,
}: {
  family: Family;
  onSelect: (f: Family) => void;
}) {
  const statusCfg = FAMILY_STATUS_CONFIG[family.family_status];
  const tempCfg = TEMPERATURE_CONFIG[family.temperature];
  const stageCfg = JOURNEY_STAGE_CONFIG[family.journey_stage];
  const accent =
    family.family_status === "crise"
      ? "red"
      : family.family_status === "atencao"
        ? "orange"
        : undefined;

  return (
    <Card
      padding="none"
      accent={accent}
      interactive
      role="button"
      tabIndex={0}
      className="cursor-pointer p-3.5"
      onClick={() => onSelect(family)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(family);
        }
      }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold",
              tempCfg.bg,
              tempCfg.color
            )}
          >
            {family.athlete_name.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {family.athlete_name}
            </p>
            <p className="text-xs text-muted-foreground">
              {family.guardian_name}
              {family.address_state ? ` · ${family.address_state}` : ""}
            </p>
          </div>
        </div>
        <span className="text-lg">{tempCfg.icon}</span>
      </div>

      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <Badge tone={STATUS_TONE[family.family_status]} size="sm">
          <span className={cn("h-1.5 w-1.5 rounded-full", statusCfg.dot)} />
          {statusCfg.label}
        </Badge>
        <Badge tone="neutral" size="sm">
          {stageCfg.label}
        </Badge>
        <Badge tone="neutral" size="sm">
          {family.plan}
        </Badge>
      </div>

      <div className="mb-3 space-y-2">
        <div>
          <p className="text-[10px] text-label-tertiary mb-1">Satisfacao</p>
          <ScoreBar value={family.satisfaction_level} color="bg-sys-green" />
        </div>
        <div>
          <p className="text-[10px] text-label-tertiary mb-1">Ansiedade</p>
          <ScoreBar
            value={family.anxiety_level}
            color={
              family.anxiety_level >= 4
                ? "bg-sys-red"
                : family.anxiety_level >= 3
                  ? "bg-sys-orange"
                  : "bg-sys-blue"
            }
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          Último contato:{" "}
          <span className="text-foreground/80">
            {formatRelative(family.last_contact_at)}
          </span>
        </span>
        <span
          className={cn(
            "font-medium",
            family.days_without_contact >= stageCfg.alertDays &&
              stageCfg.alertDays > 0
              ? "text-sys-orange"
              : "text-muted-foreground"
          )}
        >
          {family.days_without_contact}d sem contato
        </span>
      </div>

      {family.family_status === "crise" && (
        <div className="mt-3 flex items-center gap-1.5 rounded-md bg-sys-red/10 border border-sys-red/20 px-2.5 py-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-sys-red flex-shrink-0" />
          <p className="text-[10px] font-medium text-sys-red">
            Crise{" "}
            {family.psicologa_acionada
              ? "— psicóloga acionada"
              : "— acionar protocolo"}
          </p>
        </div>
      )}
      {family.family_status === "atencao" && (
        <div className="mt-3 flex items-center gap-1.5 rounded-md bg-sys-orange/10 border border-sys-orange/20 px-2.5 py-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-sys-orange flex-shrink-0" />
          <p className="text-[10px] font-medium text-sys-orange">
            Atenção registrada
          </p>
        </div>
      )}
    </Card>
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
          onClose={() => setShowNovaModal(false)}
        />
      )}

      {/* Banner de alertas */}
      {alertas.length > 0 && (
        <Card accent="orange">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="h-4 w-4 text-sys-orange" />
            <p className="text-xs font-semibold text-sys-orange">
              {alertas.length} família{alertas.length > 1 ? "s" : ""} em alerta
              de inatividade
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
            {alertas.slice(0, 8).map((a) => (
              <div
                key={a.experiencia_id}
                className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-1.5"
              >
                <p className="text-xs text-foreground/80 truncate">
                  {a.atleta_nome}
                </p>
                <span className="text-[10px] font-semibold text-sys-orange whitespace-nowrap ml-2">
                  {a.dias}d / {a.threshold}d ({a.fase})
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
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

      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-xs text-label-tertiary">Temperatura:</p>
        {[
          { key: "verde", label: "Verde", count: metrics.temperatura_verde },
          {
            key: "amarelo",
            label: "Amarelo",
            count: metrics.temperatura_amarelo,
          },
          {
            key: "vermelho",
            label: "Vermelho",
            count: metrics.temperatura_vermelho,
          },
        ].map((t) => (
          <div
            key={t.key}
            className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5"
          >
            <span className="text-xs text-foreground/80">{t.label}</span>
            <span className="rounded-full bg-secondary px-1.5 text-[10px] font-semibold text-muted-foreground">
              {t.count}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {(["todas", "satisfeita", "atencao", "crise"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {f === "todas"
              ? "Todas"
              : f === "satisfeita"
                ? "Satisfeitas"
                : f === "atencao"
                  ? "Atenção"
                  : "Crise"}
            {f !== "todas" && (
              <span className="ml-1.5 rounded-full bg-secondary px-1.5 text-[10px] text-muted-foreground">
                {f === "satisfeita"
                  ? metrics.satisfeita
                  : f === "atencao"
                    ? metrics.atencao
                    : metrics.crise}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((family) => (
          <div key={family.id} className="relative">
            <FamilyCard family={family} onSelect={setSelected} />
            {alertasByExperiencia.has(family.id) && (
              <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-md bg-sys-orange/15 border border-sys-orange/30 px-1.5 py-0.5 text-[10px] font-bold text-sys-orange">
                <Bell className="h-2.5 w-2.5" />
                Inativa
              </span>
            )}
          </div>
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
          onClose={() => setSelected(null)}
          onChanged={() => router.refresh()}
        />
      )}
    </div>
  );
}
