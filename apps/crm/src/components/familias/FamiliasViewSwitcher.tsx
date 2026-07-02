"use client";

import { usePathname } from "next/navigation";
import { HeartHandshake, LayoutDashboard } from "lucide-react";
import { BrandTabs } from "@/components/ui";

/**
 * Alterna entre as duas visões de Famílias para CEO/CTO:
 * - Head: a área operacional do Head de Sucesso (/familias-crm e sub-visões)
 * - Gerencial: o painel executivo de famílias (/war-room/familias)
 * Renderizar apenas para nível CEO (o Head só enxerga a própria área).
 */
export function FamiliasViewSwitcher() {
  const pathname = usePathname();
  const isGerencial = pathname.startsWith("/war-room/familias");

  return (
    <BrandTabs
      items={[
        { id: "head", label: "Head", icon: HeartHandshake, href: "/familias-crm" },
        { id: "gerencial", label: "Gerencial", icon: LayoutDashboard, href: "/war-room/familias" },
      ]}
      activeId={isGerencial ? "gerencial" : "head"}
      ariaLabel="Visão de famílias"
    />
  );
}
