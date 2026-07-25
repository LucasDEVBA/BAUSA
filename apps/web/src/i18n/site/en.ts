import type { SiteCopy } from "./pt";

/**
 * English copy for the institutional site.
 *
 * Intentionally empty for now: the official copy (BAU-01) exists only in
 * Portuguese, and shipping machine-translated brand positioning would be worse
 * than falling back. `src/i18n/request.ts` deep-merges this over the PT copy,
 * so every key not present here renders in Portuguese.
 *
 * Translate top-down (`brand`, `nav`, `cta` first — they are the most visible),
 * and drop the `alternates.languages` guard in `src/config/seo.ts` for each
 * page as it gets fully translated.
 */
type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export const siteEn: DeepPartial<SiteCopy> = {};

export default siteEn;
