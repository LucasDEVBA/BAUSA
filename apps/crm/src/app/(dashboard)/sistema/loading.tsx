import { SkeletonPageHeader, SkeletonCards } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonPageHeader comAcoes={false} />
      <SkeletonCards total={8} altura="h-28" />
    </div>
  );
}
