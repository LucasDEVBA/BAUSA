"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Workflow, Play, Pause, Copy, Trash2, AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { alternarAtivoFluxo, criarFluxo, duplicarFluxo, excluirFluxo } from "@/lib/actions/fluxos";
import type { FluxoResumo } from "@/lib/fluxos-queries";
import {
  CANAL_CATALOG,
  GATILHO_FLUXO_CATALOG,
  type FluxoCanal,
  type FluxoGatilho,
} from "@/types/fluxo";
import { cn } from "@/lib/utils";

// Lista de fluxos + criação. O card mostra CAPTURA em destaque (a métrica que
// separa fluxo que gera pipeline de fluxo que só conversa).

type Filtro = "todos" | "ativos" | "pausados" | "sem_captura";

const FILTROS: Array<{ id: Filtro; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "ativos", label: "Ativos" },
  { id: "pausados", label: "Pausados" },
  { id: "sem_captura", label: "Sem captura" },
];

const pct = (v: number | null): string => (v === null ? "—" : `${Math.round(v * 100)}%`);

export function FluxosClient({ fluxos }: { fluxos: FluxoResumo[] }) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return fluxos.filter((f) => {
      if (filtro === "ativos" && !f.ativo) return false;
      if (filtro === "pausados" && f.ativo) return false;
      if (filtro === "sem_captura" && f.capturas30d > 0) return false;
      if (termo && !f.nome.toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [fluxos, filtro, busca]);

  const agir = (fn: () => Promise<{ success: boolean; error?: string }>) => {
    setErro(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.success) setErro(r.error ?? "Não foi possível concluir a ação.");
      else router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filtrar fluxos" className="flex flex-wrap gap-1.5">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltro(f.id)}
              aria-pressed={filtro === f.id}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                filtro === f.id
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-label-tertiary" aria-hidden />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar fluxo…"
            aria-label="Buscar fluxo por nome"
            className="pl-9"
          />
        </div>
        <Button onClick={() => setCriando(true)}>
          <Plus className="h-4 w-4" aria-hidden /> Novo fluxo
        </Button>
      </div>

      {erro ? (
        <p className="flex items-center gap-1.5 text-xs text-sys-red">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> {erro}
        </p>
      ) : null}

      {criando ? <NovoFluxo onFechar={() => setCriando(false)} /> : null}

      {visiveis.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title={fluxos.length === 0 ? "Nenhum fluxo ainda" : "Nenhum fluxo com esses filtros"}
          description={
            fluxos.length === 0
              ? "Crie o primeiro fluxo: escolha o gatilho, monte as perguntas e capture o contato antes de mandar para o time."
              : "Ajuste o filtro ou o termo de busca."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {visiveis.map((f) => {
            const canal = CANAL_CATALOG[f.canal];
            const gatilho = GATILHO_FLUXO_CATALOG[f.gatilho];
            const semCaptura = f.entradas30d > 0 && f.capturas30d === 0;
            return (
              <Card key={f.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start gap-2">
                  <Link href={`/fluxos/${f.id}`} className="min-w-0 flex-1 hover:text-primary">
                    <p className="truncate text-sm font-bold text-foreground" title={f.nome}>{f.nome}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {gatilho?.label ?? f.gatilho} · {f.blocosTotal} bloco(s)
                    </p>
                  </Link>
                  <Badge tone={f.ativo ? "green" : "neutral"} size="sm">{f.ativo ? "Ativo" : "Pausado"}</Badge>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={canal.disponivel ? "blue" : "orange"} size="sm" title={canal.bloqueio}>
                    {canal.label}
                    {canal.disponivel ? "" : " · aguarda liberação"}
                  </Badge>
                  {semCaptura ? (
                    <Badge tone="red" size="sm" title="Entradas sem nenhum contato capturado — adicione um bloco de captura">
                      Não captura contato
                    </Badge>
                  ) : null}
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
                  <Metrica label="Entradas 30d" valor={String(f.entradas30d)} />
                  <Metrica label="Capturas" valor={String(f.capturas30d)} destaque={f.capturas30d > 0} />
                  <Metrica label="Taxa" valor={pct(f.taxaCaptura)} destaque={(f.taxaCaptura ?? 0) >= 0.15} />
                </div>

                <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                  <Button
                    size="sm"
                    variant={f.ativo ? "secondary" : "primary"}
                    disabled={pending}
                    onClick={() => agir(() => alternarAtivoFluxo(f.id, !f.ativo))}
                  >
                    {f.ativo ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
                    {f.ativo ? "Pausar" : "Ativar"}
                  </Button>
                  <Button size="sm" variant="secondary" asChild>
                    <Link href={`/fluxos/${f.id}`}>Editar</Link>
                  </Button>
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => agir(() => duplicarFluxo(f.id))}>
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => {
                      if (confirm(`Excluir o fluxo "${f.nome}"? Ele para de disparar imediatamente.`)) {
                        agir(() => excluirFluxo(f.id));
                      }
                    }}
                    aria-label={`Excluir ${f.nome}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metrica({ label, valor, destaque = false }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">{label}</p>
      <p className={destaque ? "text-sm font-bold text-primary" : "text-sm font-semibold text-foreground"}>{valor}</p>
    </div>
  );
}

// ─── Criação ─────────────────────────────────────────────────────────────

function NovoFluxo({ onFechar }: { onFechar: () => void }) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [canal, setCanal] = useState<FluxoCanal>("whatsapp");
  const [gatilho, setGatilho] = useState<FluxoGatilho>("mensagem_palavra_chave");
  const [palavras, setPalavras] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Só oferece gatilhos compatíveis com o canal escolhido.
  const gatilhosDoCanal = useMemo(
    () =>
      (Object.entries(GATILHO_FLUXO_CATALOG) as Array<[FluxoGatilho, (typeof GATILHO_FLUXO_CATALOG)[FluxoGatilho]]>)
        .filter(([, info]) => info.canais.includes(canal)),
    [canal],
  );

  const trocarCanal = (c: FluxoCanal) => {
    setCanal(c);
    const primeiro = (Object.entries(GATILHO_FLUXO_CATALOG) as Array<[FluxoGatilho, { canais: FluxoCanal[] }]>).find(
      ([, i]) => i.canais.includes(c),
    );
    if (primeiro && !GATILHO_FLUXO_CATALOG[gatilho].canais.includes(c)) setGatilho(primeiro[0]);
  };

  const info = GATILHO_FLUXO_CATALOG[gatilho];
  const canalInfo = CANAL_CATALOG[canal];

  const salvar = () => {
    setErro(null);
    startTransition(async () => {
      const r = await criarFluxo({
        nome,
        canal,
        gatilho,
        gatilhoConfig: info.usaPalavras
          ? { palavras: palavras.split(",").map((p) => p.trim()).filter(Boolean), match: "contem" }
          : {},
      });
      if (!r.success) setErro(r.error ?? "Não foi possível criar.");
      else if (r.id) router.push(`/fluxos/${r.id}`);
    });
  };

  return (
    <Card className="space-y-3 p-5">
      <h2 className="text-sm font-bold text-foreground">Novo fluxo</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground">Nome</span>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Comentou EUA no post" className="mt-1" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground">Canal</span>
          <select
            value={canal}
            onChange={(e) => trocarCanal(e.target.value as FluxoCanal)}
            className="mt-1 w-full rounded-lg border border-border bg-card px-2.5 py-2 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {(Object.entries(CANAL_CATALOG) as Array<[FluxoCanal, { label: string; disponivel: boolean }]>).map(([id, c]) => (
              <option key={id} value={id}>{c.label}{c.disponivel ? "" : " (aguarda liberação)"}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-semibold text-muted-foreground">Gatilho</span>
        <select
          value={gatilho}
          onChange={(e) => setGatilho(e.target.value as FluxoGatilho)}
          className="mt-1 w-full rounded-lg border border-border bg-card px-2.5 py-2 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {gatilhosDoCanal.map(([id, i]) => (
            <option key={id} value={id}>{i.label}</option>
          ))}
        </select>
        <span className="mt-1 block text-[11px] text-muted-foreground">{info.descricao}</span>
      </label>

      {info.usaPalavras ? (
        <label className="block">
          <span className="text-xs font-semibold text-muted-foreground">Palavras-chave (separadas por vírgula)</span>
          <Input
            value={palavras}
            onChange={(e) => setPalavras(e.target.value)}
            placeholder="eua, bolsa, quero"
            className="mt-1"
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Vazio = qualquer mensagem dispara. Acentos e maiúsculas são ignorados na comparação.
          </span>
        </label>
      ) : null}

      {!canalInfo.disponivel ? (
        <p className="rounded-lg border border-sys-orange/20 bg-sys-orange/10 p-2.5 text-[11px] text-sys-orange">
          {canalInfo.bloqueio}
        </p>
      ) : null}

      {erro ? <p className="text-xs text-sys-red">{erro}</p> : null}

      <div className="flex gap-2">
        <Button onClick={salvar} disabled={pending || nome.trim().length < 3}>
          {pending ? "Criando…" : "Criar e montar"}
        </Button>
        <Button variant="secondary" onClick={onFechar} disabled={pending}>Cancelar</Button>
      </div>
    </Card>
  );
}
