import { SkeletonPageHeader, SkeletonStatCards, SkeletonTable } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonPageHeader />
      <SkeletonStatCards total={4} />
      <SkeletonTable linhas={10} colunas={7} />
    </div>
  );
}
