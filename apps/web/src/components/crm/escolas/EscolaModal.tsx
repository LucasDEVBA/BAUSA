"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save } from "lucide-react";
import { criarEscola, atualizarEscola } from "@/lib/crm/actions/escolas";
import { US_STATES } from "@/types/crm";
import type { Escola } from "@/types/crm";
import { toast } from "sonner";

interface EscolaModalProps {
  escola?: Escola;
  open: boolean;
  onClose: () => void;
  isNew?: boolean;
}

export function EscolaModal({ escola, open, onClose, isNew }: EscolaModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<Partial<Escola>>({});

  useEffect(() => {
    if (escola) {
      setForm({ ...escola });
    } else {
      setForm({ tipo: "boarding", status: "ativa", ingles_minimo: "intermediario", serie_maxima: "12th", temperatura_relacionamento: "neutro" });
    }
  }, [escola?.id, isNew]);

  const update = (field: string, value: unknown) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = () => {
    if (!form.nome?.trim() || !form.estado_us || !form.cidade?.trim()) {
      toast.error("Nome, estado e cidade sao obrigatorios.");
      return;
    }
    startTransition(async () => {
      const result = escola && !isNew
        ? await atualizarEscola(escola.id, form)
        : await criarEscola(form);
      if (result.success) {
        toast.success(isNew ? "Escola criada!" : "Escola atualizada!");
        router.refresh();
        onClose();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-[var(--crm-surface)] border-[var(--crm-border)]">
        <SheetHeader>
          <SheetTitle className="text-[var(--crm-text-primary)]">{isNew ? "Nova Escola" : (escola?.nome || "Escola")}</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="dados" className="mt-4">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="dados" className="text-[var(--crm-text-xs)]">Dados</TabsTrigger>
            <TabsTrigger value="regras" className="text-[var(--crm-text-xs)]">Regras</TabsTrigger>
            <TabsTrigger value="relac" className="text-[var(--crm-text-xs)]">Relacao</TabsTrigger>
            <TabsTrigger value="hist" className="text-[var(--crm-text-xs)]">Historico</TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[var(--crm-text-xs)] text-[var(--crm-text-secondary)]">Nome *</Label>
              <input value={form.nome || ""} onChange={(e) => update("nome", e.target.value)} className="crm-input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[var(--crm-text-xs)] text-[var(--crm-text-secondary)]">Estado US *</Label>
                <Select value={form.estado_us || ""} onValueChange={(v) => update("estado_us", v)}>
                  <SelectTrigger className="crm-input"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{US_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[var(--crm-text-xs)] text-[var(--crm-text-secondary)]">Cidade *</Label>
                <input value={form.cidade || ""} onChange={(e) => update("cidade", e.target.value)} className="crm-input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[var(--crm-text-xs)] text-[var(--crm-text-secondary)]">Tipo</Label>
                <Select value={form.tipo || "boarding"} onValueChange={(v) => update("tipo", v)}>
                  <SelectTrigger className="crm-input"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="boarding">Boarding</SelectItem>
                    <SelectItem value="day">Day</SelectItem>
                    <SelectItem value="mista">Mista</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[var(--crm-text-xs)] text-[var(--crm-text-secondary)]">Status</Label>
                <Select value={form.status || "ativa"} onValueChange={(v) => update("status", v)}>
                  <SelectTrigger className="crm-input"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativa">Ativa</SelectItem>
                    <SelectItem value="inativa">Inativa</SelectItem>
                    <SelectItem value="em_analise">Em analise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[var(--crm-text-xs)] text-[var(--crm-text-secondary)]">Website</Label>
              <input value={form.website || ""} onChange={(e) => update("website", e.target.value)} placeholder="https://..." className="crm-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[var(--crm-text-xs)] text-[var(--crm-text-secondary)]">Notas internas</Label>
              <Textarea value={form.notas_internas || ""} onChange={(e) => update("notas_internas", e.target.value)} rows={3} className="crm-input" />
            </div>
          </TabsContent>

          <TabsContent value="regras" className="mt-4 space-y-4">
            <h4 className="crm-section-label">Financeiro</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[var(--crm-text-xs)] text-[var(--crm-text-secondary)]">Budget minimo (USD)</Label>
                <input type="number" value={form.budget_minimo_usd ?? ""} onChange={(e) => update("budget_minimo_usd", e.target.value ? Number(e.target.value) : null)} className="crm-input" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[var(--crm-text-xs)] text-[var(--crm-text-secondary)]">Budget forte (USD)</Label>
                <input type="number" value={form.budget_forte_usd ?? ""} onChange={(e) => update("budget_forte_usd", e.target.value ? Number(e.target.value) : null)} className="crm-input" />
              </div>
            </div>
            <h4 className="crm-section-label pt-2">Academico</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[var(--crm-text-xs)] text-[var(--crm-text-secondary)]">Ingles minimo</Label>
                <Select value={form.ingles_minimo || "intermediario"} onValueChange={(v) => update("ingles_minimo", v)}>
                  <SelectTrigger className="crm-input"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Nenhum</SelectItem>
                    <SelectItem value="basico">Basico</SelectItem>
                    <SelectItem value="intermediario">Intermediario</SelectItem>
                    <SelectItem value="avancado">Avancado</SelectItem>
                    <SelectItem value="fluente">Fluente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[var(--crm-text-xs)] text-[var(--crm-text-secondary)]">GPA minimo</Label>
                <input type="number" step="0.1" value={form.gpa_minimo ?? ""} onChange={(e) => update("gpa_minimo", e.target.value ? Number(e.target.value) : null)} className="crm-input" />
              </div>
            </div>
            <h4 className="crm-section-label pt-2">Esportivo</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[var(--crm-text-xs)] text-[var(--crm-text-secondary)]">Influencia esporte</Label>
                <Select value={form.influencia_esporte || "moderada"} onValueChange={(v) => update("influencia_esporte", v)}>
                  <SelectTrigger className="crm-input"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="decisiva">Decisiva</SelectItem>
                    <SelectItem value="forte">Forte</SelectItem>
                    <SelectItem value="moderada">Moderada</SelectItem>
                    <SelectItem value="baixa">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[var(--crm-text-xs)] text-[var(--crm-text-secondary)]">Serie maxima</Label>
                <Select value={form.serie_maxima || "12th"} onValueChange={(v) => update("serie_maxima", v)}>
                  <SelectTrigger className="crm-input"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="9th">9th</SelectItem>
                    <SelectItem value="10th">10th</SelectItem>
                    <SelectItem value="11th">11th</SelectItem>
                    <SelectItem value="12th">12th</SelectItem>
                    <SelectItem value="pg_year">PG Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="relac" className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[var(--crm-text-xs)] text-[var(--crm-text-secondary)]">Admissions Officer</Label>
              <input value={form.admissions_officer_nome || ""} onChange={(e) => update("admissions_officer_nome", e.target.value)} placeholder="Nome" className="crm-input" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[var(--crm-text-xs)] text-[var(--crm-text-secondary)]">Email</Label>
                <input value={form.admissions_officer_email || ""} onChange={(e) => update("admissions_officer_email", e.target.value)} className="crm-input" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[var(--crm-text-xs)] text-[var(--crm-text-secondary)]">Telefone</Label>
                <input value={form.admissions_officer_telefone || ""} onChange={(e) => update("admissions_officer_telefone", e.target.value)} className="crm-input" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[var(--crm-text-xs)] text-[var(--crm-text-secondary)]">Temperatura</Label>
              <Select value={form.temperatura_relacionamento || "neutro"} onValueChange={(v) => update("temperatura_relacionamento", v)}>
                <SelectTrigger className="crm-input"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="forte">Forte</SelectItem>
                  <SelectItem value="bom">Bom</SelectItem>
                  <SelectItem value="neutro">Neutro</SelectItem>
                  <SelectItem value="frio">Frio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="hist" className="mt-4 space-y-3 text-[var(--crm-text-sm)]">
            <div className="grid grid-cols-2 gap-4">
              <div><span className="text-[var(--crm-text-tertiary)]">Aplicados:</span> <span className="font-[var(--crm-weight-semibold)] text-[var(--crm-text-primary)]">{escola?.total_aplicados ?? 0}</span></div>
              <div><span className="text-[var(--crm-text-tertiary)]">Aceitos:</span> <span className="font-[var(--crm-weight-semibold)] text-[var(--crm-text-primary)]">{escola?.total_aceitos ?? 0}</span></div>
              <div><span className="text-[var(--crm-text-tertiary)]">Taxa:</span> <span className="font-[var(--crm-weight-semibold)] text-[var(--crm-text-primary)]">{escola?.taxa_aceitacao ? `${Number(escola.taxa_aceitacao).toFixed(0)}%` : "\u2014"}</span></div>
              <div><span className="text-[var(--crm-text-tertiary)]">Bolsa media:</span> <span className="font-[var(--crm-weight-semibold)] text-[var(--crm-text-primary)]">{escola?.bolsa_media_obtida ? `${escola.bolsa_media_obtida}%` : "\u2014"}</span></div>
            </div>
            {!escola && <p className="text-[var(--crm-text-tertiary)] text-center py-8">Salve a escola para ver o historico.</p>}
          </TabsContent>
        </Tabs>

        <div className="mt-6">
          <button onClick={handleSave} disabled={isPending} className="crm-btn crm-btn-primary w-full py-2.5">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isNew ? "Criar Escola" : "Salvar"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
