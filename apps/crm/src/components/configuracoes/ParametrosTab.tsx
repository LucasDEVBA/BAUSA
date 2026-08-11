"use client";

import { useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  Check,
  CircleDollarSign,
  Gauge,
  HeartPulse,
  Info,
  Loader2,
  RotateCcw,
  Save,
  Sparkles,
  Target,
} from "lucide-react";
import { toast } from "sonner";

import { Badge, Button, Card } from "@/components/ui";
import {
  CurrencyInput,
  PercentInput,
  ToggleField,
  UnitInput,
  formatBRL,
  formatBRLCompacto,
} from "@/components/ui/NumericInputs";
import {
  salvarExperiencia,
  salvarMatch,
  salvarMetas,
  salvarScore,
  salvarValores,
  type ExperienciaInput,
  type MatchInput,
  type MetasInput,
  type ParametrosSistema,
  type ScoreInput,
  type ValoresInput,
} from "@/lib/actions/parametros";
import { cn } from "@/lib/utils";

/**
 * Metas, valores e parâmetros do sistema.
 *
 * Cada seção salva por conta própria (botão só habilita quando há mudança) e
 * grava nas chaves que o sistema REALMENTE lê — a tela antiga escrevia chaves
 * paralelas que ninguém consumia, então "salvar" não mudava nada em lugar
 * nenhum. Cada bloco diz onde o número é usado, para o CEO saber o efeito.
 */

const PLANOS: { id: keyof ValoresInput["planos"]; nome: string; tone: "purple" | "blue" | "neutral" }[] = [
  { id: "legacy", nome: "Legacy", tone: "purple" },
  { id: "journey", nome: "Journey", tone: "blue" },
  { id: "start", nome: "Start", tone: "neutral" },
];

const PESOS_SCORE: { id: keyof ScoreInput["pesos"]; label: string }[] = [
  { id: "investimento", label: "Capacidade de investimento" },
  { id: "timing", label: "Timing (série/idade)" },
  { id: "ingles", label: "Nível de inglês" },
  { id: "academico", label: "Desempenho acadêmico" },
  { id: "competitivo", label: "Nível competitivo" },
  { id: "comprometimento", label: "Comprometimento" },
  { id: "video", label: "Vídeo de highlights" },
];

const PESOS_MATCH: { id: keyof MatchInput["pesos"]; label: string }[] = [
  { id: "financeiro", label: "Orçamento × custo da escola" },
  { id: "academico", label: "Perfil acadêmico" },
  { id: "esportivo", label: "Nível esportivo" },
  { id: "serie", label: "Série / ano de entrada" },
  { id: "historico_bausa", label: "Histórico BAUSA com a escola" },
];

/** Cabeçalho de seção com ícone, título e explicação do impacto real. */
function SecaoHeader({
  icone: Icone,
  titulo,
  descricao,
  onde,
}: {
  icone: typeof Target;
  titulo: string;
  descricao: string;
  onde: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icone aria-hidden className="size-4" />
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{descricao}</p>
        <p className="mt-1 flex items-center gap-1 text-[11px] text-label-tertiary">
          <Info aria-hidden className="size-3 shrink-0" />
          {onde}
        </p>
      </div>
    </div>
  );
}

/** Rodapé de seção: some quando não há alteração; avisa quando há. */
function SecaoFooter({
  dirty,
  pendente,
  onSalvar,
  onReverter,
  bloqueio,
}: {
  dirty: boolean;
  pendente: boolean;
  onSalvar: () => void;
  onReverter: () => void;
  bloqueio?: string | null;
}) {
  return (
    <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-3">
      {bloqueio && (
        <p className="mr-auto flex items-center gap-1.5 text-[11px] font-medium text-sys-red">
          <AlertTriangle aria-hidden className="size-3.5 shrink-0" />
          {bloqueio}
        </p>
      )}
      {dirty && !bloqueio && (
        <p className="mr-auto text-[11px] text-label-tertiary">Alterações não salvas</p>
      )}
      <Button variant="ghost" size="sm" disabled={!dirty || pendente} onClick={onReverter}>
        <RotateCcw />
        Reverter
      </Button>
      <Button size="sm" disabled={!dirty || pendente || Boolean(bloqueio)} onClick={onSalvar}>
        {pendente ? <Loader2 className="animate-spin" /> : <Save />}
        Salvar
      </Button>
    </div>
  );
}

/** Barra de soma dos pesos (100% obrigatório). */
function SomaPesos({ total }: { total: number }) {
  const ok = total === 100;
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border px-3 py-2",
        ok ? "border-sys-green/25 bg-sys-green/8" : "border-sys-red/25 bg-sys-red/8",
      )}
    >
      <span className={cn("text-xs font-medium", ok ? "text-sys-green" : "text-sys-red")}>
        {ok ? (
          <span className="flex items-center gap-1.5">
            <Check className="size-3.5" /> Pesos somam 100%
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="size-3.5" />
            Soma atual: {total}% — precisa fechar em 100%
          </span>
        )}
      </span>
      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full transition-all", ok ? "bg-sys-green" : "bg-sys-red")}
          style={{ width: `${Math.min(100, total)}%` }}
        />
      </div>
    </div>
  );
}

export function ParametrosTab({ inicial }: { inicial: ParametrosSistema }) {
  const [pendente, startTransition] = useTransition();

  const [metas, setMetas] = useState<MetasInput>(inicial.metas);
  const [valores, setValores] = useState<ValoresInput>(inicial.valores);
  const [score, setScore] = useState<ScoreInput>(inicial.score);
  const [match, setMatch] = useState<MatchInput>(inicial.match);
  const [exp, setExp] = useState<ExperienciaInput>(inicial.experiencia);

  // Baseline para dirty-check e reverter (atualizada a cada save bem-sucedido)
  const [base, setBase] = useState<ParametrosSistema>(inicial);

  const mudou = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);

  const totalScore = useMemo(
    () => Object.values(score.pesos).reduce((s, v) => s + v, 0),
    [score.pesos],
  );
  const totalMatch = useMemo(
    () => Object.values(match.pesos).reduce((s, v) => s + v, 0),
    [match.pesos],
  );

  const salvar = (
    fn: () => Promise<{ success: boolean; error?: string }>,
    aoOk: () => void,
    nome: string,
  ) => {
    startTransition(async () => {
      const r = await fn();
      if (r.success) {
        aoOk();
        toast.success(`${nome} salvos`);
      } else {
        toast.error(r.error ?? "Não foi possível salvar.");
      }
    });
  };

  // Projeção da meta: quantos contratos o ticket médio exige para bater o mês
  const contratosNecessarios =
    metas.ticket_medio_alvo > 0 ? Math.ceil(metas.meta_mensal_padrao / metas.ticket_medio_alvo) : 0;
  const metaAnualPorMes = metas.meta_anual > 0 ? Math.round(metas.meta_anual / 12) : 0;
  const descompasso = metaAnualPorMes > 0 && Math.abs(metaAnualPorMes - metas.meta_mensal_padrao) > metaAnualPorMes * 0.15;

  return (
    <div className="space-y-5">
      {/* ── Metas comerciais ── */}
      <Card>
        <SecaoHeader
          icone={Target}
          titulo="Metas comerciais"
          descricao="Os alvos que o War Room usa para medir o mês e o ano."
          onde="Usado em: War Room (medidor de meta, projeção e saúde do pipeline)."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CurrencyInput
            label="Meta anual"
            valor={metas.meta_anual}
            onChange={(v) => setMetas({ ...metas, meta_anual: v })}
            ajuda={metaAnualPorMes > 0 ? `${formatBRLCompacto(metaAnualPorMes)}/mês` : undefined}
          />
          <CurrencyInput
            label="Meta mensal"
            valor={metas.meta_mensal_padrao}
            onChange={(v) => setMetas({ ...metas, meta_mensal_padrao: v })}
            ajuda={descompasso ? "Difere bastante da meta anual ÷ 12" : "Base do medidor do War Room"}
          />
          <CurrencyInput
            label="Ticket médio alvo"
            valor={metas.ticket_medio_alvo}
            onChange={(v) => setMetas({ ...metas, ticket_medio_alvo: v })}
            ajuda={
              contratosNecessarios > 0
                ? `≈ ${contratosNecessarios} contrato(s)/mês para bater a meta`
                : undefined
            }
          />
          <UnitInput
            label="Contratos por mês"
            unidade="contratos"
            valor={metas.contratos_mes_alvo}
            onChange={(v) => setMetas({ ...metas, contratos_mes_alvo: v })}
            min={0}
            max={999}
            ajuda="Alvo exibido no card de metas"
          />
        </div>

        <div className="mt-4 rounded-xl border border-border bg-secondary/40 p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-label-tertiary">
            Pipeline saudável
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            Quantas vezes a meta mensal o pipeline aberto precisa valer. Abaixo do mínimo, o War
            Room sinaliza risco.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:max-w-sm">
            <UnitInput
              label="Mínimo"
              unidade="× a meta"
              valor={metas.pipeline_health_min}
              onChange={(v) => setMetas({ ...metas, pipeline_health_min: v })}
              min={1}
              max={20}
            />
            <UnitInput
              label="Máximo"
              unidade="× a meta"
              valor={metas.pipeline_health_max}
              onChange={(v) => setMetas({ ...metas, pipeline_health_max: v })}
              min={1}
              max={20}
            />
          </div>
          {metas.meta_mensal_padrao > 0 && (
            <p className="mt-2 text-[11px] text-label-tertiary">
              Hoje isso equivale a um pipeline entre{" "}
              <strong className="text-muted-foreground">
                {formatBRLCompacto(metas.meta_mensal_padrao * metas.pipeline_health_min)}
              </strong>{" "}
              e{" "}
              <strong className="text-muted-foreground">
                {formatBRLCompacto(metas.meta_mensal_padrao * metas.pipeline_health_max)}
              </strong>
              .
            </p>
          )}
        </div>

        <SecaoFooter
          dirty={mudou(metas, base.metas)}
          pendente={pendente}
          onReverter={() => setMetas(base.metas)}
          bloqueio={
            metas.pipeline_health_min > metas.pipeline_health_max
              ? "O mínimo não pode ser maior que o máximo."
              : null
          }
          onSalvar={() =>
            salvar(
              () => salvarMetas(metas),
              () => setBase((b) => ({ ...b, metas })),
              "Metas",
            )
          }
        />
      </Card>

      {/* ── Planos e valores ── */}
      <Card>
        <SecaoHeader
          icone={CircleDollarSign}
          titulo="Planos e valores"
          descricao="Preço de cada plano, valor no Pix e o que entra em cada um."
          onde="Usado em: criação de contrato, parcelas e projeções do Financeiro."
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {PLANOS.map(({ id, nome, tone }) => {
            const p = valores.planos[id];
            const desconto = p.valor > 0 ? Math.round(((p.valor - p.valor_pix) / p.valor) * 100) : 0;
            return (
              <div key={id} className="rounded-xl border border-border p-3.5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{nome}</p>
                  <Badge tone={tone} size="sm">
                    {desconto > 0 ? `${desconto}% no Pix` : "sem desconto"}
                  </Badge>
                </div>
                <div className="space-y-3">
                  <CurrencyInput
                    label="Valor do plano"
                    valor={p.valor}
                    onChange={(v) =>
                      setValores({ ...valores, planos: { ...valores.planos, [id]: { ...p, valor: v } } })
                    }
                  />
                  <CurrencyInput
                    label="Valor no Pix"
                    valor={p.valor_pix}
                    onChange={(v) =>
                      setValores({
                        ...valores,
                        planos: { ...valores.planos, [id]: { ...p, valor_pix: v } },
                      })
                    }
                    ajuda={
                      p.valor_pix > p.valor
                        ? "Maior que o valor do plano"
                        : `Economia de ${formatBRL(p.valor - p.valor_pix)}`
                    }
                  />
                  <ToggleField
                    label="Inclui psicóloga"
                    ativo={p.psicologa}
                    onChange={(v) =>
                      setValores({
                        ...valores,
                        planos: { ...valores.planos, [id]: { ...p, psicologa: v } },
                      })
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:max-w-md">
          <CurrencyInput
            label="Entrada padrão (sinal)"
            valor={valores.entrada_padrao}
            onChange={(v) => setValores({ ...valores, entrada_padrao: v })}
            ajuda="Sugerida ao criar contrato"
          />
          <CurrencyInput
            label="Custo da psicóloga"
            valor={valores.psicologa_custo_padrao}
            onChange={(v) => setValores({ ...valores, psicologa_custo_padrao: v })}
            ajuda="Entra no cálculo de margem"
          />
        </div>

        <SecaoFooter
          dirty={mudou(valores, base.valores)}
          pendente={pendente}
          onReverter={() => setValores(base.valores)}
          bloqueio={
            PLANOS.some(({ id }) => valores.planos[id].valor_pix > valores.planos[id].valor)
              ? "Há plano com Pix maior que o valor padrão."
              : null
          }
          onSalvar={() =>
            salvar(
              () => salvarValores(valores),
              () => setBase((b) => ({ ...b, valores })),
              "Planos e valores",
            )
          }
        />
      </Card>

      {/* ── Lead Score ── */}
      <Card>
        <SecaoHeader
          icone={Sparkles}
          titulo="Lead Score"
          descricao="Peso de cada critério na nota de 0 a 100 do lead e os cortes de classificação."
          onde="Usado em: cálculo do score no banco (atletas) e badges Quente/Morno/Frio."
        />
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 lg:grid-cols-2">
          {PESOS_SCORE.map(({ id, label }) => (
            <PercentInput
              key={id}
              label={label}
              valor={score.pesos[id]}
              onChange={(v) => setScore({ ...score, pesos: { ...score.pesos, [id]: v } })}
            />
          ))}
        </div>
        <div className="mt-4 space-y-3">
          <SomaPesos total={totalScore} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:max-w-md">
            <PercentInput
              label="Quente a partir de"
              valor={score.faixas.hot}
              comSlider={false}
              onChange={(v) => setScore({ ...score, faixas: { ...score.faixas, hot: v } })}
            />
            <PercentInput
              label="Morno a partir de"
              valor={score.faixas.warm}
              comSlider={false}
              onChange={(v) => setScore({ ...score, faixas: { ...score.faixas, warm: v } })}
              ajuda="Abaixo disso, o lead é Frio"
            />
          </div>
        </div>
        <SecaoFooter
          dirty={mudou(score, base.score)}
          pendente={pendente}
          onReverter={() => setScore(base.score)}
          bloqueio={
            totalScore !== 100
              ? "Os pesos precisam somar 100%."
              : score.faixas.hot <= score.faixas.warm
                ? "A faixa Quente precisa ser maior que a Morna."
                : null
          }
          onSalvar={() =>
            salvar(
              () => salvarScore(score),
              () => setBase((b) => ({ ...b, score })),
              "Lead Score",
            )
          }
        />
      </Card>

      {/* ── Motor de Match ── */}
      <Card>
        <SecaoHeader
          icone={Gauge}
          titulo="Motor de Match"
          descricao="Peso de cada dimensão no match atleta × escola e as faixas de classificação."
          onde="Usado em: sugestão de escolas e nota de compatibilidade."
        />
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 lg:grid-cols-2">
          {PESOS_MATCH.map(({ id, label }) => (
            <PercentInput
              key={id}
              label={label}
              valor={match.pesos[id]}
              onChange={(v) => setMatch({ ...match, pesos: { ...match.pesos, [id]: v } })}
            />
          ))}
        </div>
        <div className="mt-4 space-y-3">
          <SomaPesos total={totalMatch} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:max-w-2xl">
            <PercentInput
              label="Excelente"
              valor={match.faixas.excelente}
              comSlider={false}
              onChange={(v) => setMatch({ ...match, faixas: { ...match.faixas, excelente: v } })}
            />
            <PercentInput
              label="Forte"
              valor={match.faixas.forte}
              comSlider={false}
              onChange={(v) => setMatch({ ...match, faixas: { ...match.faixas, forte: v } })}
            />
            <PercentInput
              label="Possível"
              valor={match.faixas.possivel}
              comSlider={false}
              onChange={(v) => setMatch({ ...match, faixas: { ...match.faixas, possivel: v } })}
            />
          </div>
        </div>
        <SecaoFooter
          dirty={mudou(match, base.match)}
          pendente={pendente}
          onReverter={() => setMatch(base.match)}
          bloqueio={
            totalMatch !== 100
              ? "Os pesos precisam somar 100%."
              : !(match.faixas.excelente > match.faixas.forte && match.faixas.forte > match.faixas.possivel)
                ? "As faixas precisam ser decrescentes."
                : null
          }
          onSalvar={() =>
            salvar(
              () => salvarMatch(match),
              () => setBase((b) => ({ ...b, match })),
              "Motor de Match",
            )
          }
        />
      </Card>

      {/* ── Experiência da família ── */}
      <Card>
        <SecaoHeader
          icone={HeartPulse}
          titulo="Temperatura da família"
          descricao="A partir de que nível a família entra em alerta vermelho."
          onde="Usado em: cálculo automático de temperatura no CRM de Experiência."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:max-w-md">
          <UnitInput
            label="Ansiedade a partir de"
            unidade="1 a 10"
            valor={exp.ansiedade_vermelho}
            onChange={(v) => setExp({ ...exp, ansiedade_vermelho: v })}
            min={1}
            max={10}
            ajuda="Ansiedade igual ou acima disso vira vermelho"
          />
          <UnitInput
            label="Satisfação abaixo de"
            unidade="1 a 10"
            valor={exp.satisfacao_vermelho}
            onChange={(v) => setExp({ ...exp, satisfacao_vermelho: v })}
            min={1}
            max={10}
            ajuda="Satisfação igual ou abaixo disso vira vermelho"
          />
        </div>
        <SecaoFooter
          dirty={mudou(exp, base.experiencia)}
          pendente={pendente}
          onReverter={() => setExp(base.experiencia)}
          onSalvar={() =>
            salvar(
              () => salvarExperiencia(exp),
              () => setBase((b) => ({ ...b, experiencia: exp })),
              "Temperatura",
            )
          }
        />
      </Card>
    </div>
  );
}
