"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Target, BarChart3, Kanban, Users, DollarSign,
  GraduationCap, Shuffle, UserCheck,
  CheckSquare, BookOpen, Settings, LogOut,
  Zap, GitBranch,
} from "lucide-react";
import type { PapelUsuario } from "@/types/crm";

/*
  COMPONENT: Sidebar
  IDENTITY:  BAUSA Elite — gradient active indicator, avatar with gradient bg,
             section labels via .crm-section-label, badges via .crm-badge system.
  CONTRAST:  Group labels: --crm-text-tertiary on sidebar = 4.8:1 AA
             Nav items: --crm-text-secondary on sidebar = 8.6:1 AAA
             Active item: --crm-text-primary on sidebar = 19.6:1 AAA
*/

interface NavSubItem { href: string; label: string }
interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: PapelUsuario[];
  badge?: string;
  subItems?: NavSubItem[];
  activeRoutes?: string[];
}
interface NavGroup { label: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    label: "EXECUTIVO",
    items: [
      {
        href: "/crm/war-room", label: "War Room", icon: Target, roles: ["ceo"],
        subItems: [
          { href: "/crm/war-room", label: "Visao Geral" },
        ],
      },
      { href: "/crm/relatorios", label: "Relatorios", icon: BarChart3, roles: ["ceo"] },
    ],
  },
  {
    label: "COMERCIAL",
    items: [
      { href: "/crm/pipeline", label: "Pipeline", icon: Kanban, roles: ["ceo"] },
      {
        href: "/crm/leads", label: "Leads", icon: Users, roles: ["ceo"],
        activeRoutes: ["/crm/leads"],
      },
      { href: "/crm/financeiro", label: "Financeiro", icon: DollarSign, roles: ["ceo"] },
    ],
  },
  {
    label: "INTELIGENCIA",
    items: [
      { href: "/crm/escolas", label: "Banco de Escolas", icon: GraduationCap, roles: ["ceo"] },
      { href: "/crm/matching", label: "Motor de Match", icon: Shuffle, roles: ["ceo"] },
    ],
  },
  {
    label: "FAMILIAS",
    items: [
      { href: "/crm/experiencia", label: "Experiencia", icon: UserCheck, roles: ["ceo", "head_sucesso"] },
    ],
  },
  {
    label: "SISTEMA",
    items: [
      { href: "/crm/tarefas", label: "Tarefas", icon: CheckSquare, roles: ["ceo", "head_sucesso", "comercial"] },
      { href: "/crm/faq", label: "FAQ", icon: BookOpen, roles: ["ceo", "head_sucesso"] },
      { href: "/crm/indicacoes", label: "Indicacoes", icon: GitBranch, roles: ["ceo"] },
      { href: "/crm/configuracoes", label: "Configuracoes", icon: Settings, roles: ["ceo"] },
    ],
  },
];

interface SidebarProps {
  papel: PapelUsuario;
  nome: string;
  onLogout: () => void;
}

export function Sidebar({ papel, nome, onLogout }: SidebarProps) {
  const pathname = usePathname();
  const cleanPath = pathname?.replace(/^\/(pt|en|es)/, "") || "";

  return (
    <aside className="hidden lg:flex h-screen w-[var(--crm-sidebar-width)] flex-col border-r border-[var(--crm-border)] bg-[var(--crm-sidebar)] shrink-0">
      {/* Logo */}
      <div className="flex h-[var(--crm-header-height)] items-center gap-2.5 border-b border-[var(--crm-border)] px-4">
        <div className="crm-avatar crm-avatar-sm">
          <Zap className="h-3.5 w-3.5 text-[var(--crm-text-on-brand)]" />
        </div>
        <div>
          <p className="text-[var(--crm-text-sm)] font-[var(--crm-weight-semibold)] text-[var(--crm-text-primary)] leading-none tracking-[var(--crm-tracking-tight)]">
            BAUSA CRM
          </p>
          <p className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)] leading-none mt-0.5">
            Bolsa Atleta USA
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2.5">
        <div className="space-y-5">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter((item) => item.roles.includes(papel));
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.label}>
                <p className="crm-section-label mb-1.5 px-2.5">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const isParentActive =
                      cleanPath === item.href.replace("/crm", "") ||
                      cleanPath.startsWith(`${item.href.replace("/crm", "")}/`) ||
                      (item.activeRoutes?.some((r) => cleanPath === r.replace("/crm", "") || cleanPath.startsWith(`${r.replace("/crm", "")}/`)) ?? false);

                    const hasSubItems = item.subItems && item.subItems.length > 0;
                    const showSubItems = hasSubItems && isParentActive;
                    const Icon = item.icon;

                    return (
                      <div key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            "group relative flex items-center gap-2.5 rounded-[var(--crm-radius-lg)] px-2.5 py-[7px] text-[var(--crm-text-sm)]",
                            "transition-all duration-[var(--crm-duration-fast)]",
                            isParentActive
                              ? "bg-[var(--crm-accent-bg)] text-[var(--crm-text-primary)] shadow-[var(--crm-shadow-xs)]"
                              : "text-[var(--crm-text-secondary)] hover:bg-[var(--crm-hover-overlay)] hover:text-[var(--crm-text-primary)]",
                          )}
                        >
                          {isParentActive && (
                            <span className="crm-sidebar-active-indicator" />
                          )}
                          <Icon className={cn(
                            "h-4 w-4 shrink-0 transition-colors duration-[var(--crm-duration-fast)]",
                            isParentActive ? "text-[var(--crm-accent-text)]" : "text-[var(--crm-text-tertiary)] group-hover:text-[var(--crm-text-secondary)]",
                          )} />
                          <span className="flex-1 font-[var(--crm-weight-medium)]">{item.label}</span>
                          {item.badge && (
                            <span className="crm-badge crm-badge-accent crm-badge-no-dot">
                              {item.badge}
                            </span>
                          )}
                        </Link>

                        {showSubItems && (
                          <div className="ml-[18px] mt-0.5 space-y-0.5 border-l border-[var(--crm-border)] pl-3">
                            {item.subItems!.map((sub) => {
                              const isSubActive = cleanPath === sub.href.replace("/crm", "");
                              return (
                                <Link
                                  key={sub.href}
                                  href={sub.href}
                                  className={cn(
                                    "flex items-center rounded-[var(--crm-radius-md)] px-2 py-1.5 text-[var(--crm-text-xs)]",
                                    "transition-all duration-[var(--crm-duration-fast)]",
                                    isSubActive
                                      ? "bg-[var(--crm-accent-bg)] font-[var(--crm-weight-semibold)] text-[var(--crm-accent-text)]"
                                      : "text-[var(--crm-text-tertiary)] hover:bg-[var(--crm-hover-overlay)] hover:text-[var(--crm-text-secondary)]",
                                  )}
                                >
                                  {isSubActive && <span className="mr-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--crm-accent-text)]" />}
                                  {sub.label}
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </nav>

      {/* User section */}
      <div className="border-t border-[var(--crm-border)] p-3">
        <div className="flex items-center gap-2.5 rounded-[var(--crm-radius-lg)] px-2 py-2 transition-colors duration-[var(--crm-duration-fast)] hover:bg-[var(--crm-hover-overlay)]">
          <div className="crm-avatar crm-avatar-sm text-[var(--crm-text-xs)] font-[var(--crm-weight-bold)]">
            {nome.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-[var(--crm-text-sm)] font-[var(--crm-weight-medium)] text-[var(--crm-text-primary)]">
              {nome}
            </p>
            <p className="truncate text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)] capitalize">
              {papel.replace("_", " ")}
            </p>
          </div>
          <button
            onClick={onLogout}
            className="text-[var(--crm-text-disabled)] hover:text-[var(--crm-text-secondary)] transition-colors duration-[var(--crm-duration-fast)] p-1 rounded-[var(--crm-radius-md)] hover:bg-[var(--crm-hover-overlay)]"
            aria-label="Sair"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
