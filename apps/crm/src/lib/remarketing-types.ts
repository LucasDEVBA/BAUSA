// Tipos compartilhados da feature de re-marketing (client + server actions).
// Mantidos fora de arquivos "use server" (que só podem exportar funções async).

export type MensagemTipo = "texto" | "imagem" | "link";
export type MensagemCanal = "whatsapp" | "email";

export interface MensagemConfig {
  canal: MensagemCanal;
  tipo: MensagemTipo; // relevante só p/ WhatsApp (email é template único)
  assunto?: string; // só e-mail
  imagemUrl?: string; // imagem (WhatsApp) ou header (e-mail)
  linkUrl?: string; // link CTA (WhatsApp) ou botão (e-mail)
  linkTitulo?: string; // título do card (WhatsApp) ou rótulo do botão (e-mail)
  linkDescricao?: string; // só WhatsApp (card link)
  linkImagem?: string; // só WhatsApp (thumb do card link)
}
