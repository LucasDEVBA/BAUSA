import { SkeletonCards, SkeletonPageHeader, SkeletonStatCards } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonPageHeader />
      <SkeletonCards total={1} altura="h-20" colunas="lg:grid-cols-1" />
      <SkeletonStatCards total={4} />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <SkeletonCards total={1} altura="h-80" colunas="lg:grid-cols-1" />
        <SkeletonCards total={2} altura="h-36" colunas="lg:grid-cols-1" />
      </div>
    </div>
  );
}
