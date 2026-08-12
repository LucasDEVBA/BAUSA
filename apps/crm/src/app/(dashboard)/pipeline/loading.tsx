import { SkeletonPageHeader, SkeletonStatCards, SkeletonBoard } from "@/components/ui";

export default function Loading() {
  return (
    <div className="flex h-full flex-col gap-4">
      <SkeletonPageHeader />
      <SkeletonStatCards total={4} />
      <SkeletonBoard colunas={7} />
    </div>
  );
}
