import { SkeletonTabs, SkeletonStatCards, SkeletonChart, SkeletonCards } from "@/components/ui";

/** War Room: barra de abas + hero de receita (2/3) com 3 KPIs ao lado + drills. */
export default function Loading() {
  return (
    <div className="space-y-4">
      <SkeletonTabs total={7} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><SkeletonChart altura="h-56" /></div>
        <SkeletonStatCards total={3} />
      </div>
      <SkeletonCards total={6} altura="h-28" />
    </div>
  );
}
