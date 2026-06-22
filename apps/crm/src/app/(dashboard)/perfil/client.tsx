"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, Loader2, User, Lock, Check } from "lucide-react";
import { toast } from "sonner";

import { createBrowserClient } from "@/lib/supabase-browser";
import { uploadAvatar } from "@/lib/avatar-upload";
import { atualizarMeuPerfil } from "@/lib/actions/usuarios";
import { getInitials } from "@/lib/utils";
import { PAPEL_LABEL } from "@/lib/papel";
import type { UserProfile } from "@/types/crm";

const inputClass =
  "w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm text-foreground placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

export function PerfilClient({ profile }: { profile: UserProfile }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [nome, setNome] = useState(profile.nome);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url);
  const [savingNome, setSavingNome] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [savingSenha, setSavingSenha] = useState(false);

  const onPickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadAvatar(profile.id, file);
      const r = await atualizarMeuPerfil({ avatar_url: url });
      if (!r.success) throw new Error(r.error);
      setAvatarUrl(url);
      toast.success("Foto de perfil atualizada");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar a foto");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const salvarNome = async () => {
    if (nome.trim().length < 2) {
      toast.error("Informe um nome válido");
      return;
    }
    setSavingNome(true);
    const r = await atualizarMeuPerfil({ nome });
    setSavingNome(false);
    if (r.success) {
      toast.success("Perfil atualizado");
      router.refresh();
    } else {
      toast.error(r.error);
    }
  };

  const trocarSenha = async (e: FormEvent) => {
    e.preventDefault();
    if (novaSenha.length < 8) {
      toast.error("A senha deve ter ao menos 8 caracteres");
      return;
    }
    if (novaSenha !== confirmar) {
      toast.error("As senhas não conferem");
      return;
    }
    setSavingSenha(true);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) throw error;
      toast.success("Senha alterada com sucesso");
      setNovaSenha("");
      setConfirmar("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao alterar a senha");
    } finally {
      setSavingSenha(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-title-2 text-foreground">Meu Perfil</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Gerencie seus dados, foto de perfil e senha.
        </p>
      </div>

      {/* Identidade + foto */}
      <div className="rounded-lg border border-border/70 bg-card/60 p-4">
        <div className="flex items-center gap-5">
          <div className="relative flex-shrink-0">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={profile.nome}
                width={80}
                height={80}
                unoptimized
                className="h-20 w-20 rounded-full object-cover ring-1 ring-border"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-sys-purple text-base font-semibold text-primary-foreground">
                {getInitials(profile.nome)}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-background transition-colors hover:bg-primary/90 disabled:opacity-60"
              aria-label="Alterar foto de perfil"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={onPickFile}
            />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-foreground">{profile.nome}</p>
            <p className="truncate text-sm text-muted-foreground">{profile.email}</p>
            <span className="mt-1.5 inline-flex items-center rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              {PAPEL_LABEL[profile.papel]}
            </span>
          </div>
        </div>
      </div>

      {/* Dados pessoais */}
      <div className="rounded-lg border border-border/70 bg-card/60 p-4">
        <div className="mb-4 flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Dados pessoais</h2>
        </div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Nome</label>
        <input value={nome} onChange={(e) => setNome(e.target.value)} className={inputClass} />
        <label className="mb-1.5 mt-3 block text-xs font-medium text-muted-foreground">E-mail</label>
        <input
          value={profile.email}
          disabled
          className="w-full rounded-md border border-border bg-secondary px-3 py-2.5 text-sm text-muted-foreground"
        />
        <p className="mt-1 text-[10px] text-label-tertiary">
          O e-mail de login não pode ser alterado por aqui.
        </p>
        <div className="mt-4 flex justify-end">
          <button
            onClick={salvarNome}
            disabled={savingNome || nome.trim() === profile.nome}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {savingNome ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Salvar
          </button>
        </div>
      </div>

      {/* Trocar senha */}
      <form onSubmit={trocarSenha} className="rounded-lg border border-border/70 bg-card/60 p-4">
        <div className="mb-4 flex items-center gap-2">
          <Lock className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Trocar senha</h2>
        </div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Nova senha</label>
        <input
          type="password"
          value={novaSenha}
          onChange={(e) => setNovaSenha(e.target.value)}
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          className={inputClass}
        />
        <label className="mb-1.5 mt-3 block text-xs font-medium text-muted-foreground">
          Confirmar nova senha
        </label>
        <input
          type="password"
          value={confirmar}
          onChange={(e) => setConfirmar(e.target.value)}
          autoComplete="new-password"
          className={inputClass}
        />
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            disabled={savingSenha || !novaSenha || !confirmar}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {savingSenha ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Alterar senha
          </button>
        </div>
      </form>
    </div>
  );
}
