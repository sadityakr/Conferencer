/** Debug helper: print the text lines and parsed schedule of a PDF.  npx tsx scripts/dev/dump-schedule.ts file.pdf */
import fs from "node:fs";
import { extractPdfLines } from "../../src/lib/schedule/pdfText";
import { parseScheduleText } from "../../src/lib/schedule/textParser";

(async () => {
  const lines = await extractPdfLines(new Uint8Array(fs.readFileSync(process.argv[2])));
  console.log(lines.join("\n"), "\n");
  console.log(JSON.stringify(parseScheduleText(lines), null, 1));
})();
