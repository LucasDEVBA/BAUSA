"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save } from "lucide-react";
import { atualizarConfiguracao } from "@/lib/crm/actions/configuracoes";
import { toast } from "sonner";

interface ConfiguracoesFormProps {
  configs: Record<string, { valor: unknown; descricao: string | null }>;
}

export function ConfiguracoesForm({ configs }: ConfiguracoesFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [local, setLocal] = useState<Record<string, unknown>>(() => {
    const m: Record<string, unknown> = {};
    Object.entries(configs).forEach(([k, v]) => { m[k] = v.valor; });
    return m;
  });

  const save = (chave: string) => {
    startTransition(async () => {
      const result = await atualizarConfiguracao(chave, local[chave]);
      if (result.success) {
        toast.success(`${chave} atualizado!`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const getVal = (chave: string): unknown => local[chave] ?? configs[chave]?.valor;

  const JsonField = ({ chave, label }: { chave: string; label: string }) => {
    const val = getVal(chave);
    const [text, setText] = useState(JSON.stringify(val, null, 2));
    return (
      <div className="crm-card">
        <div className="mb-3">
          <h4 className="text-[var(--crm-text-base)] font-[var(--crm-weight-semibold)] text-[var(--crm-text-primary)]">{label}</h4>
          {configs[chave]?.descricao && <p className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)] mt-0.5">{configs[chave].descricao}</p>}
        </div>
        <div className="space-y-2">
          <textarea
            className="crm-input font-[var(--crm-font-mono)] text-[var(--crm-text-xs)] min-h-[80px]"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              try { setLocal((p) => ({ ...p, [chave]: JSON.parse(e.target.value) })); } catch { /* invalid json */ }
            }}
          />
          <button onClick={() => save(chave)} disabled={isPending} className="crm-btn crm-btn-primary">
            {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Salvar
          </button>
        </div>
      </div>
    );
  };

  const NumberField = ({ chave, label }: { chave: string; label: string }) => (
    <div className="flex items-center gap-3">
      <Label className="text-[var(--crm-text-base)] w-48 shrink-0 text-[var(--crm-text-secondary)]">{label}</Label>
      <input
        type="number"
        className="crm-input w-32"
        value={String(getVal(chave) ?? "")}
        onChange={(e) => setLocal((p) => ({ ...p, [chave]: Number(e.target.value) }))}
      />
      <button onClick={() => save(chave)} disabled={isPending} className="crm-btn crm-btn-secondary">
        <Save className="w-3 h-3" />
      </button>
    </div>
  );

  return (
    <Tabs defaultValue="financeiro">
      <TabsList className="flex-wrap">
        <TabsTrigger value="financeiro">Planos</TabsTrigger>
        <TabsTrigger value="scoring">Lead Scoring</TabsTrigger>
        <TabsTrigger value="match">Match</TabsTrigger>
        <TabsTrigger value="timers">Timers</TabsTrigger>
        <TabsTrigger value="metas">Metas</TabsTrigger>
        <TabsTrigger value="experiencia">Experiencia</TabsTrigger>
        <TabsTrigger value="cobranca">Cobranca</TabsTrigger>
      </TabsList>

      <TabsContent value="financeiro" className="mt-4 space-y-4">
        <JsonField chave="planos" label="Planos e Valores" />
        <NumberField chave="entrada_padrao" label="Entrada padrao (R$)" />
        <NumberField chave="psicologa_custo_padrao" label="Custo psicologa (R$)" />
      </TabsContent>

      <TabsContent value="scoring" className="mt-4 space-y-4">
        <JsonField chave="lead_score_pesos" label="Pesos do Lead Score (soma = 100)" />
        <JsonField chave="lead_score_faixas" label="Faixas de classificacao (hot >= X, warm >= Y)" />
      </TabsContent>

      <TabsContent value="match" className="mt-4 space-y-4">
        <JsonField chave="match_pesos" label="Pesos do Motor de Match (soma = 100)" />
        <JsonField chave="match_faixas" label="Faixas de classificacao de match" />
      </TabsContent>

      <TabsContent value="timers" className="mt-4 space-y-4">
        <JsonField chave="timers_automacao" label="Timers de automacao (horas/dias)" />
      </TabsContent>

      <TabsContent value="metas" className="mt-4 space-y-4">
        <NumberField chave="meta_anual" label="Meta anual (R$)" />
        <NumberField chave="meta_mensal_padrao" label="Meta mensal (R$)" />
        <NumberField chave="ticket_medio_alvo" label="Ticket medio alvo (R$)" />
        <NumberField chave="contratos_mes_alvo" label="Contratos/mes alvo" />
        <JsonField chave="pipeline_health_ratio" label="Pipeline Health Ratio" />
      </TabsContent>

      <TabsContent value="experiencia" className="mt-4 space-y-4">
        <JsonField chave="thresholds_experiencia" label="Thresholds de temperatura" />
        <JsonField chave="inatividade_por_fase" label="Dias de inatividade por fase" />
        <JsonField chave="digest_horario" label="Horario do digest" />
      </TabsContent>

      <TabsContent value="cobranca" className="mt-4 space-y-4">
        <JsonField chave="regua_cobranca" label="Regua de cobranca" />
        <JsonField chave="probabilidade_por_etapa" label="Probabilidade padrao por etapa" />
      </TabsContent>
    </Tabs>
  );
}
