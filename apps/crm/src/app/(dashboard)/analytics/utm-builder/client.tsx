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
    color: "text-pink-400",
    source: "instagram",
    medium: "paid",
    campaign: "",
    content: "",
  },
  {
    label: "Facebook Ads",
    icon: Facebook,
    color: "text-blue-400",
    source: "facebook",
    medium: "paid",
    campaign: "",
    content: "",
  },
  {
    label: "Instagram Bio",
    icon: Instagram,
    color: "text-pink-400",
    source: "instagram",
    medium: "social",
    campaign: "bio_link",
    content: "",
  },
  {
    label: "Instagram Stories",
    icon: Instagram,
    color: "text-pink-400",
    source: "instagram",
    medium: "social",
    campaign: "stories",
    content: "",
  },
  {
    label: "TikTok Ads",
    icon: Video,
    color: "text-cyan-400",
    source: "tiktok",
    medium: "paid",
    campaign: "",
    content: "",
  },
  {
    label: "Google Ads",
    icon: Search,
    color: "text-yellow-400",
    source: "google",
    medium: "paid",
    campaign: "",
    content: "",
  },
  {
    label: "Google Orgânico",
    icon: Globe,
    color: "text-emerald-400",
    source: "google",
    medium: "organic",
    campaign: "",
    content: "",
  },
  {
    label: "WhatsApp",
    icon: MessageCircle,
    color: "text-green-400",
    source: "whatsapp",
    medium: "referral",
    campaign: "indicacao",
    content: "",
  },
  {
    label: "E-mail Marketing",
    icon: Mail,
    color: "text-indigo-400",
    source: "email",
    medium: "email",
    campaign: "",
    content: "",
  },
  {
    label: "Campanha Custom",
    icon: Megaphone,
    color: "text-amber-400",
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
        <h1 className="text-xl font-bold text-zinc-100">Gerador de Links UTM</h1>
        <p className="text-sm text-zinc-500">
          Crie links rastreáveis para suas campanhas. Dados aparecem em Analytics →
          Atribuição.
        </p>
      </div>

      {/* Presets */}
      <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
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
                    ? "border-indigo-500/50 bg-indigo-500/10 text-indigo-300"
                    : "border-[#1e2130] bg-[#0c0e14] text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
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
        <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Parâmetros UTM
          </p>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Source <span className="text-red-400">*</span>
              <span className="ml-1 text-zinc-600">(de onde vem)</span>
            </label>
            <input
              value={source}
              onChange={(e) => setSource(e.target.value.toLowerCase().replace(/\s/g, "_"))}
              placeholder="instagram, facebook, google, whatsapp..."
              className="w-full rounded-lg border border-[#1e2130] bg-[#0c0e14] px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Medium <span className="text-red-400">*</span>
              <span className="ml-1 text-zinc-600">(tipo de tráfego)</span>
            </label>
            <select
              value={medium}
              onChange={(e) => setMedium(e.target.value)}
              className="w-full rounded-lg border border-[#1e2130] bg-[#0c0e14] px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-indigo-500"
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
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Campaign <span className="text-red-400">*</span>
              <span className="ml-1 text-zinc-600">(nome da campanha)</span>
            </label>
            <input
              value={campaign}
              onChange={(e) => setCampaign(e.target.value.toLowerCase().replace(/\s/g, "_"))}
              placeholder="safra_fall2026, lancamento_maio, black_friday..."
              className="w-full rounded-lg border border-[#1e2130] bg-[#0c0e14] px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Content
              <span className="ml-1 text-zinc-600">(qual criativo/variação)</span>
            </label>
            <input
              value={content}
              onChange={(e) => setContent(e.target.value.toLowerCase().replace(/\s/g, "_"))}
              placeholder="video_depoimento, carrossel_escolas, stories_cta..."
              className="w-full rounded-lg border border-[#1e2130] bg-[#0c0e14] px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Term
              <span className="ml-1 text-zinc-600">(palavra-chave — Google Ads)</span>
            </label>
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value.toLowerCase().replace(/\s/g, "_"))}
              placeholder="bolsa_esportiva_eua, estudar_nos_eua..."
              className="w-full rounded-lg border border-[#1e2130] bg-[#0c0e14] px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-4">
          {/* Landing URL */}
          <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                Link da Landing Page
              </p>
              {hasParams && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                  <Sparkles className="h-3 w-3" /> UTM ativo
                </span>
              )}
            </div>

            <div className="rounded-lg border border-[#1e2130] bg-[#0c0e14] p-3">
              <p className="break-all text-sm text-zinc-300 font-mono leading-relaxed">
                {generatedUrl}
              </p>
            </div>

            <button
              onClick={() => copyToClipboard(generatedUrl, "full")}
              disabled={!hasParams}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
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
          <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
              Link Direto do Formulário
            </p>

            <div className="rounded-lg border border-[#1e2130] bg-[#0c0e14] p-3">
              <p className="break-all text-sm text-zinc-300 font-mono leading-relaxed">
                {formsUrl}
              </p>
            </div>

            <button
              onClick={() => copyToClipboard(formsUrl, "short")}
              disabled={!hasParams}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[#1e2130] bg-[#0c0e14] py-2.5 text-sm font-medium text-zinc-300 transition-all hover:border-zinc-600 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
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
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="text-xs font-medium text-amber-300 mb-2">Como usar</p>
            <ul className="space-y-1 text-xs text-zinc-400">
              <li>• Use o <strong className="text-zinc-200">Link Landing</strong> para anúncios e posts (lead vê a home primeiro)</li>
              <li>• Use o <strong className="text-zinc-200">Link Formulário</strong> para remarketing (lead já conhece, vai direto pro form)</li>
              <li>• Dados aparecem em <strong className="text-zinc-200">Analytics → Atribuição</strong> após o lead enviar o formulário</li>
              <li>• UTMs são capturados no <strong className="text-zinc-200">primeiro acesso</strong> (first-touch attribution)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
