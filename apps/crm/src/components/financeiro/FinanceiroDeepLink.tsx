"use client";

import { useEffect } from "react";

/**
 * Deep-link do Financeiro: quando a URL traz ?deal=<id> (ex.: clique numa
 * notificação de pagamento), rola até e destaca as linhas do contrato/parcelas
 * daquele deal (ancoradas por data-deal-id), depois limpa o param.
 */
export function FinanceiroDeepLink({ targetDeal }: { targetDeal?: string }) {
  useEffect(() => {
    if (!targetDeal || typeof window === "undefined") return;

    const rows = document.querySelectorAll<HTMLElement>(
      `[data-deal-id="${CSS.escape(targetDeal)}"]`,
    );
    if (rows.length > 0) {
      rows[0].scrollIntoView({ behavior: "smooth", block: "center" });
      const timers = Array.from(rows).map((row) => {
        row.classList.add("deeplink-highlight");
        return window.setTimeout(
          () => row.classList.remove("deeplink-highlight"),
          3000,
        );
      });
      // Limpa o param (não reabre em refresh nem polui o histórico).
      const url = new URL(window.location.href);
      url.searchParams.delete("deal");
      window.history.replaceState(null, "", url.pathname + url.search);
      return () => timers.forEach((t) => window.clearTimeout(t));
    }
  }, [targetDeal]);

  return null;
}
