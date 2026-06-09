"use client";

import { useState, useMemo, useCallback } from "react";
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
} from "lucide-react";

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

export function UtmBuilderClient() {
  const [baseUrl] = useState("https://bolsaatletausa.com");
  const [source, setSource] = useState("");
  const [medium, setMedium] = useState("");
  const [campaign, setCampaign] = useState("");
  const [content, setContent] = useState("");
  const [term, setTerm] = useState("");
  const [copied, setCopied] = useState(false);
  const [copiedShort, setCopiedShort] = useState(false);

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

  const copyToClipboard = useCallback(
    async (url: string, type: "full" | "short") => {
      await navigator.clipboard.writeText(url);
      if (type === "full") {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-title-2 text-foreground">Gerador de Links UTM</h1>
        <p className="text-sm text-muted-foreground">
          Crie links rastreáveis para suas campanhas. Dados aparecem em Analytics →
          Atribuição.
        </p>
      </div>

      {/* Presets */}
      <div className="glass-card rounded-xl p-5">
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
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-card rounded-xl p-5 space-y-4">
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
          <div className="glass-card rounded-xl p-5">
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
          <div className="glass-card rounded-xl p-5">
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

          {/* Help */}
          <div className="rounded-xl border border-sys-orange/20 bg-sys-orange/5 p-4">
            <p className="text-xs font-medium text-sys-orange mb-2">Como usar</p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>• Use o <strong className="text-foreground">Link Landing</strong> para anúncios e posts (lead vê a home primeiro)</li>
              <li>• Use o <strong className="text-foreground">Link Formulário</strong> para remarketing (lead já conhece, vai direto pro form)</li>
              <li>• Dados aparecem em <strong className="text-foreground">Analytics → Atribuição</strong> após o lead enviar o formulário</li>
              <li>• UTMs são capturados no <strong className="text-foreground">primeiro acesso</strong> (first-touch attribution)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
