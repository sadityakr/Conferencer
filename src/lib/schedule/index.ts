import type { ParsedSchedule } from "../types";
import { getVlmProvider, type VlmProvider } from "../vlm/provider";
import { extractPdfLines } from "./pdfText";
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
  const lines = await extractPdfLines(pdf);
  if (parser === "vlm") {
    const schedule = await parseScheduleWithVlm(opts.provider ?? getVlmProvider(), lines);
    return { schedule, parser, lines };
  }
  const schedule = normalizeSchedule(parseScheduleText(lines, { defaultYear: opts.defaultYear }));
  return { schedule, parser: "text", lines };
}
