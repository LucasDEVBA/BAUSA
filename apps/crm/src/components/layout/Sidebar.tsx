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
  BookOpen,
  LogOut,
  CheckSquare,
  GitBranch,
  FileText,
  Shield,
  Activity,
  Megaphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createBrowserClient } from "@/lib/supabase-browser";
import { PAPEL_LABEL } from "@/lib/papel";
import type { PapelUsuario } from "@/types/crm";

interface NavSubItem {
  href: string;
  label: string;
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
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "MINHA ÁREA",
    items: [
      {
        href: "/minha-area",
        label: "Minha Área",
        icon: Home,
        roles: ["head_sucesso"],
      },
    ],
  },
  {
    label: "EXECUTIVO",
    items: [
      {
        href: "/war-room",
        label: "War Room",
        icon: Target,
        roles: ["ceo"],
        subItems: [
          { href: "/war-room/dashboard", label: "Dashboard" },
          { href: "/war-room", label: "Visão Geral" },
          { href: "/war-room/meta", label: "Meta e Receita" },
          { href: "/war-room/funil", label: "Funil Comercial" },
          { href: "/war-room/caixa", label: "Caixa" },
          { href: "/war-room/risco", label: "Receita em Risco" },
          { href: "/war-room/posicionamento", label: "Posicionamento" },
          { href: "/war-room/familias", label: "Famílias" },
          { href: "/war-room/familias-onboarding", label: "Onboarding Famílias" },
        ],
      },
      {
        href: "/analytics",
        label: "Analytics",
        icon: BarChart3,
        roles: ["ceo"],
        subItems: [
          { href: "/analytics", label: "Receita" },
          { href: "/analytics/atribuicao", label: "Atribuição" },
          { href: "/analytics/cac", label: "CAC/ROI" },
          { href: "/analytics/utm-builder", label: "Gerador UTM" },
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
        badge: "8",
        activeRoutes: ["/dashboard", "/leads"],
        subItems: [
          { href: "/dashboard", label: "Dashboard" },
          { href: "/leads", label: "Lista" },
          { href: "/leads/novo", label: "+ Novo Lead" },
        ],
      },
      { href: "/financeiro", label: "Financeiro", icon: DollarSign, roles: ["ceo"] },
      { href: "/remarketing", label: "Re-marketing", icon: Megaphone, roles: ["ceo"] },
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
      { href: "/familias", label: "Visao Consolidada", icon: Users, roles: ["ceo", "head_sucesso"] },
      {
        href: "/familias-crm",
        label: "Experiência",
        icon: UserCheck,
        roles: ["ceo", "head_sucesso"],
        activeRoutes: ["/familias-crm"],
      },
      {
        href: "/familias-pipeline",
        label: "Pipeline da Família",
        icon: Kanban,
        roles: ["ceo", "head_sucesso"],
        activeRoutes: ["/familias-pipeline"],
      },
    ],
  },
  {
    label: "SISTEMA",
    items: [
      { href: "/tarefas", label: "Tarefas", icon: CheckSquare, roles: ["ceo", "head_sucesso"] },
      { href: "/documentos", label: "Documentos", icon: FileText, roles: ["ceo", "head_sucesso"] },
      { href: "/faq", label: "FAQ", icon: BookOpen, roles: ["ceo", "head_sucesso"] },
      { href: "/indicacoes", label: "Indicações", icon: GitBranch, roles: ["ceo", "head_sucesso"] },
      { href: "/automacoes-monitor", label: "Automacoes", icon: Activity, roles: ["ceo"] },
      { href: "/audit", label: "Audit Trail", icon: Shield, roles: ["ceo"] },
      { href: "/configuracoes", label: "Configurações", icon: Settings, roles: ["ceo"] },
    ],
  },
];

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
  // CTO tem o mesmo acesso do CEO — normaliza p/ o filtro de visibilidade dos itens.
  const papelEfetivo: PapelUsuario = papel === "cto" ? "ceo" : papel;

  useEffect(() => {
    try {
      // Sync inicial a partir do localStorage (evita hydration mismatch via effect).
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
        "flex h-screen flex-col border-r border-sidebar-border bg-sidebar/70 backdrop-blur-xl transition-[width] duration-300",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex h-14 items-center border-b border-sidebar-border",
          collapsed ? "justify-center px-2" : "gap-2.5 px-4",
        )}
      >
        <Image
          src="/brand/bausa-bau.png"
          alt="BAUSA"
          width={48}
          height={32}
          priority
          className="flex-shrink-0"
        />
        {!collapsed && (
          <div>
            <p className="text-sm font-semibold text-sidebar-foreground leading-none">BAU Global</p>
            <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Bolsa Atleta USA</p>
          </div>
        )}
      </div>

      {/* Navegação principal */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <div className="space-y-4">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter((item) => item.roles.includes(papelEfetivo));
            if (visibleItems.length === 0) return null;

            return (
            <div key={group.label}>
              {!collapsed && (
                <p className="mb-1 px-3 text-[10px] font-semibold tracking-widest text-label-tertiary">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isParentActive =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`) ||
                    (item.activeRoutes?.some(
                      (r) => pathname === r || pathname.startsWith(`${r}/`)
                    ) ?? false);

                  const hasSubItems = item.subItems && item.subItems.length > 0;
                  const showSubItems = hasSubItems && isParentActive && !collapsed;
                  const Icon = item.icon;

                  return (
                    <div key={item.href}>
                      <Link
                        href={item.soon ? "#" : item.href}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "group relative flex items-center rounded-lg py-2 text-sm transition-all",
                          collapsed ? "justify-center px-0" : "gap-2.5 px-3",
                          isParentActive
                            ? "bg-primary/15 text-foreground"
                            : item.soon
                            ? "text-label-tertiary cursor-not-allowed"
                            : "text-muted-foreground hover:bg-fill-4 hover:text-foreground"
                        )}
                      >
                        {isParentActive && (
                          <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
                        )}
                        <Icon
                          className={cn(
                            "h-4 w-4 flex-shrink-0",
                            isParentActive ? "text-primary" : ""
                          )}
                        />
                        {!collapsed && (
                          <span className="flex-1 font-medium">{item.label}</span>
                        )}
                        {!collapsed && item.badge && !item.soon && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/20 px-1.5 text-[10px] font-semibold text-primary">
                            {item.badge}
                          </span>
                        )}
                        {!collapsed && item.soon && (
                          <span className="text-[9px] font-medium uppercase tracking-wider text-label-tertiary">
                            em breve
                          </span>
                        )}
                      </Link>

                      {showSubItems && (
                        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3">
                          {item.subItems!.map((sub) => {
                            const isSubActive = pathname === sub.href;
                            return (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                className={cn(
                                  "flex items-center rounded-md px-2 py-1.5 text-xs transition-all",
                                  isSubActive
                                    ? "bg-primary/12 font-semibold text-primary"
                                    : "text-muted-foreground hover:bg-fill-4 hover:text-foreground"
                                )}
                              >
                                {isSubActive && (
                                  <span className="mr-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-primary" />
                                )}
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
          "flex items-center border-t border-sidebar-border text-muted-foreground transition-colors hover:bg-fill-4 hover:text-foreground",
          collapsed ? "justify-center py-3" : "gap-2.5 px-4 py-2.5",
        )}
      >
        {collapsed ? (
          <ChevronsRight className="h-4 w-4" />
        ) : (
          <>
            <ChevronsLeft className="h-4 w-4" />
            <span className="text-xs font-medium">Recolher</span>
          </>
        )}
      </button>

      {/* User info → Meu Perfil */}
      <div className={cn("border-t border-sidebar-border", collapsed ? "p-2" : "p-3")}>
        <div className={cn("flex items-center", collapsed ? "flex-col gap-2" : "gap-1")}>
          <Link
            href="/perfil"
            title="Meu perfil"
            className={cn(
              "flex min-w-0 items-center rounded-lg transition-colors hover:bg-fill-4",
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
                className="h-7 w-7 flex-shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-sys-purple text-xs font-bold text-primary-foreground">
                {nome.charAt(0).toUpperCase()}
              </div>
            )}
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="truncate text-xs font-medium text-foreground">{nome}</p>
                <p className="truncate text-[10px] text-muted-foreground">{PAPEL_LABEL[papel]}</p>
              </div>
            )}
          </Link>
          <button
            onClick={handleLogout}
            className="flex-shrink-0 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-fill-4 hover:text-foreground"
            aria-label="Sair"
            title="Sair"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
