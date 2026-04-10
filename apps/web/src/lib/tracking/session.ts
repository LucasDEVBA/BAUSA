function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function getOrCreateVisitorId(): string {
  if (typeof window === "undefined") return "";

  const key = "bau_visitor_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = generateId();
    localStorage.setItem(key, id);
  }
  return id;
}

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";

  const key = "bau_session_id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = generateId();
    sessionStorage.setItem(key, id);
  }
  return id;
}

export function captureLandingUrl(): string {
  if (typeof window === "undefined") return "";

  const key = "bau_landing_url";
  let url = sessionStorage.getItem(key);
  if (!url) {
    url = window.location.href;
    sessionStorage.setItem(key, url);
  }
  return url;
}

export function captureReferrer(): string {
  if (typeof window === "undefined") return "";

  const key = "bau_referrer";
  let ref = sessionStorage.getItem(key);
  if (!ref) {
    ref = document.referrer || "";
    sessionStorage.setItem(key, ref);
  }
  return ref;
}

export function getDeviceType(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";

  const width = window.innerWidth;
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}
