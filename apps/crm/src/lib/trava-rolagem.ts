/**
 * Trava de rolagem com CONTADOR por elemento — use SEMPRE esta, nunca
 * "salva o overflow anterior e restaura" à mão no mesmo scroller.
 *
 * Por quê: o ConfirmProvider e os sheets por baixo dele travam o mesmo
 * <main>. Com "salva e restaura", quando os dois fecham no MESMO commit
 * ("Descartar alterações?" → Descartar) o React limpa o filho (sheet, que
 * restaura "") antes do pai (ConfirmProvider, que restaura o "hidden" que
 * ele viu ao abrir): o <main> fica travado e nenhuma página do Engine rola
 * até um reload. Com contador, só a ÚLTIMA liberação devolve o valor
 * original, em qualquer ordem de limpeza.
 */
interface TravaAtiva {
  donos: number;
  overflowOriginal: string;
}

const travasAtivas = new WeakMap<HTMLElement, TravaAtiva>();

/** Trava `elemento` e devolve a liberação (idempotente). */
export function travarRolagem(elemento: HTMLElement): () => void {
  let trava = travasAtivas.get(elemento);
  if (!trava) {
    trava = { donos: 0, overflowOriginal: elemento.style.overflow };
    travasAtivas.set(elemento, trava);
    elemento.style.overflow = "hidden";
  }
  trava.donos += 1;

  const minhaTrava = trava;
  let liberada = false;
  return () => {
    // Cleanup de efeito pode rodar 2x (StrictMode): não pode descontar outro dono.
    if (liberada) return;
    liberada = true;
    minhaTrava.donos -= 1;
    if (minhaTrava.donos > 0) return;
    travasAtivas.delete(elemento);
    elemento.style.overflow = minhaTrava.overflowOriginal;
  };
}
