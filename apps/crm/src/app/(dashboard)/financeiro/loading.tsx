import { SkeletonPageHeader, SkeletonTabs, SkeletonStatCards, SkeletonList, SkeletonTable } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonPageHeader />
      <SkeletonTabs total={6} />
      <SkeletonStatCards total={4} />
      <div className="grid gap-4 lg:grid-cols-3">
        <SkeletonList itens={4} altura="h-[24rem]" />
        <SkeletonList itens={4} altura="h-[24rem]" />
        <SkeletonList itens={4} altura="h-[24rem]" />
      </div>
      <SkeletonTable linhas={6} colunas={7} comToolbar={false} />
    </div>
  );
}
