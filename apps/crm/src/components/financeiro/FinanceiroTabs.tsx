"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "geral", label: "Visão Geral" },
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
    (tab: TabId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "geral") {
        params.delete("tab");
      } else {
        params.set("tab", tab);
      }
      const qs = params.toString();
      router.push(`${pathname}${qs ? `?${qs}` : ""}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className={cn("liquid-glass flex gap-1 rounded-lg p-1", className)}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => handleChange(tab.id)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            currentTab === tab.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-fill-4 hover:text-foreground"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
