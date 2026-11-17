"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui";

/**
 * Botões do consentimento OAuth. Travam durante o envio: um 2º clique em
 * "Permitir" aprovaria um pedido já consumido e mostraria erro falso.
 */
export function BotoesConsentimento({ podeAprovar }: { podeAprovar: boolean }) {
  const { pending, data } = useFormStatus();
  const decisao = data?.get("decisao");
  return (
    <>
      {podeAprovar && (
        <Button
          type="submit"
          name="decisao"
          value="aprovar"
          variant="brand"
          size="lg"
          className="sm:flex-1"
          disabled={pending}
          aria-busy={pending && decisao === "aprovar"}
        >
          {pending && decisao === "aprovar" && <Loader2 aria-hidden className="animate-spin" />}
          Permitir acesso
        </Button>
      )}
      <Button
        type="submit"
        name="decisao"
        value="negar"
        variant="secondary"
        size="lg"
        className="sm:flex-1"
        disabled={pending}
        aria-busy={pending && decisao === "negar"}
      >
        {podeAprovar ? "Cancelar" : "Recusar"}
      </Button>
    </>
  );
}
