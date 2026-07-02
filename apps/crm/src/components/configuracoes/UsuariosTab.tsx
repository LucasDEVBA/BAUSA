"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { UserPlus, Loader2, Users as UsersIcon, ShieldCheck, Check } from "lucide-react";
import { toast } from "sonner";

import { listarUsuarios, atualizarUsuario, criarUsuario } from "@/lib/actions/usuarios";
import { getInitials, cn } from "@/lib/utils";
import type { UserProfile, PapelUsuario } from "@/types/crm";
import { Card, Input, Button, EmptyState } from "@/components/ui";

const PAPEL_OPTIONS: { value: PapelUsuario; label: string }[] = [
  { value: "ceo", label: "CEO" },
  { value: "cto", label: "CTO" },
  { value: "head_sucesso", label: "Head de Sucesso" },
  { value: "comercial", label: "Comercial" },
];

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground appearance-none transition-colors focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25";
const labelClass = "mb-1 block text-[10px] font-medium text-muted-foreground";

interface RowEdit {
  papel: PapelUsuario;
  ativo: boolean;
}

export function UsuariosTab() {
  const [usuarios, setUsuarios] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [edits, setEdits] = useState<Record<string, RowEdit>>({});

  const [showCreate, setShowCreate] = useState(false);
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [papel, setPapel] = useState<PapelUsuario>("comercial");
  const [senha, setSenha] = useState("");

  const load = () => {
    startTransition(async () => {
      const r = await listarUsuarios();
      if (r.success) {
        setUsuarios(r.data ?? []);
        setEdits({});
      } else {
        toast.error(r.error);
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setEdit = (u: UserProfile, patch: Partial<RowEdit>) => {
    setEdits((prev) => ({
      ...prev,
      [u.id]: {
        papel: prev[u.id]?.papel ?? u.papel,
        ativo: prev[u.id]?.ativo ?? u.ativo,
        ...patch,
      },
    }));
  };

  const isDirty = (u: UserProfile) => {
    const e = edits[u.id];
    return Boolean(e && (e.papel !== u.papel || e.ativo !== u.ativo));
  };

  const salvar = (u: UserProfile) => {
    const e = edits[u.id];
    if (!e) return;
    startTransition(async () => {
      const r = await atualizarUsuario(u.id, { papel: e.papel, ativo: e.ativo });
      if (r.success) {
        toast.success("Usuário atualizado");
        load();
      } else {
        toast.error(r.error);
      }
    });
  };

  const criar = () => {
    startTransition(async () => {
      const r = await criarUsuario({ email, nome, papel, senha });
      if (r.success) {
        toast.success("Usuário criado com sucesso");
        setEmail("");
        setNome("");
        setSenha("");
        setPapel("comercial");
        setShowCreate(false);
        load();
      } else {
        toast.error(r.error);
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* Header + criar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <UsersIcon className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Usuários do sistema</h3>
        </div>
        <Button type="button" onClick={() => setShowCreate((v) => !v)}>
          <UserPlus className="h-4 w-4" />
          Novo usuário
        </Button>
      </div>

      {/* Formulário de criação */}
      {showCreate && (
        <Card className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Criar usuário
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Nome</label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
            </div>
            <div>
              <label className={labelClass}>E-mail (login)</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@bolsaatletausa.com" />
            </div>
            <div>
              <label className={labelClass}>Papel</label>
              <select value={papel} onChange={(e) => setPapel(e.target.value as PapelUsuario)} className={selectClass}>
                {PAPEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Senha inicial</label>
              <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-1 text-[10px] text-label-tertiary">
              <ShieldCheck className="h-3 w-3" />
              Requer SUPABASE_SERVICE_KEY no ambiente. CTO usa o papel CEO.
            </p>
            <Button type="button" onClick={criar} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Criar usuário
            </Button>
          </div>
        </Card>
      )}

      {/* Lista */}
      {loading ? (
        <Card padding="none">
          <EmptyState
            icon={Loader2}
            title="Carregando usuários…"
            className="[&_svg]:animate-spin"
          />
        </Card>
      ) : usuarios.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={UsersIcon}
            title="Nenhum usuário cadastrado ainda"
            description="Crie o primeiro usuário do sistema com o botão “Novo usuário”."
          />
        </Card>
      ) : (
        <Card padding="none" className="divide-y divide-border overflow-hidden">
          {usuarios.map((u) => {
            const papelVal = edits[u.id]?.papel ?? u.papel;
            const ativoVal = edits[u.id]?.ativo ?? u.ativo;
            return (
              <div key={u.id} className="flex flex-wrap items-center gap-3 p-4 transition-colors hover:bg-secondary/40">
                {u.avatar_url ? (
                  <Image
                    src={u.avatar_url}
                    alt={u.nome}
                    width={36}
                    height={36}
                    unoptimized
                    className="h-9 w-9 flex-shrink-0 rounded-full object-cover ring-1 ring-border"
                  />
                ) : (
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-brand text-xs font-bold text-primary-foreground">
                    {getInitials(u.nome)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{u.nome}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </div>

                <select
                  value={papelVal}
                  onChange={(e) => setEdit(u, { papel: e.target.value as PapelUsuario })}
                  className={cn(selectClass, "h-8 w-auto px-2.5 text-xs")}
                  aria-label={`Papel de ${u.nome}`}
                >
                  {PAPEL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setEdit(u, { ativo: !ativoVal })}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25",
                    ativoVal
                      ? "border-sys-green/20 bg-sys-green/15 text-sys-green"
                      : "border-border bg-secondary text-muted-foreground",
                  )}
                  aria-pressed={ativoVal}
                >
                  {ativoVal ? "Ativo" : "Inativo"}
                </button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => salvar(u)}
                  disabled={!isDirty(u) || pending}
                >
                  <Check className="h-3.5 w-3.5" />
                  Salvar
                </Button>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
