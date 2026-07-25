import type { SiteCopy } from "./pt";

/**
 * Copy en español del sitio institucional.
 *
 * Vacío a propósito: la copy oficial (BAU-01) sólo existe en portugués, y
 * publicar un posicionamiento de marca traducido a máquina sería peor que el
 * fallback. `src/i18n/request.ts` hace deep-merge sobre la copy en PT, así que
 * toda clave ausente aquí se muestra en portugués.
 */
type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export const siteEs: DeepPartial<SiteCopy> = {};

export default siteEs;
