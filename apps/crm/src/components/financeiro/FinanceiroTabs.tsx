"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "geral", label: "Visao Geral" },
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
    <div className={cn("flex gap-1 rounded-lg border border-[#1e2130] bg-[#0f1117] p-1", className)}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => handleChange(tab.id)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            currentTab === tab.id
              ? "bg-indigo-600 text-white"
              : "text-zinc-400 hover:bg-[#1e2130] hover:text-zinc-200"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
