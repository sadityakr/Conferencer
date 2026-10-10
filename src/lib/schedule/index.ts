import type { ParsedSchedule } from "../types";
import { getVlmProvider, type VlmProvider } from "../vlm/provider";
import { extractPdfLayout } from "./pdfText";
import { parseScheduleTable } from "./tableParser";
import { parseScheduleText } from "./textParser";
import { parseScheduleWithVlm } from "./vlmParser";
import { normalizeSchedule } from "./normalize";

export type ParserKind = "text" | "vlm";

export interface ParseResult {
  schedule: ParsedSchedule;
  parser: ParserKind;
  lines: string[];
}

/** Turn an uploaded schedule PDF into sessions + talks. Parser chosen by SCHEDULE_PARSER. */
export async function parseSchedulePdf(
  pdf: Uint8Array,
  opts: { parser?: ParserKind; provider?: VlmProvider; defaultYear?: number } = {},
): Promise<ParseResult> {
  const parser = opts.parser ?? ((process.env.SCHEDULE_PARSER as ParserKind) || "text");
  const { lines, rows } = await extractPdfLayout(pdf);
  if (parser === "vlm") {
    const schedule = await parseScheduleWithVlm(opts.provider ?? getVlmProvider(), lines);
    return { schedule, parser, lines };
  }
  // Two heuristics: sessions with nested talk lines, or one talk per table row with wrapped
  // cells. Trust the line parser when it found real nesting (sessions holding several talks or
  // spanning more than their talk); otherwise every row became its own "session" and the
  // table reading is the better one.
  const byLine = normalizeSchedule(parseScheduleText(lines, { defaultYear: opts.defaultYear }));
  const byTable = normalizeSchedule(parseScheduleTable(rows, { defaultYear: opts.defaultYear }));
  const talks = (s: ParsedSchedule) => s.sessions.reduce((n, x) => n + x.talks.length, 0);
  const nested = (s: ParsedSchedule) =>
    s.sessions
      .filter((x) => x.talks.length >= 2 || (x.talks.length === 1 && (x.talks[0].start !== x.start || x.talks[0].end !== x.end)))
      .reduce((n, x) => n + x.talks.length, 0);
  const lineNested = talks(byLine) > 0 && nested(byLine) >= 0.5 * talks(byLine);
  const useTable = lineNested ? talks(byTable) > 2 * talks(byLine) : talks(byTable) >= talks(byLine) && talks(byTable) > 0;
  const schedule = useTable ? { ...byTable, conferenceName: byLine.conferenceName, timezone: byLine.timezone } : byLine;
  return { schedule, parser: "text", lines };
}
