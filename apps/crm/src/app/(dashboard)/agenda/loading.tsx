import { SkeletonPageHeader, SkeletonStatCards, SkeletonList } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonPageHeader />
      <SkeletonStatCards total={3} />
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonList itens={6} />
        <SkeletonList itens={6} />
      </div>
    </div>
  );
}
