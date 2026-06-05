"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Megaphone,
  Download,
  Copy,
  TrendingUp,
  DollarSign,
  ShieldCheck,
  Info,
  Check,
} from "lucide-react";
import { toast } from "sonner";

import { exportarSegmentoCSV } from "@/lib/actions/remarketing";
import type {
  RemarketingData,
  RemarketingLeadAnon,
} from "@/lib/remarketing-queries";

// Faixas de idade (espelham FAIXAS_IDADE do queries — constante pura, sem
// importar o módulo server-only no bundle do client).
const FAIXAS_IDADE = ["até 15", "16-18", "19-21", "22+"] as const;
function faixaDaIdade(idade: number | null): string | null {
  if (idade == null) return null;
  if (idade <= 15) return "até 15";
  if (idade <= 18) return "16-18";
  if (idade <= 21) return "19-21";
  return "22+";
}

const CLASSES = ["QUENTE", "MORNO"] as const;

const MENSAGEM_DEFAULT =
  "Olá {nome}! 👋 Vi que você buscou uma bolsa esportiva nos EUA para o {esporte}. " +
  "Que tal retomarmos essa conversa? Posso te mostrar o próximo passo do seu projeto.\n\n— Equipe Bolsa Atleta USA";

const brl = (v: number) => `R$ ${Number(v || 0).toLocaleString("pt-BR")}`;

const SEGMENT_COLORS: Record<string, string> = {
  nao_agendaram: "#fbbf24",
  reuniao_sem_fechar: "#60a5fa",
  proposta_sem_resposta: "#a78bfa",
  perdidos_recuperaveis: "#f87171",
  inativos_90d: "#fb923c",
  alto_score_sem_followup: "#34d399",
  aniversariantes: "#f472b6",
};

export function RemarketingClient({ data }: { data: RemarketingData }) {
  const { segments, ticketMedio, esportes } = data;
  const [isPending, startTransition] = useTransition();

  const [selectedKey, setSelectedKey] = useState(
    segments.find((s) => s.total > 0)?.key ?? segments[0]?.key ?? "",
  );
  const [faixas, setFaixas] = useState<string[]>([]);
  const [esportesSel, setEsportesSel] = useState<string[]>([]);
  const [classesSel, setClassesSel] = useState<string[]>([]);
  const [mensagem, setMensagem] = useState(MENSAGEM_DEFAULT);

  const segment = segments.find((s) => s.key === selectedKey) ?? segments[0];

  function passa(l: RemarketingLeadAnon): boolean {
    if (faixas.length) {
      const f = faixaDaIdade(l.idade);
      if (!f || !faixas.includes(f)) return false;
    }
    if (esportesSel.length && !esportesSel.includes(l.esporte)) return false;
    if (classesSel.length && !classesSel.includes(l.classe)) return false;
    return true;
  }

  const filtrados = useMemo(
    () => (segment ? segment.leads.filter(passa) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [segment, faixas, esportesSel, classesSel],
  );

  const alcance = filtrados.length;
  const conversao = Math.round(alcance * (segment?.taxaEstimada ?? 0));
  const receita = conversao * ticketMedio;
  const comConsentimento = filtrados.filter((l) => l.consentimento).length;

  const filtrosAtivos = faixas.length + esportesSel.length + classesSel.length;

  function toggle(list: string[], set: (v: string[]) => void, value: string) {
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  function handleCopy() {
    navigator.clipboard.writeText(mensagem).then(
      () => toast.success("Mensagem copiada"),
      () => toast.error("Não foi possível copiar"),
    );
  }

  function handleExport() {
    startTransition(async () => {
      const result = await exportarSegmentoCSV(selectedKey, {
        faixasIdade: faixas,
        esportes: esportesSel,
        classes: classesSel,
      });
      if (result.success) {
        const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`${result.rows} contatos exportados`);
      } else {
        toast.error(result.error);
      }
    });
  }

  const preview = mensagem
    .replace(/\{nome\}/g, "João")
    .replace(/\{esporte\}/g, segment?.leads[0]?.esporte ?? "futebol");

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-zinc-100">
          <Megaphone className="h-5 w-5 text-indigo-400" />
          Re-marketing
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Audiências segmentadas de leads qualificados (QUENTE/MORNO) que ainda não
          fecharam — para campanhas de reaquecimento.
        </p>
      </div>

      {/* Aviso LGPD */}
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
        <p className="text-xs leading-relaxed text-amber-200/80">
          <strong className="text-amber-300">Uso responsável (LGPD).</strong> O export
          contém dados pessoais. Use como Custom Audience na Meta ou para contato manual,
          com base legal válida. Nesta versão não há disparo automático em massa
          (proteção da conta WhatsApp) — exporte ou copie a mensagem e envie pelo Pipeline.
        </p>
      </div>

      {/* Audiências inteligentes */}
      <section>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-zinc-600">
          Audiências
        </p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {segments.map((s) => {
            const active = s.key === selectedKey;
            return (
              <button
                key={s.key}
                onClick={() => setSelectedKey(s.key)}
                className={`flex flex-col gap-1.5 rounded-xl border p-3.5 text-left transition-all ${
                  active
                    ? "border-indigo-500/50 bg-indigo-600/10"
                    : "border-[#1e2130] bg-[#141720] hover:border-zinc-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: SEGMENT_COLORS[s.key] ?? "#71717a" }}
                  />
                  <span className="text-[11px] font-semibold text-emerald-400">
                    ~{Math.round(s.taxaEstimada * 100)}%
                  </span>
                </div>
                <p className="text-xs font-semibold leading-tight text-zinc-200">{s.label}</p>
                <p className="text-lg font-bold tabular-nums text-zinc-100">
                  {s.total}
                  <span className="ml-1 text-[10px] font-normal text-zinc-500">leads</span>
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Filtros + painel */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
        {/* Filtros avançados */}
        <section className="space-y-4 rounded-xl border border-[#1e2130] bg-[#141720] p-5">
          <div>
            <p className="text-sm font-semibold text-zinc-200">Filtros avançados</p>
            <p className="text-xs text-zinc-500">
              Refine a audiência &ldquo;{segment?.label}&rdquo; — {filtrosAtivos} filtro(s) ativo(s)
            </p>
          </div>

          <FilterGroup label="Idade">
            {FAIXAS_IDADE.map((f) => (
              <Chip key={f} active={faixas.includes(f)} onClick={() => toggle(faixas, setFaixas, f)}>
                {f}
              </Chip>
            ))}
          </FilterGroup>

          <FilterGroup label="Classificação">
            {CLASSES.map((c) => (
              <Chip key={c} active={classesSel.includes(c)} onClick={() => toggle(classesSel, setClassesSel, c)}>
                {c}
              </Chip>
            ))}
          </FilterGroup>

          {esportes.length > 0 && (
            <FilterGroup label="Esporte">
              {esportes.slice(0, 16).map((e) => (
                <Chip key={e} active={esportesSel.includes(e)} onClick={() => toggle(esportesSel, setEsportesSel, e)}>
                  {e}
                </Chip>
              ))}
            </FilterGroup>
          )}

          {filtrosAtivos > 0 && (
            <button
              onClick={() => {
                setFaixas([]);
                setEsportesSel([]);
                setClassesSel([]);
              }}
              className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
            >
              Limpar filtros
            </button>
          )}
        </section>

        {/* Painel direito */}
        <div className="space-y-4">
          {/* Alcance estimado */}
          <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-br from-emerald-600/15 to-emerald-800/5 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400/70">
              Alcance estimado
            </p>
            <p className="mt-1 flex items-baseline gap-1.5 text-3xl font-bold tabular-nums text-zinc-100">
              {alcance}
              <span className="text-xs font-normal text-zinc-400">leads nesta audiência</span>
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <p className="flex items-center gap-1 text-[11px] text-zinc-400">
                  <TrendingUp className="h-3 w-3" /> Conversão esperada
                </p>
                <p className="text-lg font-bold tabular-nums text-emerald-400">{conversao}</p>
              </div>
              <div>
                <p className="flex items-center gap-1 text-[11px] text-zinc-400">
                  <DollarSign className="h-3 w-3" /> Receita potencial
                </p>
                <p className="text-lg font-bold tabular-nums text-emerald-400">{brl(receita)}</p>
              </div>
            </div>
            <p className="mt-3 flex items-center gap-1 text-[10px] text-zinc-500">
              <Info className="h-3 w-3" /> Estimativa: {Math.round((segment?.taxaEstimada ?? 0) * 100)}% de
              conversão × ticket médio {brl(ticketMedio)}. {comConsentimento} c/ consentimento LGPD.
            </p>
          </div>

          {/* Editor de mensagem */}
          <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-zinc-200">Mensagem WhatsApp</p>
              <span
                className={`text-[10px] ${mensagem.length > 1024 ? "text-red-400" : "text-zinc-500"}`}
              >
                {mensagem.length}/1024
              </span>
            </div>
            <textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={6}
              className="w-full resize-none rounded-lg border border-[#1e2130] bg-[#0f1117] p-3 text-sm text-zinc-200 outline-none focus:border-indigo-500/50"
            />
            <p className="mt-1.5 text-[11px] text-zinc-500">
              Variáveis: <code className="text-zinc-400">{"{nome}"}</code>,{" "}
              <code className="text-zinc-400">{"{esporte}"}</code>
            </p>
            <div className="mt-2 rounded-lg border border-[#1e2130] bg-[#0c0e16] p-2.5">
              <p className="mb-1 text-[10px] uppercase tracking-wide text-zinc-600">Preview</p>
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-300">{preview}</p>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={handleCopy}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#1e2130] bg-[#0f1117] px-3 py-2 text-sm text-zinc-200 transition hover:bg-[#1a1f2e]"
              >
                <Copy className="h-4 w-4" /> Copiar
              </button>
              <button
                onClick={handleExport}
                disabled={alcance === 0 || isPending}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-40"
              >
                <Download className="h-4 w-4" />
                {isPending ? "Gerando…" : `CSV (${alcance})`}
              </button>
            </div>
          </div>
        </div>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-zinc-600">
        <Info className="h-3 w-3" />
        CSV no formato Meta Custom Audience (email, telefone E.164, primeiro nome) — suba em
        Meta Ads → Públicos → Lista de clientes. O disparo via WhatsApp será integrado quando
        houver templates aprovados pela Meta + horário seguro.
      </p>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition ${
        active
          ? "border-indigo-500/50 bg-indigo-600/20 text-white"
          : "border-[#1e2130] bg-[#0f1117] text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {active && <Check className="h-3 w-3" />}
      {children}
    </button>
  );
}
