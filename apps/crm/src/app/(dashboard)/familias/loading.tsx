import { SkeletonPageHeader, SkeletonTabs, SkeletonStatCards, SkeletonTable } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonPageHeader />
      <SkeletonTabs total={3} />
      <SkeletonStatCards total={4} />
      <SkeletonTable linhas={8} colunas={6} />
    </div>
  );
}
