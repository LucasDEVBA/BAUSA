const UTM_STORAGE_KEY = "bau_utm_params";

const UTM_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

type UTMParams = Record<(typeof UTM_PARAMS)[number], string | null>;

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
  if (typeof window === "undefined") {
    return {
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_content: null,
      utm_term: null,
    };
  }

  const stored = localStorage.getItem(UTM_STORAGE_KEY);
  if (!stored) {
    return {
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_content: null,
      utm_term: null,
    };
  }

  return JSON.parse(stored) as UTMParams;
}
