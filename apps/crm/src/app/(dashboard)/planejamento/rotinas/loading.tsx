import { SkeletonCards, SkeletonPageHeader } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-4">
      <SkeletonPageHeader />
      <SkeletonCards total={1} altura="h-16" colunas="lg:grid-cols-1" />
      <SkeletonCards total={3} altura="h-28" colunas="lg:grid-cols-1" />
    </div>
  );
}
