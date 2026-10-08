"use client";

import { useState, useTransition, type ReactNode } from "react";
import { FileText, Loader2, RotateCw, SearchX, UserCheck, UserCog, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Badge, type BadgeTone } from "@/components/ui";
import { enviarFrioParaAprovacao, enviarIncompletoParaAprovacao } from "@/lib/actions/leads";
import { type CadastroEncontrado } from "@/lib/actions/leads-busca";
import { FRIOS_REVISAO_DIAS, type TipoLocalCadastro } from "@/lib/revisao-leads";

import { ReuniaoDetectadaBadge } from "./ReuniaoDetectadaBadge";
import { type EstadoBuscaCadastros } from "./useBuscaCadastros";

export type ModoRevisao = "aprovacao" | "frios" | "incompletos";

/**
 * Por que um card que TEM lugar numa coluna de revisão não está na tela:
 * página ainda não carregada, carregado mas escondido pelos filtros (os cards
 * de revisão não casam e-mail/telefone) ou visão Tabela (revisão só no Kanban).
 */
export type MotivoForaDaTela = "nao_carregado" | "filtrado" | "so_kanban";

const TEXTO_MOTIVO: Record<MotivoForaDaTela, string> = {
  nao_carregado: "ainda não carregado na coluna",
  filtrado: "oculto pelos filtros — a coluna não busca e-mail/telefone",
  so_kanban: "a coluna só aparece no Kanban",
};

interface ForaDoPipelineFaixaProps {
  estado: EstadoBuscaCadastros;
  /** O cadastro já aparece na tela agora (card carregado e não filtrado)? */
  estaVisivel: (item: CadastroEncontrado) => boolean;
  /** Item de coluna de revisão fora da tela: por quê (sem a prop, texto neutro). */
  motivoForaDaTela?: (item: CadastroEncontrado) => MotivoForaDaTela;
  rotuloEtapa: (etapa: string) => string;
  onAbrirDossie: (formSubmissionId: string) => void;
  /**
   * Abre o modal de revisão/fila no lead. `aoDecidir` (só para lead FORA da
   * coluna): o board chama no lugar de tirar o card da coluna quando o lead é
   * decidido no modal — ele nunca esteve (nem conta) na coluna.
   */
  onAbrirRevisao: (modo: ModoRevisao, formSubmissionId: string, aoDecidir?: () => void) => void;
  /** Depois de QUALQUER escrita (enviar p/ fila, aprovar/reprovar na revisão): tira o card da coluna, refaz a busca e o board. */
  onAtualizado: (item: CadastroEncontrado) => void;
  onTentarDeNovo: () => void;
}

const TOM_CLASSE: Record<string, BadgeTone> = {
  QUENTE: "green",
  MORNO: "orange",
  FRIO: "blue",
  INCOMPLETO: "purple",
  INVALIDO: "red",
};

const dataCurta = (iso: string | null): string =>
  iso
    ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }).format(
        new Date(iso),
      )
    : "—";

const resumir = (texto: string | null, max = 110): string | null =>
  texto ? (texto.length > max ? `${texto.slice(0, max)}…` : texto) : null;

/** Onde está + por quê, em português (T13). */
export function descreverLocal(
  c: CadastroEncontrado,
  rotuloEtapa: (etapa: string) => string,
  motivo?: MotivoForaDaTela,
): { titulo: string; detalhe: string | null } {
  const classe = c.qualification_classification ?? "sem classe";
  const porQue = motivo ? TEXTO_MOTIVO[motivo] : "fora da tela agora";
  const textos: Record<TipoLocalCadastro, { titulo: string; detalhe: string | null }> = {
    board_deal: {
      titulo: `No pipeline · ${rotuloEtapa(c.deal_etapa ?? "")}`,
      detalhe: c.deal_etapa === "projeto_futuro" ? "Na seção Leads Futuros, abaixo do board" : "Oculto pelos filtros atuais",
    },
    fora_kanban_cancelamento: { titulo: "Cancelamento solicitado", detalhe: "Sem coluna no Kanban — aparece na visão Tabela" },
    coluna_aprovacao: { titulo: "Aguardando aprovação", detalhe: `Recebido em ${dataCurta(c.submitted_at)} — ${porQue}` },
    coluna_frios: { titulo: "Na coluna Frios", detalhe: `Frio de ${dataCurta(c.submitted_at)} — ${porQue}` },
    coluna_incompletos: {
      titulo: "Na coluna Incompletos",
      detalhe: `Incompleto de ${dataCurta(c.submitted_at)} — ${porQue}`,
    },
    fora_perdido_timing: { titulo: "Perdido por timing", detalhe: "Tarde demais — perdidos por timing ficam fora do Kanban" },
    fora_deal_suspenso: { titulo: "Deal suspenso", detalhe: `Pendente com classe ${classe} — não entra na fila` },
    fora_pendente_classe: { titulo: "Fora da fila", detalhe: `Pendente com classe ${classe} — a fila só aceita Quente/Morno` },
    fora_reprovado: {
      titulo: `Reprovado em ${dataCurta(c.aprovacao_decidida_em)}`,
      detalhe: resumir(c.aprovacao_motivo),
    },
    fora_invalido: { titulo: "Invalidado pelo classificador", detalhe: resumir(c.qualification_reason) },
    fora_janela: {
      titulo: `${c.qualification_classification === "INCOMPLETO" ? "Incompleto" : "Frio"} de ${dataCurta(c.submitted_at)}, fora da janela`,
      detalhe: `A revisão mostra só os últimos ${FRIOS_REVISAO_DIAS} dias`,
    },
    fora_aprovado_sem_deal: { titulo: "Aprovado, sem deal ativo", detalhe: "Abra o dossiê para conferir" },
    fora_sem_classificacao: { titulo: "Ainda sem classificação", detalhe: "Qualificação pendente ou com falha" },
    fora_sem_decisao: { titulo: `${classe} sem decisão`, detalhe: "Cadastro anterior à fila de aprovação" },
  };
  return textos[c.local.tipo];
}

/**
 * Faixa "Fora do pipeline" (T13): resultados da busca no SERVIDOR que não
 * estão na tela. Dois grupos: quem o board não mostra por regra (inválido,
 * reprovado, fora da janela…) e quem tem lugar no board mas não está
 * visível agora (coluna não carregada, filtros). Só leitura + ações que
 * já existem (abrir dossiê/fila, enviar p/ fila com os CAS de sempre).
 */
export function ForaDoPipelineFaixa({
  estado,
  estaVisivel,
  motivoForaDaTela,
  rotuloEtapa,
  onAbrirDossie,
  onAbrirRevisao,
  onAtualizado,
  onTentarDeNovo,
}: ForaDoPipelineFaixaProps) {
  const [enviandoId, setEnviandoId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const naoVisiveis = estado.status === "ok" ? estado.itens.filter((i) => !estaVisivel(i)) : [];
  const fora = naoVisiveis.filter((i) => !i.local.noBoard);
  const noBoardOcultos = naoVisiveis.filter((i) => i.local.noBoard);

  const enviarParaFila = (item: CadastroEncontrado) => {
    setEnviandoId(item.id);
    startTransition(async () => {
      try {
        const r =
          item.qualification_classification === "INCOMPLETO"
            ? await enviarIncompletoParaAprovacao(item.id)
            : await enviarFrioParaAprovacao(item.id);
        if (r.success) {
          toast.success(`${item.athlete_name} enviado para a fila de aprovação`, {
            description: "Entrou como MORNO provisório — nada é enviado sem aprovar.",
          });
          onAtualizado(item);
        } else {
          toast.error(r.error);
        }
      } catch {
        toast.error("Falha de rede ao enviar para a fila. Tente de novo.");
      } finally {
        setEnviandoId(null);
      }
    });
  };

  const linha = (item: CadastroEncontrado) => {
    const { titulo, detalhe } = descreverLocal(item, rotuloEtapa, motivoForaDaTela?.(item));
    const tipo = item.local.tipo;
    // FRIO/INCOMPLETO sem decisão e sem deal ativo: pode ir p/ fila ou ser aprovado na revisão.
    const revisavel =
      item.aprovacao_status === null &&
      (item.qualification_classification === "FRIO" || item.qualification_classification === "INCOMPLETO") &&
      !item.deal_id;
    const modoRevisao: ModoRevisao | null =
      tipo === "coluna_aprovacao" ? "aprovacao" : tipo === "coluna_frios" ? "frios" : tipo === "coluna_incompletos" ? "incompletos" : null;
    // T13/T12: FRIO/INCOMPLETO além da janela não tem coluna — a revisão
    // (Aprovar lead / Aprovar sem mensagem) abre direto nele pelo garantirId.
    const modoForaDaJanela: ModoRevisao | null =
      tipo === "fora_janela" && revisavel
        ? item.qualification_classification === "INCOMPLETO"
          ? "incompletos"
          : "frios"
        : null;
    return (
      <li
        key={item.id}
        className="flex flex-col gap-1.5 rounded-lg border border-border/70 bg-background px-2.5 py-2 sm:flex-row sm:items-center sm:gap-3"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="min-w-0 max-w-full truncate text-xs font-semibold text-foreground">{item.athlete_name}</span>
            <Badge size="sm" tone={TOM_CLASSE[item.qualification_classification ?? ""] ?? "neutral"}>
              {item.qualification_classification ?? "Sem classe"}
            </Badge>
            {item.meeting_scheduled && (
              // deal_id da view = deal ATIVO; só sem ele dá para afirmar "sem deal" (perdido por timing e suspenso têm deal).
              <ReuniaoDetectadaBadge detectadaEm={item.meeting_scheduled_at} semDeal={!item.deal_id} />
            )}
          </div>
          {item.guardian_name && (
            <p className="truncate text-[11px] text-muted-foreground">Resp.: {item.guardian_name}</p>
          )}
          <p className="text-[11px] text-foreground">
            <span className="font-medium">{titulo}</span>
            {detalhe && <span className="text-muted-foreground"> · {detalhe}</span>}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {modoRevisao ? (
            <button
              type="button"
              onClick={() => onAbrirRevisao(modoRevisao, item.id)}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
            >
              <UserCheck aria-hidden className="size-3" />
              {modoRevisao === "aprovacao" ? "Abrir na fila" : "Abrir na revisão"}
            </button>
          ) : modoForaDaJanela ? (
            <button
              type="button"
              onClick={() => onAbrirRevisao(modoForaDaJanela, item.id, () => onAtualizado(item))}
              title="Abre o dossiê com Aprovar lead, Aprovar sem mensagem e Reprovar"
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
            >
              <UserCog aria-hidden className="size-3" />
              Revisar e aprovar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onAbrirDossie(item.id)}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
            >
              <FileText aria-hidden className="size-3" />
              Abrir dossiê
            </button>
          )}
          {revisavel && (
            <button
              type="button"
              onClick={() => enviarParaFila(item)}
              disabled={enviandoId === item.id}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-primary/10 px-2 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-60"
            >
              {enviandoId === item.id ? (
                <Loader2 aria-hidden className="size-3 animate-spin" />
              ) : (
                <UserPlus aria-hidden className="size-3" />
              )}
              Enviar p/ fila
            </button>
          )}
        </div>
      </li>
    );
  };

  let visual: ReactNode = null;
  if (estado.status === "carregando") {
    visual = (
      <p className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Loader2 aria-hidden className="size-3 animate-spin" />
        Procurando “{estado.termo}” em todos os cadastros…
      </p>
    );
  } else if (estado.status === "erro") {
    visual = (
      <div role="alert" className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-sys-red/25 bg-sys-red/5 px-2.5 py-1.5 text-[11px] text-sys-red">
        <SearchX aria-hidden className="size-3.5" />
        Busca fora do board falhou: {estado.erro}
        <button type="button" onClick={onTentarDeNovo} className="inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline">
          <RotateCw aria-hidden className="size-3" /> Tentar de novo
        </button>
      </div>
    );
  } else if (estado.status === "ok" && naoVisiveis.length === 0 && estado.total === 0) {
    visual = <p className="mb-2 text-[11px] text-muted-foreground">Nenhum cadastro encontrado para “{estado.termo}”.</p>;
  } else if (estado.status === "ok" && naoVisiveis.length > 0) {
    visual = (
      <section
        aria-labelledby="fora-pipeline-titulo"
        className="mb-3 shrink-0 rounded-xl border border-sys-orange/25 bg-sys-orange/5 p-2.5"
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <h2 id="fora-pipeline-titulo" className="text-xs font-semibold text-foreground">
            Fora do pipeline ({fora.length})
          </h2>
          {noBoardOcultos.length > 0 && (
            <span className="text-[11px] text-muted-foreground">
              · {noBoardOcultos.length} no board, mas fora da tela
            </span>
          )}
          {estado.total > estado.itens.length && (
            <span className="text-[11px] text-muted-foreground sm:ml-auto">
              Mostrando {estado.itens.length} de {estado.total} resultados — refine a busca
            </span>
          )}
        </div>
        {/* Altura contida: a faixa divide a altura com o board, que encolhe (não é cortado) */}
        <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto" aria-label={`Resultados para “${estado.termo}”`}>
          {[...fora, ...noBoardOcultos].map(linha)}
        </ul>
      </section>
    );
  }

  return (
    <>
      {/* Região viva SEMPRE montada: região que já nasce com o texto não é
          anunciada de forma confiável (VoiceOver/NVDA) — só o texto troca. */}
      <p role="status" aria-live="polite" className="sr-only">
        {textoAnuncio(estado, fora.length, noBoardOcultos.length, naoVisiveis.length)}
      </p>
      {visual}
    </>
  );
}

/** O que o leitor de tela ouve a cada busca (o erro é anunciado pelo role="alert"). */
function textoAnuncio(estado: EstadoBuscaCadastros, fora: number, ocultos: number, naoVisiveis: number): string {
  if (estado.status === "carregando") return `Procurando “${estado.termo}” em todos os cadastros…`;
  if (estado.status !== "ok") return "";
  if (estado.total === 0) return `Nenhum cadastro encontrado para “${estado.termo}”.`;
  if (naoVisiveis === 0) return `Os resultados para “${estado.termo}” já estão na tela.`;
  return `${fora} fora do pipeline${ocultos > 0 ? `, ${ocultos} no board mas fora da tela` : ""}.`;
}
