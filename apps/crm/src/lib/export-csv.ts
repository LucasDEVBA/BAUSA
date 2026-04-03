export function generateCSV(headers: string[], rows: string[][]): string {
  const headerRow = headers.join(",");
  const dataRows = rows.map(row =>
    row.map(cell => `"${(cell ?? "").replace(/"/g, '""')}"`).join(",")
  );
  return [headerRow, ...dataRows].join("\n");
}

export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
