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
      { href: "/configuracoes", label: "Configuraç��es", icon: Settings, roles: ["ceo"] },
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
    <aside className="flex h-screen w-60 flex-col border-r border-[#1e2130] bg-[#0f1117]">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-[#1e2130] px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white leading-none">BAUSA Engine</p>
          <p className="text-[10px] text-zinc-500 leading-none mt-0.5">Bolsa Atleta USA</p>
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
              <p className="mb-1 px-3 text-[10px] font-semibold tracking-widest text-zinc-600">
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
                            ? "bg-indigo-600/20 text-white"
                            : item.soon
                            ? "text-zinc-600 cursor-not-allowed"
                            : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                        )}
                      >
                        {isParentActive && (
                          <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-indigo-500" />
                        )}
                        <Icon
                          className={cn(
                            "h-4 w-4 flex-shrink-0",
                            isParentActive ? "text-indigo-400" : ""
                          )}
                        />
                        <span className="flex-1 font-medium">{item.label}</span>
                        {item.badge && !item.soon && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600/30 px-1.5 text-[10px] font-semibold text-indigo-300">
                            {item.badge}
                          </span>
                        )}
                        {item.soon && (
                          <span className="text-[9px] font-medium uppercase tracking-wider text-zinc-600">
                            em breve
                          </span>
                        )}
                      </Link>

                      {showSubItems && (
                        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-[#1e2130] pl-3">
                          {item.subItems!.map((sub) => {
                            const isSubActive = pathname === sub.href;
                            return (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                className={cn(
                                  "flex items-center rounded-md px-2 py-1.5 text-xs transition-all",
                                  isSubActive
                                    ? "bg-indigo-600/15 font-semibold text-indigo-300"
                                    : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                                )}
                              >
                                {isSubActive && (
                                  <span className="mr-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-indigo-400" />
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
      <div className="border-t border-[#1e2130] p-3">
        <div className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/5">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-bold text-white">
            {nome.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-medium text-zinc-200">{nome}</p>
            <p className="truncate text-[10px] text-zinc-500 capitalize">{papel.replace("_", " ")}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-zinc-600 hover:text-zinc-300 transition-colors p-1 rounded-lg hover:bg-white/5"
            aria-label="Sair"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
