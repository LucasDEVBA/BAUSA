import { describe, expect, it } from "vitest";

import { redirectPermitidoParaConsentimento } from "./redirect-consentimento";

describe("redirectPermitidoParaConsentimento", () => {
  it("should accept Claude's official registered callbacks", () => {
    expect(redirectPermitidoParaConsentimento("https://claude.ai/api/mcp/auth_callback")).toBe(true);
    expect(redirectPermitidoParaConsentimento("https://claude.com/api/mcp/auth_callback")).toBe(true);
  });

  it("should accept the final redirect with code/state only when parameters are allowed", () => {
    const final = "https://claude.ai/api/mcp/auth_callback?code=x&state=y";
    expect(redirectPermitidoParaConsentimento(final, { comParametros: true })).toBe(true);
    expect(redirectPermitidoParaConsentimento(final)).toBe(false);
    expect(redirectPermitidoParaConsentimento("https://claude.ai/api/mcp/auth_callback?redirect=evil")).toBe(false);
  });

  it("should accept Claude Code loopback on any port, only on /callback", () => {
    expect(redirectPermitidoParaConsentimento("http://localhost:54321/callback")).toBe(true);
    expect(redirectPermitidoParaConsentimento("http://[::1]:8080/callback")).toBe(true);
    expect(redirectPermitidoParaConsentimento("http://127.0.0.1:8080/callback?code=x", { comParametros: true })).toBe(true);
    expect(redirectPermitidoParaConsentimento("http://localhost:3000/redirect?to=https://evil.com")).toBe(false);
    expect(redirectPermitidoParaConsentimento("http://localhost:3000/")).toBe(false);
  });

  it("should reject any other destination (phishing via dynamic client registration)", () => {
    for (const uri of [
      "https://claude.ai.evil.com/api/mcp/auth_callback",
      "https://evil.com/api/mcp/auth_callback",
      "https://claude.ai/outra/rota",
      "https://claude.ai/api/mcp/auth_callback/",
      "https://claude.ai/api/mcp/auth_callback#frag",
      "http://claude.ai/api/mcp/auth_callback",
      "https://user:pass@claude.ai/api/mcp/auth_callback",
      "http://localhost.evil.com/callback",
      "javascript:alert(1)",
      "nao-e-url",
      "",
      null,
      undefined,
    ]) {
      expect(redirectPermitidoParaConsentimento(uri), String(uri)).toBe(false);
    }
  });
});
