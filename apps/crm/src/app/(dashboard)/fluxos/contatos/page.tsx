import { Users } from "lucide-react";

import { requirePapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { fetchContatos, FluxosError, type ContatoFluxo } from "@/lib/fluxos-queries";
import { FluxosNav } from "@/components/fluxos/FluxosNav";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { CANAL_CATALOG } from "@/types/fluxo";

// /fluxos/contatos — a base que os fluxos constroem. Cada linha mostra o que
// foi realmente capturado (e-mail/telefone) e se virou lead no funil.
export const dynamic = "force-dynamic";

const LIMITE = 200;

const data = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" }) : "—";

export default async function FluxosContatosPage() {
  await requirePapel("ceo");
  const supabase = await createServerSupabaseClient();

  let contatos: ContatoFluxo[] = [];
  let erro: string | null = null;
  try {
    contatos = await fetchContatos(supabase, LIMITE);
  } catch (e) {
    erro = e instanceof FluxosError ? e.message : "Falha ao carregar contatos.";
  }

  const comContato = contatos.filter((c) => c.campos.email || c.campos.telefone).length;

  return (
    <div className="space-y-5">
      <FluxosNav />
      <PageHeader
        title="Contatos"
        description={`${contatos.length} pessoa(s) que passaram por um fluxo · ${comContato} com e-mail ou telefone`}
        dense
      />

      {erro || contatos.length === 0 ? (
        <EmptyState
          icon={Users}
          title={erro ? "Não foi possível carregar" : "Nenhum contato ainda"}
          description={erro ?? "Assim que um fluxo rodar, quem conversar aparece aqui — com o que foi capturado."}
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-label-tertiary">
                  <th className="px-4 py-3 font-semibold">Contato</th>
                  <th className="px-3 py-3 font-semibold">Canal</th>
                  <th className="px-3 py-3 font-semibold">E-mail</th>
                  <th className="px-3 py-3 font-semibold">Telefone</th>
                  <th className="px-3 py-3 font-semibold">Tags</th>
                  <th className="px-3 py-3 font-semibold">No funil</th>
                  <th className="px-4 py-3 text-right font-semibold">Último contato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contatos.map((c) => {
                  const email = typeof c.campos.email === "string" ? c.campos.email : null;
                  const telefone = typeof c.campos.telefone === "string" ? c.campos.telefone : null;
                  return (
                    <tr key={c.id} className="transition-colors hover:bg-secondary/60">
                      <td className="max-w-[220px] px-4 py-3">
                        <p className="truncate font-semibold text-foreground">{c.nome ?? c.username ?? c.externoId}</p>
                        {c.username ? <p className="truncate text-[11px] text-muted-foreground">@{c.username}</p> : null}
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone="neutral" size="sm">{CANAL_CATALOG[c.canal]?.label ?? c.canal}</Badge>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{email ?? "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{telefone ?? "—"}</td>
                      <td className="max-w-[180px] px-3 py-3">
                        {c.tags.length > 0 ? (
                          <span className="flex flex-wrap gap-1">
                            {c.tags.slice(0, 3).map((t) => (
                              <Badge key={t} tone="blue" size="sm">{t}</Badge>
                            ))}
                            {c.tags.length > 3 ? <span className="text-[10px] text-label-tertiary">+{c.tags.length - 3}</span> : null}
                          </span>
                        ) : (
                          <span className="text-label-tertiary">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {c.temLead ? <Badge tone="green" size="sm">Lead</Badge> : <span className="text-label-tertiary">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{data(c.ultimoContatoEm)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
