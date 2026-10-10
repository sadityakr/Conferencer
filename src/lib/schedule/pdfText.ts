/**
 * Extract text lines from a PDF, rebuilding rows from glyph positions so table-like
 * schedules keep their columns. Columns are separated by " | ".
 */
interface Item {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A text item with its position, for layout-aware (table) parsing. */
export interface PdfCell {
  text: string;
  x: number;
  x2: number;
  h: number;
}

/** One visual row: cells left to right, plus its baseline and font size. */
export interface PdfRow {
  page: number;
  y: number;
  h: number;
  cells: PdfCell[];
}

export interface PdfLayout {
  lines: string[];
  rows: PdfRow[];
}

export async function extractPdfLines(data: Uint8Array): Promise<string[]> {
  return (await extractPdfLayout(data)).lines;
}

export async function extractPdfLayout(data: Uint8Array): Promise<PdfLayout> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(data), // pdf.js detaches the buffer it is given
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0, // only errors; we just need the text, not glyph rendering
  }).promise;

  const lines: string[] = [];
  const outRows: PdfRow[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items: Item[] = [];
    for (const it of content.items) {
      if (!("str" in it) || !it.str.trim()) continue;
      items.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: Math.abs(it.transform[3]) || 10 });
    }
    // Group into rows: items whose baselines are within ~40% of the font size.
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const rows: Item[][] = [];
    for (const it of items) {
      const row = rows[rows.length - 1];
      if (row && Math.abs(row[0].y - it.y) <= Math.max(2, it.h * 0.4)) row.push(it);
      else rows.push([it]);
    }
    for (const row of rows) {
      row.sort((a, b) => a.x - b.x);
      outRows.push({
        page: p,
        y: row[0].y,
        h: Math.max(...row.map((i) => i.h)),
        cells: row.map((i) => ({ text: i.str.replace(/\s+/g, " ").trim(), x: i.x, x2: i.x + i.w, h: i.h })),
      });
      let line = "";
      let prevEnd: number | null = null;
      for (const it of row) {
        if (prevEnd !== null) {
          const gap = it.x - prevEnd;
          line += gap > it.h * 1.5 ? " | " : gap > it.h * 0.15 ? " " : "";
        }
        line += it.str;
        prevEnd = it.x + it.w;
      }
      lines.push(line.replace(/\s+/g, " ").trim());
    }
  }
  await doc.destroy();
  return { lines: lines.filter(Boolean), rows: outRows };
}
