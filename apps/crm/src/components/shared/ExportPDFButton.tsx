"use client";

import { FileDown } from "lucide-react";
import { exportToPDF } from "@/lib/export-pdf";
import { cn } from "@/lib/utils";

interface ExportPDFButtonProps {
  title: string;
  label?: string;
  className?: string;
  variant?: "default" | "small";
}

export function ExportPDFButton({
  title,
  label = "Exportar PDF",
  className,
  variant = "default",
}: ExportPDFButtonProps) {
  const handleExport = () => {
    exportToPDF(title);
  };

  if (variant === "small") {
    return (
      <button
        onClick={handleExport}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-[#1a1f2e] hover:text-zinc-200",
          className,
        )}
      >
        <FileDown className="h-3 w-3" />
        {label}
      </button>
    );
  }

  return (
    <button
      onClick={handleExport}
      className={cn(
        "flex items-center gap-2 rounded-lg border border-[#1e2130] bg-[#141720] px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-[#1a1f2e] hover:text-zinc-200",
        className,
      )}
    >
      <FileDown className="h-4 w-4" />
      {label}
    </button>
  );
}
