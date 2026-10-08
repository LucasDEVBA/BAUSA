"use client";

import { useId, type ReactNode } from "react";
import type { FieldErrors, UseFormRegister, UseFormSetValue, UseFormWatch } from "react-hook-form";

import { cn } from "@/lib/utils";
import type { EscolaFormValues } from "@/lib/escolas/formulario";

import {
  AGRESSIVIDADE_OPTIONS,
  INFLUENCIA_OPTIONS,
  INGLES_OPTIONS,
  PERFIL_OPTIONS,
  SERIE_OPTIONS,
  STATUS_OPTIONS,
  TEMPERATURA_OPTIONS,
  TESTE_VALUES,
  TIPO_OPTIONS,
  US_STATES,
  type SelectOption,
} from "./school-options";

/**
 * Campos do formulário de escola — COMPARTILHADO entre criação
 * (SchoolFormSheet) e edição (SchoolEditForm): mesmos rótulos e mesmas opções
 * (fonte única: school-options.ts). Nada de listas locais de enum.
 */

const inputClass =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 aria-[invalid=true]:border-destructive";
const selectClass = cn(inputClass, "appearance-none");
const labelClass = "mb-1 block text-[10px] font-medium text-muted-foreground";
const ajudaClass = "mt-1 text-[10px] leading-snug text-label-tertiary";

export const toNumberOrNull = (value: unknown): number | null => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  const tituloId = useId();
  return (
    <section aria-labelledby={tituloId} className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h3 id={tituloId} className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} role="alert" className="mt-1 text-[10px] font-medium text-destructive">
      {message}
    </p>
  ) : null;
}

function RequiredMark() {
  return (
    <span className="text-destructive" aria-hidden>
      {" "}*
    </span>
  );
}

/** Mantém visível um valor legado (fora das opções) em vez de trocá-lo em silêncio. */
function opcoesComAtual(opcoes: readonly SelectOption[], atual: string | null | undefined): readonly SelectOption[] {
  if (!atual || opcoes.some((o) => o.value === atual)) return opcoes;
  return [...opcoes, { value: atual, label: `${atual} (valor atual)` }];
}

interface SchoolFormFieldsProps {
  register: UseFormRegister<EscolaFormValues>;
  errors: FieldErrors<EscolaFormValues>;
  watch: UseFormWatch<EscolaFormValues>;
  setValue: UseFormSetValue<EscolaFormValues>;
  /** Na edição: valores crus atuais — habilitam opções "não informado"/legadas. */
  atual?: {
    serie_maxima: string | null;
    ingles_minimo: string | null;
    temperatura_relacionamento: string | null;
    localizacaoPendente: boolean;
  };
}

export function SchoolFormFields({ register, errors, watch, setValue, atual }: SchoolFormFieldsProps) {
  const uid = useId();
  const id = (campo: keyof EscolaFormValues) => `${uid}-${campo}`;
  const erroId = (campo: keyof EscolaFormValues) => `${uid}-${campo}-erro`;
  const a11y = (campo: keyof EscolaFormValues) => ({
    id: id(campo),
    "aria-invalid": errors[campo] ? true : undefined,
    "aria-describedby": errors[campo] ? erroId(campo) : undefined,
  });

  const testes = watch("testes_exigidos");
  const alternarTeste = (teste: string) => {
    const proximo = testes.includes(teste) ? testes.filter((t) => t !== teste) : [...testes, teste];
    setValue("testes_exigidos", proximo, { shouldDirty: true });
  };
  const testesLegados = testes.filter((t) => !(TESTE_VALUES as readonly string[]).includes(t));
  const serieOpcoes = opcoesComAtual(SERIE_OPTIONS, atual?.serie_maxima);
  const inglesSemValor = atual !== undefined && atual.ingles_minimo === null;
  const serieSemValor = atual !== undefined && atual.serie_maxima === null;
  const temperaturaSemValor = atual !== undefined && atual.temperatura_relacionamento === null;

  return (
    <div className="space-y-5">
      <Section title="Identificação">
        <div>
          <label htmlFor={id("nome")} className={labelClass}>
            Nome da escola
            <RequiredMark />
          </label>
          <input {...register("nome")} {...a11y("nome")} className={inputClass} placeholder="Ex.: IMG Academy" />
          <FieldError id={erroId("nome")} message={errors.nome?.message} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={id("tipo")} className={labelClass}>
              Tipo
              <RequiredMark />
            </label>
            <select {...register("tipo")} {...a11y("tipo")} className={selectClass}>
              {TIPO_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <FieldError id={erroId("tipo")} message={errors.tipo?.message} />
          </div>
          <div>
            <label htmlFor={id("perfil")} className={labelClass}>Perfil</label>
            <select {...register("perfil")} {...a11y("perfil")} className={selectClass}>
              <option value="">Não classificado</option>
              {PERFIL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p className={ajudaClass}>Preenchido pela equipe — o sistema nunca deduz o perfil.</p>
          </div>
          <div>
            <label htmlFor={id("status")} className={labelClass}>Status</label>
            <select {...register("status")} {...a11y("status")} className={selectClass}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p className={ajudaClass}>Só escolas ativas entram no Motor de Match.</p>
          </div>
          <div>
            <label htmlFor={id("website")} className={labelClass}>Site oficial</label>
            <input {...register("website")} {...a11y("website")} className={inputClass} placeholder="https://escola.org" inputMode="url" />
            <FieldError id={erroId("website")} message={errors.website?.message} />
          </div>
        </div>
      </Section>

      <Section title="Localização">
        {atual?.localizacaoPendente && (
          <p className="rounded-md border border-sys-orange/30 bg-sys-orange/10 px-3 py-2 text-[11px] text-sys-orange">
            Localização ainda a confirmar (veio do import do Trello). Deixe em branco para manter assim.
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={id("cidade")} className={labelClass}>
              Cidade
              {!atual?.localizacaoPendente && <RequiredMark />}
            </label>
            <input {...register("cidade")} {...a11y("cidade")} className={inputClass} placeholder={atual?.localizacaoPendente ? "A confirmar" : "Ex.: Bradenton"} />
            <FieldError id={erroId("cidade")} message={errors.cidade?.message} />
          </div>
          <div>
            <label htmlFor={id("estado_us")} className={labelClass}>
              Estado (US)
              {!atual?.localizacaoPendente && <RequiredMark />}
            </label>
            <select {...register("estado_us")} {...a11y("estado_us")} className={selectClass}>
              <option value="">{atual?.localizacaoPendente ? "A confirmar" : "Selecione…"}</option>
              {US_STATES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <FieldError id={erroId("estado_us")} message={errors.estado_us?.message} />
          </div>
        </div>
      </Section>

      <Section title="Links operacionais">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={id("link_inscricao")} className={labelClass}>Link de inscrição (application)</label>
            <input {...register("link_inscricao")} {...a11y("link_inscricao")} className={inputClass} placeholder="https://portal.escola.org/apply" inputMode="url" />
            <FieldError id={erroId("link_inscricao")} message={errors.link_inscricao?.message} />
          </div>
          <div>
            <label htmlFor={id("link_plano_saude")} className={labelClass}>Link do plano de saúde</label>
            <input {...register("link_plano_saude")} {...a11y("link_plano_saude")} className={inputClass} placeholder="https://seguradora.com/enroll" inputMode="url" />
            <FieldError id={erroId("link_plano_saude")} message={errors.link_plano_saude?.message} />
          </div>
        </div>
      </Section>

      <Section title="Regras financeiras">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={id("budget_minimo_usd")} className={labelClass}>Budget mínimo (USD)</label>
            <input type="number" min={0} step={1000} {...register("budget_minimo_usd", { setValueAs: toNumberOrNull })} {...a11y("budget_minimo_usd")} className={inputClass} placeholder="Não informado" />
            <FieldError id={erroId("budget_minimo_usd")} message={errors.budget_minimo_usd?.message} />
          </div>
          <div>
            <label htmlFor={id("budget_forte_usd")} className={labelClass}>Budget forte (USD)</label>
            <input type="number" min={0} step={1000} {...register("budget_forte_usd", { setValueAs: toNumberOrNull })} {...a11y("budget_forte_usd")} className={inputClass} placeholder="Não informado" />
            <FieldError id={erroId("budget_forte_usd")} message={errors.budget_forte_usd?.message} />
          </div>
        </div>
        <p className={ajudaClass}>O budget mínimo filtra o Motor de Match: família abaixo dele fica com match 0 (exceto atleta de elite).</p>
        <div>
          <label htmlFor={id("agressividade_bolsa")} className={labelClass}>Agressividade de bolsa</label>
          <select {...register("agressividade_bolsa")} {...a11y("agressividade_bolsa")} className={selectClass}>
            <option value="">Não informado</option>
            {AGRESSIVIDADE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </Section>

      <Section title="Regras acadêmicas">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={id("ingles_minimo")} className={labelClass}>
              Inglês mínimo
              <RequiredMark />
            </label>
            <select {...register("ingles_minimo")} {...a11y("ingles_minimo")} className={selectClass}>
              {inglesSemValor && <option value="">Não informado (atual)</option>}
              {INGLES_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <FieldError id={erroId("ingles_minimo")} message={errors.ingles_minimo?.message} />
          </div>
          <div>
            <label htmlFor={id("nota_minima_duolingo")} className={labelClass}>Duolingo mínimo</label>
            <input type="number" min={10} max={160} step={5} {...register("nota_minima_duolingo", { setValueAs: toNumberOrNull })} {...a11y("nota_minima_duolingo")} className={inputClass} placeholder="Não informado" />
            <FieldError id={erroId("nota_minima_duolingo")} message={errors.nota_minima_duolingo?.message} />
          </div>
          <div>
            <label htmlFor={id("gpa_minimo")} className={labelClass}>GPA mínimo (0–4)</label>
            <input type="number" min={0} max={4} step={0.1} {...register("gpa_minimo", { setValueAs: toNumberOrNull })} {...a11y("gpa_minimo")} className={inputClass} placeholder="Não informado" />
            <FieldError id={erroId("gpa_minimo")} message={errors.gpa_minimo?.message} />
          </div>
          <div>
            <label htmlFor={id("serie_maxima")} className={labelClass}>
              Série máxima aceita
              <RequiredMark />
            </label>
            <select {...register("serie_maxima")} {...a11y("serie_maxima")} className={selectClass}>
              {serieSemValor && <option value="">Não informado (atual)</option>}
              {serieOpcoes.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p className={ajudaClass}>Atleta acima desta série fica com match 0. Para aceitar PG, escolha “PG”.</p>
            <FieldError id={erroId("serie_maxima")} message={errors.serie_maxima?.message} />
          </div>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" {...register("rolling_admission")} className="size-4 rounded border-input bg-card accent-primary focus:ring-2 focus:ring-primary/30" />
          <span className="text-xs text-muted-foreground">Rolling admission</span>
        </label>
        <div>
          <p className={labelClass} id={`${uid}-testes`}>Testes exigidos</p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${uid}-testes`}>
            {[...TESTE_VALUES, ...testesLegados].map((teste) => {
              const ativo = testes.includes(teste);
              return (
                <button
                  key={teste}
                  type="button"
                  onClick={() => alternarTeste(teste)}
                  aria-pressed={ativo}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                    ativo ? "border-primary/40 bg-primary/15 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {teste}
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      <Section title="Regras esportivas">
        <div>
          <label htmlFor={id("influencia_esporte")} className={labelClass}>Influência do esporte na admissão</label>
          <select {...register("influencia_esporte")} {...a11y("influencia_esporte")} className={selectClass}>
            <option value="">Não informado</option>
            {INFLUENCIA_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={id("esportes_oferecidos")} className={labelClass}>Esportes oferecidos</label>
          <input {...register("esportes_oferecidos")} {...a11y("esportes_oferecidos")} className={inputClass} placeholder="Vazio = não restringe o Match" />
          <p className={ajudaClass}>
            Separe por vírgula, com o mesmo nome do cadastro do atleta (hoje: “Futebol”). Preencher RESTRINGE o Match:
            atleta de outro esporte fica com match 0 nesta escola.
          </p>
          <FieldError id={erroId("esportes_oferecidos")} message={errors.esportes_oferecidos?.message} />
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" {...register("aceita_excecao_elite")} className="size-4 rounded border-input bg-card accent-primary focus:ring-2 focus:ring-primary/30" />
          <span className="text-xs text-muted-foreground">Aceita exceção para atleta de elite</span>
        </label>
      </Section>

      <Section title="Prazos">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={id("deadline_fall")} className={labelClass}>Deadline Fall</label>
            <input type="date" {...register("deadline_fall")} {...a11y("deadline_fall")} className={inputClass} />
            <FieldError id={erroId("deadline_fall")} message={errors.deadline_fall?.message} />
          </div>
          <div>
            <label htmlFor={id("deadline_spring")} className={labelClass}>Deadline Spring</label>
            <input type="date" {...register("deadline_spring")} {...a11y("deadline_spring")} className={inputClass} />
            <FieldError id={erroId("deadline_spring")} message={errors.deadline_spring?.message} />
          </div>
        </div>
      </Section>

      <Section title="Admissions officer">
        <div>
          <label htmlFor={id("admissions_officer_nome")} className={labelClass}>Nome</label>
          <input {...register("admissions_officer_nome")} {...a11y("admissions_officer_nome")} className={inputClass} placeholder="Nome do officer" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={id("admissions_officer_email")} className={labelClass}>E-mail</label>
            <input type="email" {...register("admissions_officer_email")} {...a11y("admissions_officer_email")} className={inputClass} placeholder="email@escola.org" />
            <FieldError id={erroId("admissions_officer_email")} message={errors.admissions_officer_email?.message} />
          </div>
          <div>
            <label htmlFor={id("admissions_officer_telefone")} className={labelClass}>Telefone</label>
            <input {...register("admissions_officer_telefone")} {...a11y("admissions_officer_telefone")} className={inputClass} placeholder="+1 (555) 123-4567" inputMode="tel" />
          </div>
        </div>
      </Section>

      <Section title="Relacionamento e notas">
        <div>
          <label htmlFor={id("temperatura_relacionamento")} className={labelClass}>Temperatura do relacionamento</label>
          <select {...register("temperatura_relacionamento")} {...a11y("temperatura_relacionamento")} className={selectClass}>
            {temperaturaSemValor && <option value="">Não informado (atual)</option>}
            {TEMPERATURA_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <FieldError id={erroId("temperatura_relacionamento")} message={errors.temperatura_relacionamento?.message} />
        </div>
        <div>
          <label htmlFor={id("regra_pratica")} className={labelClass}>Regra prática BAUSA</label>
          <textarea {...register("regra_pratica")} {...a11y("regra_pratica")} rows={2} className={cn(inputClass, "resize-none")} placeholder="Regra prática para esta escola…" />
          <FieldError id={erroId("regra_pratica")} message={errors.regra_pratica?.message} />
        </div>
        <div>
          <label htmlFor={id("notas_internas")} className={labelClass}>Notas internas</label>
          <textarea {...register("notas_internas")} {...a11y("notas_internas")} rows={4} className={cn(inputClass, "resize-y")} placeholder="Observações internas…" />
          <FieldError id={erroId("notas_internas")} message={errors.notas_internas?.message} />
        </div>
      </Section>
    </div>
  );
}
