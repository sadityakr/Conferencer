import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { parseSchedulePdf } from "@/lib/schedule";

/** A programme laid out like DS/AI4Sci 2026: one talk per row, wrapped cells, right-aligned paper codes. */
async function tablePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  // Neighbouring columns use different fonts, as in real exports; pdf.js would otherwise
  // merge same-font runs on one baseline into a single text item.
  const fontAt = (x: number) => (x < 120 || (x > 200 && x < 350) ? bold : font);
  const page = doc.addPage([595, 842]);
  let y = 800;
  const size = 5; // narrow enough that cells do not overlap, as in the real programme
  const cell = (x: number, t: string, dy = 0) => page.drawText(t, { x, y: y - dy, size, font: fontAt(x) });
  const code = (t: string) => cell(250 - bold.widthOfTextAtSize(t, size), t); // right-aligned before the title column
  const row = (cells: [number, string][], wrapped: [number, string][][] = [], gap = 17) => {
    cells.forEach(([x, t]) => cell(x, t));
    wrapped.forEach((line, i) => line.forEach(([x, t]) => cell(x, t, (i + 1) * 6)));
    y -= gap + wrapped.length * 6;
  };

  row([[56, "TUESDAY, OCTOBER 6th"]]);
  row([[56, "09:00-10:00, Lecture Hall N1"], [125, "Keynote 2"], [252, "Generative AI for Climate and Weather"], [352, "Claire Monteleoni (INRIA Paris)"]]);
  row([[56, "AI4Sci 2026"], [125, "AI4Chemistry&Materials Track"], [226, "Supported by a foundation"]], [], 24);
  code("AI4Sci16");
  row([[56, "10:10-10:30, Lecture Hall N2"], [125, "AI4Sci: Chemistry"], [252, "Overcoming Data and Validation"], [352, "Shoeb Athar (ICGM)*; Adrien"]], [
    [[252, "Bottlenecks in Machine Learning"], [352, "Mecibah (ICGM)"]],
  ]);
  row([[56, "10:10-10:30, Lecture Hall N1"], [125, "DS: Explainable AI"], [252, "The Explanandum Matters"], [352, "Asma Hashmi (LMU)*"]]);
  row([[56, "10:30-11:00 Coffee Break"]], [], 14);
  row([[56, "11:00-11:07, Lecture Hall N2"], [125, "DS: Applications"], [236, "DS019 Reducing False Positives in"], [352, "Julia Wasala (Leiden)*"]], [[[252, "Methane Plume Detection"]]]);
  row([[56, "11:07-11:14, Lecture Hall N2"], [125, "DS: Applications"], [236, "DS022 Discovering Strategies"], [352, "Dani Chambon (TU/e)"]]);
  row([[56, "11:00-12:00, Lecture Hall N1"], [125, "Keynote 3"], [252, "El agente esta presente: The Era of AI"], [352, "Alan Aspuru-Guzik (Toronto)"]], [[[252, "Scientists is Today"]]]);
  return doc.save();
}

describe("table-layout schedule PDFs", () => {
  it("rebuilds talks from wrapped cells and groups parallel tracks into sessions", async () => {
    const { schedule } = await parseSchedulePdf(await tablePdf(), { parser: "text" });
    const view = schedule.sessions.map((s) => ({
      when: `${s.date} ${s.start}-${s.end}`,
      room: s.room,
      session: s.title,
      talks: s.talks.map((t) => `${t.start} ${t.title} — ${t.speakers}`),
    }));
    expect(view).toEqual([
      { when: "2026-10-06 09:00-10:00", room: "Lecture Hall N1", session: "Keynote 2", talks: ["09:00 Generative AI for Climate and Weather — Claire Monteleoni (INRIA Paris)"] },
      {
        when: "2026-10-06 10:10-10:30", room: "Lecture Hall N2", session: "AI4Sci: Chemistry",
        talks: ["10:10 Overcoming Data and Validation Bottlenecks in Machine Learning (AI4Sci16) — Shoeb Athar (ICGM)*; Adrien Mecibah (ICGM)"],
      },
      { when: "2026-10-06 10:10-10:30", room: "Lecture Hall N1", session: "DS: Explainable AI", talks: ["10:10 The Explanandum Matters — Asma Hashmi (LMU)*"] },
      {
        when: "2026-10-06 11:00-11:14", room: "Lecture Hall N2", session: "DS: Applications",
        talks: ["11:00 Reducing False Positives in Methane Plume Detection (DS019) — Julia Wasala (Leiden)*", "11:07 Discovering Strategies (DS022) — Dani Chambon (TU/e)"],
      },
      { when: "2026-10-06 11:00-12:00", room: "Lecture Hall N1", session: "Keynote 3", talks: ["11:00 El agente esta presente: The Era of AI Scientists is Today — Alan Aspuru-Guzik (Toronto)"] },
    ]);
  });
});
