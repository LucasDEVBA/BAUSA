import { SkeletonCards, SkeletonPageHeader, SkeletonStatCards, SkeletonTabs } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-4">
      <SkeletonPageHeader />
      <SkeletonStatCards total={4} />
      <SkeletonTabs total={5} />
      <SkeletonCards total={2} altura="h-56" colunas="lg:grid-cols-2" />
    </div>
  );
}
