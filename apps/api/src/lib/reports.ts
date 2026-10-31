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

const RTL_LETTER = /[\u0600-\u06EF\u06FA-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const FA_DIGITS_ONLY = /^[\u06F0-\u06F9\u0660-\u0669\/.:,\-]+$/;

/** ترتیب نمایشی یک سطر: pdfkit کلمه‌ها را چپ‌به‌راست می‌چیند، پس ترتیب کلمه‌های فارسی را خودمان برعکس می‌کنیم. */
function visualSegs(words: string[]): string[] {
  // fontkit توکن‌های تمام‌رقم فارسی را برعکس می‌کند؛ از پیش جبرانش می‌کنیم
  const fixed = words.map((w) => (FA_DIGITS_ONLY.test(w) ? [...w].reverse().join('') : w));
  if (!fixed.some((w) => RTL_LETTER.test(w))) return fixed;
  const groups: string[][] = [];
  for (const w of fixed) {
    const ltr = !RTL_LETTER.test(w) && /[A-Za-z0-9@]/.test(w);
    const last = groups[groups.length - 1];
    if (ltr && last && (last as any).ltr) last.push(w);
    else { const g: any = [w]; g.ltr = ltr; groups.push(g); }
  }
  return groups.reverse().flatMap((g) => g);
}

const gap = (doc: PDFKit.PDFDocument) => doc.widthOfString('a') * 0.6;
function segsWidth(doc: PDFKit.PDFDocument, segs: string[]) {
  return segs.reduce((a, w) => a + doc.widthOfString(w), 0) + gap(doc) * Math.max(0, segs.length - 1);
}

/** شکستن متن به سطرها به ترتیب منطقی، سپس تبدیل هر سطر به ترتیب نمایشی */
function rtlLines(doc: PDFKit.PDFDocument, text: string, width: number): string[][] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[][] = [];
  let cur: string[] = [];
  for (const w of words) {
    const next = [...cur, w];
    if (cur.length && segsWidth(doc, visualSegs(next)) > width) { lines.push(cur); cur = [w]; }
    else cur = next;
  }
  if (cur.length || !lines.length) lines.push(cur);
  return lines.map(visualSegs);
}

function rtlText(doc: PDFKit.PDFDocument, text: string, x: number, y: number, width: number, align: 'right' | 'center') {
  const lh = doc.currentLineHeight(true);
  const lines = rtlLines(doc, text, width);
  lines.forEach((segs, i) => {
    const w = segsWidth(doc, segs);
    let cx = align === 'right' ? x + width - w : x + (width - w) / 2;
    for (const seg of segs) {
      doc.text(seg, cx, y + i * lh, { lineBreak: false });
      cx += doc.widthOfString(seg) + gap(doc);
    }
  });
  return lines.length * lh;
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
      const heights = cells.map((c, i) => rtlLines(doc, String(c ?? ''), cols[i] - pad * 2).length * doc.currentLineHeight(true));
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
          ;
        rtlText(doc, String(c ?? ''), x + pad, y + pad, cols[i] - pad * 2, 'right');
      });
      doc.x = left;
      doc.y = y + h;
    };

    let ty = doc.y;
    doc.font('fa-bold').fontSize(15).fillColor('#111111');
    ty += rtlText(doc, title, left, ty, usable, 'center');
    doc.font('fa').fontSize(10).fillColor('#555555');
    ty += rtlText(doc, subtitle, left, ty, usable, 'center');
    doc.x = left; doc.y = ty;
    doc.moveDown(0.8);
    drawRow(head, true, '#1f4e5f');
    rows.forEach((r) => drawRow(r, false));
    doc.end();
  });
}
