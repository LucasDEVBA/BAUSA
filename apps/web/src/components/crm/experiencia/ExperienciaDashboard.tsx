"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Phone, Clock, ChevronRight, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { FamiliaModal } from "./FamiliaModal";

interface ExperienciaItem {
  id: string;
  atleta_id: string;
  deal_id: string;
  fase: string;
  temperatura: string;
  ansiedade: number;
  satisfacao: number;
  status: string;
  descricao_problema: string | null;
  data_ultimo_contato: string | null;
  proximo_contato: string | null;
  atleta: {
    nome_completo: string;
    whatsapp: string;
    esporte: string;
    responsavel: { nome: string; whatsapp: string } | null;
  } | null;
  deal: {
    id: string;
    etapa: string;
    contrato: { plano: string; valor_total: number } | null;
  } | null;
}

interface Tarefa {
  id: string;
  titulo: string;
  prazo: string;
  prioridade: string;
  status: string;
  deal_id: string | null;
}

interface Props {
  experiencias: ExperienciaItem[];
  tarefas: Tarefa[];
  papel: string;
}

const TEMP_CONFIG: Record<string, { bg: string; label: string; Icon: typeof CheckCircle2 }> = {
  verde: { bg: "crm-badge-success", label: "OK", Icon: CheckCircle2 },
  amarelo: { bg: "crm-badge-warning", label: "Atencao", Icon: AlertCircle },
  vermelho: { bg: "crm-badge-error", label: "Crise", Icon: XCircle },
};

export function ExperienciaDashboard({ experiencias, tarefas, papel }: Props) {
  const [selectedExp, setSelectedExp] = useState<ExperienciaItem | null>(null);

  const hoje = new Date().toISOString();
  const em7dias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Tarefas atrasadas + criticas do dia
  const tarefasUrgentes = tarefas
    .filter((t) => t.status !== "concluida" && t.status !== "cancelada")
    .filter((t) => t.prazo < hoje || t.prioridade === "critica")
    .slice(0, 5);

  // Familias em crise ou atencao
  const emAlerta = experiencias
    .filter((e) => e.status === "crise" || e.status === "atencao" || e.temperatura === "vermelho");

  // Dias sem contato
  const calcDiasSemContato = (data: string | null) => {
    if (!data) return 999;
    return Math.floor((Date.now() - new Date(data).getTime()) / (1000 * 60 * 60 * 24));
  };

  // Familias ordenadas: crise -> atencao -> dias sem contato desc
  const familiasOrdenadas = [...experiencias].sort((a, b) => {
    const statusOrder: Record<string, number> = { crise: 0, atencao: 1, satisfeita: 2 };
    const sa = statusOrder[a.status] ?? 2;
    const sb = statusOrder[b.status] ?? 2;
    if (sa !== sb) return sa - sb;
    return calcDiasSemContato(b.data_ultimo_contato) - calcDiasSemContato(a.data_ultimo_contato);
  });

  // Proximos contatos (7 dias)
  const proximosContatos = experiencias
    .filter((e) => e.proximo_contato && e.proximo_contato <= em7dias && e.proximo_contato >= hoje.split("T")[0])
    .sort((a, b) => (a.proximo_contato || "").localeCompare(b.proximo_contato || ""));

  // "Fazer agora": tarefas urgentes + familias em alerta
  const fazerAgora = [
    ...tarefasUrgentes.map((t) => ({
      key: `t-${t.id}`,
      tipo: "tarefa" as const,
      titulo: t.titulo,
      subtitulo: t.prioridade === "critica" ? "Critica" : "Atrasada",
      urgente: true,
    })),
    ...emAlerta.slice(0, 3).map((e) => ({
      key: `e-${e.id}`,
      tipo: "familia" as const,
      titulo: e.atleta?.nome_completo || "Familia",
      subtitulo: e.status === "crise" ? "CRISE" : "Atencao",
      urgente: e.status === "crise",
      exp: e,
    })),
  ].slice(0, 5);

  return (
    <>
      <div className="space-y-4">
        {/* SECAO 1 -- Fazer agora */}
        {fazerAgora.length > 0 && (
          <div className="crm-card border-[var(--crm-error-border)] bg-[var(--crm-error-tint)] !shadow-none">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-[var(--crm-error)]" />
              <h3 className="text-[var(--crm-text-md)] font-[var(--crm-weight-semibold)] text-[var(--crm-text-primary)]">Fazer agora</h3>
            </div>
            <div className="space-y-2">
              {fazerAgora.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between p-3 bg-[var(--crm-surface)] rounded-[var(--crm-radius-lg)] border border-[var(--crm-border)] cursor-pointer hover:bg-[var(--crm-surface-hover)] transition-colors duration-[var(--crm-duration-fast)]"
                  onClick={() => {
                    if (item.tipo === "familia" && "exp" in item) {
                      setSelectedExp(item.exp as ExperienciaItem);
                    }
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-[var(--crm-text-sm)] font-[var(--crm-weight-medium)] truncate text-[var(--crm-text-primary)]">{item.titulo}</p>
                    <p className={cn(
                      "text-[var(--crm-text-xs)]",
                      item.urgente ? "text-[var(--crm-error)] font-[var(--crm-weight-semibold)]" : "text-[var(--crm-warning)]",
                    )}>
                      {item.subtitulo}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--crm-text-tertiary)] shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECAO 2 -- Familias */}
        <div>
          <h2 className="text-[var(--crm-text-md)] font-[var(--crm-weight-semibold)] mb-3 flex items-center gap-2 text-[var(--crm-text-primary)]">
            Familias
            <span className="crm-badge crm-badge-neutral crm-badge-no-dot text-[var(--crm-text-xs)]">{experiencias.length}</span>
          </h2>
          {familiasOrdenadas.length === 0 ? (
            <div className="crm-card">
              <div className="crm-empty-state">
                <p className="crm-empty-state-description">Nenhuma familia no CRM Experiencia.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {familiasOrdenadas.map((exp) => {
                const dias = calcDiasSemContato(exp.data_ultimo_contato);
                const tempConfig = TEMP_CONFIG[exp.temperatura] || TEMP_CONFIG.verde;
                const TempIcon = tempConfig.Icon;
                const threshold = exp.fase === "admissao" ? 7 : exp.fase === "pre_embarque" ? 15 : exp.fase === "embarcado_inicial" ? 7 : 30;
                const inativa = dias > threshold;

                return (
                  <div
                    key={exp.id}
                    className={cn(
                      "crm-card crm-card-interactive !p-3",
                      inativa && "border-[var(--crm-error-border)]",
                    )}
                    onClick={() => setSelectedExp(exp)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <TempIcon className={cn(
                            "w-4 h-4 shrink-0",
                            exp.temperatura === "verde" && "text-[var(--crm-success)]",
                            exp.temperatura === "amarelo" && "text-[var(--crm-warning)]",
                            exp.temperatura === "vermelho" && "text-[var(--crm-error)]",
                          )} />
                          <span className="text-[var(--crm-text-sm)] font-[var(--crm-weight-medium)] truncate text-[var(--crm-text-primary)]">
                            {exp.atleta?.nome_completo || "\u2014"}
                          </span>
                          <span className={cn("crm-badge crm-badge-no-dot text-[var(--crm-text-xs)] shrink-0", tempConfig.bg)}>
                            {tempConfig.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">
                          <span className="capitalize">{exp.fase?.replace("_", " ")}</span>
                          <span className={cn(inativa && "text-[var(--crm-error)] font-[var(--crm-weight-medium)]")}>
                            {dias < 999 ? `${dias}d sem contato` : "Sem contato"}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-[var(--crm-text-secondary)] hover:text-[var(--crm-text-primary)]"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedExp(exp);
                        }}
                      >
                        <Phone className="w-4 h-4 mr-1" />
                        Contato
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECAO 3 -- Minha semana */}
        {proximosContatos.length > 0 && (
          <div className="crm-card">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-[var(--crm-text-tertiary)]" />
              <h3 className="text-[var(--crm-text-md)] font-[var(--crm-weight-semibold)] text-[var(--crm-text-primary)]">Proximos 7 dias</h3>
            </div>
            <div className="space-y-2">
              {proximosContatos.slice(0, 7).map((exp) => (
                <div key={exp.id} className="flex items-center justify-between text-[var(--crm-text-sm)]">
                  <span className="text-[var(--crm-text-tertiary)]">
                    {exp.proximo_contato ? new Date(exp.proximo_contato).toLocaleDateString("pt-BR") : "\u2014"}
                  </span>
                  <span className="font-[var(--crm-weight-medium)] truncate ml-3 text-[var(--crm-text-primary)]">{exp.atleta?.nome_completo || "\u2014"}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal de familia */}
      <FamiliaModal
        experiencia={selectedExp}
        open={!!selectedExp}
        onClose={() => setSelectedExp(null)}
      />
    </>
  );
}
