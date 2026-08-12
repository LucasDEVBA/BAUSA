import { SkeletonPageHeader, SkeletonStatCards, SkeletonTable } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-4">
      <SkeletonPageHeader />
      <SkeletonStatCards total={4} />
      <SkeletonTable linhas={6} colunas={7} comToolbar={false} />
    </div>
  );
}
