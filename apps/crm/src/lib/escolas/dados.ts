import {
  AGRESSIVIDADE_VALUES,
  INFLUENCIA_VALUES,
  INGLES_VALUES,
  PERFIL_VALUES,
  STATUS_VALUES,
  TEMPERATURA_VALUES,
  TIPO_VALUES,
  isValorDe,
} from "@/components/escolas/school-options";
import type { HistoricoEscola, School } from "@/types/school";

/**
 * Leitura do Banco de Escolas: colunas explícitas (nunca SELECT *) e mapeamento
 * linha → School SEM tradução de vocabulário. Valor ausente continua null.
 * As listas são UM literal de string: o supabase-js tipa o retorno a partir do
 * literal (com string montada por join ele devolve GenericStringError[]).
 */

export const ESCOLA_COLUNAS =
  "id, nome, cidade, estado_us, tipo, perfil, status, website, link_inscricao, link_plano_saude, budget_minimo_usd, budget_forte_usd, agressividade_bolsa, ingles_minimo, nota_minima_duolingo, gpa_minimo, testes_exigidos, esportes_oferecidos, influencia_esporte, aceita_excecao_elite, serie_maxima, rolling_admission, deadline_fall, deadline_spring, admissions_officer_nome, admissions_officer_email, admissions_officer_telefone, temperatura_relacionamento, ultimo_contato_at, regra_pratica, notas_internas, updated_at";

export const HISTORICO_COLUNAS =
  "escola_id, atletas_total, em_andamento, em_planejamento, aceitos, recusados, bolsas_informadas, bolsa_obtida_pct_soma, bolsa_media_obtida_pct";

export const HISTORICO_VAZIO: HistoricoEscola = {
  atletas_total: 0,
  em_andamento: 0,
  em_planejamento: 0,
  aceitos: 0,
  recusados: 0,
  bolsas_informadas: 0,
  bolsa_obtida_pct_soma: null,
  bolsa_media_obtida_pct: null,
};

type Linha = Record<string, unknown>;

/** PostgREST devolve NUMERIC como number, mas aceitamos string por robustez. */
function numeroOuNull(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = typeof valor === "number" ? valor : Number(valor);
  return Number.isFinite(n) ? n : null;
}

function inteiro(valor: unknown): number {
  return numeroOuNull(valor) ?? 0;
}

function textoOuNull(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() !== "" ? valor : null;
}

function listaDeTexto(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.filter((v): v is string => typeof v === "string") : [];
}

function enumOuNull<T extends string>(valores: readonly T[], valor: unknown): T | null {
  return isValorDe(valores, valor) ? valor : null;
}

export function mapearHistorico(linha: Linha): [string, HistoricoEscola] | null {
  const escolaId = textoOuNull(linha.escola_id);
  if (!escolaId) return null;
  return [
    escolaId,
    {
      atletas_total: inteiro(linha.atletas_total),
      em_andamento: inteiro(linha.em_andamento),
      em_planejamento: inteiro(linha.em_planejamento),
      aceitos: inteiro(linha.aceitos),
      recusados: inteiro(linha.recusados),
      bolsas_informadas: inteiro(linha.bolsas_informadas),
      bolsa_obtida_pct_soma: numeroOuNull(linha.bolsa_obtida_pct_soma),
      bolsa_media_obtida_pct: numeroOuNull(linha.bolsa_media_obtida_pct),
    },
  ];
}

/**
 * Linha do banco → School. `tipo` e `status` têm CHECK no banco; se algum dia
 * vier valor fora do domínio, a linha é descartada e logada (não inventamos
 * rótulo — foi a tradução inventada que gerou a "Division" na tela).
 */
export function mapearEscola(linha: Linha, historico: HistoricoEscola | undefined): School | null {
  const id = textoOuNull(linha.id);
  const tipo = enumOuNull(TIPO_VALUES, linha.tipo);
  const status = enumOuNull(STATUS_VALUES, linha.status);
  if (!id || !tipo || !status) {
    console.error({
      level: "error",
      action: "mapear_escola",
      escolaId: id,
      motivo: "tipo/status fora do domínio do CHECK",
    });
    return null;
  }

  return {
    id,
    nome: typeof linha.nome === "string" ? linha.nome : "",
    cidade: typeof linha.cidade === "string" ? linha.cidade : "",
    estado_us: typeof linha.estado_us === "string" ? linha.estado_us : "",
    tipo,
    perfil: enumOuNull(PERFIL_VALUES, linha.perfil),
    status,
    website: textoOuNull(linha.website),
    link_inscricao: textoOuNull(linha.link_inscricao),
    link_plano_saude: textoOuNull(linha.link_plano_saude),
    budget_minimo_usd: numeroOuNull(linha.budget_minimo_usd),
    budget_forte_usd: numeroOuNull(linha.budget_forte_usd),
    agressividade_bolsa: enumOuNull(AGRESSIVIDADE_VALUES, linha.agressividade_bolsa),
    ingles_minimo: enumOuNull(INGLES_VALUES, linha.ingles_minimo),
    nota_minima_duolingo: numeroOuNull(linha.nota_minima_duolingo),
    gpa_minimo: numeroOuNull(linha.gpa_minimo),
    testes_exigidos: listaDeTexto(linha.testes_exigidos),
    esportes_oferecidos: listaDeTexto(linha.esportes_oferecidos),
    influencia_esporte: enumOuNull(INFLUENCIA_VALUES, linha.influencia_esporte),
    aceita_excecao_elite: linha.aceita_excecao_elite === true,
    serie_maxima: textoOuNull(linha.serie_maxima),
    rolling_admission: linha.rolling_admission === true,
    deadline_fall: textoOuNull(linha.deadline_fall),
    deadline_spring: textoOuNull(linha.deadline_spring),
    admissions_officer_nome: textoOuNull(linha.admissions_officer_nome),
    admissions_officer_email: textoOuNull(linha.admissions_officer_email),
    admissions_officer_telefone: textoOuNull(linha.admissions_officer_telefone),
    temperatura_relacionamento: enumOuNull(TEMPERATURA_VALUES, linha.temperatura_relacionamento),
    ultimo_contato_at: textoOuNull(linha.ultimo_contato_at),
    regra_pratica: textoOuNull(linha.regra_pratica),
    notas_internas: textoOuNull(linha.notas_internas),
    updated_at: typeof linha.updated_at === "string" ? linha.updated_at : "",
    historico: historico ?? HISTORICO_VAZIO,
  };
}

/** Indicadores do topo — MESMA fonte dos cards (a view de histórico). */
export interface ResumoBancoEscolas {
  totalEscolas: number;
  escolasAtivas: number;
  emAndamento: number;
  aceitos: number;
  /** aceitos + recusados: só há taxa quando existe resposta registrada. */
  respostas: number;
  taxaAceitePct: number | null;
  bolsasInformadas: number;
  bolsaMediaPct: number | null;
}

export function resumirBancoEscolas(escolas: readonly School[]): ResumoBancoEscolas {
  let emAndamento = 0;
  let aceitos = 0;
  let recusados = 0;
  let bolsasInformadas = 0;
  let somaBolsas = 0;
  for (const e of escolas) {
    emAndamento += e.historico.em_andamento;
    aceitos += e.historico.aceitos;
    recusados += e.historico.recusados;
    bolsasInformadas += e.historico.bolsas_informadas;
    somaBolsas += e.historico.bolsa_obtida_pct_soma ?? 0;
  }
  const respostas = aceitos + recusados;
  return {
    totalEscolas: escolas.length,
    escolasAtivas: escolas.filter((e) => e.status === "ativa").length,
    emAndamento,
    aceitos,
    respostas,
    taxaAceitePct: respostas > 0 ? Math.round((aceitos / respostas) * 100) : null,
    bolsasInformadas,
    bolsaMediaPct: bolsasInformadas > 0 ? somaBolsas / bolsasInformadas : null,
  };
}
