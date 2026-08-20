"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button, Card } from "@/components/ui";
import { localPart } from "@/components/emails/email-status";
import { salvarPermissoesEmails } from "@/lib/actions/emails";
import type { EmailsPermissoes } from "@/lib/emails-queries";

const CHECK_CLS = "size-3.5 accent-primary";

function ListaContas({
  titulo,
  ajuda,
  opcoes,
  selecionadas,
  onToggle,
}: {
  titulo: string;
  ajuda: string;
  opcoes: string[];
  selecionadas: Set<string>;
  onToggle: (conta: string) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold text-foreground">{titulo}</legend>
      <p className="text-[11px] leading-relaxed text-label-tertiary">{ajuda}</p>
      <div className="space-y-1.5">
        {opcoes.map((conta) => (
          <label
            key={conta}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:bg-secondary/50 motion-reduce:transition-none"
          >
            <input
              type="checkbox"
              checked={selecionadas.has(conta)}
              onChange={() => onToggle(conta)}
              className={CHECK_CLS}
            />
            <span className="text-xs font-medium text-foreground">{localPart(conta)}</span>
            <span className="min-w-0 truncate text-[11px] text-muted-foreground">{conta}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Aba Acessos (/emails — CEO-only): define o que a Head de Sucesso enxerga e
 * usa no módulo de e-mail. Duas listas independentes: caixas VISÍVEIS
 * (recebidos/enviados/métricas) e contas de ENVIO (De: do compositor).
 * Fail-closed: nada marcado = a tela abre vazia para ela.
 * O CC do CEO nos envios dela é FORÇADO por código — não há opção aqui.
 */
export function AcessosTab({
  caixas,
  contasEnvio,
  permissoes,
}: {
  /** Todas as caixas sincronizadas (visão do CEO). */
  caixas: string[];
  /** Whitelist de envio (emails_contas). */
  contasEnvio: string[];
  permissoes: EmailsPermissoes;
}) {
  const router = useRouter();
  const [caixasSel, setCaixasSel] = useState<Set<string>>(() => new Set(permissoes.caixas));
  const [envioSel, setEnvioSel] = useState<Set<string>>(() => new Set(permissoes.envio));
  const [salvando, startSalvar] = useTransition();

  const igual = (sel: Set<string>, orig: string[]) =>
    sel.size === orig.length && orig.every((c) => sel.has(c));
  const alterado = !igual(caixasSel, permissoes.caixas) || !igual(envioSel, permissoes.envio);

  const toggle = (setter: typeof setCaixasSel) => (conta: string) => {
    setter((prev) => {
      const novo = new Set(prev);
      if (novo.has(conta)) novo.delete(conta);
      else novo.add(conta);
      return novo;
    });
  };

  const salvar = () => {
    startSalvar(async () => {
      const res = await salvarPermissoesEmails({
        caixas: [...caixasSel],
        envio: [...envioSel],
      });
      if (!res.success) {
        toast.error(res.error ?? "Não foi possível salvar os acessos.");
        return;
      }
      toast.success("Acessos da Head atualizados.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <ShieldCheck className="size-4 text-primary" />
          Acessos da Head de Sucesso
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Você define quais caixas a Head vê e por quais contas ela envia. Sem nada marcado, a
          tela de e-mails abre vazia para ela.{" "}
          <strong>
            Todo e-mail enviado por ela leva leandro.ribeiro@ em cópia automaticamente
          </strong>{" "}
          — isso é fixo no sistema, sem opção de desligar.
        </p>

        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <ListaContas
            titulo="Caixas visíveis"
            ajuda="Recebidos, enviados e métricas destas caixas. Dica: para ela ver o que enviou por uma conta, inclua a conta também aqui."
            opcoes={caixas}
            selecionadas={caixasSel}
            onToggle={toggle(setCaixasSel)}
          />
          <ListaContas
            titulo="Contas de envio (De:)"
            ajuda="Contas que aparecem no seletor De: do compositor dela."
            opcoes={contasEnvio}
            selecionadas={envioSel}
            onToggle={toggle(setEnvioSel)}
          />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Button size="md" onClick={salvar} disabled={salvando || !alterado}>
            {salvando ? <Loader2 className="animate-spin" /> : <Save />}
            Salvar acessos
          </Button>
          {!alterado && <span className="text-[11px] text-label-tertiary">Tudo salvo.</span>}
        </div>
      </Card>
    </div>
  );
}
