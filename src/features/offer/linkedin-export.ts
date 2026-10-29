// Reads files from a person's own LinkedIn data export (Settings > Data privacy > Get a copy of your data). ORYQEN never connects to LinkedIn,
// never fetches a profile URL and never sees anything the person did not hand over as a file. The result is plain text the person edits.
export type ExportFile = { name: string; text: string };
export type LinkedInProfile = { text: string; years: number | null; recognised: Array<"skills" | "positions" | "education" | "profile">; ignored: string[] };

// RFC 4180 style CSV: quoted fields, doubled quotes and newlines inside quotes.
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(field); field = ""; if (row.some(cell => cell.trim())) rows.push(row); row = []; }
    else field += ch;
  }
  row.push(field); if (row.some(cell => cell.trim())) rows.push(row);
  return rows;
}
function table(file: ExportFile) {
  const rows = parseCsv(file.text);
  // Some exports start with a notes line before the header row, so take the first row that has at least two columns, or a known single-column header.
  const headerIndex = rows.findIndex(row => row.length >= 2 || /^name$/i.test((row[0] ?? "").trim()));
  if (headerIndex < 0) return null;
  const header = rows[headerIndex]!.map(cell => cell.trim().toLowerCase());
  return { header, rows: rows.slice(headerIndex + 1).map(row => Object.fromEntries(header.map((name, index) => [name, (row[index] ?? "").trim()]))) as Array<Record<string, string>> };
}
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
function monthIndex(value: string): number | null {
  const text = value.trim().toLowerCase();
  const named = text.match(/^([a-z]{3})[a-z]*\s+(\d{4})$/); if (named && MONTHS.includes(named[1]!)) return Number(named[2]) * 12 + MONTHS.indexOf(named[1]!);
  const iso = text.match(/^(\d{4})-(\d{1,2})/); if (iso) return Number(iso[1]) * 12 + Number(iso[2]) - 1;
  const year = text.match(/^(\d{4})$/); if (year) return Number(year[1]) * 12;
  return null;
}
// Years covered by the union of the positions' date ranges (overlapping jobs are not counted twice).
function yearsCovered(ranges: Array<[number, number]>): number | null {
  const sorted = ranges.filter(([a, b]) => b >= a).sort((x, y) => x[0] - y[0]);
  if (!sorted.length) return null;
  let total = 0, [start, end] = sorted[0]!;
  for (const [a, b] of sorted.slice(1)) { if (a <= end) end = Math.max(end, b); else { total += end - start; start = a; end = b; } }
  total += end - start;
  return Math.floor(total / 12);
}

export function readLinkedInExport(files: ExportFile[], now: Date = new Date()): LinkedInProfile {
  const recognised: LinkedInProfile["recognised"] = [], ignored: string[] = [], lines: string[] = [], ranges: Array<[number, number]> = [];
  const nowIndex = now.getUTCFullYear() * 12 + now.getUTCMonth();
  for (const file of files) {
    const data = table(file);
    if (!data) { ignored.push(file.name); continue; }
    const has = (...names: string[]) => names.every(name => data.header.includes(name));
    if (has("company name", "title")) {
      recognised.push("positions");
      for (const row of data.rows.slice(0, 50)) {
        if (!row["title"] && !row["company name"]) continue;
        const from = monthIndex(row["started on"] ?? ""), to = (row["finished on"] ?? "") ? monthIndex(row["finished on"]!) : nowIndex;
        if (from !== null && to !== null) ranges.push([from, to]);
        const span = [row["started on"], row["finished on"] || (from !== null ? "present" : "")].filter(Boolean).join(" – ");
        lines.push(`Experience: ${row["title"] ?? ""} at ${row["company name"] ?? ""}${span ? ` (${span})` : ""}${row["description"] ? `. ${row["description"].replace(/\s+/g, " ").slice(0, 300)}` : ""}`);
      }
    } else if (has("school name")) {
      recognised.push("education");
      for (const row of data.rows.slice(0, 20)) lines.push(`Education: ${[row["degree name"], row["school name"]].filter(Boolean).join(", ")}${row["notes"] ? `. ${row["notes"].replace(/\s+/g, " ").slice(0, 200)}` : ""}`);
    } else if (data.header.length <= 2 && has("name")) {
      recognised.push("skills");
      const names = data.rows.map(row => row["name"]).filter(Boolean).slice(0, 100);
      if (names.length) lines.push(`Skills: ${names.join(", ")}`);
    } else if (has("headline") || has("summary")) {
      recognised.push("profile");
      const row = data.rows[0];
      if (row?.["headline"]) lines.push(`Headline: ${row["headline"]}`);
      if (row?.["summary"]) lines.push(`Summary: ${row["summary"].replace(/\s+/g, " ").slice(0, 600)}`);
    } else ignored.push(file.name);
  }
  const years = yearsCovered(ranges);
  return { text: lines.join("\n"), years, recognised, ignored };
}
