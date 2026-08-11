import { SkeletonPageHeader, SkeletonTabs, SkeletonStatCards, SkeletonList } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonPageHeader />
      <SkeletonTabs total={4} />
      <SkeletonStatCards total={4} />
      <SkeletonList itens={6} />
    </div>
  );
}
