"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Users,
  Kanban,
  BarChart3,
  Settings,
  Target,
  Home,
  DollarSign,
  ChevronsLeft,
  ChevronsRight,
  GraduationCap,
  Shuffle,
  UserCheck,
  LogOut,
  Megaphone,
  MessageCircle,
  Workflow,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createBrowserClient } from "@/lib/supabase-browser";
import { PAPEL_LABEL } from "@/lib/papel";
import type { PapelUsuario } from "@/types/crm";

interface NavSubItem {
  href: string;
  label: string;
  roles?: PapelUsuario[];
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: PapelUsuario[];
  badge?: string;
  soon?: boolean;
  subItems?: NavSubItem[];
  activeRoutes?: string[];
  excludeRoutes?: string[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "MINHA ÁREA",
    items: [
      { href: "/minha-area", label: "Minha Área", icon: Home, roles: ["head_sucesso"] },
    ],
  },
  {
    label: "EXECUTIVO",
    items: [
      { href: "/war-room", label: "War Room", icon: Target, roles: ["ceo"], excludeRoutes: ["/war-room/familias"] },
      {
        href: "/analytics",
        label: "Analytics",
        icon: BarChart3,
        roles: ["ceo"],
        activeRoutes: [
          "/analytics",
          "/analytics/atribuicao",
          "/analytics/cac",
          "/analytics/conversas",
          "/analytics/reunioes",
          "/analytics/utm-builder",
        ],
      },
      { href: "/relatorios", label: "Relatorios", icon: BarChart3, roles: ["ceo"] },
    ],
  },
  {
    label: "COMERCIAL",
    items: [
      { href: "/pipeline", label: "Pipeline", icon: Kanban, roles: ["ceo"] },
      {
        href: "/leads",
        label: "Leads",
        icon: Users,
        roles: ["ceo"],
        activeRoutes: ["/dashboard", "/leads", "/leads/novo"],
        subItems: [{ href: "/leads/novo", label: "+ Novo Lead" }],
      },
      { href: "/agenda", label: "Agenda", icon: CalendarDays, roles: ["ceo"] },
      { href: "/financeiro", label: "Financeiro", icon: DollarSign, roles: ["ceo"] },
      { href: "/remarketing", label: "Re-marketing", icon: Megaphone, roles: ["ceo"] },
      { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle, roles: ["ceo", "head_sucesso"] },
      { href: "/automacoes", label: "Automações", icon: Workflow, roles: ["ceo"] },
    ],
  },
  {
    label: "INTELIGÊNCIA",
    items: [
      { href: "/escolas", label: "Banco de Escolas", icon: GraduationCap, roles: ["ceo"] },
      { href: "/matching", label: "Motor de Match", icon: Shuffle, roles: ["ceo"] },
    ],
  },
  {
    label: "FAMÍLIAS",
    items: [
      {
        href: "/familias-crm",
        label: "Famílias",
        icon: UserCheck,
        roles: ["ceo", "head_sucesso"],
        activeRoutes: ["/familias", "/familias-crm", "/familias-pipeline", "/war-room/familias"],
        // Sub-itens só p/ CEO/CTO: alternam entre a área do Head e o painel gerencial.
        subItems: [
          { href: "/familias-crm", label: "Head", roles: ["ceo"] },
          { href: "/war-room/familias", label: "Gerencial", roles: ["ceo"] },
        ],
      },
    ],
  },
  {
    label: "SISTEMA",
    items: [
      {
        href: "/sistema",
        label: "Sistema",
        icon: Settings,
        roles: ["ceo", "head_sucesso"],
        activeRoutes: [
          "/sistema",
          "/tarefas",
          "/faq",
          "/indicacoes",
          "/automacoes-monitor",
          "/audit",
          "/configuracoes",
        ],
        // Hub /sistema + sub-páginas; Monitor/Audit/Configurações só CEO/CTO.
        // Automações (builder) mora no grupo COMERCIAL.
        subItems: [
          { href: "/tarefas", label: "Tarefas" },
          { href: "/faq", label: "FAQ" },
          { href: "/indicacoes", label: "Indicações" },
          { href: "/automacoes-monitor", label: "Monitor de filas", roles: ["ceo"] },
          { href: "/audit", label: "Audit Trail", roles: ["ceo"] },
          { href: "/configuracoes", label: "Configurações", roles: ["ceo"] },
        ],
      },
    ],
  },
];

// Marcador de cor por seção — identidade BAU (sem dourado, fora da marca oficial).
const GROUP_DOT: Record<string, string> = {
  "MINHA ÁREA": "bg-sys-green",
  EXECUTIVO: "bg-bau-blue",
  COMERCIAL: "bg-sys-orange",
  INTELIGÊNCIA: "bg-sys-purple",
  FAMÍLIAS: "bg-bau-burgundy",
  SISTEMA: "bg-muted-foreground",
};

const STORAGE_KEY = "bausa-sidebar-collapsed";

interface SidebarProps {
  papel: PapelUsuario;
  nome: string;
  avatarUrl: string | null;
}

export function Sidebar({ papel, nome, avatarUrl }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const papelEfetivo: PapelUsuario = papel === "cto" ? "ceo" : papel;

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* localStorage indisponivel — mantem expandida */
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignora erro de storage */
      }
      return next;
    });
  };

  const handleLogout = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-300",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* Workspace header */}
      <div
        className={cn(
          "flex h-16 items-center border-b border-sidebar-border",
          collapsed ? "justify-center px-2" : "gap-2.5 px-4",
        )}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-brand shadow-sm">
          <Image src="/brand/bausa-bau.png" alt="BAU" width={26} height={18} priority />
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-none tracking-tight text-sidebar-foreground">
              BAU Engine
            </p>
            <p className="mt-1 truncate text-[11px] leading-none text-muted-foreground">
              Bolsa Atleta USA
            </p>
          </div>
        )}
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        <div className="space-y-5">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter((item) => item.roles.includes(papelEfetivo));
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.label}>
                {!collapsed && (
                  <div className="mb-1.5 flex items-center gap-1.5 px-2">
                    <span className={cn("size-1.5 rounded-full", GROUP_DOT[group.label] ?? "bg-muted-foreground")} />
                    <p className="text-eyebrow text-label-tertiary">{group.label}</p>
                  </div>
                )}
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const isExcluded =
                      item.excludeRoutes?.some((r) => pathname === r || pathname.startsWith(`${r}/`)) ?? false;
                    const isParentActive =
                      !isExcluded &&
                      (pathname === item.href ||
                        pathname.startsWith(`${item.href}/`) ||
                        (item.activeRoutes?.some((r) => pathname === r || pathname.startsWith(`${r}/`)) ?? false));
                    const visibleSubItems = item.subItems?.filter(
                      (sub) => !sub.roles || sub.roles.includes(papelEfetivo),
                    );
                    const hasSubItems = !!visibleSubItems && visibleSubItems.length > 0;
                    const showSubItems = hasSubItems && isParentActive && !collapsed;
                    const Icon = item.icon;

                    return (
                      <div key={item.href}>
                        <Link
                          href={item.soon ? "#" : item.href}
                          title={collapsed ? item.label : undefined}
                          aria-current={isParentActive ? "page" : undefined}
                          className={cn(
                            "group relative flex items-center rounded-lg py-2 text-sm transition-colors",
                            collapsed ? "justify-center px-0" : "gap-2.5 px-2.5",
                            isParentActive
                              ? "bg-primary/10 font-medium text-primary"
                              : item.soon
                                ? "cursor-not-allowed text-label-tertiary"
                                : "text-muted-foreground hover:bg-accent hover:text-foreground",
                          )}
                        >
                          {isParentActive && (
                            <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
                          )}
                          <Icon className="size-4 shrink-0" />
                          {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                          {!collapsed && item.badge && !item.soon && (
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
                              {item.badge}
                            </span>
                          )}
                          {!collapsed && item.soon && (
                            <span className="text-eyebrow text-label-tertiary">em breve</span>
                          )}
                        </Link>

                        {showSubItems && (
                          <div className="ml-4 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3">
                            {visibleSubItems!.map((sub) => {
                              const isSubActive = pathname === sub.href;
                              return (
                                <Link
                                  key={sub.href}
                                  href={sub.href}
                                  className={cn(
                                    "flex items-center rounded-md px-2 py-1.5 text-xs transition-colors",
                                    isSubActive
                                      ? "font-semibold text-primary"
                                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                                  )}
                                >
                                  {isSubActive && <span className="mr-1.5 size-1 shrink-0 rounded-full bg-primary" />}
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

      {/* Recolher / expandir */}
      <button
        onClick={toggleCollapsed}
        title={collapsed ? "Expandir menu" : "Recolher menu"}
        aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        aria-pressed={collapsed}
        className={cn(
          "flex items-center border-t border-sidebar-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
          collapsed ? "justify-center py-3" : "gap-2.5 px-4 py-2.5",
        )}
      >
        {collapsed ? (
          <ChevronsRight className="size-4" />
        ) : (
          <>
            <ChevronsLeft className="size-4" />
            <span className="text-xs font-medium">Recolher</span>
          </>
        )}
      </button>

      {/* Perfil */}
      <div className={cn("border-t border-sidebar-border", collapsed ? "p-2" : "p-3")}>
        <div className={cn("flex items-center", collapsed ? "flex-col gap-2" : "gap-1")}>
          <Link
            href="/perfil"
            title="Meu perfil"
            className={cn(
              "flex min-w-0 items-center rounded-lg transition-colors hover:bg-accent",
              collapsed ? "p-1" : "flex-1 gap-2.5 px-2 py-2 text-left",
            )}
          >
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={nome}
                width={28}
                height={28}
                unoptimized
                className="size-7 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-xs font-bold text-white">
                {nome.charAt(0).toUpperCase()}
              </span>
            )}
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">{nome}</p>
                <p className="truncate text-[10px] text-muted-foreground">{PAPEL_LABEL[papel]}</p>
              </div>
            )}
          </Link>
          <button
            onClick={handleLogout}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
