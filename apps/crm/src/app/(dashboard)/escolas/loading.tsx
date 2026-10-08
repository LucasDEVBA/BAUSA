import { SkeletonCards, SkeletonPageHeader, SkeletonStatCards } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonPageHeader />
      <SkeletonStatCards total={4} />
      <SkeletonCards total={6} altura="h-72" colunas="xl:grid-cols-3" />
    </div>
  );
}
