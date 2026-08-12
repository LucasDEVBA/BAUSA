import { SkeletonPageHeader, SkeletonStatCards, SkeletonTable } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonPageHeader />
      <SkeletonStatCards total={3} />
      <SkeletonTable linhas={8} colunas={5} />
    </div>
  );
}
