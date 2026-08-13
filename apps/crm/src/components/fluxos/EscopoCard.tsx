"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Power, ShieldCheck, AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { salvarEscopoFluxos } from "@/lib/actions/fluxos-escopo";
import type { FluxosEscopo } from "@/lib/fluxos-escopo-shared";
import { cn } from "@/lib/utils";

// Gate do CEO: onde os fluxos podem responder. Fica no TOPO da tela porque é
// a chave geral — se está desligado, nada dispara, e isso precisa ser óbvio.

const MODOS: Array<{ id: FluxosEscopo["modo"]; label: string; desc: string }> = [
  { id: "desligado", label: "Desligado", desc: "Nenhum fluxo responde. Você monta e testa à vontade." },
  { id: "lista", label: "Só estes", desc: "Responde apenas nos contatos e grupos que você listar." },
  { id: "global", label: "Global", desc: "Responde em qualquer conversa que casar com um gatilho." },
];

export function EscopoCard({ escopo }: { escopo: FluxosEscopo }) {
  const router = useRouter();
  const [modo, setModo] = useState<FluxosEscopo["modo"]>(escopo.modo);
  const [telefones, setTelefones] = useState(escopo.telefones.join(", "));
  const [grupos, setGrupos] = useState(escopo.grupos.join(", "));
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sujo =
    modo !== escopo.modo ||
    telefones !== escopo.telefones.join(", ") ||
    grupos !== escopo.grupos.join(", ");

  const salvar = () => {
    setMsg(null);
    startTransition(async () => {
      const r = await salvarEscopoFluxos({
        modo,
        telefones: telefones.split(",").map((t) => t.trim()).filter(Boolean),
        grupos: grupos.split(",").map((g) => g.trim()).filter(Boolean),
      });
      if (!r.success) setMsg(r.error ?? "Não foi possível salvar.");
      else {
        setMsg("Escopo salvo.");
        router.refresh();
      }
    });
  };

  const ligado = escopo.modo !== "desligado";

  return (
    <Card className={cn("space-y-3 p-4", ligado ? "border-sys-green/30" : "border-border")}>
      <div className="flex flex-wrap items-center gap-2">
        {ligado ? (
          <ShieldCheck className="h-4 w-4 text-sys-green" aria-hidden />
        ) : (
          <Power className="h-4 w-4 text-muted-foreground" aria-hidden />
        )}
        <h2 className="text-sm font-bold text-foreground">Onde os fluxos podem responder</h2>
        <Badge tone={ligado ? "green" : "neutral"} size="sm">
          {escopo.modo === "global" ? "Global" : escopo.modo === "lista" ? "Lista restrita" : "Desligado"}
        </Badge>
        {escopo.modo === "lista" ? (
          <span className="text-[11px] text-muted-foreground">
            {escopo.telefones.length} contato(s) · {escopo.grupos.length} grupo(s)
          </span>
        ) : null}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Chave geral do motor. Com <strong>Desligado</strong>, nenhum fluxo responde — nem os que estiverem ativos.
        É seguro montar, testar e revisar antes de abrir para todo mundo.
      </p>

      <div role="group" aria-label="Modo de escopo" className="flex flex-wrap gap-1.5">
        {MODOS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setModo(m.id)}
            aria-pressed={modo === m.id}
            title={m.desc}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              modo === m.id
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-label-tertiary">{MODOS.find((m) => m.id === modo)?.desc}</p>

      {modo === "lista" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">Telefones (separados por vírgula)</span>
            <Input
              value={telefones}
              onChange={(e) => setTelefones(e.target.value)}
              placeholder="5571991461565, 5511988887777"
              className="mt-1"
            />
            <span className="mt-1 block text-[11px] text-label-tertiary">
              DDI e o 9º dígito não importam — a comparação usa os últimos 10 números.
            </span>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">Grupos (ids, separados por vírgula)</span>
            <Input
              value={grupos}
              onChange={(e) => setGrupos(e.target.value)}
              placeholder="120363000000000000"
              className="mt-1"
            />
            <span className="mt-1 block text-[11px] text-label-tertiary">
              Com ou sem @g.us — as duas formas funcionam.
            </span>
          </label>
        </div>
      ) : null}

      {modo === "global" && escopo.modo !== "global" ? (
        <p className="flex items-start gap-1.5 rounded-lg border border-sys-orange/20 bg-sys-orange/10 p-2.5 text-[11px] text-sys-orange">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          No modo Global os fluxos ativos passam a responder <strong>qualquer</strong> conversa que case com um
          gatilho. Confira os fluxos ativos e as palavras-chave antes de salvar.
        </p>
      ) : null}

      {msg ? (
        <p className={cn("text-xs", msg === "Escopo salvo." ? "text-sys-green" : "text-sys-red")}>{msg}</p>
      ) : null}

      <Button onClick={salvar} disabled={pending || !sujo}>
        {pending ? "Salvando…" : "Salvar escopo"}
      </Button>
    </Card>
  );
}
