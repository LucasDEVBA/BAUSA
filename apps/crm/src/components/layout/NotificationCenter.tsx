"use client";

import { useState, useEffect, useRef, useCallback, useTransition } from "react";
import { Bell, Check, CheckCheck, X } from "lucide-react";
import { toast } from "sonner";
import {
  getNotificacoesNaoLidas,
  marcarNotificacaoLida,
  marcarTodasNotificacoesLidas,
} from "@/lib/actions/automacoes";
import { cn } from "@/lib/utils";
import type { Notificacao } from "@/types/crm";

const SEVERIDADE_DOT: Record<string, string> = {
  critica: "bg-red-500",
  alta: "bg-orange-500",
  media: "bg-blue-500",
  baixa: "bg-zinc-500",
};

const REFRESH_INTERVAL_MS = 60_000;

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Agora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function NotificationCenter() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotificacoes = useCallback(() => {
    startTransition(async () => {
      try {
        const data = await getNotificacoesNaoLidas();
        setNotificacoes(data as Notificacao[]);
      } catch {
        // Silently fail on auto-refresh
      }
    });
  }, [startTransition]);

  useEffect(() => {
    fetchNotificacoes();
    const interval = setInterval(fetchNotificacoes, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchNotificacoes]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handler);
    }
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleMarcarLida = (id: string) => {
    startTransition(async () => {
      const result = await marcarNotificacaoLida(id);
      if (result.success) {
        setNotificacoes((prev) => prev.filter((n) => n.id !== id));
      }
    });
  };

  const handleMarcarTodasLidas = () => {
    startTransition(async () => {
      const result = await marcarTodasNotificacoesLidas();
      if (result.success) {
        setNotificacoes([]);
        toast.success("Todas as notificacoes marcadas como lidas");
      } else {
        toast.error("Erro ao marcar notificacoes");
      }
    });
  };

  const count = notificacoes.length;
  const displayList = notificacoes.slice(0, 10);

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((p) => !p)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-[#1e2130] bg-[#141720] text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-300"
        aria-label={`Notificacoes${count > 0 ? ` (${count} nao lidas)` : ""}`}
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[9px] font-bold text-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-[#1e2130] bg-[#0f1117] shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#1e2130] px-4 py-3">
            <p className="text-xs font-semibold text-zinc-200">
              Notificacoes {count > 0 && `(${count})`}
            </p>
            <div className="flex items-center gap-2">
              {count > 0 && (
                <button
                  onClick={handleMarcarTodasLidas}
                  disabled={isPending}
                  className="flex items-center gap-1 text-[10px] font-medium text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50"
                >
                  <CheckCheck className="h-3 w-3" />
                  Marcar todas
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-600 hover:text-zinc-400 transition-colors"
                aria-label="Fechar notificacoes"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {displayList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-zinc-600">
                <Bell className="mb-2 h-6 w-6" />
                <p className="text-xs">Nenhuma notificacao pendente</p>
              </div>
            ) : (
              displayList.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleMarcarLida(notif.id)}
                  className="flex w-full items-start gap-3 border-b border-[#1e2130] px-4 py-3 text-left transition-colors hover:bg-white/5 last:border-0"
                >
                  {/* Severity dot */}
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 flex-shrink-0 rounded-full",
                      SEVERIDADE_DOT[notif.severidade] ?? SEVERIDADE_DOT.baixa,
                    )}
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-zinc-200 line-clamp-1">
                      {notif.titulo}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-500 line-clamp-2">
                      {notif.mensagem}
                    </p>
                    <p className="mt-1 text-[10px] text-zinc-600">
                      {timeAgo(notif.created_at)}
                    </p>
                  </div>

                  {/* Mark as read icon */}
                  <Check className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-zinc-700 hover:text-indigo-400" />
                </button>
              ))
            )}
          </div>

          {count > 10 && (
            <div className="border-t border-[#1e2130] px-4 py-2 text-center">
              <p className="text-[10px] text-zinc-600">
                + {count - 10} notificacoes
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
