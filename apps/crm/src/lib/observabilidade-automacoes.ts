import type { AutomacaoGatilho } from "@/types/automacao";
import { createServerSupabaseClient } from "./supabase-server";
import type { CheckStatus } from "./observabilidade-checks";

/**
 * Auto-instrumentação das automações (F4 do plano de observabilidade).
 *
 * Princípio pedido pelo CEO: "ao criar uma automação, a observabilidade dela
 * já nasce criada" — a saúde é 100% DERIVADA de `automacoes` + `automacao_runs`,
 * sem nenhuma configuração obrigatória. `gatilho_config.sla_horas` é um
 * override OPCIONAL para quem quer determinismo em gatilho de evento.
 *
 * Regras (constantes abaixo):
 *  (a) erro_cronico  — CRÍTICO: 3 erros consecutivos OU taxa ≥50% em ≥6 runs/7d
 *  (b) runs_presos   — CRÍTICO: pendente >2h OU erro com retry vencido >2h
 *  (c) silencio      — agendamento: determinístico (frequência + folga);
 *                      sla_horas: determinístico (override explícito);
 *                      EVENTO: heurística por MEDIANA de intervalos — no máximo
 *                      ATENÇÃO e SÓ NA TELA (o watchdog automático usa apenas as
 *                      regras determinísticas — heurística nunca acorda o CEO;
 *                      invariante travado em tests/automacoes-saude-invariants).
 *  (d) sem_runs      — ativa sem NENHUM run na janela de 30d.
 */

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface AutomacaoSaude {
  id: string;
  nome: string;
  gatilho: AutomacaoGatilho | "sistema";
  ativo: boolean;
  status: CheckStatus;
  motivos: string[];
  ultimaRunAt: string | null;
  slaHoras: number | null;
  /** Mediana de intervalo entre runs (h) — só quando a heurística se aplica. */
  baselineHoras: number | null;
  contagens: { runs30d: number; erros7d: number; presos: number };
}

// ─── Constantes das regras ───────────────────────────────────────────────────

const ERRO_CONSECUTIVOS = 3;
const ERRO_TAXA_MIN_RUNS = 6;
const ERRO_TAXA = 0.5;
const RUNS_PRESOS_HORAS = 2;
const AGENDAMENTO_FOLGA_HORAS = 6;
/** Heurística de silêncio (só tela): guardrails anti-falso-positivo. */
const SILENCIO_CARENCIA_DIAS = 7;
const SILENCIO_MIN_RUNS = 8;
const SILENCIO_BASELINE_MAX_HORAS = 72;
const SILENCIO_PISO_HORAS = 24;
const SEM_RUNS_CARENCIA_HORAS = 48;
const JANELA_DIAS = 30;
const RUNS_LIMITE = 2000;

const FREQ_HORAS: Record<string, number> = { diaria: 24, semanal: 24 * 7, mensal: 24 * 31 };

// ─── Implementação ───────────────────────────────────────────────────────────

type Supabase = Awaited<ReturnType<typeof createServerSupabaseClient>>;

interface RunRow {
  automacao_id: string;
  status: string;
  created_at: string;
  proxima_tentativa_at: string | null;
}

function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const ord = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ord.length / 2);
  return ord.length % 2 === 0 ? (ord[meio - 1] + ord[meio]) / 2 : ord[meio];
}

function lerSlaHoras(config: Record<string, unknown>): number | null {
  const v = config.sla_horas;
  return typeof v === "number" && v >= 1 && v <= 720 ? v : null;
}

export async function avaliarSaudeAutomacoes(supabase: Supabase): Promise<AutomacaoSaude[]> {
  const desde = new Date(Date.now() - JANELA_DIAS * 86_400_000).toISOString();

  const [autosRes, runsRes] = await Promise.all([
    supabase
      .from("automacoes")
      .select("id, nome, gatilho, gatilho_config, ativo, updated_at")
      .is("deleted_at", null)
      .order("nome"),
    supabase
      .from("automacao_runs")
      .select("automacao_id, status, created_at, proxima_tentativa_at")
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(RUNS_LIMITE),
  ]);
  if (autosRes.error) throw new Error(`automacoes: ${autosRes.error.message}`);
  if (runsRes.error) throw new Error(`automacao_runs: ${runsRes.error.message}`);

  const runsPorAuto = new Map<string, RunRow[]>();
  for (const raw of runsRes.data ?? []) {
    const r = raw as unknown as RunRow;
    const lista = runsPorAuto.get(r.automacao_id);
    if (lista) lista.push(r);
    else runsPorAuto.set(r.automacao_id, [r]);
  }

  const agora = Date.now();
  const corte7d = agora - 7 * 86_400_000;
  const cortePreso = agora - RUNS_PRESOS_HORAS * 3_600_000;

  const resultado: AutomacaoSaude[] = [];

  for (const raw of autosRes.data ?? []) {
    const a = raw as Record<string, unknown>;
    const id = String(a.id);
    const nome = String(a.nome);
    const gatilho = String(a.gatilho) as AutomacaoGatilho | "sistema";
    const ativo = a.ativo === true;
    const config = (a.gatilho_config ?? {}) as Record<string, unknown>;
    const runs = runsPorAuto.get(id) ?? []; // DESC por created_at

    const slaHoras = lerSlaHoras(config);
    const ultimaRunAt = runs[0]?.created_at ?? null;
    const motivos: string[] = [];
    let status: CheckStatus = "ok";
    const pior = (novo: CheckStatus) => {
      if (novo === "critico") status = "critico";
      else if (novo === "atencao" && status !== "critico") status = "atencao";
    };

    // (b) runs presos — pendente velho ou retry vencido
    const presos = runs.filter((r) => {
      if (r.status === "pendente") return new Date(r.created_at).getTime() < cortePreso;
      if (r.status === "erro" && r.proxima_tentativa_at) {
        return new Date(r.proxima_tentativa_at).getTime() < cortePreso;
      }
      return false;
    }).length;

    const runs7d = runs.filter((r) => new Date(r.created_at).getTime() >= corte7d);
    const erros7d = runs7d.filter((r) => r.status === "erro").length;

    let baselineHoras: number | null = null;

    if (!ativo) {
      resultado.push({
        id, nome, gatilho, ativo,
        status: "info",
        motivos: ["Pausada — sem avaliação de saúde."],
        ultimaRunAt, slaHoras, baselineHoras: null,
        contagens: { runs30d: runs.length, erros7d, presos },
      });
      continue;
    }

    if (presos > 0) {
      pior("critico");
      motivos.push(`${presos} run(s) presos (pendente ${RUNS_PRESOS_HORAS}h+ ou retry vencido) — engine parada ou CAS travado.`);
    }

    // (a) erro crônico
    const consecutivos = runs.slice(0, ERRO_CONSECUTIVOS);
    if (consecutivos.length === ERRO_CONSECUTIVOS && consecutivos.every((r) => r.status === "erro")) {
      pior("critico");
      motivos.push(`${ERRO_CONSECUTIVOS} erros consecutivos — a automação está falhando toda vez.`);
    } else if (runs7d.length >= ERRO_TAXA_MIN_RUNS && erros7d / runs7d.length >= ERRO_TAXA) {
      pior("critico");
      motivos.push(`Taxa de erro ${Math.round((erros7d / runs7d.length) * 100)}% em ${runs7d.length} runs/7d.`);
    }

    // (c) silêncio
    const idadeUltimaH = ultimaRunAt ? (agora - new Date(ultimaRunAt).getTime()) / 3_600_000 : null;

    if (gatilho === "agendamento") {
      const esperadoH = FREQ_HORAS[String(config.frequencia)] ?? 24;
      if (idadeUltimaH !== null && idadeUltimaH > esperadoH + AGENDAMENTO_FOLGA_HORAS) {
        pior("critico");
        motivos.push(`Agendamento ${String(config.frequencia)} sem run há ${Math.floor(idadeUltimaH)}h (esperado ≤ ${esperadoH + AGENDAMENTO_FOLGA_HORAS}h).`);
      }
    }
    if (slaHoras !== null && idadeUltimaH !== null && idadeUltimaH > slaHoras) {
      pior("critico");
      motivos.push(`SLA de silêncio estourado: ${Math.floor(idadeUltimaH)}h sem run (SLA ${slaHoras}h).`);
    }

    // Heurística de EVENTO — SÓ ATENÇÃO, SÓ NA TELA (nunca no watchdog):
    // exige carência, amostra mínima e baseline curta (mediana) — guardrails
    // contra falso-positivo de cadência naturalmente esparsa.
    if (gatilho !== "agendamento" && slaHoras === null && runs.length >= SILENCIO_MIN_RUNS && ultimaRunAt) {
      const primeiraRun = runs[runs.length - 1];
      const carenciaOk = agora - new Date(primeiraRun.created_at).getTime() >= SILENCIO_CARENCIA_DIAS * 86_400_000;
      if (carenciaOk) {
        const intervalosH: number[] = [];
        for (let i = 0; i < runs.length - 1; i++) {
          intervalosH.push((new Date(runs[i].created_at).getTime() - new Date(runs[i + 1].created_at).getTime()) / 3_600_000);
        }
        baselineHoras = mediana(intervalosH);
        if (
          baselineHoras !== null &&
          baselineHoras <= SILENCIO_BASELINE_MAX_HORAS &&
          idadeUltimaH !== null &&
          idadeUltimaH > Math.max(3 * baselineHoras, baselineHoras + 24, SILENCIO_PISO_HORAS)
        ) {
          pior("atencao");
          motivos.push(`Silêncio anômalo: mediana de ${Math.round(baselineHoras)}h entre runs, atual ${Math.floor(idadeUltimaH)}h sem run.`);
        }
      }
    }

    // (d) sem runs na janela
    if (runs.length === 0) {
      const atualizadaHaH = (agora - new Date(String(a.updated_at)).getTime()) / 3_600_000;
      if (atualizadaHaH >= SEM_RUNS_CARENCIA_HORAS) {
        if (gatilho === "agendamento" || slaHoras !== null) {
          pior("critico");
          motivos.push(`Nenhum run em ${JANELA_DIAS}d — agendamento/SLA deveria ter disparado (gatilho mal configurado ou engine parada).`);
        } else {
          pior("atencao");
          motivos.push(`Nenhum run em ${JANELA_DIAS}d — gatilho possivelmente mal configurado (ou evento raro).`);
        }
      }
    }

    if (motivos.length === 0) motivos.push("Saudável — runs fluindo dentro do esperado.");

    resultado.push({
      id, nome, gatilho, ativo, status, motivos, ultimaRunAt, slaHoras, baselineHoras,
      contagens: { runs30d: runs.length, erros7d, presos },
    });
  }

  const ordem: Record<CheckStatus, number> = { critico: 0, atencao: 1, ok: 2, info: 3 };
  resultado.sort((x, y) => ordem[x.status] - ordem[y.status] || x.nome.localeCompare(y.nome));
  return resultado;
}
