// Tipos compartilhados da feature de re-marketing (client + server actions).
// Mantidos fora de arquivos "use server" (que só podem exportar funções async).

export type MensagemTipo = "texto" | "imagem" | "link";

export interface MensagemConfig {
  tipo: MensagemTipo;
  imagemUrl?: string;
  linkUrl?: string;
  linkTitulo?: string;
  linkDescricao?: string;
  linkImagem?: string;
}
