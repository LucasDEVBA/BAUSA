import { SkeletonPageHeader, SkeletonCards } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonPageHeader />
      <SkeletonCards total={6} altura="h-32" />
    </div>
  );
}
