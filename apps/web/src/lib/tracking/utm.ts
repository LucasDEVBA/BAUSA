const UTM_STORAGE_KEY = "bau_utm_params";

const UTM_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  // utm_id = {{campaign.id}} no Meta Ads: chave estável que sobrevive a renomear
  // a campanha (utm_campaign muda; o id não). Base do join CAC por campanha.
  "utm_id",
] as const;

type UTMParams = Record<(typeof UTM_PARAMS)[number], string | null>;

const EMPTY_UTMS: UTMParams = {
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  utm_content: null,
  utm_term: null,
  utm_id: null,
};

export function captureUTMs(): void {
  if (typeof window === "undefined") return;

  // First-touch attribution: never overwrite existing UTMs
  if (localStorage.getItem(UTM_STORAGE_KEY)) return;

  const searchParams = new URLSearchParams(window.location.search);
  const hasAnyUTM = UTM_PARAMS.some((key) => searchParams.has(key));

  if (!hasAnyUTM) return;

  const utms: Record<string, string | null> = {};
  for (const key of UTM_PARAMS) {
    utms[key] = searchParams.get(key);
  }

  localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utms));
}

export function getStoredUTMs(): UTMParams {
  if (typeof window === "undefined") return { ...EMPTY_UTMS };

  const stored = localStorage.getItem(UTM_STORAGE_KEY);
  if (!stored) return { ...EMPTY_UTMS };

  // Mescla sobre EMPTY_UTMS para garantir todas as chaves (ex.: utm_id) mesmo em
  // entradas antigas do localStorage gravadas antes de utm_id existir.
  return { ...EMPTY_UTMS, ...(JSON.parse(stored) as Partial<UTMParams>) };
}
