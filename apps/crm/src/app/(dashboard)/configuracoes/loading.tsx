import { SkeletonPageHeader, SkeletonTabs, SkeletonCards } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonPageHeader comAcoes={false} />
      <SkeletonTabs total={6} />
      <SkeletonCards total={4} altura="h-40" colunas="lg:grid-cols-2" />
    </div>
  );
}
