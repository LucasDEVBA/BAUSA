"use client";

import { useState, useTransition, useCallback } from "react";
import { Save, Shield, Bell, List, Database, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { atualizarConfiguracao } from "@/lib/actions/configuracoes";
import { cn } from "@/lib/utils";
import { DOCUMENTO_TIPOS, FAQ_CATEGORIAS } from "@/types/crm";
import { DEAL_STAGE_CONFIG, PIPELINE_STAGE_ORDER } from "@/types/deal";
import { UsuariosTab } from "@/components/configuracoes/UsuariosTab";
import { PageHeader, BrandTabs, Card, Input, Button } from "@/components/ui";

const TABS = [
  { value: "planos", label: "Planos" },
  { value: "lead_scoring", label: "Lead Scoring" },
  { value: "match", label: "Match" },
  { value: "metas", label: "Metas" },
  { value: "timers", label: "Timers" },
  { value: "experiencia", label: "Experiencia" },
  { value: "cobranca", label: "Cobranca" },
  { value: "pipeline", label: "Pipeline" },
  { value: "notificacoes", label: "Notificacoes" },
  { value: "listas", label: "Listas" },
  { value: "usuarios", label: "Usuarios" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

const labelClass = "text-xs font-medium text-muted-foreground";
const selectClass =
  "h-9 rounded-lg border border-input bg-card px-3 text-sm text-foreground transition-colors appearance-none focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25";

interface ConfiguracoesClientProps {
  configsIniciais: Record<string, unknown>;
}

function SaveBtn({ onClick, isPending, label = "Salvar" }: { onClick: () => void; isPending: boolean; label?: string }) {
  return (
    <Button onClick={onClick} disabled={isPending} size="sm">
      <Save className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}

function NumberField({ label, value, onChange, unit, min, max, step }: {
  label: string; value: number; onChange: (v: number) => void; unit?: string; min?: number; max?: number; step?: number;
}) {
  return (
    <div className="space-y-1.5">
      <label className={labelClass}>{label} {unit && <span className="text-label-tertiary">({unit})</span>}</label>
      <Input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} min={min} max={max} step={step ?? 1} />
    </div>
  );
}

function ToggleSwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={cn(
        "relative h-6 w-11 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        value ? "bg-primary" : "bg-secondary",
      )}
      role="switch"
      aria-checked={value}
    >
      <span className={cn("absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform", value && "translate-x-5")} />
    </button>
  );
}

function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <label className={labelClass}>{label}</label>
      <ToggleSwitch value={value} onChange={onChange} />
    </div>
  );
}

function WeightedCriteriaSection({
  title, criteria, pesos, faixas, faixaFields, onPesoChange, onFaixaChange,
}: {
  title: string;
  criteria: { key: string; label: string }[];
  pesos: Record<string, number>;
  faixas: Record<string, number>;
  faixaFields: { key: string; label: string }[];
  onPesoChange: (key: string, value: number) => void;
  onFaixaChange: (key: string, value: number) => void;
}) {
  const total = Object.values(pesos).reduce((s, v) => s + (Number(v) || 0), 0);
  const isValid = total === 100;

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
        <div className="space-y-3">
          {criteria.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-4">
              <span className="w-32 text-sm text-foreground/80">{label}</span>
              <input type="range" min={0} max={100} value={Number(pesos[key] ?? 0)} onChange={(e) => onPesoChange(key, Number(e.target.value))} className="flex-1 accent-primary" />
              <Input type="number" min={0} max={100} value={Number(pesos[key] ?? 0)} onChange={(e) => onPesoChange(key, Number(e.target.value))} className="w-20 text-center" />
            </div>
          ))}
        </div>
        <div className={cn("mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold", isValid ? "bg-sys-green/15 text-sys-green" : "bg-sys-red/15 text-sys-red")}>
          {!isValid && <AlertTriangle className="h-4 w-4" />}
          Total: {total} / 100
          {!isValid && <span className="text-xs font-normal ml-2">A soma deve ser 100</span>}
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-foreground mb-4">Faixas de Classificacao</h3>
        <div className={cn("grid gap-4", faixaFields.length <= 2 ? "grid-cols-2" : "grid-cols-3")}>
          {faixaFields.map(({ key, label }) => (
            <NumberField key={key} label={label} value={Number(faixas[key] ?? 0)} onChange={(v) => onFaixaChange(key, v)} min={0} max={100} />
          ))}
        </div>
      </Card>
    </div>
  );
}

export function ConfiguracoesClient({ configsIniciais }: ConfiguracoesClientProps) {
  const [configs, setConfigs] = useState<Record<string, unknown>>(configsIniciais);
  const [activeTab, setActiveTab] = useState<TabValue>("planos");
  const [isPending, startTransition] = useTransition();

  const saveConfig = useCallback((chave: string, valor: unknown) => {
    startTransition(async () => {
      const result = await atualizarConfiguracao(chave, valor);
      if (result.success) {
        setConfigs((prev) => ({ ...prev, [chave]: valor }));
        toast.success(`Configuracao "${chave}" atualizada`);
      } else {
        toast.error(result.error ?? "Erro ao atualizar");
      }
    });
  }, [startTransition]);

  const getConfigObj = (chave: string, fallback: Record<string, unknown>): Record<string, unknown> =>
    (configs[chave] as Record<string, unknown>) ?? fallback;

  const updateLocalConfig = (chave: string, valor: unknown) => {
    setConfigs((prev) => ({ ...prev, [chave]: valor }));
  };

  return (
    <div className="flex h-full flex-col gap-5">
      <PageHeader
        eyebrow="Sistema"
        title="Configuracoes do Sistema"
        description="Ajuste parametros do CRM — acesso exclusivo CEO"
      />

      {/* Tabs */}
      <BrandTabs
        variant="segmented"
        ariaLabel="Secoes de configuracao"
        items={TABS.map((tab) => ({ id: tab.value, label: tab.label }))}
        activeId={activeTab}
        onSelect={(id) => setActiveTab(id as TabValue)}
      />

      {/* LGPD + Soft Delete notices */}
      <Card accent="brand">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/20">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Politica de Retencao de Dados (LGPD)</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Leads nao qualificados: retencao de 2 anos. Clientes ativos: duracao do contrato + 5 anos.
              Dados anonimizados apos periodo de retencao.
            </p>
          </div>
        </div>
      </Card>

      <Card accent="green">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-sys-green/20">
            <Database className="h-4 w-4 text-sys-green" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Status Soft Delete</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Todas as tabelas CRM utilizam <code className="text-sys-green font-mono">deleted_at</code> para exclusao logica. Dados nunca sao removidos permanentemente sem autorizacao explicita.
            </p>
          </div>
        </div>
      </Card>

      {/* Tab content */}
      <div className="flex-1 space-y-5 overflow-y-auto">
        {/* ===== PLANOS ===== */}
        {activeTab === "planos" && (() => {
          const PLANOS_KEY = "planos_valores";
          const CONFIG_KEY = "planos_config";
          const planos = getConfigObj(PLANOS_KEY, {
            journey: { padrao: 26000, pix: 23000, sinal: 4500, psicologa: true },
            legacy: { padrao: 32000, pix: 28500, sinal: 4500, psicologa: true },
            start: { padrao: 18000, pix: 16000, sinal: 4500, psicologa: false },
          }) as Record<string, Record<string, unknown>>;
          const planosConfig = getConfigObj(CONFIG_KEY, { entrada_padrao: 4500, custo_psicologa: 2500 });

          const updatePlano = (plano: string, campo: string, valor: unknown) => {
            const updated = { ...planos, [plano]: { ...planos[plano], [campo]: valor } };
            updateLocalConfig(PLANOS_KEY, updated);
          };
          const updatePConfig = (campo: string, valor: unknown) => {
            updateLocalConfig(CONFIG_KEY, { ...planosConfig, [campo]: valor });
          };

          return (
            <div className="space-y-5">
              {[
                { key: "journey", label: "Journey" },
                { key: "legacy", label: "Legacy" },
                { key: "start", label: "Start" },
              ].map(({ key, label }) => {
                const p = planos[key] ?? {};
                return (
                  <Card key={key}>
                    <h3 className="text-sm font-semibold text-foreground mb-4">Plano {label}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <NumberField label="Valor Padrao" value={Number(p.padrao ?? 0)} onChange={(v) => updatePlano(key, "padrao", v)} unit="R$" />
                      <NumberField label="Valor Pix" value={Number(p.pix ?? 0)} onChange={(v) => updatePlano(key, "pix", v)} unit="R$" />
                      <NumberField label="Sinal Padrao" value={Number(p.sinal ?? 4500)} onChange={(v) => updatePlano(key, "sinal", v)} unit="R$" />
                      <ToggleField label="Inclui Psicologa" value={Boolean(p.psicologa)} onChange={(v) => updatePlano(key, "psicologa", v)} />
                    </div>
                  </Card>
                );
              })}

              <Card>
                <h3 className="text-sm font-semibold text-foreground mb-4">Configuracoes Gerais</h3>
                <div className="grid grid-cols-2 gap-4">
                  <NumberField label="Entrada Padrao" value={Number(planosConfig.entrada_padrao ?? 4500)} onChange={(v) => updatePConfig("entrada_padrao", v)} unit="R$" />
                  <NumberField label="Custo Psicologa" value={Number(planosConfig.custo_psicologa ?? 2500)} onChange={(v) => updatePConfig("custo_psicologa", v)} unit="R$" />
                </div>
              </Card>

              <div className="flex justify-end gap-3">
                <SaveBtn onClick={() => { saveConfig(PLANOS_KEY, configs[PLANOS_KEY]); saveConfig(CONFIG_KEY, configs[CONFIG_KEY]); }} isPending={isPending} />
              </div>
            </div>
          );
        })()}

        {/* ===== LEAD SCORING ===== */}
        {activeTab === "lead_scoring" && (() => {
          const PESOS_KEY = "lead_scoring_pesos";
          const FAIXAS_KEY = "lead_scoring_faixas";
          const pesos = getConfigObj(PESOS_KEY, { investimento: 25, timing: 20, ingles: 15, academico: 15, competitivo: 10, comprometimento: 10, video: 5 }) as Record<string, number>;
          const faixas = getConfigObj(FAIXAS_KEY, { hot: 80, warm: 60 }) as Record<string, number>;

          return (
            <>
              <WeightedCriteriaSection
                title="Pesos dos Criterios"
                criteria={[
                  { key: "investimento", label: "Investimento" },
                  { key: "timing", label: "Timing" },
                  { key: "ingles", label: "Ingles" },
                  { key: "academico", label: "Academico" },
                  { key: "competitivo", label: "Competitivo" },
                  { key: "comprometimento", label: "Comprometimento" },
                  { key: "video", label: "Video" },
                ]}
                pesos={pesos}
                faixas={faixas}
                faixaFields={[
                  { key: "hot", label: "Hot >=" },
                  { key: "warm", label: "Warm >=" },
                ]}
                onPesoChange={(k, v) => updateLocalConfig(PESOS_KEY, { ...pesos, [k]: v })}
                onFaixaChange={(k, v) => updateLocalConfig(FAIXAS_KEY, { ...faixas, [k]: v })}
              />
              <div className="flex justify-end">
                <SaveBtn onClick={() => { saveConfig(PESOS_KEY, configs[PESOS_KEY]); saveConfig(FAIXAS_KEY, configs[FAIXAS_KEY]); }} isPending={isPending} />
              </div>
            </>
          );
        })()}

        {/* ===== MATCH ===== */}
        {activeTab === "match" && (() => {
          const PESOS_KEY = "match_pesos";
          const FAIXAS_KEY = "match_faixas";
          const pesos = getConfigObj(PESOS_KEY, { financeiro: 30, academico: 25, esportivo: 25, serie: 10, historico_bausa: 10 }) as Record<string, number>;
          const faixas = getConfigObj(FAIXAS_KEY, { excelente: 85, forte: 70, possivel: 50 }) as Record<string, number>;

          return (
            <>
              <WeightedCriteriaSection
                title="Pesos dos Criterios de Match"
                criteria={[
                  { key: "financeiro", label: "Financeiro" },
                  { key: "academico", label: "Academico" },
                  { key: "esportivo", label: "Esportivo" },
                  { key: "serie", label: "Serie" },
                  { key: "historico_bausa", label: "Historico BAUSA" },
                ]}
                pesos={pesos}
                faixas={faixas}
                faixaFields={[
                  { key: "excelente", label: "Excelente >=" },
                  { key: "forte", label: "Forte >=" },
                  { key: "possivel", label: "Possivel >=" },
                ]}
                onPesoChange={(k, v) => updateLocalConfig(PESOS_KEY, { ...pesos, [k]: v })}
                onFaixaChange={(k, v) => updateLocalConfig(FAIXAS_KEY, { ...faixas, [k]: v })}
              />
              <div className="flex justify-end">
                <SaveBtn onClick={() => { saveConfig(PESOS_KEY, configs[PESOS_KEY]); saveConfig(FAIXAS_KEY, configs[FAIXAS_KEY]); }} isPending={isPending} />
              </div>
            </>
          );
        })()}

        {/* ===== METAS ===== */}
        {activeTab === "metas" && (() => {
          const KEY = "metas_config";
          const metas = getConfigObj(KEY, { meta_anual: 1000000, meta_mensal: 83333, ticket_medio_alvo: 25000, contratos_mes_alvo: 4, pipeline_health_ratio: 3 }) as Record<string, number>;
          const update = (campo: string, valor: number) => updateLocalConfig(KEY, { ...metas, [campo]: valor });

          return (
            <div className="space-y-5">
              <Card>
                <h3 className="text-sm font-semibold text-foreground mb-4">Metas Comerciais</h3>
                <div className="grid grid-cols-2 gap-4">
                  <NumberField label="Meta Anual" value={Number(metas.meta_anual ?? 0)} onChange={(v) => update("meta_anual", v)} unit="R$" />
                  <NumberField label="Meta Mensal" value={Number(metas.meta_mensal ?? 0)} onChange={(v) => update("meta_mensal", v)} unit="R$" />
                  <NumberField label="Ticket Medio Alvo" value={Number(metas.ticket_medio_alvo ?? 0)} onChange={(v) => update("ticket_medio_alvo", v)} unit="R$" />
                  <NumberField label="Contratos/Mes Alvo" value={Number(metas.contratos_mes_alvo ?? 0)} onChange={(v) => update("contratos_mes_alvo", v)} />
                  <NumberField label="Pipeline Health Ratio" value={Number(metas.pipeline_health_ratio ?? 3)} onChange={(v) => update("pipeline_health_ratio", v)} step={0.1} />
                </div>
              </Card>
              <div className="flex justify-end">
                <SaveBtn onClick={() => saveConfig(KEY, configs[KEY])} isPending={isPending} />
              </div>
            </div>
          );
        })()}

        {/* ===== TIMERS ===== */}
        {activeTab === "timers" && (() => {
          const KEY = "timers_config";
          const timers = getConfigObj(KEY, {
            convite_inicial_delay: 22, followup_1: 48, followup_2: 168,
            horario_seguro_inicio: 8, horario_seguro_fim: 21,
            alinhamento_sem_avanco: 72, proposta_sem_followup: 48,
            negociacao_parada: 96, contrato_sem_assinatura: 48,
            contrato_sem_sinal: 48, nf_pendente_apos_entrada: 72,
          }) as Record<string, number>;
          const update = (campo: string, valor: number) => updateLocalConfig(KEY, { ...timers, [campo]: valor });

          const fields = [
            { key: "convite_inicial_delay", label: "Convite Inicial Delay", unit: "horas" },
            { key: "followup_1", label: "Follow-up 1", unit: "horas" },
            { key: "followup_2", label: "Follow-up 2", unit: "horas" },
            { key: "horario_seguro_inicio", label: "Horario Seguro Inicio", unit: "h (0-23)" },
            { key: "horario_seguro_fim", label: "Horario Seguro Fim", unit: "h (0-23)" },
            { key: "alinhamento_sem_avanco", label: "Alinhamento sem Avanco", unit: "horas" },
            { key: "proposta_sem_followup", label: "Proposta sem Follow-up", unit: "horas" },
            { key: "negociacao_parada", label: "Negociação parada", unit: "horas" },
            { key: "contrato_sem_assinatura", label: "Contrato sem Assinatura", unit: "horas" },
            { key: "contrato_sem_sinal", label: "Contrato sem Sinal", unit: "horas" },
            { key: "nf_pendente_apos_entrada", label: "NF Pendente apos Entrada", unit: "horas" },
          ];

          return (
            <div className="space-y-5">
              <Card>
                <h3 className="text-sm font-semibold text-foreground mb-4">Timers de Comunicacao</h3>
                <div className="grid grid-cols-2 gap-4">
                  {fields.map(({ key, label, unit }) => (
                    <NumberField key={key} label={label} value={Number(timers[key] ?? 0)} onChange={(v) => update(key, v)} unit={unit} min={0} />
                  ))}
                </div>
              </Card>
              <div className="flex justify-end">
                <SaveBtn onClick={() => saveConfig(KEY, configs[KEY])} isPending={isPending} />
              </div>
            </div>
          );
        })()}

        {/* ===== EXPERIENCIA ===== */}
        {activeTab === "experiencia" && (() => {
          const EXP_KEY = "experiencia_config";
          const TEMP_KEY = "temperatura_config";
          const expConfig = getConfigObj(EXP_KEY, { admissao: 7, pre_embarque: 15, embarcado_inicial: 7, acompanhamento: 30 }) as Record<string, number>;
          const tempConfig = getConfigObj(TEMP_KEY, { ansiedade_threshold: 7, satisfacao_threshold: 4 }) as Record<string, number>;

          const FASES = [
            { key: "admissao", label: "Admissao", def: 7 },
            { key: "aprovado", label: "Aprovado", def: 7 },
            { key: "pre_embarque", label: "Pre-embarque", def: 15 },
            { key: "embarcado_inicial", label: "Embarcado", def: 7 },
            { key: "acompanhamento", label: "Acompanhamento", def: 30 },
            { key: "encerrado", label: "Encerrado", def: 90 },
          ];

          return (
            <div className="space-y-5">
              <Card>
                <h3 className="text-sm font-semibold text-foreground mb-4">Inatividade por Fase (dias)</h3>
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-secondary/50">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Fase</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Dias</th>
                      </tr>
                    </thead>
                    <tbody>
                      {FASES.map(({ key, label, def }) => (
                        <tr key={key} className="border-b border-border last:border-0">
                          <td className="px-4 py-2.5 text-sm text-foreground/80">{label}</td>
                          <td className="px-4 py-2.5">
                            <Input type="number" min={1} value={Number(expConfig[key] ?? def)} onChange={(e) => updateLocalConfig(EXP_KEY, { ...expConfig, [key]: Number(e.target.value) })} className="w-24" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold text-foreground mb-4">Thresholds de Temperatura</h3>
                <div className="grid grid-cols-2 gap-4">
                  <NumberField label="Ansiedade (alerta se >=)" value={Number(tempConfig.ansiedade_threshold ?? 7)} onChange={(v) => updateLocalConfig(TEMP_KEY, { ...tempConfig, ansiedade_threshold: v })} min={1} max={10} />
                  <NumberField label="Satisfacao (alerta se <=)" value={Number(tempConfig.satisfacao_threshold ?? 4)} onChange={(v) => updateLocalConfig(TEMP_KEY, { ...tempConfig, satisfacao_threshold: v })} min={1} max={10} />
                </div>
              </Card>

              <div className="flex justify-end">
                <SaveBtn onClick={() => { saveConfig(EXP_KEY, configs[EXP_KEY]); saveConfig(TEMP_KEY, configs[TEMP_KEY]); }} isPending={isPending} />
              </div>
            </div>
          );
        })()}

        {/* ===== COBRANCA ===== */}
        {activeTab === "cobranca" && (() => {
          const KEY = "cobranca_config";
          const cobranca = getConfigObj(KEY, {
            d_minus_3: { canal: "whatsapp", ativo: true },
            d_0: { canal: "whatsapp", ativo: true },
            d_plus_1: { canal: "whatsapp", ativo: true },
            d_plus_3: { canal: "ambos", ativo: true },
            d_plus_7: { canal: "ambos", ativo: true },
            d_plus_15: { canal: "ambos", ativo: true },
          }) as Record<string, Record<string, unknown>>;

          const STAGES = [
            { key: "d_minus_3", label: "D-3 (Lembrete antes)" },
            { key: "d_0", label: "D0 (Dia do vencimento)" },
            { key: "d_plus_1", label: "D+1" },
            { key: "d_plus_3", label: "D+3" },
            { key: "d_plus_7", label: "D+7" },
            { key: "d_plus_15", label: "D+15" },
          ];

          const CANAL_OPTS = [
            { value: "whatsapp", label: "WhatsApp" },
            { value: "email", label: "Email" },
            { value: "ambos", label: "Ambos" },
          ];

          const updateStage = (stageKey: string, campo: string, valor: unknown) => {
            updateLocalConfig(KEY, { ...cobranca, [stageKey]: { ...cobranca[stageKey], [campo]: valor } });
          };

          return (
            <div className="space-y-5">
              <Card>
                <h3 className="text-sm font-semibold text-foreground mb-4">Regras de Cobranca</h3>
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-secondary/50">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Estagio</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Canal</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Ativo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {STAGES.map(({ key, label }) => {
                        const stage = cobranca[key] ?? { canal: "whatsapp", ativo: true };
                        return (
                          <tr key={key} className="border-b border-border last:border-0">
                            <td className="px-4 py-2.5 text-sm text-foreground/80">{label}</td>
                            <td className="px-4 py-2.5">
                              <select value={String(stage.canal ?? "whatsapp")} onChange={(e) => updateStage(key, "canal", e.target.value)} className={cn(selectClass, "w-36")}>
                                {CANAL_OPTS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                              </select>
                            </td>
                            <td className="px-4 py-2.5">
                              <ToggleSwitch value={Boolean(stage.ativo)} onChange={(v) => updateStage(key, "ativo", v)} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
              <div className="flex justify-end">
                <SaveBtn onClick={() => saveConfig(KEY, configs[KEY])} isPending={isPending} />
              </div>

              {/* Editor das mensagens da régua (texto usado pela CF billing-reminders) */}
              {(() => {
                const MSG_KEY = "regua_mensagens";
                const msgs = getConfigObj(MSG_KEY, {}) as Record<string, Record<string, unknown>>;
                const MARCOS = [
                  { key: "dneg3", label: "D-3 · Lembrete amigável", whatsapp: true, email: false },
                  { key: "d0", label: "D0 · Dia do vencimento", whatsapp: true, email: true },
                  { key: "d1", label: "D+1 · Atraso", whatsapp: true, email: false },
                  { key: "d3", label: "D+3 · Notificação formal", whatsapp: false, email: true },
                  { key: "d7", label: "D+7 · Pendência (avisa o CEO)", whatsapp: true, email: true },
                  { key: "d15", label: "D+15 · Crítico (avisa o CEO)", whatsapp: false, email: true },
                ];
                const updateMsg = (marco: string, campo: string, valor: string) => {
                  updateLocalConfig(MSG_KEY, { ...msgs, [marco]: { ...(msgs[marco] ?? {}), [campo]: valor } });
                };
                const taClass = cn(selectClass, "min-h-20 w-full resize-y leading-relaxed");
                return (
                  <>
                    <Card>
                      <h3 className="mb-1 text-sm font-semibold text-foreground">Mensagens da régua</h3>
                      <p className="mb-4 text-xs text-muted-foreground">
                        Texto enviado às famílias em cada marco. Variáveis:{" "}
                        {["{responsavel_nome}", "{atleta_nome}", "{valor}", "{vencimento}", "{numero_parcela}"].map((v) => (
                          <code key={v} className="mr-1.5 rounded bg-secondary px-1 py-0.5 font-mono text-[11px] text-foreground">{v}</code>
                        ))}
                      </p>
                      <div className="space-y-5">
                        {MARCOS.map((m) => {
                          const cur = msgs[m.key] ?? {};
                          return (
                            <div key={m.key} className="rounded-lg border border-border p-3.5">
                              <p className="mb-2.5 text-xs font-semibold text-foreground">{m.label}</p>
                              <div className="space-y-2.5">
                                {m.whatsapp && (
                                  <div>
                                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-label-tertiary">WhatsApp</label>
                                    <textarea className={taClass} value={String(cur.whatsapp ?? "")} onChange={(e) => updateMsg(m.key, "whatsapp", e.target.value)} />
                                  </div>
                                )}
                                {m.email && (
                                  <>
                                    <div>
                                      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-label-tertiary">E-mail — assunto</label>
                                      <Input value={String(cur.email_assunto ?? "")} onChange={(e) => updateMsg(m.key, "email_assunto", e.target.value)} />
                                    </div>
                                    <div>
                                      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-label-tertiary">E-mail — corpo</label>
                                      <textarea className={taClass} value={String(cur.email ?? "")} onChange={(e) => updateMsg(m.key, "email", e.target.value)} />
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                    <div className="flex justify-end">
                      <SaveBtn onClick={() => saveConfig(MSG_KEY, configs[MSG_KEY])} isPending={isPending} />
                    </div>
                  </>
                );
              })()}
            </div>
          );
        })()}

        {/* ===== USUARIOS ===== */}
        {activeTab === "usuarios" && <UsuariosTab />}

        {/* ===== PIPELINE ===== */}
        {activeTab === "pipeline" && (
          <div className="space-y-4">
            <Card accent="orange" padding="sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-sys-orange" />
                <p className="text-sm font-semibold text-sys-orange">Somente leitura</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Estagios do pipeline sao definidos no codigo. Para alterar, contate o desenvolvedor.
              </p>
            </Card>

            <Card>
              <h3 className="text-sm font-semibold text-foreground mb-4">
                Estagios do Pipeline ({PIPELINE_STAGE_ORDER.length})
              </h3>
              <div className="space-y-1.5">
                {PIPELINE_STAGE_ORDER.map((stageId, idx) => {
                  const stage = DEAL_STAGE_CONFIG[stageId];
                  return (
                    <div
                      key={stageId}
                      className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-2.5"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-muted-foreground">
                        {idx + 1}
                      </span>
                      <span className={cn("h-2.5 w-2.5 rounded-full flex-shrink-0", stage.dotColor)} />
                      <span className="flex-1 text-sm text-foreground">{stage.label}</span>
                      {stage.isFinancial && (
                        <span className="rounded-full bg-sys-green/15 border border-sys-green/20 px-2 py-0.5 text-[9px] font-semibold text-sys-green">
                          Financeiro
                        </span>
                      )}
                      {stage.isLost && (
                        <span className="rounded-full bg-sys-red/15 border border-sys-red/20 px-2 py-0.5 text-[9px] font-semibold text-sys-red">
                          Perda
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {/* ===== NOTIFICACOES ===== */}
        {activeTab === "notificacoes" && (
          <div className="space-y-4">
            <Card className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Bell className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Configuracoes de Notificacao</p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">Espelhar todas notificacoes ao CEO</p>
                  <p className="text-[10px] text-label-tertiary">Chave: espelhar_notificacoes_ceo</p>
                </div>
                <ToggleSwitch
                  value={Boolean(configs["espelhar_notificacoes_ceo"])}
                  onChange={(next) => {
                    startTransition(async () => {
                      const result = await atualizarConfiguracao("espelhar_notificacoes_ceo", next);
                      if (result.success) {
                        setConfigs((prev) => ({ ...prev, espelhar_notificacoes_ceo: next }));
                        toast.success("Configuracao atualizada");
                      } else {
                        toast.error(result.error ?? "Erro ao atualizar");
                      }
                    });
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <label className={labelClass}>Horario do digest diario</label>
                <p className="text-[10px] text-label-tertiary">Chave: digest_horario</p>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="time"
                    value={String(configs["digest_horario"] ?? "09:00")}
                    onChange={(e) => updateLocalConfig("digest_horario", e.target.value)}
                    className="w-auto"
                  />
                  <SaveBtn onClick={() => saveConfig("digest_horario", configs["digest_horario"])} isPending={isPending} />
                </div>
              </div>

              <div className="space-y-2">
                <p className={labelClass}>Canais de notificacao</p>
                {["WhatsApp", "Email", "In-app"].map((canal) => {
                  const canais = ((typeof configs["canais_notificacao"] === "object" && configs["canais_notificacao"] !== null) ? configs["canais_notificacao"] : {}) as Record<string, boolean>;
                  const key = canal.toLowerCase().replace("-", "_");
                  const isEnabled = canais[key] ?? true;
                  return (
                    <div key={canal} className="flex items-center justify-between">
                      <span className="text-sm text-foreground">{canal}</span>
                      <ToggleSwitch
                        value={isEnabled}
                        onChange={() => {
                          const updated = { ...canais, [key]: !isEnabled };
                          startTransition(async () => {
                            const result = await atualizarConfiguracao("canais_notificacao", updated);
                            if (result.success) {
                              setConfigs((prev) => ({ ...prev, canais_notificacao: updated }));
                              toast.success(`Canal ${canal} ${!isEnabled ? "ativado" : "desativado"}`);
                            } else {
                              toast.error(result.error ?? "Erro ao atualizar");
                            }
                          });
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}

        {/* ===== LISTAS ===== */}
        {activeTab === "listas" && (
          <div className="space-y-4">
            <Card accent="orange" padding="sm">
              <div className="flex items-center gap-2">
                <List className="h-4 w-4 text-sys-orange" />
                <p className="text-sm font-semibold text-sys-orange">Listas somente leitura</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Para alterar estas listas, contate o desenvolvedor.</p>
            </Card>

            {[
              { title: "Esportes (posicoes)", items: ["Goleiro", "Zagueiro", "Lateral Direito", "Lateral Esquerdo", "Volante", "Meio-campo", "Meia Atacante", "Ponta Direita", "Ponta Esquerda", "Atacante Centro"] },
              { title: "Series escolares", items: ["7th Grade", "8th Grade", "9th Grade", "10th Grade", "11th Grade", "12th Grade"] },
              { title: "Niveis de ingles", items: ["Basico", "Basico-Intermediario", "Intermediario", "Avancado", "Fluente"] },
              { title: "Motivos de perda", items: ["Financeiro", "Timing", "Desistencia da familia", "Atleta nao qualificado", "Concorrencia", "Outro"] },
              { title: "Tipos de documento", items: DOCUMENTO_TIPOS.map((d) => d.label) },
              { title: "Categorias FAQ", items: FAQ_CATEGORIAS.map((c) => c.label) },
            ].map((lista) => (
              <Card key={lista.title}>
                <p className="text-sm font-semibold text-foreground mb-2">{lista.title}</p>
                <div className="flex flex-wrap gap-1.5">
                  {lista.items.map((item) => (
                    <span key={item} className="rounded-md border border-border bg-secondary/40 px-2 py-1 text-xs text-muted-foreground">{item}</span>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
