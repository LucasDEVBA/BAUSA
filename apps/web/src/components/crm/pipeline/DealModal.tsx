"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, XCircle, MessageCircle, Send, Calendar } from "lucide-react";
import { atualizarDeal, moverDeal } from "@/lib/crm/actions/deals";
import { enviarConviteReuniao, enviarWhatsAppManual } from "@/lib/crm/actions/whatsapp";
import { registrarLinkCalendario } from "@/lib/crm/actions/calendario";
import { ETAPA_LABELS, ETAPA_ORDEM, PIPELINE_ETAPAS, type StatusDeal } from "@/types/crm";
import { toast } from "sonner";
import { ContratoPanel } from "@/components/crm/financeiro/ContratoPanel";

/*
  COMPONENT: DealModal
  PROBLEM:   Mixed shadcn + raw classes. Input/Textarea use inline bg/border
             overrides that don't reference tokens. WhatsApp/Calendar sections
             use raw green/red classes. Section dividers use raw border-t without
             token color. Lost form uses hardcoded red/10 backgrounds.
  DECISION:  Migrate all inline color overrides to CRM tokens. Use semantic
             success (WhatsApp), error (lost), accent (calendar) token sets.
             Keep shadcn Sheet/Button/Input primitives (they inherit from theme).
             Brand DNA: Premium (sheet animation), Controlled (structured sections).
  CONTRAST:  Labels: --crm-text-secondary on surface = 7.4:1 AAA
             Input text: --crm-text-primary on bg = 19.4:1 AAA
*/

interface DealModalProps {
  deal: any;
  open: boolean;
  onClose: () => void;
}

export function DealModal({ deal, open, onClose }: DealModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [nextAction, setNextAction] = useState(deal?.next_action || "");
  const [dataProxima, setDataProxima] = useState(deal?.data_proxima_acao || "");
  const [notas, setNotas] = useState(deal?.notas_reuniao || "");
  const [showLostForm, setShowLostForm] = useState(false);
  const [motivoPerda, setMotivoPerda] = useState("");
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [whatsappMsg, setWhatsappMsg] = useState("");
  const [calendarLink, setCalendarLink] = useState(deal?.google_calendar_event_id || "");
  const [dataReuniao, setDataReuniao] = useState("");

  if (!deal) return null;

  const currentIdx = PIPELINE_ETAPAS.indexOf(deal.etapa as StatusDeal);
  const nextEtapa = currentIdx < PIPELINE_ETAPAS.length - 1 ? PIPELINE_ETAPAS[currentIdx + 1] : null;

  const handleSave = () => {
    startTransition(async () => {
      const result = await atualizarDeal(deal.id, {
        next_action: nextAction || undefined,
        data_proxima_acao: dataProxima || undefined,
        notas_reuniao: notas || undefined,
      });
      if (result.success) {
        toast.success("Deal atualizado!");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleAdvance = () => {
    if (!nextEtapa) return;
    startTransition(async () => {
      const result = await moverDeal(deal.id, nextEtapa);
      if (result.success) {
        toast.success(`Movido para ${ETAPA_LABELS[nextEtapa]}`);
        router.refresh();
        onClose();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleLost = () => {
    if (!motivoPerda.trim()) {
      toast.error("Informe o motivo da perda.");
      return;
    }
    startTransition(async () => {
      const result = await moverDeal(deal.id, "perdido", motivoPerda);
      if (result.success) {
        toast.success("Deal marcado como perdido.");
        router.refresh();
        onClose();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-[var(--crm-surface)] border-[var(--crm-border)]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-[var(--crm-text-primary)]">
            {deal.atleta?.nome_completo || "Deal"}
            <Badge variant="outline" className="text-[var(--crm-text-xs)] capitalize text-[var(--crm-text-secondary)] border-[var(--crm-border)]">
              {ETAPA_LABELS[deal.etapa as StatusDeal] || deal.etapa}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Athlete info */}
          <div className="space-y-1 text-[var(--crm-text-base)]">
            <p><span className="text-[var(--crm-text-tertiary)]">Esporte:</span> <span className="text-[var(--crm-text-primary)]">{deal.atleta?.esporte || "\u2014"}</span></p>
            <p><span className="text-[var(--crm-text-tertiary)]">Serie:</span> <span className="text-[var(--crm-text-primary)]">{deal.atleta?.serie_escolar || "\u2014"}</span></p>
            <p><span className="text-[var(--crm-text-tertiary)]">WhatsApp:</span> <span className="text-[var(--crm-text-primary)]">{deal.atleta?.whatsapp || "\u2014"}</span></p>
            {deal.valor_estimado && (
              <p><span className="text-[var(--crm-text-tertiary)]">Valor:</span> <span className="text-[var(--crm-success)] font-[var(--crm-weight-semibold)] tabular-nums">R$ {Number(deal.valor_estimado).toLocaleString("pt-BR")}</span></p>
            )}
          </div>

          {/* Editable fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[var(--crm-text-secondary)]">Next Action</Label>
              <Input
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                placeholder="Proxima acao..."
                className="crm-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[var(--crm-text-secondary)]">Data Proxima Acao</Label>
              <Input
                type="date"
                value={dataProxima}
                onChange={(e) => setDataProxima(e.target.value)}
                className="crm-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[var(--crm-text-secondary)]">Notas da Reuniao</Label>
              <Textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Anotacoes..."
                rows={3}
                className="crm-input"
              />
            </div>
          </div>

          {/* Calendar / Meeting section */}
          {(deal.etapa === "lead" || deal.etapa === "reuniao_marcada") && (
            <div className="pt-4 border-t border-[var(--crm-border)]">
              <h3 className="text-[var(--crm-text-base)] font-[var(--crm-weight-semibold)] mb-3 flex items-center gap-2 text-[var(--crm-text-primary)]">
                <Calendar className="w-4 h-4 text-[var(--crm-accent-text)]" /> Reuniao
              </h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-[var(--crm-text-xs)] text-[var(--crm-text-secondary)]">Link/ID Google Calendar</Label>
                  <Input
                    value={calendarLink}
                    onChange={(e) => setCalendarLink(e.target.value)}
                    placeholder="Cole o link ou ID do evento..."
                    className="crm-input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[var(--crm-text-xs)] text-[var(--crm-text-secondary)]">Data da reuniao</Label>
                  <Input
                    type="datetime-local"
                    value={dataReuniao}
                    onChange={(e) => setDataReuniao(e.target.value)}
                    className="crm-input"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending || !calendarLink.trim()}
                  className="border-[var(--crm-accent-border)] text-[var(--crm-accent-text)] hover:bg-[var(--crm-accent-bg)]"
                  onClick={() => {
                    startTransition(async () => {
                      const result = await registrarLinkCalendario(
                        deal.id,
                        calendarLink,
                        dataReuniao || undefined,
                      );
                      if (result.success) {
                        toast.success("Reuniao registrada!");
                        router.refresh();
                      } else {
                        toast.error(result.error);
                      }
                    });
                  }}
                >
                  {isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Calendar className="w-3 h-3 mr-1" />}
                  Confirmar reuniao agendada
                </Button>
              </div>
            </div>
          )}

          {/* WhatsApp */}
          <div className="pt-4 border-t border-[var(--crm-border)]">
            <h3 className="text-[var(--crm-text-base)] font-[var(--crm-weight-semibold)] mb-3 flex items-center gap-2 text-[var(--crm-text-primary)]">
              <MessageCircle className="w-4 h-4 text-[var(--crm-success)]" /> WhatsApp
            </h3>
            <div className="space-y-2">
              {deal.etapa === "lead" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full border-[var(--crm-success-border)] text-[var(--crm-success)] hover:bg-[var(--crm-success-subtle)]"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      const result = await enviarConviteReuniao(deal.id);
                      if (result.success) {
                        toast.success("Convite de reuniao enviado!");
                        router.refresh();
                      } else {
                        toast.error(result.error);
                      }
                    });
                  }}
                >
                  {isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
                  Enviar convite de reuniao
                </Button>
              )}

              {!showWhatsApp ? (
                <Button size="sm" variant="ghost" className="w-full text-[var(--crm-success)]" onClick={() => setShowWhatsApp(true)}>
                  <MessageCircle className="w-3 h-3 mr-1" /> Enviar mensagem manual
                </Button>
              ) : (
                <div className="space-y-2 p-3 bg-[var(--crm-success-subtle)] rounded-[var(--crm-radius-lg)] border border-[var(--crm-success-border)]">
                  <Textarea
                    value={whatsappMsg}
                    onChange={(e) => setWhatsappMsg(e.target.value)}
                    placeholder="Digite a mensagem..."
                    rows={3}
                    className="crm-input text-[var(--crm-text-sm)]"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-[var(--crm-success)] hover:bg-[color-mix(in_srgb,var(--crm-success)_90%,black)] text-[var(--crm-text-on-brand)]"
                      disabled={isPending || !whatsappMsg.trim()}
                      onClick={() => {
                        const whatsapp = deal.atleta?.whatsapp;
                        if (!whatsapp) {
                          toast.error("Sem numero WhatsApp.");
                          return;
                        }
                        startTransition(async () => {
                          const result = await enviarWhatsAppManual({
                            destinatario: whatsapp,
                            mensagem: whatsappMsg,
                            dealId: deal.id,
                          });
                          if (result.success) {
                            toast.success("Mensagem enviada!");
                            setWhatsappMsg("");
                            setShowWhatsApp(false);
                          } else {
                            toast.error(result.error);
                          }
                        });
                      }}
                    >
                      {isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />}
                      Enviar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowWhatsApp(false)}>Cancelar</Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Financial */}
          <div className="pt-4 border-t border-[var(--crm-border)]">
            <h3 className="text-[var(--crm-text-base)] font-[var(--crm-weight-semibold)] mb-3 text-[var(--crm-text-primary)]">Financeiro</h3>
            <ContratoPanel dealId={deal.id} />
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-4 border-t border-[var(--crm-border)]">
            <Button onClick={handleSave} disabled={isPending} className="crm-btn crm-btn-primary w-full py-2.5">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar
            </Button>

            {nextEtapa && (
              <Button onClick={handleAdvance} disabled={isPending} variant="outline" className="crm-btn crm-btn-secondary w-full py-2.5">
                Avancar para {ETAPA_LABELS[nextEtapa]}
              </Button>
            )}

            {!showLostForm ? (
              <Button
                onClick={() => setShowLostForm(true)}
                variant="ghost"
                className="w-full text-[var(--crm-error)] hover:text-[var(--crm-error)] hover:bg-[var(--crm-error-subtle)]"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Marcar como Perdido
              </Button>
            ) : (
              <div className="space-y-2 p-3 bg-[var(--crm-error-tint)] rounded-[var(--crm-radius-lg)] border border-[var(--crm-error-border)]">
                <Label className="text-[var(--crm-error)]">Motivo da perda (obrigatorio)</Label>
                <Textarea
                  value={motivoPerda}
                  onChange={(e) => setMotivoPerda(e.target.value)}
                  placeholder="Descreva o motivo..."
                  rows={2}
                  className="crm-input"
                />
                <div className="flex gap-2">
                  <Button onClick={handleLost} disabled={isPending} variant="destructive" size="sm" className="flex-1">
                    Confirmar Perda
                  </Button>
                  <Button onClick={() => setShowLostForm(false)} variant="outline" size="sm">
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
