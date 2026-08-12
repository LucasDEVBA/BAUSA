/**
 * Primitivos de UI do BAUSA Engine — design system v2 (light-first, BAU, liquid glass).
 * Import único: import { Card, Button, StatCard, ... } from "@/components/ui";
 */
export { Card, type CardProps } from "./Card";
export { Button, buttonVariants, type ButtonProps } from "./Button";
export { Badge, type BadgeProps, type BadgeTone } from "./Badge";
export { DeltaBadge, type DeltaBadgeProps } from "./DeltaBadge";
export { Input, type InputProps } from "./Input";
export { Skeleton, type SkeletonProps } from "./Skeleton";
export {
  SkeletonPageHeader,
  SkeletonStatCards,
  SkeletonTable,
  SkeletonCards,
  SkeletonChart,
  SkeletonBoard,
  SkeletonTabs,
  SkeletonList,
} from "./skeletons";
export { EmptyState, type EmptyStateProps } from "./EmptyState";
export { PageHeader, type PageHeaderProps } from "./PageHeader";
export { StatCard, type StatCardProps } from "./StatCard";
export { ChannelAction, type ChannelActionProps, type Channel } from "./ChannelAction";
export { InsightCard, type InsightCardProps } from "./InsightCard";
export {
  ChartCard,
  type ChartCardProps,
  chartAxisTick,
  CHART_GRID,
  CHART_CURSOR_FILL,
} from "./ChartCard";
export { ChartTooltip, type ChartTooltipProps, type ChartTooltipItem } from "./ChartTooltip";
export { PeriodSelector, type PeriodSelectorProps, type PeriodOption } from "./PeriodSelector";
export { BrandTabs, type BrandTab } from "./BrandTabs";
export { ScrollList, type ScrollListProps } from "./ScrollList";
export { HeaderMenu, type HeaderMenuProps } from "./HeaderMenu";
export {
  ConfirmProvider,
  useConfirm,
  type ConfirmOptions,
  type ConfirmTone,
} from "./ConfirmDialog";
export {
  CurrencyInput,
  UnitInput,
  PercentInput,
  ToggleField,
  formatBRL,
  formatBRLCompacto,
} from "./NumericInputs";
