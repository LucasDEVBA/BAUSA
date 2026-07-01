/**
 * Primitivos de UI do BAUSA Engine (DESIGN_SPEC §6).
 * Um primitivo por conceito, tokenizado e reusável. Import único:
 *   import { Card, Button, Badge, Input, Skeleton, EmptyState, BrandTabs } from "@/components/ui";
 */
export { Card, type CardProps } from "./Card";
export { Button, buttonVariants, type ButtonProps } from "./Button";
export { Badge, type BadgeProps, type BadgeTone } from "./Badge";
export { Input, type InputProps } from "./Input";
export { Skeleton, type SkeletonProps } from "./Skeleton";
export { EmptyState, type EmptyStateProps } from "./EmptyState";
export { BrandTabs, type BrandTab } from "./BrandTabs";
