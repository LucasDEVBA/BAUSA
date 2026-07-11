"use client";

import { useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  Star,
  Trash2,
  Video,
  X,
} from "lucide-react";
import {
  atualizarEtapaTemplate,
  atualizarTemplateOnboarding,
  criarEtapaTemplate,
  criarTemplateOnboarding,
  definirTemplateDefault,
  excluirTemplateOnboarding,
  listarTemplatesAdmin,
  removerEtapaTemplate,
  reordenarEtapasTemplate,
  type EtapaInput,
  type TemplateAdmin,
  type TemplateEtapaAdmin,
} from "@/lib/actions/onboarding-admin";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TemplatesAdminProps {
  templatesIniciais: TemplateAdmin[];
}

export function TemplatesAdmin({ templatesIniciais }: TemplatesAdminProps) {
  const [templates, setTemplates] = useState<TemplateAdmin[]>(templatesIniciais);
  const [expandido, setExpandido] = useState<string | null>(
    templatesIniciais.find((t) => t.is_default)?.id ?? null,
  );
  const [showNovoTemplate, setShowNovoTemplate] = useState(false);
  const [isPending, startTransition] = useTransition();

  const reload = async () => {
    const data = await listarTemplatesAdmin();
    setTemplates(data);
  };

  const run = (fn: () => Promise<{ success: boolean; error?: string }>, ok: string) => {
    startTransition(async () => {
      const result = await fn();
      if (result.success) {
        toast.success(ok);
        await reload();
      } else {
        toast.error(result.error ?? "Falha");
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Modelos de onboarding
          </p>
          <p className="text-[11px] text-muted-foreground">
            Defina as etapas, prazos, checklists e exigências que a Head segue
            com cada família. Alterações valem para <strong>novos</strong>{" "}
            onboardings — famílias em andamento mantêm o roteiro original.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNovoTemplate((v) => !v)}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90"
        >
          <Plus className="h-3 w-3" />
          Novo modelo
        </button>
      </div>

      {showNovoTemplate && (
        <NovoTemplateForm
          onSaved={() => {
            setShowNovoTemplate(false);
            void reload();
          }}
          onCancel={() => setShowNovoTemplate(false)}
        />
      )}

      {templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-10 text-center">
          <ListChecks className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhum modelo cadastrado.
          </p>
        </div>
      ) : (
        templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            expandido={expandido === template.id}
            onToggle={() =>
              setExpandido(expandido === template.id ? null : template.id)
            }
            isPending={isPending}
            onDefinirDefault={() =>
              run(
                () => definirTemplateDefault(template.id),
                "Modelo padrão atualizado",
              )
            }
            onToggleAtivo={() =>
              run(
                () =>
                  atualizarTemplateOnboarding(template.id, {
                    ativo: !template.ativo,
                  }),
                template.ativo ? "Modelo desativado" : "Modelo ativado",
              )
            }
            onExcluir={() => {
              if (
                !window.confirm(
                  `Excluir o modelo "${template.nome}"? Onboardings já criados não são afetados.`,
                )
              )
                return;
              run(
                () => excluirTemplateOnboarding(template.id),
                "Modelo excluído",
              );
            }}
            onReload={reload}
          />
        ))
      )}
    </div>
  );
}

// ─── Card de template ────────────────────────────────────────
function TemplateCard({
  template,
  expandido,
  onToggle,
  isPending,
  onDefinirDefault,
  onToggleAtivo,
  onExcluir,
  onReload,
}: {
  template: TemplateAdmin;
  expandido: boolean;
  onToggle: () => void;
  isPending: boolean;
  onDefinirDefault: () => void;
  onToggleAtivo: () => void;
  onExcluir: () => void;
  onReload: () => Promise<void>;
}) {
  const [editandoNome, setEditandoNome] = useState(false);
  const [nome, setNome] = useState(template.nome);
  const [descricao, setDescricao] = useState(template.descricao ?? "");
  const [showNovaEtapa, setShowNovaEtapa] = useState(false);
  const [editandoEtapaId, setEditandoEtapaId] = useState<string | null>(null);
  const [savingMeta, startMetaTransition] = useTransition();

  const salvarMeta = () => {
    startMetaTransition(async () => {
      const result = await atualizarTemplateOnboarding(template.id, {
        nome,
        descricao,
      });
      if (result.success) {
        toast.success("Modelo atualizado");
        setEditandoNome(false);
        await onReload();
      } else {
        toast.error(result.error ?? "Falha");
      }
    });
  };

  const mover = (etapa: TemplateEtapaAdmin, dir: -1 | 1) => {
    const ids = template.etapas.map((e) => e.id);
    const idx = ids.indexOf(etapa.id);
    const alvo = idx + dir;
    if (alvo < 0 || alvo >= ids.length) return;
    [ids[idx], ids[alvo]] = [ids[alvo], ids[idx]];
    startMetaTransition(async () => {
      const result = await reordenarEtapasTemplate(template.id, ids);
      if (result.success) {
        await onReload();
      } else {
        toast.error(result.error ?? "Falha ao reordenar");
      }
    });
  };

  return (
    <div
      className={cn(
        "rounded-xl border bg-card",
        template.is_default ? "border-primary/40" : "border-border",
        !template.ativo && "opacity-70",
      )}
    >
      {/* Cabeçalho */}
      <div className="flex items-start gap-2 p-4">
        <button
          type="button"
          onClick={onToggle}
          className="mt-0.5 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={expandido ? "Recolher modelo" : "Expandir modelo"}
        >
          {expandido ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        <div className="min-w-0 flex-1">
          {editandoNome ? (
            <div className="space-y-2">
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-sm font-semibold text-foreground outline-none focus:border-primary/40"
              />
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={2}
                placeholder="Descrição do modelo (opcional)"
                className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={salvarMeta}
                  disabled={savingMeta}
                  className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {savingMeta && <Loader2 className="h-3 w-3 animate-spin" />}
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditandoNome(false);
                    setNome(template.nome);
                    setDescricao(template.descricao ?? "");
                  }}
                  className="rounded-md border border-border px-2.5 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-accent"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">
                  {template.nome}
                </p>
                {template.is_default && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-[9px] font-bold uppercase text-primary">
                    <Star className="h-2.5 w-2.5" />
                    Padrão
                  </span>
                )}
                {!template.ativo && (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">
                    Inativo
                  </span>
                )}
              </div>
              {template.descricao && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {template.descricao}
                </p>
              )}
              <p className="mt-1 text-[10px] text-muted-foreground">
                {template.etapas.length}{" "}
                {template.etapas.length === 1 ? "etapa" : "etapas"} ·{" "}
                {template.instancias_count}{" "}
                {template.instancias_count === 1
                  ? "família usa"
                  : "famílias usam"}{" "}
                este modelo
              </p>
            </>
          )}
        </div>
        {!editandoNome && (
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setEditandoNome(true)}
              className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              title="Renomear / descrição"
            >
              <Pencil className="h-3 w-3" />
            </button>
            {!template.is_default && (
              <button
                type="button"
                onClick={onDefinirDefault}
                disabled={isPending || !template.ativo}
                className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/20 disabled:opacity-50"
              >
                Tornar padrão
              </button>
            )}
            {!template.is_default && (
              <>
                <button
                  type="button"
                  onClick={onToggleAtivo}
                  disabled={isPending}
                  className="rounded-md border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-accent disabled:opacity-50"
                >
                  {template.ativo ? "Desativar" : "Ativar"}
                </button>
                <button
                  type="button"
                  onClick={onExcluir}
                  disabled={isPending}
                  className="rounded-md border border-sys-red/30 p-1.5 text-sys-red hover:bg-sys-red/10 disabled:opacity-50"
                  title="Excluir modelo"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Etapas */}
      {expandido && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-2">
          {template.etapas.length === 0 && (
            <p className="py-2 text-center text-xs text-muted-foreground">
              Nenhuma etapa ainda — adicione a primeira abaixo.
            </p>
          )}
          {template.etapas.map((etapa, idx) =>
            editandoEtapaId === etapa.id ? (
              <EtapaForm
                key={etapa.id}
                inicial={etapa}
                onSubmit={async (dados) => {
                  const result = await atualizarEtapaTemplate(etapa.id, dados);
                  if (result.success) {
                    toast.success("Etapa atualizada");
                    setEditandoEtapaId(null);
                    await onReload();
                  } else {
                    toast.error(result.error ?? "Falha");
                  }
                }}
                onCancel={() => setEditandoEtapaId(null)}
              />
            ) : (
              <div
                key={etapa.id}
                className="flex items-start gap-2.5 rounded-lg border border-border bg-secondary/20 p-3"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[10px] font-bold text-primary">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground">
                    {etapa.titulo}
                  </p>
                  {etapa.descricao && (
                    <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                      {etapa.descricao}
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[9px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {etapa.prazo_dias}{" "}
                      {etapa.prazo_dias === 1 ? "dia" : "dias"}
                    </span>
                    {etapa.checklist.length > 0 && (
                      <span className="flex items-center gap-1 rounded bg-sys-green/12 px-1.5 py-0.5 font-semibold text-sys-green">
                        <ListChecks className="h-2.5 w-2.5" />
                        {etapa.checklist.length} itens
                      </span>
                    )}
                    {etapa.requer_reuniao && (
                      <span className="flex items-center gap-1 rounded bg-sys-blue/12 px-1.5 py-0.5 font-semibold text-sys-blue">
                        <Video className="h-2.5 w-2.5" />
                        Reunião
                      </span>
                    )}
                    {etapa.requer_documentos && (
                      <span className="flex items-center gap-1 rounded bg-sys-purple/12 px-1.5 py-0.5 font-semibold text-sys-purple">
                        <FileText className="h-2.5 w-2.5" />
                        Documentos
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => mover(etapa, -1)}
                    disabled={idx === 0 || savingMeta}
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                    aria-label="Mover para cima"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => mover(etapa, 1)}
                    disabled={idx === template.etapas.length - 1 || savingMeta}
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
                    aria-label="Mover para baixo"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditandoEtapaId(etapa.id)}
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label="Editar etapa"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!window.confirm(`Excluir a etapa "${etapa.titulo}"?`))
                        return;
                      void (async () => {
                        const result = await removerEtapaTemplate(etapa.id);
                        if (result.success) {
                          toast.success("Etapa excluída");
                          await onReload();
                        } else {
                          toast.error(result.error ?? "Falha");
                        }
                      })();
                    }}
                    className="rounded p-1 text-sys-red/70 hover:bg-sys-red/10 hover:text-sys-red"
                    aria-label="Excluir etapa"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ),
          )}

          {showNovaEtapa ? (
            <EtapaForm
              onSubmit={async (dados) => {
                const result = await criarEtapaTemplate(template.id, dados);
                if (result.success) {
                  toast.success("Etapa adicionada");
                  setShowNovaEtapa(false);
                  await onReload();
                } else {
                  toast.error(result.error ?? "Falha");
                }
              }}
              onCancel={() => setShowNovaEtapa(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowNovaEtapa(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-[11px] font-semibold text-muted-foreground hover:border-primary/40 hover:text-primary"
            >
              <Plus className="h-3 w-3" />
              Adicionar etapa
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Form de novo template ───────────────────────────────────
function NovoTemplateForm({
  onSaved,
  onCancel,
}: {
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    if (!nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    startTransition(async () => {
      const result = await criarTemplateOnboarding({ nome, descricao });
      if (result.success) {
        toast.success("Modelo criado — adicione as etapas");
        onSaved();
      } else {
        toast.error(result.error ?? "Falha");
      }
    });
  };

  return (
    <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
          Novo modelo
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          aria-label="Cancelar"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <input
        type="text"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Nome do modelo (ex: Onboarding intensivo 15 dias) *"
        className="w-full rounded-md border border-border bg-card px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40"
      />
      <textarea
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        rows={2}
        placeholder="Descrição (opcional)"
        className="w-full rounded-md border border-border bg-card px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40"
      />
      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        className="flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
        Criar modelo
      </button>
    </div>
  );
}

// ─── Form de etapa (criar/editar) ────────────────────────────
function EtapaForm({
  inicial,
  onSubmit,
  onCancel,
}: {
  inicial?: TemplateEtapaAdmin;
  onSubmit: (dados: EtapaInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [prazoDias, setPrazoDias] = useState(inicial?.prazo_dias ?? 7);
  const [requerReuniao, setRequerReuniao] = useState(
    inicial?.requer_reuniao ?? false,
  );
  const [requerAssuntos, setRequerAssuntos] = useState(
    inicial?.requer_assuntos ?? false,
  );
  const [requerDocumentos, setRequerDocumentos] = useState(
    inicial?.requer_documentos ?? false,
  );
  const [checklist, setChecklist] = useState<string[]>(
    inicial?.checklist ?? [],
  );
  const [novoItem, setNovoItem] = useState("");
  const [isPending, startTransition] = useTransition();

  const addItem = () => {
    const item = novoItem.trim();
    if (!item) return;
    if (checklist.length >= 20) {
      toast.error("Máximo de 20 itens no checklist");
      return;
    }
    setChecklist((prev) => [...prev, item]);
    setNovoItem("");
  };

  const submit = () => {
    if (!titulo.trim()) {
      toast.error("Título é obrigatório");
      return;
    }
    startTransition(async () => {
      await onSubmit({
        titulo: titulo.trim(),
        descricao: descricao.trim() || undefined,
        prazo_dias: prazoDias,
        requer_reuniao: requerReuniao,
        requer_assuntos: requerAssuntos,
        requer_documentos: requerDocumentos,
        checklist,
      });
    });
  };

  return (
    <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
          {inicial ? "Editar etapa" : "Nova etapa"}
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          aria-label="Cancelar"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px]">
        <div>
          <label className="mb-1 block text-[10px] text-muted-foreground">
            Título *
          </label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex: Realizar call de onboarding"
            className="w-full rounded-md border border-border bg-card px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-muted-foreground">
            Prazo (dias) *
          </label>
          <input
            type="number"
            value={prazoDias}
            onChange={(e) => setPrazoDias(Number(e.target.value))}
            min={1}
            max={365}
            className="w-full rounded-md border border-border bg-card px-2.5 py-2 text-xs text-foreground outline-none focus:border-primary/40"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[10px] text-muted-foreground">
          Descrição — o que a Head deve fazer nesta etapa
        </label>
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={2}
          placeholder="Instruções detalhadas para a execução da etapa..."
          className="w-full rounded-md border border-border bg-card px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40"
        />
      </div>

      <div>
        <label className="mb-1 block text-[10px] text-muted-foreground">
          Checklist de sub-itens ({checklist.length}/20)
        </label>
        <div className="mb-1.5 flex gap-1.5">
          <input
            type="text"
            value={novoItem}
            onChange={(e) => setNovoItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addItem();
              }
            }}
            placeholder="Ex: Enviar convite com data, hora e link"
            className="flex-1 rounded-md border border-border bg-card px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40"
          />
          <button
            type="button"
            onClick={addItem}
            className="rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-accent"
          >
            +
          </button>
        </div>
        {checklist.length > 0 && (
          <ul className="space-y-1">
            {checklist.map((item, i) => (
              <li
                key={`${i}-${item}`}
                className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-[11px] text-foreground"
              >
                <CheckCircle2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">{item}</span>
                <button
                  type="button"
                  onClick={() =>
                    setChecklist((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  className="text-muted-foreground hover:text-sys-red"
                  aria-label={`Remover item ${item}`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-[9px] text-muted-foreground">
          A Head só consegue concluir a etapa com todos os itens marcados.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="flex items-center gap-1.5 text-[11px] text-foreground">
          <input
            type="checkbox"
            checked={requerReuniao}
            onChange={(e) => setRequerReuniao(e.target.checked)}
            className="h-3.5 w-3.5 accent-[color:var(--primary)]"
          />
          Exige reunião vinculada
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-foreground">
          <input
            type="checkbox"
            checked={requerAssuntos}
            onChange={(e) => setRequerAssuntos(e.target.checked)}
            className="h-3.5 w-3.5 accent-[color:var(--primary)]"
          />
          Exige pauta registrada
        </label>
        <label className="flex items-center gap-1.5 text-[11px] text-foreground">
          <input
            type="checkbox"
            checked={requerDocumentos}
            onChange={(e) => setRequerDocumentos(e.target.checked)}
            className="h-3.5 w-3.5 accent-[color:var(--primary)]"
          />
          Envolve documentos
        </label>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        className="flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
        {inicial ? "Salvar etapa" : "Adicionar etapa"}
      </button>
    </div>
  );
}
