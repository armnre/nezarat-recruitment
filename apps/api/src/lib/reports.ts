import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export type Cell = string | number | null | undefined;

const FONT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../assets/fonts');
const FONT_REGULAR = path.join(FONT_DIR, 'Vazirmatn-FD-Regular.ttf');
const FONT_BOLD = path.join(FONT_DIR, 'Vazirmatn-FD-Bold.ttf');

const csvCell = (v: Cell) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // جلوگیری از formula injection
  return `"${s.replace(/"/g, '""')}"`;
};

/** CSV با BOM تا Excel متن فارسی را درست باز کند. */
export function buildCsv(head: string[], rows: Cell[][]) {
  return '\uFEFF' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export async function buildXlsx(title: string, head: string[], rows: Cell[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'سامانه جذب و گزینش اساتید';
  const ws = wb.addWorksheet('متقاضیان', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 2 }] });
  ws.mergeCells(1, 1, 1, head.length);
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { name: 'Vazirmatn', bold: true, size: 14 };
  t.alignment = { horizontal: 'center' };
  const hr = ws.addRow(head);
  hr.font = { name: 'Vazirmatn', bold: true, color: { argb: 'FFFFFFFF' } };
  hr.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E5F' } }; c.alignment = { horizontal: 'center', vertical: 'middle' }; });
  for (const r of rows) {
    const row = ws.addRow(r.map((v) => (typeof v === 'string' && /^[=+\-@]/.test(v) ? `'${v}` : v ?? '')));
    row.font = { name: 'Vazirmatn' };
    row.alignment = { horizontal: 'right', vertical: 'top', wrapText: true };
  }
  ws.columns.forEach((col, i) => {
    const max = Math.max(head[i].length, ...rows.map((r) => String(r[i] ?? '').length));
    col.width = Math.min(Math.max(max + 4, 10), 50);
  });
  ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: head.length } };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/**
 * PDF افقی A4، راست‌به‌چپ با فونت محلی Vazirmatn (ارقام فارسی).
 * fontkit شکل‌دهی حروف و ترتیب RTL هر سلول را انجام می‌دهد؛ ستون‌ها از راست چیده می‌شوند.
 */
export function buildPdf(title: string, subtitle: string, head: string[], rows: Cell[][], widths: number[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30, info: { Title: title, Producer: 'nezarat' } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.registerFont('fa', FONT_REGULAR);
    doc.registerFont('fa-bold', FONT_BOLD);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const usable = right - left;
    const total = widths.reduce((a, b) => a + b, 0);
    const cols = widths.map((w) => (w / total) * usable);
    const pad = 4;

    const drawRow = (cells: Cell[], bold: boolean, fill?: string) => {
      doc.font(bold ? 'fa-bold' : 'fa').fontSize(bold ? 9.5 : 9);
      const heights = cells.map((c, i) => doc.heightOfString(String(c ?? ''), { width: cols[i] - pad * 2 }));
      const h = Math.max(...heights) + pad * 2;
      if (doc.y + h > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        if (!bold) drawRow(head, true, '#1f4e5f');
      }
      const y = doc.y;
      let x = right;
      cells.forEach((c, i) => {
        x -= cols[i];
        if (fill) doc.rect(x, y, cols[i], h).fill(fill);
        doc.rect(x, y, cols[i], h).lineWidth(0.5).stroke('#9aa5ab');
        doc.fillColor(fill ? '#ffffff' : '#111111').font(bold ? 'fa-bold' : 'fa')
          .text(String(c ?? ''), x + pad, y + pad, { width: cols[i] - pad * 2, align: 'right' });
      });
      doc.x = left;
      doc.y = y + h;
    };

    doc.font('fa-bold').fontSize(15).fillColor('#111111').text(title, left, doc.y, { width: usable, align: 'center' });
    doc.font('fa').fontSize(10).fillColor('#555555').text(subtitle, { width: usable, align: 'center' });
    doc.moveDown(0.8);
    drawRow(head, true, '#1f4e5f');
    rows.forEach((r) => drawRow(r, false));
    doc.end();
  });
}
