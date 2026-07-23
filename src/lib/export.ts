import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface ExportColumn {
  header: string;
  key: string;
}

export function exportToPDF(
  title: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
  subtitle?: string,
) {
  const doc = new jsPDF();

  // Header
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('AttendX', 14, 12);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 14, 20);

  if (subtitle) {
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    doc.text(subtitle, 14, 34);
  }

  const tableY = subtitle ? 40 : 32;

  autoTable(doc, {
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => columns.map((c) => String(r[c.key] ?? ''))),
    startY: tableY,
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [240, 245, 255] },
    styles: { fontSize: 8, cellPadding: 3 },
    margin: { top: tableY },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(8);
  doc.text(`Generated on ${new Date().toLocaleString()}`, 14, finalY);

  doc.save(`attendx-${title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
}

export function exportToExcel(
  title: string,
  columns: ExportColumn[],
  rows: Record<string, unknown>[],
) {
  const data = rows.map((r) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((c) => { obj[c.header] = r[c.key] ?? ''; });
    return obj;
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));
  XLSX.writeFile(wb, `attendx-${title.toLowerCase().replace(/\s+/g, '-')}.xlsx`);
}
