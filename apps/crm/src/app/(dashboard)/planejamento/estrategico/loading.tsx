import { SkeletonCards, SkeletonPageHeader, SkeletonTabs } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-4">
      <SkeletonPageHeader />
      <SkeletonTabs total={2} />
      <SkeletonCards total={3} altura="h-40" colunas="lg:grid-cols-1" />
    </div>
  );
}
