import { SkeletonPageHeader, SkeletonTabs, SkeletonCards } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonPageHeader />
      <SkeletonTabs total={2} />
      <SkeletonCards total={6} altura="h-28" colunas="lg:grid-cols-2" />
    </div>
  );
}
