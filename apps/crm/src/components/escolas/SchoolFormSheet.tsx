"use client";

import { useEffect, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { GraduationCap, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { criarEscola } from "@/lib/actions/escolas";
import type { Escola } from "@/types/crm";
import {
  TIPO_OPTIONS,
  STATUS_OPTIONS,
  INGLES_OPTIONS,
  AGRESSIVIDADE_OPTIONS,
  INFLUENCIA_OPTIONS,
  TEMPERATURA_OPTIONS,
  TESTE_OPTIONS,
  SERIE_OPTIONS,
  US_STATES,
} from "./school-options";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const schema = z.object({
  nome: z.string().trim().min(2, "Mínimo de 2 caracteres."),
  estado_us: z.string().trim().min(2, "Selecione o estado."),
  cidade: z.string().trim().min(2, "Informe a cidade."),
  tipo: z.enum(["boarding", "day", "mista"]),
  status: z.enum(["ativa", "inativa", "em_analise"]),
  website: z.string().trim().optional(),
  budget_minimo_usd: z.number().min(0, "≥ 0").nullable().optional(),
  budget_forte_usd: z.number().min(0, "≥ 0").nullable().optional(),
  agressividade_bolsa: z.enum(["alta", "media", "baixa", "rara"]),
  ingles_minimo: z.enum(["nenhum", "basico", "intermediario", "avancado", "fluente"]),
  gpa_minimo: z.number().min(0, "0 a 4").max(4, "0 a 4").nullable().optional(),
  serie_maxima: z.string().optional(),
  rolling_admission: z.boolean(),
  testes_exigidos: z.array(z.string()),
  influencia_esporte: z.enum(["decisiva", "forte", "moderada", "baixa"]),
  aceita_excecao_elite: z.boolean(),
  esportes_oferecidos: z.string().optional(),
  deadline_fall: z.string().optional(),
  deadline_spring: z.string().optional(),
  admissions_officer_nome: z.string().optional(),
  admissions_officer_email: z
    .string()
    .trim()
    .refine((v) => !v || EMAIL_RE.test(v), "E-mail inválido.")
    .optional(),
  admissions_officer_telefone: z.string().optional(),
  temperatura_relacionamento: z.enum(["forte", "bom", "neutro", "frio"]),
  regra_pratica: z.string().optional(),
  notas_internas: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const DEFAULT_VALUES: FormValues = {
  nome: "",
  estado_us: "",
  cidade: "",
  tipo: "boarding",
  status: "ativa",
  website: "",
  budget_minimo_usd: null,
  budget_forte_usd: null,
  agressividade_bolsa: "media",
  ingles_minimo: "intermediario",
  gpa_minimo: null,
  serie_maxima: "12th",
  rolling_admission: false,
  testes_exigidos: [],
  influencia_esporte: "moderada",
  aceita_excecao_elite: false,
  esportes_oferecidos: "",
  deadline_fall: "",
  deadline_spring: "",
  admissions_officer_nome: "",
  admissions_officer_email: "",
  admissions_officer_telefone: "",
  temperatura_relacionamento: "neutro",
  regra_pratica: "",
  notas_internas: "",
};

const inputClass =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";
const selectClass =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none";
const labelClass = "text-[10px] font-medium text-muted-foreground mb-1 block";

const toNumberOrNull = (value: unknown): number | null => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseCsv = (value?: string): string[] =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

function RequiredMark() {
  return <span className="text-destructive"> *</span>;
}

function FieldError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="mt-1 text-[10px] font-medium text-destructive">
      {message}
    </p>
  ) : null;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

interface SchoolFormSheetProps {
  open: boolean;
  onClose: () => void;
}

export function SchoolFormSheet({ open, onClose }: SchoolFormSheetProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULT_VALUES,
  });

  // Reseta o formulário sempre que o sheet é fechado (estado limpo na próxima abertura).
  useEffect(() => {
    if (!open) reset(DEFAULT_VALUES);
  }, [open, reset]);

  // Fecha no Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const testesSelecionados = watch("testes_exigidos");

  const toggleTeste = (teste: string) => {
    const next = testesSelecionados.includes(teste)
      ? testesSelecionados.filter((item) => item !== teste)
      : [...testesSelecionados, teste];
    setValue("testes_exigidos", next, { shouldDirty: true });
  };

  const onSubmit = (values: FormValues) => {
    if (
      values.budget_minimo_usd != null &&
      values.budget_forte_usd != null &&
      values.budget_forte_usd < values.budget_minimo_usd
    ) {
      setError("budget_forte_usd", { message: "Deve ser ≥ ao mínimo." });
      return;
    }

    startTransition(async () => {
      const payload: Partial<Escola> = {
        nome: values.nome.trim(),
        estado_us: values.estado_us,
        cidade: values.cidade.trim(),
        tipo: values.tipo,
        status: values.status,
        website: values.website?.trim() || null,
        budget_minimo_usd: values.budget_minimo_usd ?? null,
        budget_forte_usd: values.budget_forte_usd ?? null,
        agressividade_bolsa: values.agressividade_bolsa,
        ingles_minimo: values.ingles_minimo,
        gpa_minimo: values.gpa_minimo ?? null,
        serie_maxima: values.serie_maxima?.trim() || "12th",
        rolling_admission: values.rolling_admission,
        testes_exigidos: values.testes_exigidos,
        influencia_esporte: values.influencia_esporte,
        aceita_excecao_elite: values.aceita_excecao_elite,
        esportes_oferecidos: parseCsv(values.esportes_oferecidos),
        deadline_fall: values.deadline_fall?.trim() || null,
        deadline_spring: values.deadline_spring?.trim() || null,
        admissions_officer_nome: values.admissions_officer_nome?.trim() || null,
        admissions_officer_email: values.admissions_officer_email?.trim() || null,
        admissions_officer_telefone: values.admissions_officer_telefone?.trim() || null,
        temperatura_relacionamento: values.temperatura_relacionamento,
        regra_pratica: values.regra_pratica?.trim() || null,
        notas_internas: values.notas_internas?.trim() || null,
      };

      const result = await criarEscola(payload);
      if (result.success) {
        toast.success("Escola cadastrada com sucesso");
        reset(DEFAULT_VALUES);
        onClose();
        router.refresh();
      } else {
        toast.error(result.error ?? "Erro ao cadastrar escola");
      }
    });
  };

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cadastrar nova escola"
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col liquid-glass"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-foreground">Nova escola</h2>
              <p className="text-xs text-muted-foreground">Cadastro manual no banco institucional</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-fill-4 hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Identificação */}
            <Section title="Identificação">
              <div>
                <label className={labelClass}>
                  Nome da escola
                  <RequiredMark />
                </label>
                <input
                  {...register("nome")}
                  className={inputClass}
                  placeholder="Ex: IMG Academy"
                  autoFocus
                  aria-invalid={!!errors.nome}
                />
                <FieldError message={errors.nome?.message} />
              </div>
              <div>
                <label className={labelClass}>Website</label>
                <input
                  {...register("website")}
                  className={inputClass}
                  placeholder="https://escola.edu"
                  inputMode="url"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>
                    Tipo
                    <RequiredMark />
                  </label>
                  <select {...register("tipo")} className={selectClass}>
                    {TIPO_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Status</label>
                  <select {...register("status")} className={selectClass}>
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </Section>

            {/* Localização */}
            <Section title="Localização">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>
                    Cidade
                    <RequiredMark />
                  </label>
                  <input
                    {...register("cidade")}
                    className={inputClass}
                    placeholder="Ex: Bradenton"
                    aria-invalid={!!errors.cidade}
                  />
                  <FieldError message={errors.cidade?.message} />
                </div>
                <div>
                  <label className={labelClass}>
                    Estado (US)
                    <RequiredMark />
                  </label>
                  <select {...register("estado_us")} className={selectClass} aria-invalid={!!errors.estado_us}>
                    <option value="">Selecione…</option>
                    {US_STATES.map((state) => (
                      <option key={state.value} value={state.value}>
                        {state.label}
                      </option>
                    ))}
                  </select>
                  <FieldError message={errors.estado_us?.message} />
                </div>
              </div>
            </Section>

            {/* Regras financeiras */}
            <Section title="Regras Financeiras">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Budget mínimo (USD)</label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    {...register("budget_minimo_usd", { setValueAs: toNumberOrNull })}
                    className={inputClass}
                    placeholder="20000"
                  />
                  <FieldError message={errors.budget_minimo_usd?.message} />
                </div>
                <div>
                  <label className={labelClass}>Budget forte (USD)</label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    {...register("budget_forte_usd", { setValueAs: toNumberOrNull })}
                    className={inputClass}
                    placeholder="35000"
                  />
                  <FieldError message={errors.budget_forte_usd?.message} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Agressividade de bolsa</label>
                <select {...register("agressividade_bolsa")} className={selectClass}>
                  {AGRESSIVIDADE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </Section>

            {/* Regras acadêmicas */}
            <Section title="Regras Acadêmicas">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Inglês mínimo</label>
                  <select {...register("ingles_minimo")} className={selectClass}>
                    {INGLES_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>GPA mínimo (0–4)</label>
                  <input
                    type="number"
                    min={0}
                    max={4}
                    step={0.1}
                    {...register("gpa_minimo", { setValueAs: toNumberOrNull })}
                    className={inputClass}
                    placeholder="2.5"
                  />
                  <FieldError message={errors.gpa_minimo?.message} />
                </div>
                <div>
                  <label className={labelClass}>Série máxima aceita</label>
                  <select {...register("serie_maxima")} className={selectClass}>
                    {SERIE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    {...register("rolling_admission")}
                    className="h-4 w-4 rounded border-input bg-card accent-primary focus:ring-2 focus:ring-primary/30"
                  />
                  <span className="text-xs text-muted-foreground">Rolling admission</span>
                </label>
              </div>
              <div>
                <label className={labelClass}>Testes exigidos</label>
                <div className="flex flex-wrap gap-2">
                  {TESTE_OPTIONS.map((teste) => {
                    const active = testesSelecionados.includes(teste);
                    return (
                      <button
                        key={teste}
                        type="button"
                        onClick={() => toggleTeste(teste)}
                        aria-pressed={active}
                        className={cn(
                          "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                          active
                            ? "border-primary/40 bg-primary/15 text-primary"
                            : "border-border bg-card text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {teste}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Section>

            {/* Regras esportivas */}
            <Section title="Regras Esportivas">
              <div>
                <label className={labelClass}>Influência do esporte na admissão</label>
                <select {...register("influencia_esporte")} className={selectClass}>
                  {INFLUENCIA_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Esportes oferecidos</label>
                <input
                  {...register("esportes_oferecidos")}
                  className={inputClass}
                  placeholder="Futebol, Vôlei, Tênis (separe por vírgula)"
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  {...register("aceita_excecao_elite")}
                  className="h-4 w-4 rounded border-input bg-card accent-primary focus:ring-2 focus:ring-primary/30"
                />
                <span className="text-xs text-muted-foreground">Aceita exceção para atleta de elite</span>
              </label>
            </Section>

            {/* Prazos */}
            <Section title="Prazos">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Deadline Fall</label>
                  <input type="date" {...register("deadline_fall")} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Deadline Spring</label>
                  <input type="date" {...register("deadline_spring")} className={inputClass} />
                </div>
              </div>
            </Section>

            {/* Admissions Officer */}
            <Section title="Admissions Officer">
              <div>
                <label className={labelClass}>Nome</label>
                <input
                  {...register("admissions_officer_nome")}
                  className={inputClass}
                  placeholder="Nome do officer"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>E-mail</label>
                  <input
                    type="email"
                    {...register("admissions_officer_email")}
                    className={inputClass}
                    placeholder="email@school.edu"
                    aria-invalid={!!errors.admissions_officer_email}
                  />
                  <FieldError message={errors.admissions_officer_email?.message} />
                </div>
                <div>
                  <label className={labelClass}>Telefone</label>
                  <input
                    {...register("admissions_officer_telefone")}
                    className={inputClass}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>
            </Section>

            {/* Relacionamento + Notas */}
            <Section title="Relacionamento e Notas">
              <div>
                <label className={labelClass}>Temperatura do relacionamento</label>
                <select {...register("temperatura_relacionamento")} className={selectClass}>
                  {TEMPERATURA_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Regra prática BAUSA</label>
                <textarea
                  {...register("regra_pratica")}
                  rows={2}
                  className={cn(inputClass, "resize-none")}
                  placeholder="Regra prática para esta escola…"
                />
              </div>
              <div>
                <label className={labelClass}>Notas internas</label>
                <textarea
                  {...register("notas_internas")}
                  rows={3}
                  className={cn(inputClass, "resize-none")}
                  placeholder="Observações internas…"
                />
              </div>
            </Section>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 border-t border-border bg-popover px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GraduationCap className="h-3.5 w-3.5" />}
              Criar escola
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
