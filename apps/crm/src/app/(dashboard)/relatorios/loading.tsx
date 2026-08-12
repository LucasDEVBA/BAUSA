import { SkeletonPageHeader, SkeletonTabs, SkeletonStatCards, SkeletonChart } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonPageHeader />
      <SkeletonTabs total={4} />
      <SkeletonStatCards total={4} />
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonChart />
        <SkeletonChart />
      </div>
    </div>
  );
}
