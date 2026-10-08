/**
 * Regras da data de nascimento do formulário público (T23 — caso Samuel).
 *
 * O seletor de data do celular abre no ano ATUAL: a família escolhia o dia e
 * enviava "nascido este ano" (idade −1). Outras colocavam a data do próprio
 * responsável (1972). O classificador lia isso como "incoerência grave" →
 * INVALIDO → lead real invisível no Engine.
 *
 * PARIDADE (guard tests/nascimento-serie-paridade.test.js): a tabela
 * série → faixa de idade é IGUAL em
 *   - functions/qualify-lead/index.js (FAIXA_IDADE_POR_SERIE)
 *   - supabase/migrations/*_form_submissions_validar_nascimento.sql (public.fs_faixa_idade_serie)
 * As MENSAGENS (PT) são também as chaves de tradução em form.errors (en/es)
 * e as mensagens que o banco devolve no envio direto.
 */

export interface FaixaIdade {
  min: number;
  max: number;
}

/** Idade em anos completos aceita por série (com folga para repetência/calendário). */
export const FAIXA_IDADE_POR_SERIE: Readonly<Record<string, FaixaIdade>> = {
  before_7th: { min: 6, max: 14 },
  "8th_grade": { min: 11, max: 17 },
  "9th_grade": { min: 12, max: 18 },
  hs_1st: { min: 13, max: 20 },
  hs_2nd: { min: 14, max: 21 },
  hs_3rd: { min: 15, max: 22 },
  graduated_last_year: { min: 16, max: 24 },
  graduated_2plus: { min: 17, max: 30 },
};

/** Sem série escolhida (ou código desconhecido): só a faixa absoluta. */
export const FAIXA_IDADE_ABSOLUTA: Readonly<FaixaIdade> = { min: 5, max: 30 };

export const MSG_NASCIMENTO = {
  obrigatoria: "Data de nascimento é obrigatória",
  invalida: "Data de nascimento inválida",
  futuro: "A data de nascimento não pode ser no futuro",
  anoAtual: "Confira o ano de nascimento do atleta — a data escolhida é deste ano",
  incoerente:
    "A data de nascimento não combina com a série escolhida — confira o ano de nascimento do atleta (não o do responsável)",
} as const;

export type MotivoNascimentoInvalido = keyof typeof MSG_NASCIMENTO;

interface DataSimples {
  ano: number;
  mes: number;
  dia: number;
}

const RE_DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "YYYY-MM-DD" estrito (bloqueia ano de 5 dígitos e 30/02). */
export function parseDataISO(valor: string): DataSimples | null {
  const m = RE_DATA_ISO.exec(valor.trim());
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return { ano, mes, dia };
}

function hojeLocal(hoje: Date): DataSimples {
  return { ano: hoje.getFullYear(), mes: hoje.getMonth() + 1, dia: hoje.getDate() };
}

function comparar(a: DataSimples, b: DataSimples): number {
  return a.ano - b.ano || a.mes - b.mes || a.dia - b.dia;
}

/** Anos completos em `ref` para quem nasceu em `nasc`. */
export function calcularIdade(nasc: DataSimples, ref: DataSimples): number {
  const antesDoAniversario = ref.mes < nasc.mes || (ref.mes === nasc.mes && ref.dia < nasc.dia);
  return ref.ano - nasc.ano - (antesDoAniversario ? 1 : 0);
}

/**
 * null = válida. `serie` vazia ⇒ só a faixa absoluta (a coerência com a série
 * roda no superRefine do formulário, quando as duas estão preenchidas).
 */
export function validarNascimento(
  valor: string | null | undefined,
  serie: string,
  hoje: Date = new Date(),
): MotivoNascimentoInvalido | null {
  if (!valor || !valor.trim()) return "obrigatoria";
  const nasc = parseDataISO(valor);
  if (!nasc) return "invalida";
  const ref = hojeLocal(hoje);
  if (comparar(nasc, ref) > 0) return "futuro";
  if (nasc.ano === ref.ano) return "anoAtual";
  const faixa = FAIXA_IDADE_POR_SERIE[serie] ?? FAIXA_IDADE_ABSOLUTA;
  const idade = calcularIdade(nasc, ref);
  if (idade < faixa.min || idade > faixa.max) return "incoerente";
  return null;
}

function isoLocal(ano: number, mes: number, dia: number): string {
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/**
 * min/max do <input type="date">: o seletor do celular passa a abrir perto de
 * uma idade possível (não no ano atual) e o ano de 5 dígitos fica fora.
 * Calculado NO NAVEGADOR (useEffect) — no SSR o fuso é o do servidor.
 */
export function limitesSeletorNascimento(hoje: Date = new Date()): { min: string; max: string } {
  const ref = hojeLocal(hoje);
  return {
    min: isoLocal(ref.ano - FAIXA_IDADE_ABSOLUTA.max - 1, 1, 1),
    max: isoLocal(ref.ano - FAIXA_IDADE_ABSOLUTA.min, ref.mes, ref.dia),
  };
}
