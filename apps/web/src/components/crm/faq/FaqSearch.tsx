"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Search, Copy, Plus, Check, BookOpen } from "lucide-react";
import { salvarArtigo, registrarAcesso } from "@/lib/crm/actions/faq";
import { FAQ_CATEGORIAS } from "@/types/crm";
import type { FaqArtigo } from "@/types/crm";
import { toast } from "sonner";

interface FaqSearchProps {
  artigos: FaqArtigo[];
  papel: string;
}

export function FaqSearch({ artigos, papel }: FaqSearchProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [selected, setSelected] = useState<FaqArtigo | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  // New article form
  const [newTitulo, setNewTitulo] = useState("");
  const [newCategoria, setNewCategoria] = useState("outros");
  const [newConteudo, setNewConteudo] = useState("");

  const filtered = artigos.filter((a) => {
    const matchSearch = !search
      || a.titulo.toLowerCase().includes(search.toLowerCase())
      || a.conteudo.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "all" || a.categoria === filterCat;
    return matchSearch && matchCat;
  });

  const handleCopy = async (conteudo: string, artigoId: string) => {
    try {
      await navigator.clipboard.writeText(conteudo);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      await registrarAcesso(artigoId);
      toast.success("Copiado para a area de transferencia!");
    } catch {
      toast.error("Erro ao copiar.");
    }
  };

  const handleSaveNew = () => {
    if (!newTitulo.trim() || !newConteudo.trim()) {
      toast.error("Titulo e conteudo sao obrigatorios.");
      return;
    }
    startTransition(async () => {
      const result = await salvarArtigo({
        titulo: newTitulo,
        categoria: newCategoria,
        conteudo: newConteudo,
      });
      if (result.success) {
        toast.success("Artigo criado!");
        setShowNew(false);
        setNewTitulo("");
        setNewConteudo("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const catLabel = (cat: string) => FAQ_CATEGORIAS.find((c) => c.value === cat)?.label || cat;

  return (
    <>
      <div className="space-y-4">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--crm-text-tertiary)]" />
            <input
              placeholder="Buscar artigo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="crm-input pl-9 h-11"
              autoFocus
            />
          </div>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="crm-input w-40"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {FAQ_CATEGORIAS.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button onClick={() => setShowNew(true)} className="crm-btn crm-btn-primary">
            <Plus className="w-4 h-4" /> Novo
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="crm-card">
            <div className="crm-empty-state">
              <div className="crm-empty-state-icon">
                <BookOpen className="h-5 w-5" />
              </div>
              <p className="crm-empty-state-title">Nenhum artigo encontrado</p>
              <p className="crm-empty-state-description">Ajuste a busca ou crie um novo artigo.</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((artigo) => (
              <div
                key={artigo.id}
                className="crm-card crm-card-interactive"
                onClick={() => setSelected(artigo)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-[var(--crm-text-sm)] font-[var(--crm-weight-medium)] text-[var(--crm-text-primary)]">{artigo.titulo}</h3>
                    <p className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)] mt-1 line-clamp-2">{artigo.conteudo.slice(0, 150)}...</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="crm-badge crm-badge-neutral crm-badge-no-dot text-[var(--crm-text-xs)]">{catLabel(artigo.categoria)}</span>
                    <span className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">{artigo.acessos}x</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Artigo detail */}
      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-[var(--crm-surface)] border-[var(--crm-border)]">
          <SheetHeader>
            <SheetTitle className="text-[var(--crm-text-primary)]">{selected?.titulo}</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="mt-4 space-y-4">
              <span className="crm-badge crm-badge-neutral crm-badge-no-dot">{catLabel(selected.categoria)}</span>
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-[var(--crm-text-sm)] leading-relaxed text-[var(--crm-text-secondary)]">
                {selected.conteudo}
              </div>
              <button
                onClick={() => handleCopy(selected.conteudo, selected.id)}
                className={copied ? "crm-btn crm-btn-primary w-full" : "crm-btn crm-btn-secondary w-full"}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copiado!" : "Copiar para WhatsApp"}
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* New article */}
      <Sheet open={showNew} onOpenChange={setShowNew}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-[var(--crm-surface)] border-[var(--crm-border)]">
          <SheetHeader>
            <SheetTitle className="text-[var(--crm-text-primary)]">Novo Artigo</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[var(--crm-text-xs)] text-[var(--crm-text-secondary)]">Titulo *</Label>
              <input value={newTitulo} onChange={(e) => setNewTitulo(e.target.value)} className="crm-input" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[var(--crm-text-xs)] text-[var(--crm-text-secondary)]">Categoria</Label>
              <Select value={newCategoria} onValueChange={setNewCategoria}>
                <SelectTrigger className="crm-input"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FAQ_CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[var(--crm-text-xs)] text-[var(--crm-text-secondary)]">Conteudo *</Label>
              <Textarea value={newConteudo} onChange={(e) => setNewConteudo(e.target.value)} rows={10} className="crm-input" />
            </div>
            <button onClick={handleSaveNew} disabled={isPending} className="crm-btn crm-btn-primary w-full">
              Salvar Artigo
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
