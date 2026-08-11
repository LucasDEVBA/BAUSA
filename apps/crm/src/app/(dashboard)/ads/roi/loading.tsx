import { SkeletonStatCards, SkeletonCards } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonStatCards total={4} />
      <SkeletonCards total={6} altura="h-44" />
    </div>
  );
}
