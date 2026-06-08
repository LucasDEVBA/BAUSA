"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  Megaphone,
  Download,
  Copy,
  TrendingUp,
  DollarSign,
  ShieldCheck,
  Info,
  Check,
  Send,
  AlertTriangle,
  X,
  Type,
  Image as ImageIcon,
  Link2,
  Upload,
  Users,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

import { exportarSegmentoCSV } from "@/lib/actions/remarketing";
import {
  prepararCampanha,
  dispararCampanha,
  cancelarCampanha,
} from "@/lib/actions/remarketing-campanha";
import { uploadRemarketingImage } from "@/lib/actions/remarketing-media";
import { RemarketingLeadSheet } from "@/components/remarketing/RemarketingLeadSheet";
import type { MensagemConfig, MensagemTipo } from "@/lib/remarketing-types";
import type {
  RemarketingData,
  RemarketingLeadAnon,
} from "@/lib/remarketing-queries";

interface CampanhaPreparada {
  campanhaId: string;
  total: number;
  amostra: string[];
}

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
const LIST_CAP = 150;

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
  const [preparada, setPreparada] = useState<CampanhaPreparada | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  // Tipo de mensagem + mídia
  const [tipo, setTipo] = useState<MensagemTipo>("texto");
  const [imagemUrl, setImagemUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitulo, setLinkTitulo] = useState("");
  const [linkDescricao, setLinkDescricao] = useState("");
  const [linkImagem, setLinkImagem] = useState("");
  const imagemFileRef = useRef<HTMLInputElement>(null);
  const linkImagemFileRef = useRef<HTMLInputElement>(null);

  const segment = segments.find((s) => s.key === selectedKey) ?? segments[0];

  const filtrosAtuais = () => ({
    faixasIdade: faixas,
    esportes: esportesSel,
    classes: classesSel,
  });

  function handleUploadImage(file: File, target: "imagem" | "link") {
    const fd = new FormData();
    fd.append("file", file);
    startTransition(async () => {
      const r = await uploadRemarketingImage(fd);
      if (r.success) {
        if (target === "imagem") setImagemUrl(r.url);
        else setLinkImagem(r.url);
        toast.success("Imagem enviada");
      } else {
        toast.error(r.error);
      }
    });
  }

  function handlePreparar() {
    if (tipo !== "imagem" && mensagem.trim().length === 0) {
      toast.error("Escreva a mensagem antes de disparar.");
      return;
    }
    if (tipo === "imagem" && !imagemUrl.trim()) {
      toast.error("Adicione a imagem (upload ou URL).");
      return;
    }
    if (tipo === "link" && !linkUrl.trim()) {
      toast.error("Informe a URL do link.");
      return;
    }
    const config: MensagemConfig = {
      tipo,
      imagemUrl: tipo === "imagem" ? imagemUrl.trim() : undefined,
      linkUrl: tipo === "link" ? linkUrl.trim() : undefined,
      linkTitulo: tipo === "link" ? linkTitulo.trim() : undefined,
      linkDescricao: tipo === "link" ? linkDescricao.trim() : undefined,
      linkImagem: tipo === "link" ? linkImagem.trim() : undefined,
    };
    startTransition(async () => {
      const r = await prepararCampanha(selectedKey, mensagem, filtrosAtuais(), config);
      if (r.success) {
        setPreparada({ campanhaId: r.campanhaId, total: r.total, amostra: r.amostra });
      } else {
        toast.error(r.error);
      }
    });
  }

  function handleConfirmarDisparo() {
    if (!preparada) return;
    const id = preparada.campanhaId;
    startTransition(async () => {
      const r = await dispararCampanha(id);
      if (r.success) {
        toast.success(
          `Campanha iniciada — ${r.enviados ?? 0} enviados agora, ${r.restantes ?? 0} continuam automaticamente (ritmo seguro).`,
        );
        setPreparada(null);
      } else {
        toast.error(r.error ?? "Falha ao disparar");
      }
    });
  }

  function handleCancelarPreparada() {
    if (!preparada) return;
    const id = preparada.campanhaId;
    setPreparada(null);
    startTransition(async () => {
      await cancelarCampanha(id);
      toast.info("Campanha cancelada.");
    });
  }

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
  const visiveis = filtrados.slice(0, LIST_CAP);

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

  const tipoLabel = tipo === "imagem" ? "Imagem" : tipo === "link" ? "Link (card)" : "Texto";

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
          fecharam — para campanhas de reaquecimento via WhatsApp.
        </p>
      </div>

      {/* Aviso LGPD + disparo controlado */}
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
        <p className="text-xs leading-relaxed text-amber-200/80">
          <strong className="text-amber-300">Disparo controlado (LGPD).</strong> Os envios
          saem em ritmo seguro (~120/dia, 1 a cada 30–45s, das 9h às 20h), com opt-out e
          <strong> dry-run obrigatório</strong> antes do envio real. Contate apenas com base
          legal válida. Você também pode exportar a audiência como Custom Audience da Meta.
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

      {/* Filtros + lista | painel */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
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

          {/* Lista de leads (clique → detalhe) */}
          <section className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-200">
                  <Users className="h-4 w-4 text-indigo-400" /> Leads desta audiência
                </p>
                <p className="text-xs text-zinc-500">Clique em um lead para ver o detalhe completo.</p>
              </div>
              <span className="text-xs font-semibold tabular-nums text-zinc-400">{alcance}</span>
            </div>

            {alcance === 0 ? (
              <p className="py-6 text-center text-xs text-zinc-600">
                Nenhum lead com os filtros atuais.
              </p>
            ) : (
              <div className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
                {visiveis.map((l) => (
                  <button
                    key={l.dealId}
                    onClick={() => setSelectedDealId(l.dealId)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-[#1e2130] bg-[#0f1117] px-3 py-2 text-left transition hover:border-indigo-500/40 hover:bg-[#1a1f2e]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-zinc-200">{l.nome}</p>
                      <p className="truncate text-[11px] text-zinc-500">
                        {l.idade ? `${l.idade} anos` : "idade —"} • {l.esporte} • {l.cidade}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          l.classe === "QUENTE"
                            ? "bg-red-500/15 text-red-300"
                            : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {l.classe}
                      </span>
                      <span
                        title={l.consentimento ? "Com consentimento LGPD" : "Sem consentimento explícito"}
                        className={`h-1.5 w-1.5 rounded-full ${l.consentimento ? "bg-emerald-400" : "bg-zinc-600"}`}
                      />
                      <ChevronRight className="h-4 w-4 text-zinc-600" />
                    </div>
                  </button>
                ))}
                {filtrados.length > LIST_CAP && (
                  <p className="px-1 pt-2 text-center text-[11px] text-zinc-600">
                    Mostrando {LIST_CAP} de {filtrados.length}. Refine os filtros para ver os demais.
                  </p>
                )}
              </div>
            )}
          </section>
        </div>

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
            <p className="mb-2 text-sm font-semibold text-zinc-200">Mensagem WhatsApp</p>

            {/* Seletor de tipo */}
            <div className="mb-3 grid grid-cols-3 gap-1.5">
              <TypeButton active={tipo === "texto"} onClick={() => setTipo("texto")} icon={<Type className="h-3.5 w-3.5" />}>
                Texto
              </TypeButton>
              <TypeButton active={tipo === "imagem"} onClick={() => setTipo("imagem")} icon={<ImageIcon className="h-3.5 w-3.5" />}>
                Imagem
              </TypeButton>
              <TypeButton active={tipo === "link"} onClick={() => setTipo("link")} icon={<Link2 className="h-3.5 w-3.5" />}>
                Link
              </TypeButton>
            </div>

            {tipo === "imagem" && (
              <div className="mb-3">
                <MediaImageField
                  label="Imagem da campanha"
                  url={imagemUrl}
                  setUrl={setImagemUrl}
                  fileRef={imagemFileRef}
                  onFile={(f) => handleUploadImage(f, "imagem")}
                  uploading={isPending}
                />
              </div>
            )}

            {tipo === "link" && (
              <div className="mb-3 space-y-2">
                <input
                  type="url"
                  placeholder="URL do link (https://…)"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="w-full rounded-lg border border-[#1e2130] bg-[#0f1117] px-2.5 py-1.5 text-sm text-zinc-200 outline-none focus:border-indigo-500/50"
                />
                <input
                  type="text"
                  placeholder="Título (ex: Agende sua reunião)"
                  value={linkTitulo}
                  onChange={(e) => setLinkTitulo(e.target.value)}
                  className="w-full rounded-lg border border-[#1e2130] bg-[#0f1117] px-2.5 py-1.5 text-sm text-zinc-200 outline-none focus:border-indigo-500/50"
                />
                <input
                  type="text"
                  placeholder="Descrição curta"
                  value={linkDescricao}
                  onChange={(e) => setLinkDescricao(e.target.value)}
                  className="w-full rounded-lg border border-[#1e2130] bg-[#0f1117] px-2.5 py-1.5 text-sm text-zinc-200 outline-none focus:border-indigo-500/50"
                />
                <MediaImageField
                  label="Imagem do card (opcional)"
                  url={linkImagem}
                  setUrl={setLinkImagem}
                  fileRef={linkImagemFileRef}
                  onFile={(f) => handleUploadImage(f, "link")}
                  uploading={isPending}
                />
              </div>
            )}

            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] text-zinc-500">
                {tipo === "imagem" ? "Legenda (opcional)" : "Mensagem"}
              </span>
              <span className={`text-[10px] ${mensagem.length > 1024 ? "text-red-400" : "text-zinc-500"}`}>
                {mensagem.length}/1024
              </span>
            </div>
            <textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              rows={tipo === "link" ? 4 : 6}
              className="w-full resize-none rounded-lg border border-[#1e2130] bg-[#0f1117] p-3 text-sm text-zinc-200 outline-none focus:border-indigo-500/50"
            />
            <p className="mt-1.5 text-[11px] text-zinc-500">
              Variáveis: <code className="text-zinc-400">{"{nome}"}</code>,{" "}
              <code className="text-zinc-400">{"{esporte}"}</code>
            </p>

            {/* Preview por tipo */}
            <div className="mt-2 rounded-lg border border-[#1e2130] bg-[#0c0e16] p-2.5">
              <p className="mb-1 text-[10px] uppercase tracking-wide text-zinc-600">
                Preview — {tipoLabel}
              </p>
              {tipo === "imagem" && imagemUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagemUrl} alt="Imagem da campanha" className="mb-1.5 max-h-32 w-full rounded object-cover" />
              )}
              {preview && (
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-300">{preview}</p>
              )}
              {tipo === "link" && (
                <div className="mt-2 flex gap-2 rounded-lg border border-[#1e2130] bg-[#11141d] p-2">
                  {linkImagem && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={linkImagem} alt="" className="h-12 w-12 flex-shrink-0 rounded object-cover" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-zinc-200">
                      {linkTitulo || "Título do link"}
                    </p>
                    <p className="truncate text-[11px] text-zinc-500">
                      {linkDescricao || "descrição do link"}
                    </p>
                    <p className="truncate text-[10px] text-indigo-400">{linkUrl || "https://…"}</p>
                  </div>
                </div>
              )}
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
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#1e2130] bg-[#0f1117] px-3 py-2 text-sm text-zinc-200 transition hover:bg-[#1a1f2e] disabled:opacity-40"
              >
                <Download className="h-4 w-4" />
                CSV ({alcance})
              </button>
            </div>
            <button
              onClick={handlePreparar}
              disabled={alcance === 0 || isPending}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
              {isPending ? "Processando…" : `Disparar campanha (${alcance})`}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de confirmação (dry-run obrigatório) */}
      {preparada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#1e2130] bg-[#141720] p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                Confirmar disparo
              </h3>
              <button onClick={handleCancelarPreparada} className="text-zinc-500 hover:text-zinc-300">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-zinc-300">
              <strong className="text-emerald-400">{preparada.total}</strong> leads vão receber a
              mensagem (<strong>{tipoLabel}</strong>) via WhatsApp, em <strong>ritmo seguro</strong>{" "}
              (~120/dia, 1 a cada 30-45s, só das 9h às 20h).
            </p>
            {preparada.amostra.length > 0 && (
              <p className="mt-2 text-xs text-zinc-500">
                Ex: {preparada.amostra.join(", ")}
                {preparada.total > preparada.amostra.length ? "…" : ""}
              </p>
            )}
            <div className="mt-3 rounded-lg border border-[#1e2130] bg-[#0c0e16] p-2.5">
              <p className="mb-1 text-[10px] uppercase tracking-wide text-zinc-600">Mensagem</p>
              {tipo === "imagem" && imagemUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagemUrl} alt="" className="mb-1.5 max-h-28 w-full rounded object-cover" />
              )}
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-zinc-300">{preview}</p>
              {tipo === "link" && (
                <p className="mt-1 truncate text-[10px] text-indigo-400">{linkUrl}</p>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleCancelarPreparada}
                className="flex-1 rounded-lg border border-[#1e2130] bg-[#0f1117] px-3 py-2 text-sm text-zinc-300 transition hover:bg-[#1a1f2e]"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarDisparo}
                disabled={isPending}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
                {isPending ? "Disparando…" : "Confirmar e disparar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sheet de detalhe do lead (reusa DealDetailSheet) */}
      <RemarketingLeadSheet dealId={selectedDealId} onClose={() => setSelectedDealId(null)} />

      <p className="flex items-center gap-1.5 text-xs text-zinc-600">
        <Info className="h-3 w-3" />
        Disparo via WhatsApp (Z-API) com salvaguardas anti-ban + dry-run obrigatório. CSV no
        formato Meta Custom Audience (email, telefone E.164, primeiro nome) também disponível para
        Públicos da Meta Ads.
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

function TypeButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
        active
          ? "border-indigo-500/50 bg-indigo-600/20 text-white"
          : "border-[#1e2130] bg-[#0f1117] text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function MediaImageField({
  label,
  url,
  setUrl,
  fileRef,
  onFile,
  uploading,
}: {
  label: string;
  url: string;
  setUrl: (v: string) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onFile: (file: File) => void;
  uploading: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      {url && (
        <div className="relative overflow-hidden rounded-lg border border-[#1e2130]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Pré-visualização" className="max-h-32 w-full object-cover" />
          <button
            type="button"
            onClick={() => setUrl("")}
            className="absolute right-1 top-1 rounded bg-black/60 p-1 text-zinc-200 transition hover:bg-black/80"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-[#1e2130] bg-[#0f1117] px-2.5 py-1.5 text-xs text-zinc-200 transition hover:bg-[#1a1f2e] disabled:opacity-40"
        >
          <Upload className="h-3.5 w-3.5" /> {uploading ? "Enviando…" : "Enviar"}
        </button>
        <input
          type="url"
          placeholder="ou cole uma URL https://…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-[#1e2130] bg-[#0f1117] px-2.5 py-1.5 text-xs text-zinc-200 outline-none focus:border-indigo-500/50"
        />
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}
