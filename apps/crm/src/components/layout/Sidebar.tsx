"use client";

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
  Zap,
  ChevronRight,
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

interface SidebarProps {
  papel: PapelUsuario;
  nome: string;
}

export function Sidebar({ papel, nome }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-sys-purple">
          <Zap className="h-4 w-4 text-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-sidebar-foreground leading-none">BAUSA Engine</p>
          <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Bolsa Atleta USA</p>
        </div>
      </div>

      {/* Navegação principal */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <div className="space-y-4">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter((item) => item.roles.includes(papel));
            if (visibleItems.length === 0) return null;

            return (
            <div key={group.label}>
              <p className="mb-1 px-3 text-[10px] font-semibold tracking-widest text-label-tertiary">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isParentActive =
                    pathname === item.href ||
                    pathname.startsWith(`${item.href}/`) ||
                    (item.activeRoutes?.some(
                      (r) => pathname === r || pathname.startsWith(`${r}/`)
                    ) ?? false);

                  const hasSubItems = item.subItems && item.subItems.length > 0;
                  const showSubItems = hasSubItems && isParentActive;
                  const Icon = item.icon;

                  return (
                    <div key={item.href}>
                      <Link
                        href={item.soon ? "#" : item.href}
                        className={cn(
                          "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all",
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
                        <span className="flex-1 font-medium">{item.label}</span>
                        {item.badge && !item.soon && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/20 px-1.5 text-[10px] font-semibold text-primary">
                            {item.badge}
                          </span>
                        )}
                        {item.soon && (
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

      {/* User info */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-fill-4">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-sys-purple text-xs font-bold text-primary-foreground">
            {nome.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-medium text-foreground">{nome}</p>
            <p className="truncate text-[10px] text-muted-foreground capitalize">{papel.replace("_", " ")}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-fill-4"
            aria-label="Sair"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
