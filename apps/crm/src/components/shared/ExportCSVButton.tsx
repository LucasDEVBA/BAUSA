"use client";

import { Download } from "lucide-react";
import { generateCSV, downloadCSV } from "@/lib/export-csv";
import { cn } from "@/lib/utils";

interface ExportCSVButtonProps {
  filename: string;
  headers: string[];
  rows: string[][];
  label?: string;
  className?: string;
  variant?: "default" | "small";
}

export function ExportCSVButton({
  filename,
  headers,
  rows,
  label = "Exportar CSV",
  className,
  variant = "default",
}: ExportCSVButtonProps) {
  const handleExport = () => {
    const csv = generateCSV(headers, rows);
    downloadCSV(filename, csv);
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
        <Download className="h-3 w-3" />
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
      <Download className="h-4 w-4" />
      {label}
    </button>
  );
}
