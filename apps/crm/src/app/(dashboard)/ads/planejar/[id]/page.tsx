import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requirePapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { UTM_BLOCO_CANONICO } from "@/lib/ads-utm";
import type { MapaConfianca } from "@/lib/ads-confianca";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlanoSalvoClient, type PlanoSalvo } from "./client";

// /ads/planejar/[id] — tela de UM plano salvo: briefing completo (UTM no
// topo), personalização dos campos-chave e vínculo com a campanha real.
export const dynamic = "force-dynamic";

export default async function PlanoSalvoPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePapel("ceo");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("ads_planos")
    .select("id, titulo, foco, plano, confianca, status, campanha_id, notas, created_at")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) notFound();

  const plano: PlanoSalvo = {
    id: String(data.id),
    titulo: String(data.titulo),
    foco: typeof data.foco === "string" ? data.foco : null,
    plano: data.plano as PlanoSalvo["plano"],
    confianca: (data.confianca ?? undefined) as MapaConfianca | undefined,
    status: String(data.status) === "executado" ? "executado" : "rascunho",
    campanhaId: typeof data.campanha_id === "string" ? data.campanha_id : null,
    notas: typeof data.notas === "string" ? data.notas : "",
    criadoEm: String(data.created_at ?? ""),
  };

  return (
    <div className="space-y-5">
      <Link
        href="/ads/planejar"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Todos os planos
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <PageHeader title={plano.titulo} description={plano.foco ? `Foco: ${plano.foco}` : "Briefing salvo do planejador"} dense />
        <Badge tone={plano.status === "executado" ? "green" : "blue"}>{plano.status === "executado" ? "Executado" : "Rascunho"}</Badge>
      </div>

      <PlanoSalvoClient plano={plano} utmBloco={UTM_BLOCO_CANONICO} />
    </div>
  );
}
