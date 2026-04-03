"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Send, AlertTriangle, Phone, MessageSquare } from "lucide-react";
import { registrarContato, atualizarExperiencia, escalonarCEO, getContatosExperiencia } from "@/lib/crm/actions/experiencia";
import { toast } from "sonner";

interface FamiliaModalProps {
  experiencia: any;
  open: boolean;
  onClose: () => void;
}

export function FamiliaModal({ experiencia, open, onClose }: FamiliaModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [contatos, setContatos] = useState<any[]>([]);

  // Form: registrar contato
  const [tipoContato, setTipoContato] = useState<string>("whatsapp");
  const [resumo, setResumo] = useState("");
  const [proximoContato, setProximoContato] = useState("");

  // Form: indicadores
  const [ansiedade, setAnsiedade] = useState(3);
  const [satisfacao, setSatisfacao] = useState(5);
  const [fase, setFase] = useState("");
  const [status, setStatus] = useState("");
  const [descProblema, setDescProblema] = useState("");
  const [acaoAndamento, setAcaoAndamento] = useState("");

  // Escalonamento
  const [showEscalonar, setShowEscalonar] = useState(false);
  const [contextoEscalona, setContextoEscalona] = useState("");

  useEffect(() => {
    if (experiencia) {
      setAnsiedade(experiencia.ansiedade || 3);
      setSatisfacao(experiencia.satisfacao || 5);
      setFase(experiencia.fase || "admissao");
      setStatus(experiencia.status || "satisfeita");
      setDescProblema(experiencia.descricao_problema || "");
      setAcaoAndamento(experiencia.acao_em_andamento || "");
      setResumo("");
      setProximoContato("");
      setTipoContato("whatsapp");
      loadContatos();
    }
  }, [experiencia?.id]);

  const loadContatos = async () => {
    if (!experiencia?.id) return;
    const data = await getContatosExperiencia(experiencia.id);
    setContatos(data);
  };

  if (!experiencia) return null;

  const atletaNome = experiencia.atleta?.nome_completo || "Atleta";
  const responsavelNome = experiencia.atleta?.responsavel?.nome || "\u2014";
  const whatsapp = experiencia.atleta?.responsavel?.whatsapp || experiencia.atleta?.whatsapp || "";
  const whatsappLink = whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, "")}` : "";

  const handleSalvarContato = () => {
    if (!resumo.trim()) {
      toast.error("Preencha o resumo do contato.");
      return;
    }
    if (!proximoContato) {
      toast.error("Defina a data do proximo contato.");
      return;
    }

    startTransition(async () => {
      const result = await registrarContato(experiencia.id, {
        tipo: tipoContato as any,
        resumo: resumo.trim(),
        proximo_contato: proximoContato,
      });
      if (result.success) {
        toast.success("Contato registrado!");
        setResumo("");
        setProximoContato("");
        router.refresh();
        onClose();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleSalvarIndicadores = () => {
    startTransition(async () => {
      const result = await atualizarExperiencia(experiencia.id, {
        fase: fase as any,
        ansiedade,
        satisfacao,
        status: status as any,
        descricao_problema: descProblema || undefined,
        acao_em_andamento: acaoAndamento || undefined,
      });
      if (result.success) {
        toast.success("Indicadores atualizados!");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleEscalonar = () => {
    if (!contextoEscalona.trim()) {
      toast.error("Descreva o contexto.");
      return;
    }
    startTransition(async () => {
      const result = await escalonarCEO(experiencia.id, contextoEscalona);
      if (result.success) {
        toast.success("Escalonado ao CEO!");
        setShowEscalonar(false);
        setContextoEscalona("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const tipoIcon: Record<string, string> = {
    whatsapp: "\uD83D\uDCAC",
    ligacao: "\uD83D\uDCDE",
    email: "\uD83D\uDCE7",
    presencial: "\uD83E\uDD1D",
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0 bg-[var(--crm-surface)] border-[var(--crm-border)]">
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle className="flex items-center gap-2 text-[var(--crm-text-lg)] text-[var(--crm-text-primary)]">
            {atletaNome}
            {whatsappLink && (
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MessageSquare className="w-4 h-4 text-[var(--crm-success)]" />
                </Button>
              </a>
            )}
          </SheetTitle>
          <p className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">{responsavelNome} | {experiencia.fase?.replace("_", " ")}</p>
        </SheetHeader>

        <Tabs defaultValue="contato" className="px-6 pb-6">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="contato" className="text-[var(--crm-text-xs)]">Contato</TabsTrigger>
            <TabsTrigger value="familia" className="text-[var(--crm-text-xs)]">Familia</TabsTrigger>
            <TabsTrigger value="info" className="text-[var(--crm-text-xs)]">Info</TabsTrigger>
          </TabsList>

          {/* ABA 1: Registrar Contato */}
          <TabsContent value="contato" className="mt-4 space-y-4">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-[var(--crm-text-xs)] text-[var(--crm-text-secondary)]">Tipo</Label>
                <Select value={tipoContato} onValueChange={setTipoContato}>
                  <SelectTrigger className="crm-input h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">\uD83D\uDCAC WhatsApp</SelectItem>
                    <SelectItem value="ligacao">\uD83D\uDCDE Ligacao</SelectItem>
                    <SelectItem value="email">\uD83D\uDCE7 Email</SelectItem>
                    <SelectItem value="presencial">\uD83E\uDD1D Presencial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[var(--crm-text-xs)] text-[var(--crm-text-secondary)]">Resumo do contato *</Label>
                <Textarea
                  value={resumo}
                  onChange={(e) => setResumo(e.target.value)}
                  placeholder="Ex: Familia tranquila, sem duvidas. Proximo passo: enviar docs."
                  rows={3}
                  className="crm-input text-[var(--crm-text-sm)]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[var(--crm-text-xs)] text-[var(--crm-text-secondary)]">Proximo contato *</Label>
                <Input
                  type="datetime-local"
                  value={proximoContato}
                  onChange={(e) => setProximoContato(e.target.value)}
                  className="crm-input h-9"
                />
              </div>
              <button
                onClick={handleSalvarContato}
                disabled={isPending}
                className="crm-btn crm-btn-primary w-full h-11 text-[var(--crm-text-md)] font-[var(--crm-weight-semibold)]"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Salvar contato
              </button>
            </div>

            {/* Timeline de contatos */}
            {contatos.length > 0 && (
              <div className="pt-4 border-t border-[var(--crm-border)]">
                <h4 className="crm-section-label mb-2">Historico</h4>
                <div className="space-y-2">
                  {contatos.slice(0, 5).map((c: any) => (
                    <div key={c.id} className="text-[var(--crm-text-xs)] border-l-2 border-[var(--crm-accent-border)] pl-3 py-1">
                      <div className="flex items-center gap-2">
                        <span>{tipoIcon[c.tipo] || "\uD83D\uDCDD"}</span>
                        <span className="text-[var(--crm-text-tertiary)]">
                          {new Date(c.created_at).toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[var(--crm-text-primary)]">{c.resumo}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ABA 2: Familia -- indicadores e escalonamento */}
          <TabsContent value="familia" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[var(--crm-text-xs)] text-[var(--crm-text-secondary)]">Fase</Label>
                <Select value={fase} onValueChange={setFase}>
                  <SelectTrigger className="crm-input h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admissao">Admissao</SelectItem>
                    <SelectItem value="aprovado">Aprovado</SelectItem>
                    <SelectItem value="pre_embarque">Pre-embarque</SelectItem>
                    <SelectItem value="embarcado_inicial">Embarcado (0-90d)</SelectItem>
                    <SelectItem value="acompanhamento">Acompanhamento</SelectItem>
                    <SelectItem value="encerrado">Encerrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[var(--crm-text-xs)] text-[var(--crm-text-secondary)]">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="crm-input h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="satisfeita">\uD83D\uDE0A Satisfeita</SelectItem>
                    <SelectItem value="atencao">\u26A0\uFE0F Atencao</SelectItem>
                    <SelectItem value="crise">\uD83D\uDEA8 Crise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[var(--crm-text-xs)] text-[var(--crm-text-secondary)]">Ansiedade (1-5)</Label>
                <Input type="number" min={1} max={5} value={ansiedade} onChange={(e) => setAnsiedade(Number(e.target.value))} className="crm-input h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[var(--crm-text-xs)] text-[var(--crm-text-secondary)]">Satisfacao (1-5)</Label>
                <Input type="number" min={1} max={5} value={satisfacao} onChange={(e) => setSatisfacao(Number(e.target.value))} className="crm-input h-9" />
              </div>
            </div>

            {(ansiedade >= 4 || satisfacao <= 2) && (
              <span className="crm-badge crm-badge-error crm-badge-no-dot text-[var(--crm-text-xs)]">Temperatura mudara para VERMELHO automaticamente</span>
            )}

            {(status === "atencao" || status === "crise") && (
              <div className="space-y-3 p-3 bg-[var(--crm-warning-subtle)] rounded-[var(--crm-radius-lg)] border border-[var(--crm-warning-border)]">
                <div className="space-y-1.5">
                  <Label className="text-[var(--crm-text-xs)] text-[var(--crm-text-secondary)]">Descricao do problema *</Label>
                  <Textarea value={descProblema} onChange={(e) => setDescProblema(e.target.value)} rows={2} className="crm-input text-[var(--crm-text-sm)]" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[var(--crm-text-xs)] text-[var(--crm-text-secondary)]">Acao em andamento</Label>
                  <Textarea value={acaoAndamento} onChange={(e) => setAcaoAndamento(e.target.value)} rows={2} className="crm-input text-[var(--crm-text-sm)]" />
                </div>
              </div>
            )}

            <button onClick={handleSalvarIndicadores} disabled={isPending} className="crm-btn crm-btn-primary w-full">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Salvar indicadores
            </button>

            <div className="pt-3 border-t border-[var(--crm-border)]">
              {!showEscalonar ? (
                <button
                  className="crm-btn crm-btn-danger w-full border border-[var(--crm-error-border)]"
                  onClick={() => setShowEscalonar(true)}
                >
                  <AlertTriangle className="w-4 h-4" />
                  Escalonar ao CEO
                </button>
              ) : (
                <div className="space-y-2 p-3 bg-[var(--crm-error-tint)] rounded-[var(--crm-radius-lg)] border border-[var(--crm-error-border)]">
                  <Label className="text-[var(--crm-text-xs)] text-[var(--crm-error)]">Contexto do escalonamento</Label>
                  <Textarea
                    value={contextoEscalona}
                    onChange={(e) => setContextoEscalona(e.target.value)}
                    placeholder="Descreva a situacao..."
                    rows={2}
                    className="crm-input text-[var(--crm-text-sm)]"
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleEscalonar} disabled={isPending} variant="destructive" size="sm" className="flex-1">
                      Confirmar escalonamento
                    </Button>
                    <Button onClick={() => setShowEscalonar(false)} variant="outline" size="sm">
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ABA 3: Info */}
          <TabsContent value="info" className="mt-4 space-y-3 text-[var(--crm-text-sm)]">
            <div className="space-y-2">
              <h4 className="crm-section-label">Atleta</h4>
              <p className="text-[var(--crm-text-primary)]">{atletaNome}</p>
              <p className="text-[var(--crm-text-tertiary)]">{experiencia.atleta?.esporte} | {experiencia.atleta?.serie_escolar}</p>
            </div>
            <div className="space-y-2">
              <h4 className="crm-section-label">Responsavel</h4>
              <p className="text-[var(--crm-text-primary)]">{responsavelNome}</p>
              {whatsapp && <p className="text-[var(--crm-text-tertiary)]">{whatsapp}</p>}
            </div>
            <div className="space-y-2">
              <h4 className="crm-section-label">Contrato</h4>
              <p className="capitalize text-[var(--crm-text-primary)]">{experiencia.deal?.contrato?.plano || "\u2014"}</p>
              {experiencia.deal?.contrato?.valor_total && (
                <p className="text-[var(--crm-text-tertiary)]">R$ {Number(experiencia.deal.contrato.valor_total).toLocaleString("pt-BR")}</p>
              )}
            </div>
            <div className="space-y-2">
              <h4 className="crm-section-label">Embarque</h4>
              <p className="text-[var(--crm-text-primary)]">{experiencia.data_prevista_embarque ? new Date(experiencia.data_prevista_embarque).toLocaleDateString("pt-BR") : "A definir"}</p>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
