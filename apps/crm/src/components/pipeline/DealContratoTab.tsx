"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, Loader2, PenTool, Receipt, Save, Send, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { ContratoPainel } from "@/components/financeiro/contrato/ContratoPainel";
import { GanhoEscolasModal } from "@/components/pipeline/GanhoEscolasModal";
import { updateNfData } from "@/lib/actions/financeiro";
import { carregarContratoDoDeal } from "@/lib/actions/financeiro-contrato";
import { formatarMoeda } from "@/lib/financeiro/calculo.mjs";
import { uploadDocumento } from "@/lib/upload";
import { cn } from "@/lib/utils";
import type { ContratoCompleto } from "@/types/contrato";

interface DealContratoTabProps {
  dealId: string;
  atletaId?: string;
  /** Contrato/sinal/parcela mudou: o valor, o plano e o sinal do deal mudaram.
   *  Quem busca o deal no cliente (/leads, /remarketing) rebusca — o
   *  revalidatePath/router.refresh só repinta o /pipeline. */
  onAtualizado?: () => void;
}

/**
 * Aba Contrato do deal (DealDetailModal/DealDetailSheet) — API inalterada.
 * O financeiro (sinal, plano, parcelas, baixa/estorno/quitação, itens,
 * custos, histórico) vive no ContratoPainel compartilhado com /contratos/[id].
 * Aqui ficam só Assinatura e Nota fiscal (comportamento anterior preservado).
 */
export function DealContratoTab({ dealId, atletaId, onAtualizado }: DealContratoTabProps) {
  const router = useRouter();
  const [dados, setDados] = useState<ContratoCompleto | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ganho, setGanho] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await carregarContratoDoDeal(dealId);
      if (!r) setErro("Sem permissão para ver o financeiro deste negócio.");
      else {
        setErro(null);
        setDados(r);
      }
    } catch (err) {
      console.error({ level: "error", action: "aba_contrato_carga", dealId, error: String(err) });
      setErro("Erro ao carregar contrato.");
    }
  }, [dealId]);

  // Carga inicial no padrão do GanhoEscolasModal (promise + flag "vivo"):
  // descarta resposta de um dealId antigo se o modal trocar de deal.
  useEffect(() => {
    let vivo = true;
    carregarContratoDoDeal(dealId)
      .then((r) => {
        if (!vivo) return;
        if (r) setDados(r);
        else setErro("Sem permissão para ver o financeiro deste negócio.");
      })
      .catch((err: unknown) => {
        console.error({ level: "error", action: "aba_contrato_carga", dealId, error: String(err) });
        if (vivo) setErro("Erro ao carregar contrato.");
      });
    return () => {
      vivo = false;
    };
  }, [dealId]);

  if (erro) {
    return (
      <div className="space-y-2 py-6 text-center text-sm">
        <p role="alert" className="text-sys-red">{erro}</p>
        <Button size="sm" variant="secondary" onClick={() => void carregar()}>Tentar de novo</Button>
      </div>
    );
  }
  if (!dados) {
    return (
      <div className="flex items-center justify-center py-12" aria-busy="true">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Carregando contrato" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ContratoPainel
        dados={dados}
        onAlterado={() => {
          void carregar();
          router.refresh(); // card/coluna do board refletem valor/plano/etapa
          onAtualizado?.();
        }}
        onGanho={() => (atletaId ?? dados.atletaId) && setGanho(true)}
      />
      {dados.contrato && <AssinaturaENf dados={dados} atletaId={atletaId} onSalvo={() => void carregar()} />}
      {ganho && (atletaId ?? dados.atletaId) && (
        <GanhoEscolasModal
          atletaId={(atletaId ?? dados.atletaId) as string}
          athleteName={dados.atletaNome ?? ""}
          onClose={() => setGanho(false)}
        />
      )}
    </div>
  );
}

/** Assinatura (estado local, como antes) + NF (agora com máscara BRL — T6). */
function AssinaturaENf({ dados, atletaId, onSalvo }: { dados: ContratoCompleto; atletaId?: string; onSalvo: () => void }) {
  const c = dados.contrato;
  const [docusignStatus, setDocusignStatus] = useState("nao_enviado");
  const [uploading, setUploading] = useState(false);
  const [contratoFileUrl, setContratoFileUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [nfNumero, setNfNumero] = useState(c?.nf_numero ?? "");
  const [nfData, setNfData] = useState(c?.nf_emitida_at?.split("T")[0] ?? "");
  const [nfValor, setNfValor] = useState<number | null>(c?.nf_valor ?? null);
  const [isPending, startTransition] = useTransition();
  if (!c) return null;

  const salvarNf = () =>
    startTransition(async () => {
      const r = await updateNfData({
        contractId: c.id,
        nfNumero: nfNumero || null,
        nfEmitidaAt: nfData || null,
        nfValor,
        nfStatus: nfNumero ? "emitida" : "pendente",
      });
      if (r.success) {
        toast.success("Dados da NF salvos");
        onSalvo();
      } else toast.error(r.error ?? "Erro ao salvar NF");
    });

  const upload = async (file: File) => {
    const alvo = atletaId ?? dados.atletaId;
    if (!alvo) return;
    setUploading(true);
    try {
      setContratoFileUrl(await uploadDocumento(alvo, "contrato_assinado", file));
      toast.success("Contrato assinado enviado");
    } catch {
      toast.error("Erro ao fazer upload do contrato");
    } finally {
      setUploading(false);
    }
  };

  const card = "rounded-lg border border-border/70 bg-card/60 p-3";
  return (
    <>
      <section className={card} aria-labelledby="ass-titulo">
        <h3 id="ass-titulo" className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <PenTool className="size-4 text-plan-legacy" aria-hidden />Assinatura do contrato
        </h3>
        <div className="flex flex-wrap gap-2">
          {docusignStatus === "nao_enviado" && (
            <Button size="sm" variant="secondary" onClick={() => setDocusignStatus("enviado")}><Send />Marcar como enviado</Button>
          )}
          {docusignStatus === "enviado" && (
            <Button size="sm" variant="secondary" onClick={() => setDocusignStatus("assinado")}><CheckCircle2 />Marcar como assinado</Button>
          )}
          {docusignStatus === "assinado" && <span className="text-xs font-medium text-sys-green">Assinado</span>}
        </div>
        <div className="mt-3 border-t border-border pt-3">
          {contratoFileUrl ? (
            <a href={contratoFileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary">
              <ExternalLink className="size-3" aria-hidden />Ver contrato assinado
            </a>
          ) : (
            <>
              <Button size="sm" variant="secondary" className="w-full border-dashed" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="animate-spin" /> : <Upload />}Enviar PDF do contrato assinado
              </Button>
              <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
            </>
          )}
        </div>
      </section>

      <section className={card} aria-labelledby="nf-titulo">
        <h3 id="nf-titulo" className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Receipt className="size-4 text-sys-orange" aria-hidden />Nota fiscal
        </h3>
        {c.nf_status === "emitida" ? (
          <p className="text-sm text-foreground">
            Nº {c.nf_numero ?? "—"} · {c.nf_emitida_at ? new Date(c.nf_emitida_at).toLocaleDateString("pt-BR") : "—"} · {formatarMoeda(c.nf_valor)}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="nf-numero" className="block text-xs font-medium text-muted-foreground">Número da NF</label>
                <input id="nf-numero" value={nfNumero} onChange={(e) => setNfNumero(e.target.value)} placeholder="Ex.: NF-00123"
                  className="h-10 w-full rounded-lg border border-input bg-card px-3 text-base sm:h-9 sm:text-sm" />
              </div>
              <div>
                <label htmlFor="nf-data" className="block text-xs font-medium text-muted-foreground">Data de emissão</label>
                <input id="nf-data" type="date" value={nfData} onChange={(e) => setNfData(e.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-card px-3 text-base sm:h-9 sm:text-sm" />
              </div>
            </div>
            <MoneyInput label="Valor da NF" value={nfValor} onValueChange={setNfValor} />
            <Button size="sm" variant="secondary" onClick={salvarNf} disabled={isPending} className={cn("text-sys-orange")}>
              {isPending ? <Loader2 className="animate-spin" /> : <Save />}Salvar dados da NF
            </Button>
          </div>
        )}
      </section>
    </>
  );
}
