import { SkeletonPageHeader, SkeletonCards } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonPageHeader comAcoes={false} />
      <SkeletonCards total={2} altura="h-48" colunas="lg:grid-cols-2" />
    </div>
  );
}
