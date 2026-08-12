import { SkeletonPageHeader, SkeletonTable } from "@/components/ui";

export default function Loading() {
  return (
    <div className="space-y-4">
      <SkeletonPageHeader />
      <SkeletonTable linhas={8} colunas={7} />
    </div>
  );
}
