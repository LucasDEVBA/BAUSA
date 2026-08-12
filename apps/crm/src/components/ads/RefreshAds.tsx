"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import { recarregarAds } from "@/lib/actions/ads";
import { cn } from "@/lib/utils";

// Refresh manual da seção Ads: fura o cache de 5 min da Graph e rebusca tudo.
export function RefreshAds() {
  const router = useRouter();
  const [pendente, startTransition] = useTransition();

  const atualizar = () =>
    startTransition(async () => {
      const r = await recarregarAds();
      if (r.success) {
        router.refresh();
        toast.success("Dados da Meta atualizados.");
      } else {
        toast.error(r.error ?? "Falha ao atualizar.");
      }
    });

  return (
    <Button variant="secondary" size="sm" onClick={atualizar} disabled={pendente} aria-label="Atualizar dados da Meta">
      <RotateCw className={cn("h-3.5 w-3.5", pendente && "animate-spin")} aria-hidden />
      <span className="ml-1.5">{pendente ? "Atualizando…" : "Atualizar"}</span>
    </Button>
  );
}
