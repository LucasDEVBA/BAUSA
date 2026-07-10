"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

import { BrandTabs } from "@/components/ui";

const TABS = [
  { id: "geral", label: "Visão Geral" },
  { id: "resultado", label: "Resultado" },
  { id: "saidas", label: "Saídas" },
  { id: "folha", label: "Folha" },
  { id: "nf_pendentes", label: "NFs Pendentes" },
  { id: "cancelamentos", label: "Cancelamentos" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface FinanceiroTabsProps {
  className?: string;
}

export function FinanceiroTabs({ className }: FinanceiroTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = (searchParams.get("tab") as TabId) || "geral";

  const handleChange = useCallback(
    (tab: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "geral") {
        params.delete("tab");
      } else {
        params.set("tab", tab);
      }
      const qs = params.toString();
      router.push(`${pathname}${qs ? `?${qs}` : ""}`);
    },
    [router, pathname, searchParams],
  );

  return (
    <BrandTabs
      items={TABS.map((t) => ({ id: t.id, label: t.label }))}
      activeId={currentTab}
      onSelect={handleChange}
      variant="segmented"
      ariaLabel="Abas do financeiro"
      className={className}
    />
  );
}
