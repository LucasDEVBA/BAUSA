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
          "flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
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
        "flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
        className,
      )}
    >
      <FileDown className="h-4 w-4" />
      {label}
    </button>
  );
}
