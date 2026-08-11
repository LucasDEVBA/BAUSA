import { SkeletonPageHeader, SkeletonTabs, SkeletonBoard } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonPageHeader />
      <SkeletonTabs total={3} />
      <SkeletonBoard colunas={6} />
    </div>
  );
}
