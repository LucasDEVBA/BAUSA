import { beforeEach, describe, expect, it, vi } from "vitest";

const supa = vi.hoisted(() => ({
  getClaims: vi.fn(),
  perfil: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => {
    supa.createClient(...args);
    return {
      auth: { getClaims: supa.getClaims },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: supa.perfil }) }) }),
    };
  },
}));

import { autenticarMcp, extrairBearer, metadadosRecursoProtegido, respostaNaoAutorizado } from "./auth";

const ORIGEM = "https://bolsa-atleta-crm.vercel.app";
const URL_SUPA = "https://projeto.supabase.co";
const SUB = "5d2c8e17-9a4b-4c3d-8e6f-1a2b3c4d5e6f";

const claimsValidos = (extra: Record<string, unknown> = {}) => ({
  iss: `${URL_SUPA}/auth/v1`,
  aud: "authenticated",
  role: "authenticated",
  sub: SUB,
  client_id: "claude-dcr-123",
  ...extra,
});

const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
/** Só o cabeçalho importa para o filtro barato; a assinatura é validada (mock) pelo getClaims. */
const jwt = (cabecalho: Record<string, unknown> = { alg: "ES256", kid: "chave-1", typ: "JWT" }) =>
  `${b64url(cabecalho)}.${b64url({ sub: SUB })}.assinatura`;
const TOKEN = jwt();

const req = (auth?: string) =>
  new Request(`${ORIGEM}/api/mcp`, { method: "POST", headers: auth ? { authorization: auth } : {} });

describe("extrairBearer", () => {
  it("should extract the token from a Bearer header", () => {
    expect(extrairBearer("Bearer abc.def.ghi")).toBe("abc.def.ghi");
  });
  it("should reject missing or malformed headers", () => {
    expect(extrairBearer(null)).toBeNull();
    expect(extrairBearer("Basic abc")).toBeNull();
    expect(extrairBearer("Bearer abc def")).toBeNull();
  });
});

describe("metadadosRecursoProtegido", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `${URL_SUPA}/`);
  });
  it("should point the MCP resource to the Supabase OAuth issuer", () => {
    expect(metadadosRecursoProtegido(ORIGEM)).toMatchObject({
      resource: `${ORIGEM}/api/mcp`,
      authorization_servers: [`${URL_SUPA}/auth/v1`],
      bearer_methods_supported: ["header"],
    });
  });
});

describe("respostaNaoAutorizado", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL_SUPA);
  });
  it("should return 401 with the resource_metadata challenge Claude follows", () => {
    const r = respostaNaoAutorizado(ORIGEM, "sem token");
    expect(r.status).toBe(401);
    expect(r.headers.get("WWW-Authenticate")).toBe(
      `Bearer resource_metadata="${ORIGEM}/.well-known/oauth-protected-resource/api/mcp"`,
    );
  });
  it("should return 403 without a challenge when the user lacks permission", () => {
    const r = respostaNaoAutorizado(ORIGEM, "papel", 403);
    expect(r.status).toBe(403);
    expect(r.headers.get("WWW-Authenticate")).toBeNull();
  });
});

describe("autenticarMcp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL_SUPA);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "anon-publica");
    supa.perfil.mockResolvedValue({ data: { papel: "ceo", ativo: true }, error: null });
  });

  it("should return 401 when there is no token", async () => {
    const r = await autenticarMcp(req(), ORIGEM);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.resposta.status).toBe(401);
    expect(supa.getClaims).not.toHaveBeenCalled();
  });

  it("should return 401 when the signature or expiry check fails", async () => {
    supa.getClaims.mockResolvedValue({ data: null, error: new Error("expirado") });
    const r = await autenticarMcp(req(`Bearer ${TOKEN}`), ORIGEM);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.resposta.status).toBe(401);
  });

  it("should return 401 (not 500) when getClaims throws on a malformed token", async () => {
    supa.getClaims.mockRejectedValue(new Error("Missing exp claim"));
    const r = await autenticarMcp(req(`Bearer ${TOKEN}`), ORIGEM);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.resposta.status).toBe(401);
  });

  it("should reject a browser session token without client_id", async () => {
    supa.getClaims.mockResolvedValue({ data: { claims: claimsValidos({ client_id: undefined }) }, error: null });
    const r = await autenticarMcp(req(`Bearer ${TOKEN}`), ORIGEM);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.resposta.status).toBe(401);
  });

  it("should reject a token from another issuer", async () => {
    supa.getClaims.mockResolvedValue({
      data: { claims: claimsValidos({ iss: "https://outro.supabase.co/auth/v1" }) },
      error: null,
    });
    const r = await autenticarMcp(req(`Bearer ${TOKEN}`), ORIGEM);
    expect(r.ok).toBe(false);
  });

  it("should return 403 for roles other than CEO/CTO", async () => {
    supa.getClaims.mockResolvedValue({ data: { claims: claimsValidos() }, error: null });
    supa.perfil.mockResolvedValue({ data: { papel: "head_sucesso", ativo: true }, error: null });
    const r = await autenticarMcp(req(`Bearer ${TOKEN}`), ORIGEM);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.resposta.status).toBe(403);
  });

  it("should return 403 for an inactive CEO", async () => {
    supa.getClaims.mockResolvedValue({ data: { claims: claimsValidos() }, error: null });
    supa.perfil.mockResolvedValue({ data: { papel: "ceo", ativo: false }, error: null });
    const r = await autenticarMcp(req(`Bearer ${TOKEN}`), ORIGEM);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.resposta.status).toBe(403);
  });

  it("should accept an active CTO and build the client with the user's own token", async () => {
    supa.getClaims.mockResolvedValue({ data: { claims: claimsValidos() }, error: null });
    supa.perfil.mockResolvedValue({ data: { papel: "cto", ativo: true }, error: null });
    const r = await autenticarMcp(req(`bearer ${TOKEN}`), ORIGEM);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.contexto).toMatchObject({ usuarioId: SUB, clientId: "claude-dcr-123" });
    const opcoes = supa.createClient.mock.calls[0]?.[2] as { global: { headers: Record<string, string> } };
    expect(opcoes.global.headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it("should reject a token with an unexpected algorithm or no kid without calling the network", async () => {
    for (const cabecalho of [{ alg: "HS256", kid: "k" }, { alg: "none" }, { alg: "ES256" }]) {
      const r = await autenticarMcp(req(`Bearer ${jwt(cabecalho)}`), ORIGEM);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.resposta.status).toBe(401);
    }
    expect(supa.getClaims).not.toHaveBeenCalled();
  });

  it("should return 503 (not 401) when Supabase Auth is unreachable", async () => {
    supa.getClaims.mockResolvedValue({ data: null, error: Object.assign(new Error("fetch failed"), { name: "AuthRetryableFetchError" }) });
    const r = await autenticarMcp(req(`Bearer ${TOKEN}`), ORIGEM);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.resposta.status).toBe(503);
      expect(r.resposta.headers.get("WWW-Authenticate")).toBeNull();
    }
  });
});
