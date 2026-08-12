import { SkeletonStatCards, SkeletonChart } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonStatCards total={4} />
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonChart />
        <SkeletonChart />
      </div>
      <SkeletonChart altura="h-72" />
    </div>
  );
}
