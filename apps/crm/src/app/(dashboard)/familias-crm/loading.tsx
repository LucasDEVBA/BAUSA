import { SkeletonPageHeader, SkeletonTabs, SkeletonStatCards, SkeletonCards } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonPageHeader />
      <SkeletonTabs total={3} />
      <SkeletonStatCards total={4} />
      <SkeletonCards total={6} altura="h-36" />
    </div>
  );
}
