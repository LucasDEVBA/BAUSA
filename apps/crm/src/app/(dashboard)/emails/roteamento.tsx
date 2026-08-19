"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Plus, Route, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge, Button, Card, EmptyState, Input } from "@/components/ui";
import { localPart } from "@/components/emails/email-status";
import { salvarRoteamentoEmails } from "@/lib/actions/emails";
import type { EmailRoteamentoRegra } from "@/lib/emails-queries";

const DOMINIO = "@bolsaatletausa.com";

const SELECT_CLS =
  "h-9 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/25";

/**
 * Aba Roteamento (/emails) — CRUD das regras alias→caixa da chave
 * `emails_roteamento`. A lista exibida vem SEMPRE das props (fonte: server) —
 * cada operação salva a lista inteira e dá router.refresh(), sem estado
 * duplicado que possa divergir do banco.
 */
export function RoteamentoTab({
  contas,
  regras,
}: {
  contas: string[];
  regras: EmailRoteamentoRegra[];
}) {
  const router = useRouter();
  const [alias, setAlias] = useState("");
  const [caixa, setCaixa] = useState(contas[0] ?? "");
  const [salvando, startSalvar] = useTransition();

  const aliasNormalizado = alias.trim().toLowerCase();
  const aliasValido =
    /^[^\s@]+@[^\s@]+$/.test(aliasNormalizado) && aliasNormalizado.endsWith(DOMINIO);
  const duplicado = regras.some((r) => r.alias === aliasNormalizado);

  const salvar = (novasRegras: EmailRoteamentoRegra[], msgOk: string) => {
    startSalvar(async () => {
      const res = await salvarRoteamentoEmails(novasRegras);
      if (!res.success) {
        toast.error(res.error ?? "Não foi possível salvar as regras.");
        return;
      }
      toast.success(msgOk);
      setAlias("");
      router.refresh();
    });
  };

  const adicionar = () => {
    if (!aliasValido || duplicado || !caixa) return;
    salvar(
      [...regras, { alias: aliasNormalizado, caixa }],
      `Regra criada: ${aliasNormalizado} → ${localPart(caixa)}.`,
    );
  };

  const remover = (regra: EmailRoteamentoRegra) => {
    salvar(
      regras.filter((r) => r.alias !== regra.alias),
      `Regra removida: ${regra.alias}.`,
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Route className="size-4 text-primary" />
          Roteamento de alias
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          O alias precisa existir no Google Workspace e entregar em uma das caixas
          sincronizadas; a regra define em qual caixa o e-mail aparece aqui no Engine.
          Aplicada aos e-mails novos a partir da criação.
        </p>

        {/* Adicionar regra */}
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="block space-y-1.5">
            <span className="block text-xs font-medium text-muted-foreground">
              Alias (quem recebe)
            </span>
            <Input
              type="text"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder={`vendas${DOMINIO}`}
              autoComplete="off"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="block text-xs font-medium text-muted-foreground">
              Caixa de destino no Engine
            </span>
            <select
              value={caixa}
              onChange={(e) => setCaixa(e.target.value)}
              className={SELECT_CLS}
            >
              {contas.map((conta) => (
                <option key={conta} value={conta}>
                  {conta}
                </option>
              ))}
            </select>
          </label>
          <Button
            size="md"
            onClick={adicionar}
            disabled={salvando || !aliasValido || duplicado}
          >
            {salvando ? <Loader2 className="animate-spin" /> : <Plus />}
            Adicionar
          </Button>
        </div>
        {alias.trim().length > 0 && !aliasValido && (
          <p className="mt-1.5 text-[11px] font-medium text-sys-orange">
            O alias precisa ser um e-mail terminando com {DOMINIO}.
          </p>
        )}
        {duplicado && (
          <p className="mt-1.5 text-[11px] font-medium text-sys-orange">
            Já existe uma regra para {aliasNormalizado} — remova-a antes de recriar.
          </p>
        )}
      </Card>

      <Card padding="none">
        {regras.length === 0 ? (
          <EmptyState
            icon={Route}
            title="Nenhuma regra de roteamento"
            description="Sem regras, cada e-mail aparece na caixa da conta que o recebeu no Google Workspace."
          />
        ) : (
          <ul className="divide-y divide-border">
            {regras.map((regra) => (
              <li
                key={regra.alias}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3"
              >
                <span className="min-w-0 truncate text-sm font-medium text-foreground">
                  {regra.alias}
                </span>
                <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
                <Badge tone="brand">{localPart(regra.caixa)}</Badge>
                <span className="min-w-0 truncate text-xs text-muted-foreground">
                  {regra.caixa}
                </span>
                <button
                  type="button"
                  onClick={() => remover(regra)}
                  disabled={salvando}
                  aria-label={`Remover regra do alias ${regra.alias}`}
                  className="ml-auto rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-sys-red/10 hover:text-sys-red disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
