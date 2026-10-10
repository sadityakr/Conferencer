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

export async function extractPdfLines(data: Uint8Array): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(data), // pdf.js detaches the buffer it is given
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0, // only errors; we just need the text, not glyph rendering
  }).promise;

  const lines: string[] = [];
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
  return lines.filter(Boolean);
}
