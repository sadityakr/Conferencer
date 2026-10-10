/** Debug helper: print the parsed schedule of a PDF.  npx tsx scripts/dev/dump-schedule.ts file.pdf [--lines] */
import fs from "node:fs";
import { extractPdfLines } from "../../src/lib/schedule/pdfText";
import { parseSchedulePdf } from "../../src/lib/schedule";

(async () => {
  const pdf = new Uint8Array(fs.readFileSync(process.argv[2]));
  if (process.argv.includes("--lines")) console.log((await extractPdfLines(pdf)).join("\n"), "\n");
  const { schedule } = await parseSchedulePdf(pdf, { parser: "text" });
  console.log(schedule.conferenceName, schedule.timezone, `${schedule.sessions.length} sessions`);
  for (const s of schedule.sessions) {
    console.log(`\n${s.date} ${s.start}-${s.end} | ${s.room} | ${s.title}`);
    for (const t of s.talks) console.log(`   ${t.start}-${t.end} ${t.title.slice(0, 70)} — ${t.speakers.slice(0, 50)}`);
  }
})();
