/**
 * Design system do site institucional — BAU-02.
 *
 * Primitivas agnósticas de conteúdo: não importam traduções nem sabem em que
 * página estão. Quem compõe seções é `src/components/sections/`.
 *
 * Client Components (custam JS): Reveal, CtaPrimary, VideoCard.
 * Todo o resto é Server Component — movimento e hover são CSS.
 */
export { ArrowLink } from "./ArrowLink";
export { BrandRule, CornerBrackets } from "./BrandRule";
export { ContrastTable, type ContrastRow } from "./ContrastTable";
export { CtaPrimary } from "./CtaPrimary";
export { Eyebrow } from "./Eyebrow";
export { InstitutionalCard } from "./InstitutionalCard";
export { LogoWall } from "./LogoWall";
export { MonumentalPause } from "./MonumentalPause";
export { MonumentalStat } from "./MonumentalStat";
export { PillarGrid, type Pillar } from "./PillarGrid";
export { RecFrame } from "./RecFrame";
export { MaskedLines, Reveal } from "./Reveal";
export { Container, Section } from "./Section";
export { Timeline, type TimelinePhase } from "./Timeline";
export { VideoCard } from "./VideoCard";
export { Watermark } from "./Watermark";
export { AnimatedCrest } from "./AnimatedCrest";
