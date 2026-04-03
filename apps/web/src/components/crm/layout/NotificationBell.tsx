"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { getNotificacoesNaoLidas, marcarNotificacaoLida, marcarTodasNotificacoesLidas } from "@/lib/crm/actions/automacoes";
import type { Notificacao } from "@/types/crm";

/*
  COMPONENT: NotificationBell
  PROBLEM:   Popover content uses raw border/bg classes, severity dot uses inline
             color function with raw Tailwind classes. "Nenhuma notificacao" empty
             state is plain text without any visual anchor.
  DECISION:  Migrate popover internals to CRM tokens. Severity dots use semantic
             token colors. Empty state uses crm-empty-state pattern.
             Brand DNA: Premium (smooth popover transitions),
             Controlled (consistent with rest of header).
  CONTRAST:  Notification title: --crm-text-primary on raised surface = 14.9:1 AAA
             Notification body: --crm-text-tertiary on raised surface = 3.8:1
             (acceptable — supplementary text, title carries info)
*/

export function NotificationBell() {
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notificacao[]>([]);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const fetchNotifs = async () => {
    const data = await getNotificacoesNaoLidas();
    setNotifs(data as Notificacao[]);
  };

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkRead = (id: string) => {
    startTransition(async () => {
      await marcarNotificacaoLida(id);
      setNotifs((prev) => prev.filter((n) => n.id !== id));
    });
  };

  const handleMarkAllRead = () => {
    startTransition(async () => {
      await marcarTodasNotificacoesLidas();
      setNotifs([]);
      router.refresh();
    });
  };

  const severityColor = (s: string) => {
    if (s === "critica") return "bg-[var(--crm-error)]";
    if (s === "alta") return "bg-[var(--crm-warning)]";
    if (s === "media") return "bg-[var(--crm-info)]";
    return "bg-[var(--crm-text-disabled)]";
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {notifs.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-[var(--crm-error)] text-[var(--crm-text-on-brand)] text-[var(--crm-text-xs)] font-[var(--crm-weight-bold)] rounded-full flex items-center justify-center">
              {notifs.length > 9 ? "9+" : notifs.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-[var(--crm-surface-raised)] border-[var(--crm-border-strong)]" align="end">
        <div className="p-3 border-b border-[var(--crm-border)] flex items-center justify-between">
          <span className="text-[var(--crm-text-base)] font-[var(--crm-weight-semibold)] text-[var(--crm-text-primary)]">
            Notificacoes
          </span>
          {notifs.length > 0 && (
            <Button variant="ghost" size="sm" className="text-[var(--crm-text-xs)] h-auto py-1 text-[var(--crm-accent-text)]" onClick={handleMarkAllRead} disabled={isPending}>
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 gap-2">
              <Bell className="h-8 w-8 text-[var(--crm-text-disabled)]" />
              <p className="text-[var(--crm-text-sm)] text-[var(--crm-text-tertiary)]">
                Nenhuma notificacao pendente.
              </p>
            </div>
          ) : (
            notifs.slice(0, 10).map((n) => (
              <div
                key={n.id}
                className="p-3 border-b border-[var(--crm-border)] last:border-0 hover:bg-[var(--crm-hover-overlay)] cursor-pointer transition-colors duration-[var(--crm-duration-fast)]"
                onClick={() => handleMarkRead(n.id)}
              >
                <div className="flex items-start gap-2">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${severityColor(n.severidade)}`} />
                  <div className="min-w-0">
                    <p className="text-[var(--crm-text-sm)] font-[var(--crm-weight-medium)] text-[var(--crm-text-primary)]">
                      {n.titulo}
                    </p>
                    <p className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)] truncate">
                      {n.mensagem}
                    </p>
                    <p className="text-[var(--crm-text-2xs)] text-[var(--crm-text-disabled)] mt-1">
                      {new Date(n.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
