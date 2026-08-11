import { SkeletonPageHeader, SkeletonTabs, SkeletonList } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonPageHeader comAcoes={false} />
      <SkeletonTabs total={2} />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <SkeletonList itens={8} altura="h-[32rem]" />
        <SkeletonList itens={6} altura="h-[32rem]" />
      </div>
    </div>
  );
}
