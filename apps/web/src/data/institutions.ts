import logoAndover from "@/assets/academys/logoAndover.png";
import logoBaylor from "@/assets/academys/logoBaylor.png";
import logoBenfica from "@/assets/academys/logoBenfica.png";
import logoChicago from "@/assets/academys/logoChicago.webp";
import logoColumbia from "@/assets/academys/logoColumbia.png";
import logoCombineGoats from "@/assets/academys/logoCombineGoats.png";
import logoDarrow from "@/assets/academys/logoDarrowSchool.png";
import logoDME from "@/assets/academys/logoDME.png";
import logoDuke from "@/assets/academys/logoDuke.png";
import logoHarvard from "@/assets/academys/logoHavard.png";
import logoHoosac from "@/assets/academys/logoHoosac.svg";
import logoHopkins from "@/assets/academys/logoHopkins.png";
import logoHotchkiss from "@/assets/academys/logoHotchkiss.png";
import logoHyde from "@/assets/academys/logoHyde.png";
import logoIMG from "@/assets/academys/logoIMGAcademy.svg";
import logoKiski from "@/assets/academys/logoKiski.png";
import logoLoomis from "@/assets/academys/logoLoomis.png";
import logoMiami from "@/assets/academys/logoMiami.png";
import logoMichigan from "@/assets/academys/logoMichigan.png";
import logoMontverde from "@/assets/academys/logoMontverde.png";
import logoNyu from "@/assets/academys/logoNyu.png";
import logoPrinceton from "@/assets/academys/logoPrinceton.png";
import logoSanDiego from "@/assets/academys/logoSanDiego.png";
import logoSanDomenico from "@/assets/academys/logoSanDomenico.png";
import logoSpire from "@/assets/academys/logoSpire.png";
import logoStanford from "@/assets/academys/logoStanford.png";
import logoTaft from "@/assets/academys/logoTaft.png";
import logoThomasMore from "@/assets/academys/logoThomasMore.png";
import logoUcla from "@/assets/academys/logoUcla.png";
import logoUMass from "@/assets/academys/logoUMass.png";
import logoUsc from "@/assets/academys/logoUsc.svg";
import logoVermont from "@/assets/academys/logoVermontAcademy.png";
import logoWebb from "@/assets/academys/logoWebb.png";
import logoWesttown from "@/assets/academys/logoWesttown.webp";
import logoYale from "@/assets/academys/logoYale.png";

/**
 * ══ CORREÇÃO DE CREDIBILIDADE (BAU-02 Parte 1, item 4) ══════════════════════
 *
 * A versão anterior do site exibia Harvard, Stanford e Duke no MESMO plano que
 * escolas efetivamente parceiras. Uma família sofisticada — ou um advogado —
 * pode ler isso como alegação de parceria com as Ivies.
 *
 * Por isso as três faixas têm rótulos distintos e significados diferentes:
 *   ESCOLAS_PARCEIRAS         → relação real, onde a BAU coloca atletas.
 *   UNIVERSIDADES_ECOSSISTEMA → destinos e relacionamento de recrutamento.
 *   INSTITUICOES_ECOSSISTEMA  → presentes no ambiente, relação não confirmada.
 *
 * A separação não enfraquece: sofistica. Mostra que a marca sabe a diferença,
 * e famílias premium notam quem sabe a diferença.
 *
 * ⚠️ A lista de PARCEIRAS segue exatamente as instituições nomeadas no guia.
 * Nenhuma outra faixa pode alegar parceria — ao confirmar uma relação real,
 * MOVA o item para ESCOLAS_PARCEIRAS em vez de mudar o rótulo da faixa.
 */

export interface Institution {
  name: string;
  logo: { src: string; width?: number; height?: number };
}

/** Faixa 1 — escolas parceiras (relações reais). */
export const ESCOLAS_PARCEIRAS: readonly Institution[] = [
  { name: "Montverde Academy", logo: logoMontverde },
  { name: "Spire Academy", logo: logoSpire },
  { name: "The Taft School", logo: logoTaft },
  { name: "Benfica Residential Academy", logo: logoBenfica },
  { name: "DME Academy", logo: logoDME },
  { name: "Hoosac School", logo: logoHoosac },
  { name: "Westtown School", logo: logoWesttown },
  { name: "Baylor School", logo: logoBaylor },
];

/** Faixa 2 — universidades do ecossistema de recrutamento. */
export const UNIVERSIDADES_ECOSSISTEMA: readonly Institution[] = [
  { name: "Harvard University", logo: logoHarvard },
  { name: "Stanford University", logo: logoStanford },
  { name: "Yale University", logo: logoYale },
  { name: "Princeton University", logo: logoPrinceton },
  { name: "Duke University", logo: logoDuke },
  { name: "Columbia University", logo: logoColumbia },
  { name: "Johns Hopkins University", logo: logoHopkins },
  { name: "University of Chicago", logo: logoChicago },
  { name: "UCLA", logo: logoUcla },
  { name: "USC", logo: logoUsc },
  { name: "University of Michigan", logo: logoMichigan },
  { name: "New York University", logo: logoNyu },
  { name: "University of Miami", logo: logoMiami },
  { name: "UC San Diego", logo: logoSanDiego },
  { name: "UMass", logo: logoUMass },
];

/**
 * Faixa 3 — demais instituições do ecossistema.
 *
 * São escolas e programas presentes no ambiente onde a BAU opera, mas cuja
 * natureza de relação não foi confirmada como parceria. Por isso o rótulo é
 * deliberadamente neutro ("Instituições do ecossistema"): entrega a densidade
 * de prova sem alegar parceria — que é o risco que a separação em faixas
 * existe para eliminar.
 *
 * ⚠️ Ao confirmar uma relação real, MOVA o item para ESCOLAS_PARCEIRAS em vez
 * de mudar o rótulo desta faixa.
 */
export const INSTITUICOES_ECOSSISTEMA: readonly Institution[] = [
  { name: "IMG Academy", logo: logoIMG },
  { name: "Phillips Academy Andover", logo: logoAndover },
  { name: "The Hotchkiss School", logo: logoHotchkiss },
  { name: "Loomis Chaffee", logo: logoLoomis },
  { name: "The Kiski School", logo: logoKiski },
  { name: "San Domenico School", logo: logoSanDomenico },
  { name: "Vermont Academy", logo: logoVermont },
  { name: "The Webb School", logo: logoWebb },
  { name: "Hyde School", logo: logoHyde },
  { name: "Darrow School", logo: logoDarrow },
  { name: "St. Thomas More School", logo: logoThomasMore },
  { name: "Combine Goats", logo: logoCombineGoats },
];
