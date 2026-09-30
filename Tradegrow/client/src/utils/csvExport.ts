/**
 * csvExport.ts
 * Client-side CSV export for admin list views — Phase F "reporting/export"
 * (deferred item, built on request). Serializes already-fetched rows to a
 * downloadable CSV; no server round trip needed since every consumer already
 * holds the full row set fetched for its DataTable.
 */

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]): void {
  const header = columns.map(c => escapeCsvCell(c.header)).join(',');
  const lines = rows.map(row => columns.map(c => escapeCsvCell(c.value(row))).join(','));
  const csv = [header, ...lines].join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
