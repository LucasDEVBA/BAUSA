// ════════════════════════════════════════════════════════════════════════
// Análise de telefone de lead — ESPELHO da cura healBrDdiAusente da CF
// send-whatsapp (incidente Gustavo Telles, 2026-08-23: "+28999711222" era
// o DDD 28 com "+" colado e sem o 55 — o responsável nunca recebeu o link
// de agendamento enquanto o atleta recebia os follow-ups).
//
// Usado pelos checks de observabilidade (tela + monitor-health tem cópia JS
// própria) para APONTAR o problema ao CEO antes/depois do outreach. A regra
// de detecção precisa ser IDÊNTICA à da cura na CF — guard de paridade em
// tests/telefone-heal-invariants.test.js compara a lista de DDDs.
// ════════════════════════════════════════════════════════════════════════

export const DDD_VALIDOS = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '21', '22', '24', '27', '28',
  '31', '32', '33', '34', '35', '37', '38',
  '41', '42', '43', '44', '45', '46', '47', '48', '49',
  '51', '53', '54', '55',
  '61', '62', '63', '64', '65', '66', '67', '68', '69',
  '71', '73', '74', '75', '77', '79',
  '81', '82', '83', '84', '85', '86', '87', '88', '89',
  '91', '92', '93', '94', '95', '96', '97', '98', '99',
]);

export type TelefoneProblema =
  /** Padrão BR sem o 55 ("+28…"): a CF cura no envio, mas o cadastro segue errado. */
  | { tipo: 'ddi_ausente_br'; sugerido: string }
  /** Curto/quebrado demais para qualquer envio ("+31", "123"). */
  | { tipo: 'invalido' };

/**
 * Analisa um telefone de lead. `null` = sem problema detectável (inclui
 * campo vazio — ausência de telefone não é telefone quebrado).
 */
export function analisarTelefone(
  phone: unknown,
  addressCountry?: string | null,
): TelefoneProblema | null {
  if (typeof phone !== 'string' || phone.trim().length === 0) return null;
  const original = phone.trim();
  const digits = original.replace(/\D/g, '');

  if (!original.startsWith('+')) {
    // Caminho legado: o formatPhone da CF adiciona 55 quando ≤11 dígitos.
    return digits.length < 8 ? { tipo: 'invalido' } : null;
  }

  // Mesma regra da cura: padrão inequívoco de BR com país declarado BR.
  const paisBr = ((addressCountry || 'BR').toUpperCase()) === 'BR';
  const dddValido = DDD_VALIDOS.has(digits.slice(0, 2));
  const celular11 = digits.length === 11 && digits[2] === '9';
  const fixoOuAntigo10 = digits.length === 10;
  if (paisBr && dddValido && (celular11 || fixoOuAntigo10)) {
    return { tipo: 'ddi_ausente_br', sugerido: `+55${digits}` };
  }

  // Curto demais para qualquer DDI real (o formatPhone rejeita < 8).
  if (digits.length < 8) return { tipo: 'invalido' };

  return null;
}
