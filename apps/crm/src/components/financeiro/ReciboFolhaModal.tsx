"use client";

import { useState } from "react";
import { ReceiptText, Printer } from "lucide-react";
import { toast } from "sonner";

import { abrirRecibo, valorPorExtenso } from "@/lib/recibo";
import type { Colaborador, EmpresaDados } from "@/types/financeiro";
import { FormModal, ModalSection, modalFieldClasses } from "./FormModal";

const { input: inputClass, label: labelClass } = modalFieldClasses;

function competenciaLabel(mes: string): string {
  const [ano, m] = mes.split("-");
  return `${m}/${ano}`;
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
}

interface ReciboFolhaModalProps {
  open: boolean;
  onClose: () => void;
  colaborador: Colaborador | null;
  empresa: EmpresaDados;
}

export function ReciboFolhaModal({ open, onClose, colaborador, empresa }: ReciboFolhaModalProps) {
  const [competenciaMes, setCompetenciaMes] = useState(() => new Date().toISOString().slice(0, 7));

  if (!colaborador) return null;

  const referente = `Folha de pagamento — competência ${competenciaLabel(competenciaMes)}`;

  const gerar = () => {
    const ok = abrirRecibo({
      empresa,
      recebedorNome: colaborador.nome,
      recebedorDoc: colaborador.cpf,
      valor: colaborador.custo_mensal_brl,
      referente,
    });
    if (!ok) {
      toast.error("O navegador bloqueou a janela de impressão. Permita pop-ups para gerar o recibo.");
      return;
    }
    onClose();
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      icon={ReceiptText}
      iconClass="bg-sys-green/12 text-sys-green ring-sys-green/25"
      title="Recibo de pagamento"
      subtitle={colaborador.nome}
      ariaLabel="Gerar recibo de pagamento"
      maxWidth="max-w-lg"
    >
      <div className="space-y-5 px-6 py-5">
        <ModalSection title="Competência">
          <input
            type="month"
            value={competenciaMes}
            onChange={(e) => setCompetenciaMes(e.target.value)}
            className={inputClass}
            aria-label="Competência do recibo"
          />
        </ModalSection>

        <ModalSection title="Prévia do recibo">
          <div className="rounded-lg border border-border bg-secondary/40 p-4 text-sm leading-relaxed text-foreground">
            <p>
              <strong>{empresa.razao_social || "Bolsa Atleta USA"}</strong>
              {empresa.cnpj ? ` (CNPJ ${empresa.cnpj})` : ""} paga a{" "}
              <strong>{colaborador.nome}</strong>
              {colaborador.cpf ? ` (CPF ${colaborador.cpf})` : ""} a importância de{" "}
              <strong>{formatBRL(colaborador.custo_mensal_brl)}</strong>.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {valorPorExtenso(colaborador.custo_mensal_brl)} — referente a {referente.toLowerCase()}.
            </p>
          </div>
          {!colaborador.cpf && (
            <p className={labelClass}>
              Dica: preencha o CPF do colaborador (ao editar) para que ele apareça no recibo.
            </p>
          )}
        </ModalSection>
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-fill-4 hover:text-foreground"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={gerar}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Printer className="h-4 w-4" />
          Imprimir recibo
        </button>
      </div>
    </FormModal>
  );
}
