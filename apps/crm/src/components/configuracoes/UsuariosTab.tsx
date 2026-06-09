"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import { UserPlus, Loader2, Users as UsersIcon, ShieldCheck, Check } from "lucide-react";
import { toast } from "sonner";

import { listarUsuarios, atualizarUsuario, criarUsuario } from "@/lib/actions/usuarios";
import { getInitials, cn } from "@/lib/utils";
import type { UserProfile, PapelUsuario } from "@/types/crm";

const PAPEL_OPTIONS: { value: PapelUsuario; label: string }[] = [
  { value: "ceo", label: "CEO" },
  { value: "head_sucesso", label: "Head de Sucesso" },
  { value: "comercial", label: "Comercial" },
];

const inputClass =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";
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
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <UserPlus className="h-4 w-4" />
          Novo usuário
        </button>
      </div>

      {/* Formulário de criação */}
      {showCreate && (
        <div className="glass-card space-y-3 rounded-xl p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Criar usuário
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Nome</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} className={inputClass} placeholder="Nome completo" />
            </div>
            <div>
              <label className={labelClass}>E-mail (login)</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="usuario@bolsaatletausa.com" />
            </div>
            <div>
              <label className={labelClass}>Papel</label>
              <select value={papel} onChange={(e) => setPapel(e.target.value as PapelUsuario)} className={cn(inputClass, "appearance-none")}>
                {PAPEL_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Senha inicial</label>
              <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} className={inputClass} placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-1 text-[10px] text-label-tertiary">
              <ShieldCheck className="h-3 w-3" />
              Requer SUPABASE_SERVICE_KEY no ambiente. CTO usa o papel CEO.
            </p>
            <button
              type="button"
              onClick={criar}
              disabled={pending}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Criar usuário
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="glass-card rounded-xl p-8 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
          Carregando usuários…
        </div>
      ) : usuarios.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center">
          <UsersIcon className="mx-auto mb-2 h-8 w-8 text-label-tertiary" />
          <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado ainda.</p>
        </div>
      ) : (
        <div className="glass-card divide-y divide-border overflow-hidden rounded-xl">
          {usuarios.map((u) => {
            const papelVal = edits[u.id]?.papel ?? u.papel;
            const ativoVal = edits[u.id]?.ativo ?? u.ativo;
            return (
              <div key={u.id} className="flex flex-wrap items-center gap-3 p-4">
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
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-sys-purple text-xs font-bold text-primary-foreground">
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
                  className="appearance-none rounded-md border border-input bg-card px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
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
                    "rounded-md border px-2.5 py-1 text-[10px] font-semibold transition-colors",
                    ativoVal
                      ? "border-sys-green/20 bg-sys-green/15 text-sys-green"
                      : "border-border bg-secondary text-muted-foreground",
                  )}
                  aria-pressed={ativoVal}
                >
                  {ativoVal ? "Ativo" : "Inativo"}
                </button>

                <button
                  type="button"
                  onClick={() => salvar(u)}
                  disabled={!isDirty(u) || pending}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
                >
                  <Check className="h-3.5 w-3.5" />
                  Salvar
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
