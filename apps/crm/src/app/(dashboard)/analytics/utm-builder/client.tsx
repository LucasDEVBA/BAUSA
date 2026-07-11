"use client";

import { useState, useMemo, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Check,
  Link2,
  Sparkles,
  Instagram,
  Facebook,
  Globe,
  MessageCircle,
  Mail,
  Video,
  Search,
  Megaphone,
  Scissors,
  MousePointerClick,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";

import { criarLinkCurto } from "@/lib/actions/links-curtos";
import type { LinkCurtoRow } from "./page";

// ─── Presets ────────────────────────────────────────────────────────────────

interface Preset {
  label: string;
  icon: typeof Instagram;
  color: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
}

const PRESETS: Preset[] = [
  {
    label: "Instagram Ads",
    icon: Instagram,
    color: "text-sys-pink",
    source: "instagram",
    medium: "paid",
    campaign: "",
    content: "",
  },
  {
    label: "Facebook Ads",
    icon: Facebook,
    color: "text-sys-blue",
    source: "facebook",
    medium: "paid",
    campaign: "",
    content: "",
  },
  {
    label: "Instagram Bio",
    icon: Instagram,
    color: "text-sys-pink",
    source: "instagram",
    medium: "social",
    campaign: "bio_link",
    content: "",
  },
  {
    label: "Instagram Stories",
    icon: Instagram,
    color: "text-sys-pink",
    source: "instagram",
    medium: "social",
    campaign: "stories",
    content: "",
  },
  {
    label: "TikTok Ads",
    icon: Video,
    color: "text-sys-cyan",
    source: "tiktok",
    medium: "paid",
    campaign: "",
    content: "",
  },
  {
    label: "Google Ads",
    icon: Search,
    color: "text-sys-yellow",
    source: "google",
    medium: "paid",
    campaign: "",
    content: "",
  },
  {
    label: "Google Orgânico",
    icon: Globe,
    color: "text-sys-green",
    source: "google",
    medium: "organic",
    campaign: "",
    content: "",
  },
  {
    label: "WhatsApp",
    icon: MessageCircle,
    color: "text-sys-green",
    source: "whatsapp",
    medium: "referral",
    campaign: "indicacao",
    content: "",
  },
  {
    label: "E-mail Marketing",
    icon: Mail,
    color: "text-primary",
    source: "email",
    medium: "email",
    campaign: "",
    content: "",
  },
  {
    label: "Campanha Custom",
    icon: Megaphone,
    color: "text-sys-orange",
    source: "",
    medium: "",
    campaign: "",
    content: "",
  },
];

// ─── Component ──────────────────────────────────────────────────────────────

export function UtmBuilderClient({ links }: { links: LinkCurtoRow[] }) {
  const router = useRouter();
  const [baseUrl] = useState("https://bolsaatletausa.com");
  const [source, setSource] = useState("");
  const [medium, setMedium] = useState("");
  const [campaign, setCampaign] = useState("");
  const [content, setContent] = useState("");
  const [term, setTerm] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedShort, setCopiedShort] = useState(false);
  const [copiedAcesso, setCopiedAcesso] = useState(false);
  // Encurtador
  const [creating, startCreate] = useTransition();
  const [target, setTarget] = useState<"landing" | "forms" | "acesso">("landing");
  const [titulo, setTitulo] = useState("");
  const [slug, setSlug] = useState("");
  const [shortSlug, setShortSlug] = useState<string | null>(null);
  const [copiedShortLink, setCopiedShortLink] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const generatedUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (source) params.set("utm_source", source);
    if (medium) params.set("utm_medium", medium);
    if (campaign) params.set("utm_campaign", campaign);
    if (content) params.set("utm_content", content);
    if (term) params.set("utm_term", term);

    const qs = params.toString();
    return qs ? `${baseUrl}/?${qs}` : baseUrl;
  }, [baseUrl, source, medium, campaign, content, term]);

  const formsUrl = useMemo(() => {
    return generatedUrl.replace(baseUrl, `${baseUrl}/forms`);
  }, [generatedUrl, baseUrl]);

  const acessoUrl = useMemo(() => {
    return generatedUrl.replace(baseUrl, `${baseUrl}/acesso`);
  }, [generatedUrl, baseUrl]);

  const copyToClipboard = useCallback(
    async (url: string, type: "full" | "short" | "acesso") => {
      await navigator.clipboard.writeText(url);
      if (type === "full") {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else if (type === "acesso") {
        setCopiedAcesso(true);
        setTimeout(() => setCopiedAcesso(false), 2000);
      } else {
        setCopiedShort(true);
        setTimeout(() => setCopiedShort(false), 2000);
      }
    },
    [],
  );

  function applyPreset(preset: Preset) {
    setSource(preset.source);
    setMedium(preset.medium);
    setCampaign(preset.campaign);
    setContent(preset.content);
    setTerm("");
  }

  const hasParams = source || medium || campaign;
  // Espelha o regex do servidor (e da rota pública /l/[slug]): 3-40 chars, sem
  // hífen nas pontas. Vazio = automático. Bloqueia o botão se inválido.
  const slugTrim = slug.trim();
  const slugValido = slugTrim === "" || /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slugTrim);

  const buildShort = useCallback(
    (slug: string) => `${baseUrl}/l/${slug}`,
    [baseUrl],
  );

  function handleEncurtar() {
    const destino =
      target === "forms" ? formsUrl : target === "acesso" ? acessoUrl : generatedUrl;
    setShortSlug(null);
    startCreate(async () => {
      const result = await criarLinkCurto({
        destino,
        slug: slug.trim() || undefined,
        titulo: titulo.trim() || undefined,
        utm_source: source || undefined,
        utm_medium: medium || undefined,
        utm_campaign: campaign || undefined,
        utm_content: content || undefined,
        utm_term: term || undefined,
      });
      if (result.success) {
        setShortSlug(result.slug);
        setSlug("");
        toast.success("Link curto criado — as UTMs ficam escondidas");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  async function copiarShort(url: string) {
    await navigator.clipboard.writeText(url);
    setCopiedShortLink(true);
    setTimeout(() => setCopiedShortLink(false), 2000);
  }

  async function copiarDaLista(id: string, url: string) {
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-title-2 text-foreground">Gerador de Links UTM</h1>
        <p className="text-sm text-muted-foreground">
          Crie links rastreáveis para suas campanhas. Dados aparecem em Analytics →
          Atribuição.
        </p>
      </div>

      {/* Presets */}
      <div className="rounded-lg border border-border/70 bg-card/60 p-3.5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Templates Rápidos
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {PRESETS.map((preset) => {
            const Icon = preset.icon;
            const isActive =
              source === preset.source &&
              medium === preset.medium &&
              (preset.campaign === "" || campaign === preset.campaign);
            return (
              <button
                key={preset.label}
                onClick={() => applyPreset(preset)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs font-medium transition-all ${
                  isActive
                    ? "border-primary/50 bg-primary/15 text-foreground"
                    : "border-border bg-secondary text-muted-foreground hover:border-border hover:text-foreground"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${preset.color}`} />
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Form Fields */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border/70 bg-card/60 p-3.5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Parâmetros UTM
          </p>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Source <span className="text-sys-red">*</span>
              <span className="ml-1 text-label-tertiary">(de onde vem)</span>
            </label>
            <input
              value={source}
              onChange={(e) => setSource(e.target.value.toLowerCase().replace(/\s/g, "_"))}
              placeholder="instagram, facebook, google, whatsapp..."
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-placeholder outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Medium <span className="text-sys-red">*</span>
              <span className="ml-1 text-label-tertiary">(tipo de tráfego)</span>
            </label>
            <select
              value={medium}
              onChange={(e) => setMedium(e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
            >
              <option value="">Selecione...</option>
              <option value="paid">paid (anúncio pago)</option>
              <option value="organic">organic (busca orgânica)</option>
              <option value="social">social (post/stories/bio)</option>
              <option value="referral">referral (indicação/parceiro)</option>
              <option value="email">email (e-mail marketing)</option>
              <option value="direct">direct (link direto)</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Campaign <span className="text-sys-red">*</span>
              <span className="ml-1 text-label-tertiary">(nome da campanha)</span>
            </label>
            <input
              value={campaign}
              onChange={(e) => setCampaign(e.target.value.toLowerCase().replace(/\s/g, "_"))}
              placeholder="safra_fall2026, lancamento_maio, black_friday..."
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-placeholder outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Content
              <span className="ml-1 text-label-tertiary">(qual criativo/variação)</span>
            </label>
            <input
              value={content}
              onChange={(e) => setContent(e.target.value.toLowerCase().replace(/\s/g, "_"))}
              placeholder="video_depoimento, carrossel_escolas, stories_cta..."
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-placeholder outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Term
              <span className="ml-1 text-label-tertiary">(palavra-chave — Google Ads)</span>
            </label>
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value.toLowerCase().replace(/\s/g, "_"))}
              placeholder="bolsa_esportiva_eua, estudar_nos_eua..."
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-foreground placeholder:text-placeholder outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-4">
          {/* Landing URL */}
          <div className="rounded-lg border border-border/70 bg-card/60 p-3.5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Link da Landing Page
              </p>
              {hasParams && (
                <span className="flex items-center gap-1 text-[10px] text-sys-green">
                  <Sparkles className="h-3 w-3" /> UTM ativo
                </span>
              )}
            </div>

            <div className="rounded-lg border border-border bg-secondary p-3">
              <p className="break-all text-sm text-foreground font-mono leading-relaxed">
                {generatedUrl}
              </p>
            </div>

            <button
              onClick={() => copyToClipboard(generatedUrl, "full")}
              disabled={!hasParams}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" /> Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> Copiar Link Landing
                </>
              )}
            </button>
          </div>

          {/* Forms URL */}
          <div className="rounded-lg border border-border/70 bg-card/60 p-3.5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Link Direto do Formulário
            </p>

            <div className="rounded-lg border border-border bg-secondary p-3">
              <p className="break-all text-sm text-foreground font-mono leading-relaxed">
                {formsUrl}
              </p>
            </div>

            <button
              onClick={() => copyToClipboard(formsUrl, "short")}
              disabled={!hasParams}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-secondary py-2.5 text-sm font-medium text-muted-foreground transition-all hover:border-border hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {copiedShort ? (
                <>
                  <Check className="h-4 w-4" /> Copiado!
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4" /> Copiar Link Formulário
                </>
              )}
            </button>
          </div>

          {/* Acesso URL */}
          <div className="rounded-lg border border-border/70 bg-card/60 p-3.5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Link da Tela de Acesso
            </p>

            <div className="rounded-lg border border-border bg-secondary p-3">
              <p className="break-all text-sm text-foreground font-mono leading-relaxed">
                {acessoUrl}
              </p>
            </div>

            <button
              onClick={() => copyToClipboard(acessoUrl, "acesso")}
              disabled={!hasParams}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-secondary py-2.5 text-sm font-medium text-muted-foreground transition-all hover:border-border hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {copiedAcesso ? (
                <>
                  <Check className="h-4 w-4" /> Copiado!
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4" /> Copiar Link Acesso
                </>
              )}
            </button>
          </div>

          {/* Help */}
          <div className="rounded-xl border border-sys-orange/20 bg-sys-orange/5 p-4">
            <p className="text-xs font-medium text-sys-orange mb-2">Como usar</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>• Use o <strong className="text-foreground">Link Landing</strong> para anúncios e posts (lead vê a home primeiro)</li>
              <li>• Use o <strong className="text-foreground">Link Formulário</strong> para remarketing (lead já conhece, vai direto pro form)</li>
              <li>• Use o <strong className="text-foreground">Link Acesso</strong> para levar direto à tela de acesso (/acesso)</li>
              <li>• Dados aparecem em <strong className="text-foreground">Analytics → Atribuição</strong> após o lead enviar o formulário</li>
              <li>• UTMs são capturados no <strong className="text-foreground">primeiro acesso</strong> (first-touch attribution)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Encurtador — esconde as UTMs no link compartilhado */}
      <section className="rounded-lg border border-primary/25 bg-card p-3.5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Scissors className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Encurtar link</h2>
          <span className="flex items-center gap-1 rounded-full border border-sys-green/30 bg-sys-green/10 px-2 py-0.5 text-[10px] font-medium text-sys-green">
            <EyeOff className="h-3 w-3" /> esconde as UTMs
          </span>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Gera um link limpo{" "}
          <span className="font-mono text-foreground">
            {baseUrl.replace("https://", "")}/l/xxxx
          </span>{" "}
          que redireciona para a URL com UTMs — o link compartilhado não expõe os
          parâmetros e os cliques são contados.
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Destino
            </label>
            <div className="flex gap-1 rounded-lg border border-border bg-secondary p-1">
              {(["landing", "forms", "acesso"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTarget(t)}
                  className={
                    target === t
                      ? "rounded-md bg-primary/15 px-3 py-1.5 text-xs font-medium text-foreground"
                      : "rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  }
                >
                  {t === "landing" ? "Landing" : t === "forms" ? "Formulário" : "Acesso"}
                </button>
              ))}
            </div>
          </div>

          <div className="min-w-[180px]">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Código do link{" "}
              <span className="text-label-tertiary">(opcional — automático se vazio)</span>
            </label>
            <div className="flex items-stretch overflow-hidden rounded-lg border border-border bg-secondary focus-within:border-primary">
              <span className="flex items-center whitespace-nowrap border-r border-border bg-secondary/60 px-2.5 text-xs font-mono text-muted-foreground">
                /l/
              </span>
              <input
                value={slug}
                onChange={(e) =>
                  setSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/\s+/g, "-")
                      .replace(/[^a-z0-9-]/g, ""),
                  )
                }
                maxLength={40}
                placeholder="ex.: fall-stories"
                aria-label="Código personalizado do link curto"
                className="w-full bg-transparent px-3 py-2 text-sm font-mono text-foreground placeholder:text-placeholder outline-none"
              />
            </div>
          </div>

          <div className="min-w-[180px] flex-1">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Título{" "}
              <span className="text-label-tertiary">(opcional — p/ identificar)</span>
            </label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="ex.: Stories lançamento fall"
              className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-placeholder outline-none focus:border-primary"
            />
          </div>

          <button
            onClick={handleEncurtar}
            disabled={!hasParams || creating || !slugValido}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Scissors className="h-4 w-4" />
            {creating ? "Gerando…" : "Gerar link curto"}
          </button>
        </div>
        {!slugValido && (
          <p className="mt-2 text-xs text-sys-orange">
            O código deve ter 3-40 caracteres (letras, números ou hífen) e não começar nem terminar com hífen.
          </p>
        )}

        {shortSlug && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-sys-green/30 bg-sys-green/10 p-3">
            <span className="break-all font-mono text-sm font-medium text-foreground">
              {buildShort(shortSlug)}
            </span>
            <button
              onClick={() => copiarShort(buildShort(shortSlug))}
              className="ml-auto flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90"
            >
              {copiedShortLink ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copiar
                </>
              )}
            </button>
          </div>
        )}
        {!hasParams && (
          <p className="mt-2 text-xs text-label-tertiary">
            Preencha os parâmetros UTM acima para gerar um link curto.
          </p>
        )}
      </section>

      {/* Meus links curtos */}
      <section className="rounded-lg border border-border/70 bg-card/60 p-3.5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Meus links curtos
          </h2>
          <span className="text-xs text-muted-foreground">
            {links.length} link(s)
          </span>
        </div>
        {links.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum link curto ainda. Gere o primeiro acima.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Link curto</th>
                  <th className="py-2 pr-4 font-medium">Destino (com UTMs)</th>
                  <th className="py-2 pr-4 text-right font-medium">Cliques</th>
                  <th className="py-2 pr-4 font-medium" />
                </tr>
              </thead>
              <tbody>
                {links.map((l) => (
                  <tr key={l.id} className="border-b border-border/50 text-foreground">
                    <td className="py-2 pr-4">
                      <span className="block font-mono text-xs font-medium">
                        /l/{l.slug}
                      </span>
                      {l.titulo && (
                        <span className="text-[10px] text-muted-foreground">
                          {l.titulo}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className="block max-w-[280px] truncate text-xs text-muted-foreground"
                        title={l.destino}
                      >
                        {l.destino}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <span className="inline-flex items-center gap-1 tabular-nums text-muted-foreground">
                        <MousePointerClick className="h-3 w-3" />
                        {l.cliques}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <button
                        onClick={() => copiarDaLista(l.id, buildShort(l.slug))}
                        className="text-muted-foreground transition hover:text-primary"
                        aria-label="Copiar link curto"
                      >
                        {copiedId === l.id ? (
                          <Check className="h-4 w-4 text-sys-green" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
