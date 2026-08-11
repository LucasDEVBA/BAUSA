"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Filtro de campanha do Desempenho: recorta série, funil e demografia para
// UMA campanha (?campanha=<id>), preservando o período escolhido.

export function CampanhaFiltro({
  opcoes,
  campanhaAtiva,
}: {
  opcoes: Array<{ id: string; nome: string }>;
  campanhaAtiva: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const aplicar = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("campanha", id);
    else params.delete("campanha");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  if (opcoes.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="ads-campanha-filtro" className="text-xs font-semibold text-muted-foreground">
        Campanha
      </label>
      <select
        id="ads-campanha-filtro"
        value={campanhaAtiva ?? ""}
        onChange={(e) => aplicar(e.target.value)}
        className="max-w-64 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">Todas as campanhas</option>
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>{o.nome.length > 60 ? `${o.nome.slice(0, 60)}…` : o.nome}</option>
        ))}
      </select>
    </div>
  );
}
