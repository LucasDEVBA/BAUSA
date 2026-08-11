"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, PencilLine, CheckCircle2, Link2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { BriefingView } from "@/components/ads/BriefingView";
import { atualizarPlanoAds, type PlanoCampanha } from "@/lib/actions/ads-planner";
import type { MapaConfianca } from "@/lib/ads-confianca";

// Personalização do plano salvo: campos-chave editáveis (orçamento, duração,
// CPL alvo, público, título, notas) + status executado + vínculo campanha_id.
// A estrutura/UTM não é editável — o que não pode ser esquecido, não se edita.

export interface PlanoSalvo {
  id: string;
  titulo: string;
  foco: string | null;
  plano: PlanoCampanha;
  confianca: MapaConfianca | undefined;
  status: "rascunho" | "executado";
  campanhaId: string | null;
  notas: string;
  criadoEm: string;
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">{label}</span>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function PlanoSalvoClient({ plano, utmBloco }: { plano: PlanoSalvo; utmBloco: string }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [pendente, startTransition] = useTransition();

  const [titulo, setTitulo] = useState(plano.titulo);
  const [orcamento, setOrcamento] = useState(String(plano.plano.orcamento.diarioBrl));
  const [duracao, setDuracao] = useState(String(plano.plano.orcamento.duracaoDias));
  const [cpl, setCpl] = useState(String(plano.plano.cplAlvo.valorBrl));
  const [idades, setIdades] = useState(plano.plano.publico.idades);
  const [genero, setGenero] = useState(plano.plano.publico.genero);
  const [localizacoes, setLocalizacoes] = useState(plano.plano.publico.localizacoes);
  const [notas, setNotas] = useState(plano.notas);
  const [campanhaId, setCampanhaId] = useState(plano.campanhaId ?? "");

  const salvar = () =>
    startTransition(async () => {
      const r = await atualizarPlanoAds({
        planoId: plano.id,
        titulo,
        notas,
        orcamentoDiarioBrl: Number(orcamento.replace(",", ".")),
        duracaoDias: Number(duracao),
        cplAlvoBrl: Number(cpl.replace(",", ".")),
        idades,
        genero,
        localizacoes,
      });
      if (r.success) {
        toast.success("Plano atualizado.");
        setEditando(false);
        router.refresh();
      } else {
        toast.error(r.error ?? "Falha ao salvar.");
      }
    });

  const marcarExecutado = () =>
    startTransition(async () => {
      const idLimpo = campanhaId.trim();
      const r = await atualizarPlanoAds({
        planoId: plano.id,
        status: "executado",
        campanhaId: idLimpo !== "" ? idLimpo : null,
      });
      if (r.success) {
        toast.success(idLimpo ? "Plano executado e vinculado à campanha." : "Plano marcado como executado.");
        router.refresh();
      } else {
        toast.error(r.error ?? "Falha ao atualizar.");
      }
    });

  return (
    <div className="space-y-5">
      {/* Personalização */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <PencilLine className="h-4 w-4 text-primary" aria-hidden />
          <h3 className="text-sm font-bold text-foreground">Personalizar este plano</h3>
          <div className="ml-auto flex gap-2">
            {editando ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setEditando(false)} disabled={pendente}>Cancelar</Button>
                <Button size="sm" onClick={salvar} disabled={pendente}>
                  {pendente ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : "Salvar alterações"}
                </Button>
              </>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setEditando(true)}>Editar campos-chave</Button>
            )}
          </div>
        </div>

        {editando ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="sm:col-span-2 xl:col-span-4">
              <Campo label="Título do plano">
                <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
              </Campo>
            </div>
            <Campo label="Orçamento diário (R$)">
              <Input type="number" min={10} max={2000} value={orcamento} onChange={(e) => setOrcamento(e.target.value)} />
            </Campo>
            <Campo label="Duração (dias)">
              <Input type="number" min={3} max={60} value={duracao} onChange={(e) => setDuracao(e.target.value)} />
            </Campo>
            <Campo label="CPL alvo (R$)">
              <Input type="number" min={1} max={2000} value={cpl} onChange={(e) => setCpl(e.target.value)} />
            </Campo>
            <Campo label="Idades">
              <Input value={idades} onChange={(e) => setIdades(e.target.value)} />
            </Campo>
            <Campo label="Gênero">
              <Input value={genero} onChange={(e) => setGenero(e.target.value)} />
            </Campo>
            <div className="sm:col-span-2 xl:col-span-3">
              <Campo label="Localizações">
                <Input value={localizacoes} onChange={(e) => setLocalizacoes(e.target.value)} />
              </Campo>
            </div>
            <div className="sm:col-span-2 xl:col-span-4">
              <Campo label="Notas do CEO (entram no histórico do plano)">
                <Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Ajustes que você fez na Meta, contexto, decisões…" />
              </Campo>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Orçamento, duração, CPL alvo, público, título e notas são editáveis. A estrutura do briefing e o UTM não —
            o que não pode ser esquecido não se edita.
          </p>
        )}
      </Card>

      {/* Execução — fecha o ciclo com a campanha real */}
      <Card className="border-sys-blue/30 bg-sys-blue/5 p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-sys-blue" aria-hidden />
              <h3 className="text-sm font-bold text-foreground">Executou no Gerenciador de Anúncios?</h3>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Cole o ID da campanha criada (aparece na URL do Gerenciador ou na aba Campanhas daqui) para vincular o plano —
              o CAC/ROI real passa a ser comparado com o CPL alvo deste plano.
            </p>
            <Input
              value={campanhaId}
              onChange={(e) => setCampanhaId(e.target.value)}
              placeholder="ID da campanha (ex.: 120245792691790144) — opcional"
              className="mt-2"
              aria-label="ID da campanha da Meta para vincular"
            />
          </div>
          <Button onClick={marcarExecutado} disabled={pendente || plano.status === "executado"}>
            {pendente ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
            <span className="ml-1.5">{plano.status === "executado" ? "Já executado" : "Marcar como executado"}</span>
          </Button>
        </div>
        {plano.campanhaId ? (
          <p className="mt-2 text-[11px] font-semibold text-sys-green">
            Vinculado à campanha {plano.campanhaId} —{" "}
            <Link href={`/ads/campanha/${plano.campanhaId}`} className="underline hover:text-foreground">ver campanha</Link>
          </p>
        ) : null}
      </Card>

      {/* Briefing completo (UTM no topo — primordial) */}
      <BriefingView plano={plano.plano} confianca={plano.confianca} utmBloco={utmBloco} />
    </div>
  );
}
