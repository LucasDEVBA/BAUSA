import Link from "next/link";
import {
  Activity,
  BookOpen,
  CheckSquare,
  ChevronRight,
  FileText,
  GitBranch,
  Settings,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { requirePapel } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import type { PapelUsuario } from "@/types/crm";

export const dynamic = "force-dynamic";

interface SistemaModule {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  roles: PapelUsuario[];
}

/** Módulos da área Sistema — mesmo gating de papel dos sub-itens do sidebar. */
const MODULES: SistemaModule[] = [
  {
    href: "/tarefas",
    label: "Tarefas",
    description: "Tarefas da operação com prioridade, prazo e responsável.",
    icon: CheckSquare,
    roles: ["ceo", "head_sucesso"],
  },
  {
    href: "/documentos",
    label: "Documentos",
    description: "Checklist de documentos por atleta, com status e upload.",
    icon: FileText,
    roles: ["ceo", "head_sucesso"],
  },
  {
    href: "/faq",
    label: "FAQ",
    description: "Base de conhecimento interna — respostas prontas por categoria.",
    icon: BookOpen,
    roles: ["ceo", "head_sucesso"],
  },
  {
    href: "/indicacoes",
    label: "Indicações",
    description: "Programa de indicação — indicadores, conversões e recompensas.",
    icon: GitBranch,
    roles: ["ceo", "head_sucesso"],
  },
  // Automações (builder) mora no grupo COMERCIAL do sidebar (/automacoes).
  {
    href: "/automacoes-monitor",
    label: "Monitor de filas",
    description: "Saúde das automações de sistema — filas de WhatsApp e follow-ups.",
    icon: Activity,
    roles: ["ceo"],
  },
  {
    href: "/audit",
    label: "Audit Trail",
    description: "Histórico imutável de alterações em todas as tabelas críticas.",
    icon: Shield,
    roles: ["ceo"],
  },
  {
    href: "/configuracoes",
    label: "Configurações",
    description: "Parâmetros do sistema, metas, scoring e gestão de usuários.",
    icon: Settings,
    roles: ["ceo"],
  },
];

export default async function SistemaPage() {
  const papel = await requirePapel(["ceo", "head_sucesso"]);
  const modules = MODULES.filter((m) => m.roles.includes(papel));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Sistema"
        title="Central do Sistema"
        description="Módulos operacionais e administrativos do BAU Engine."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <Link
              key={mod.href}
              href={mod.href}
              className="group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Card interactive className="flex h-full items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon aria-hidden className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">{mod.label}</span>
                    <ChevronRight
                      aria-hidden
                      className="size-3.5 shrink-0 text-label-tertiary transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    {mod.description}
                  </span>
                </span>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
