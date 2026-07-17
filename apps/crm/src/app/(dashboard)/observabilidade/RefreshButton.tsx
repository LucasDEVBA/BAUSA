"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * "Verificar agora" — a página roda todas as verificações server-side a cada
 * render (force-dynamic); o refresh re-executa tudo. Mesmo padrão da aba
 * Execuções de /automacoes (useTransition + router.refresh()).
 */
export function RefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
      aria-busy={isPending}
    >
      <RefreshCw aria-hidden className={cn("h-3.5 w-3.5", isPending && "animate-spin")} />
      {isPending ? "Verificando…" : "Verificar agora"}
    </Button>
  );
}
