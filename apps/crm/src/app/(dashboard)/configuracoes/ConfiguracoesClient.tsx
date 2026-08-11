"use client";

import { useState, useTransition, useCallback } from "react";
import { Save, Shield, Bell, List, Database, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { atualizarConfiguracao } from "@/lib/actions/configuracoes";
import { cn } from "@/lib/utils";
import { DOCUMENTO_TIPOS, FAQ_CATEGORIAS } from "@/types/crm";
import { DEAL_STAGE_CONFIG, PIPELINE_STAGE_ORDER } from "@/types/deal";
import { UsuariosTab } from "@/components/configuracoes/UsuariosTab";
import { ParametrosTab } from "@/components/configuracoes/ParametrosTab";
import type { ParametrosSistema } from "@/lib/actions/parametros";
import { PipelinesTab } from "@/components/configuracoes/PipelinesTab";
import { PageHeader, BrandTabs, Card, Input, Button } from "@/components/ui";

const TABS = [
  // "Metas & Valores" substitui as abas Planos/Lead Scoring/Match/Metas/
  // Timers/Experiencia: todas gravavam chaves paralelas que o sistema não lia
  // (e o update sem upsert nem gravava). A nova escreve nas chaves reais.
  { value: "parametros", label: "Metas & Valores" },
  { value: "cobranca", label: "Cobranca" },
  { value: "pipeline", label: "Pipeline" },
  { value: "pipelines", label: "Pipelines" },
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
  /** Metas/valores/parâmetros já tipados e com defaults resolvidos. */
  parametros: ParametrosSistema;
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

export function ConfiguracoesClient({ configsIniciais, parametros }: ConfiguracoesClientProps) {
  const [configs, setConfigs] = useState<Record<string, unknown>>(configsIniciais);
  const [activeTab, setActiveTab] = useState<TabValue>("parametros");
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
        {activeTab === "parametros" && <ParametrosTab inicial={parametros} />}

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

        {/* ===== PIPELINES (fases da família + etapas do comercial) ===== */}
        {activeTab === "pipelines" && (
          <PipelinesTab
            fasesConfigRaw={configs["fases_familia_config"]}
            inatividadeRaw={configs["inatividade_por_fase"]}
            etapasDealRaw={configs["etapas_deal_config"]}
            probabilidadeRaw={configs["probabilidade_por_etapa"]}
            onSaved={(fases, inatividade) => {
              setConfigs((prev) => ({
                ...prev,
                fases_familia_config: fases,
                inatividade_por_fase: inatividade,
              }));
            }}
            onSavedEtapasDeal={(etapas, probabilidade) => {
              setConfigs((prev) => ({
                ...prev,
                etapas_deal_config: etapas,
                probabilidade_por_etapa: probabilidade,
              }));
            }}
          />
        )}

        {/* ===== PIPELINE ===== */}
        {activeTab === "pipeline" && (
          <div className="space-y-4">
            <Card accent="orange" padding="sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-sys-orange" />
                <p className="text-sm font-semibold text-sys-orange">Somente leitura</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Os estagios (valores internos) sao definidos no codigo. A apresentacao
                (rotulo, cor, ordem, ocultar coluna e probabilidade) e editavel na aba Pipelines.
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
