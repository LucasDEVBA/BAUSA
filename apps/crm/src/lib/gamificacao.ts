import "server-only";

import { createAdminClient, hasServiceKey } from "@/lib/supabase-admin";

/**
 * Gamificação do Engine — motor server-side.
 *
 * Princípios:
 *  - XP só por AÇÃO HUMANA real (aprovar lead, mover deal, fechar contrato,
 *    contato com família…) — nada de pontos por automação.
 *  - `registrarEventoGamificacao` é FAIL-OPEN: qualquer erro vira log e a
 *    ação de negócio segue intocada. Gamificação nunca quebra o trabalho.
 *  - Pontos congelados no evento (mudar o catálogo não reescreve o passado).
 *  - Escrita via admin client (RLS: authenticated só lê — o client de
 *    sessão não inventa ponto).
 */

// ─── Catálogo de XP ──────────────────────────────────────────────────────

export const XP_CATALOGO = {
  lead_criado: 10,
  lead_aprovado: 15,
  lead_reprovado: 5, // decidir também é trabalho — evita viés de aprovar tudo
  deal_avancado: 10,
  contrato_criado: 50,
  sinal_pago: 80,
  pagamento_confirmado: 20,
  email_enviado: 5,
  whatsapp_enviado: 5,
  tarefa_concluida: 8,
  contato_familia: 10,
} as const;

export type TipoEventoGamificacao = keyof typeof XP_CATALOGO;

// ─── Níveis (tema esportivo BAUSA) ───────────────────────────────────────
// XP para atingir o nível n cresce quadrático: 50·(n-1)² — começo rápido
// (engaja), topo longo (aspiracional).

export const NIVEIS = [
  { nivel: 1, nome: "Rookie" },
  { nivel: 2, nome: "Titular" },
  { nivel: 3, nome: "Capitão" },
  { nivel: 4, nome: "All-Star" },
  { nivel: 5, nome: "MVP" },
  { nivel: 6, nome: "Campeão Nacional" },
  { nivel: 7, nome: "All-American" },
  { nivel: 8, nome: "Lenda" },
  { nivel: 9, nome: "Hall da Fama" },
] as const;

export function xpParaNivel(nivel: number): number {
  return 50 * (nivel - 1) * (nivel - 1);
}

export function nivelDoXp(xp: number): { nivel: number; nome: string; xpNoNivel: number; xpProximo: number | null } {
  let atual: (typeof NIVEIS)[number] = NIVEIS[0];
  for (const n of NIVEIS) {
    if (xp >= xpParaNivel(n.nivel)) atual = n;
  }
  const proximo = NIVEIS.find((n) => n.nivel === atual.nivel + 1) ?? null;
  return {
    nivel: atual.nivel,
    nome: atual.nome,
    xpNoNivel: xp - xpParaNivel(atual.nivel),
    xpProximo: proximo ? xpParaNivel(proximo.nivel) - xpParaNivel(atual.nivel) : null,
  };
}

// ─── Conquistas ──────────────────────────────────────────────────────────
// Verificadas por CONTAGEM sobre gamificacao_eventos (fonte única) — sem
// estado paralelo para dessincronizar.

export interface ConquistaDef {
  id: string;
  nome: string;
  descricao: string;
  /** emoji do selo (a UI estiliza) */
  selo: string;
  /** tipo contado; null = qualquer evento */
  tipo: TipoEventoGamificacao | null;
  quantidade: number;
}

export const CONQUISTAS_CATALOGO: ConquistaDef[] = [
  { id: "primeiro_passo", nome: "Primeiro Passo", descricao: "Primeira ação pontuada no Engine", selo: "👟", tipo: null, quantidade: 1 },
  { id: "olheiro", nome: "Olheiro", descricao: "10 leads aprovados", selo: "🔭", tipo: "lead_aprovado", quantidade: 10 },
  { id: "scout_chefe", nome: "Scout Chefe", descricao: "50 leads aprovados", selo: "🎯", tipo: "lead_aprovado", quantidade: 50 },
  { id: "primeiro_fechamento", nome: "Primeiro Fechamento", descricao: "Primeiro contrato criado", selo: "✍️", tipo: "contrato_criado", quantidade: 1 },
  { id: "fechador", nome: "Fechador", descricao: "5 contratos criados", selo: "🏆", tipo: "contrato_criado", quantidade: 5 },
  { id: "sinal_verde", nome: "Sinal Verde", descricao: "Primeiro sinal recebido", selo: "💰", tipo: "sinal_pago", quantidade: 1 },
  { id: "maquina_pipeline", nome: "Máquina do Pipeline", descricao: "50 avanços de etapa", selo: "🚀", tipo: "deal_avancado", quantidade: 50 },
  { id: "comunicador", nome: "Comunicador", descricao: "100 mensagens enviadas (e-mail + WhatsApp)", selo: "📣", tipo: null, quantidade: 0 }, // regra própria
  { id: "anjo_da_guarda", nome: "Anjo da Guarda", descricao: "50 contatos com famílias", selo: "🛡️", tipo: "contato_familia", quantidade: 50 },
  { id: "executor", nome: "Executor", descricao: "25 tarefas concluídas", selo: "✅", tipo: "tarefa_concluida", quantidade: 25 },
  { id: "semana_perfeita", nome: "Semana Perfeita", descricao: "Ações em 7 dias seguidos", selo: "🔥", tipo: null, quantidade: 0 }, // regra própria
  { id: "madrugador", nome: "Madrugador", descricao: "Ação pontuada antes das 7h", selo: "🌅", tipo: null, quantidade: 0 }, // regra própria
];

// ─── Registro (fail-open) ────────────────────────────────────────────────

export interface ResultadoGamificacao {
  pontos: number;
  xpTotal: number;
  nivel: number;
  nivelNome: string;
  subiuDeNivel: boolean;
  conquistasNovas: Array<{ id: string; nome: string; descricao: string; selo: string }>;
}

/**
 * Registra um evento de XP para o usuário logado. NUNCA lança — falha vira
 * log e `null` (a ação de negócio não pode depender disto).
 */
export async function registrarEventoGamificacao(
  tipo: TipoEventoGamificacao,
  ref?: { tipo: string; id: string },
): Promise<ResultadoGamificacao | null> {
  try {
    if (!hasServiceKey()) return null;
    const admin = createAdminClient();

    // Usuário da sessão (o admin client não carrega cookie — importa aqui).
    const { createServerSupabaseClient } = await import("@/lib/supabase-server");
    const sessao = await createServerSupabaseClient();
    const { data: userData } = await sessao.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return null;

    const pontos = XP_CATALOGO[tipo];

    const { error: insErr } = await admin.from("gamificacao_eventos").insert({
      user_id: userId,
      tipo,
      pontos,
      ref_tipo: ref?.tipo ?? null,
      ref_id: ref?.id ?? null,
    });
    if (insErr) {
      console.error({ level: "warn", action: "gamificacao_insert_falhou", error: insErr.message });
      return null;
    }

    // XP total + nível (antes/depois para detectar level-up)
    const { data: eventos } = await admin
      .from("gamificacao_eventos")
      .select("tipo, pontos, criado_em")
      .eq("user_id", userId);
    const lista = (eventos ?? []) as Array<{ tipo: string; pontos: number; criado_em: string }>;
    const xpTotal = lista.reduce((s, e) => s + (e.pontos || 0), 0);
    const antes = nivelDoXp(xpTotal - pontos);
    const agora = nivelDoXp(xpTotal);

    // Conquistas: verifica só as ainda não desbloqueadas (contagens locais —
    // a lista já está na memória).
    const { data: jaTem } = await admin
      .from("gamificacao_conquistas")
      .select("conquista")
      .eq("user_id", userId);
    const desbloqueadas = new Set((jaTem ?? []).map((c: { conquista: string }) => c.conquista));

    const porTipo = new Map<string, number>();
    for (const e of lista) porTipo.set(e.tipo, (porTipo.get(e.tipo) ?? 0) + 1);

    const novas: ResultadoGamificacao["conquistasNovas"] = [];
    for (const c of CONQUISTAS_CATALOGO) {
      if (desbloqueadas.has(c.id)) continue;
      let ok = false;
      if (c.id === "comunicador") {
        ok = (porTipo.get("email_enviado") ?? 0) + (porTipo.get("whatsapp_enviado") ?? 0) >= 100;
      } else if (c.id === "semana_perfeita") {
        const dias = new Set(lista.map((e) => e.criado_em.slice(0, 10)));
        ok = temSequencia(dias, 7);
      } else if (c.id === "madrugador") {
        // hora local BRT (UTC-3): evento antes das 7h da manhã
        ok = lista.some((e) => {
          const h = (new Date(e.criado_em).getUTCHours() + 21) % 24;
          return h >= 4 && h < 7;
        });
      } else if (c.tipo === null) {
        ok = lista.length >= c.quantidade;
      } else {
        ok = (porTipo.get(c.tipo) ?? 0) >= c.quantidade;
      }
      if (ok) {
        const { error } = await admin
          .from("gamificacao_conquistas")
          .insert({ user_id: userId, conquista: c.id });
        // corrida entre abas: UNIQUE resolve; só celebra quem inseriu
        if (!error) novas.push({ id: c.id, nome: c.nome, descricao: c.descricao, selo: c.selo });
      }
    }

    return {
      pontos,
      xpTotal,
      nivel: agora.nivel,
      nivelNome: agora.nome,
      subiuDeNivel: agora.nivel > antes.nivel,
      conquistasNovas: novas,
    };
  } catch (e) {
    console.error({ level: "warn", action: "gamificacao_falhou", error: String(e) });
    return null;
  }
}

/** true se o conjunto de dias (YYYY-MM-DD) contém N dias consecutivos. */
function temSequencia(dias: Set<string>, n: number): boolean {
  for (const dia of dias) {
    let seq = 1;
    const d = new Date(`${dia}T12:00:00Z`);
    while (seq < n) {
      d.setUTCDate(d.getUTCDate() + 1);
      if (!dias.has(d.toISOString().slice(0, 10))) break;
      seq++;
    }
    if (seq >= n) return true;
  }
  return false;
}
