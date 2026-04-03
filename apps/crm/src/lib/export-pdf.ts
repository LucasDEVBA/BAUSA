export function exportToPDF(title: string) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const content =
    document.querySelector('[data-printable]')?.innerHTML ??
    document.querySelector('main')?.innerHTML ??
    '';

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 2rem; color: #333; }
        table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
        th, td { padding: 8px 12px; border: 1px solid #ddd; text-align: left; }
        th { background: #f5f5f5; font-weight: 600; }
        h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
        h2 { font-size: 1.2rem; margin-top: 1.5rem; }
        .metric { display: inline-block; padding: 1rem; margin: 0.5rem; border: 1px solid #ddd; border-radius: 8px; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <h1>BAUSA CRM — ${title}</h1>
      <p>Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
      <hr>
      ${content}
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}
