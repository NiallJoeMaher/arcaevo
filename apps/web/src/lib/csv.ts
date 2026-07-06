/**
 * Minimal RFC-4180 CSV serialisation for admin data exports.
 *
 * Two safety properties, both unit-tested (src/lib/__tests__/csv.test.ts):
 *
 * 1. RFC-4180 escaping — a field containing a quote, comma, CR or LF is
 *    wrapped in double quotes with internal quotes doubled, so free-text
 *    values (member names) can never break a row or smuggle in columns.
 *
 * 2. CSV-injection hardening — spreadsheet apps execute cells beginning with
 *    `=`, `+`, `-`, `@` (or a tab/CR) as formulas when a CSV is opened. A
 *    waitlist name is attacker-controlled ("=HYPERLINK(...)" is a valid form
 *    input), so any such cell is prefixed with a single apostrophe — the
 *    common OWASP mitigation. The trade-off (a literal leading quote appears
 *    in the spreadsheet cell) is documented and preferred over shipping a
 *    file that runs formulas on the founder's machine.
 *
 * Rows are joined with CRLF per RFC 4180.
 */

const NEEDS_QUOTING = /[",\r\n]/;
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Escape one cell: injection-hardened, then RFC-4180 quoted when needed. */
export function csvField(value: string): string {
  let v = value;
  if (FORMULA_PREFIX.test(v)) v = `'${v}`;
  if (NEEDS_QUOTING.test(v)) v = `"${v.replaceAll('"', '""')}"`;
  return v;
}

/** One CSV line (no terminator). */
export function csvRow(fields: readonly string[]): string {
  return fields.map(csvField).join(",");
}

/**
 * Full document: header row + data rows, CRLF-joined, with a trailing CRLF
 * (RFC 4180 permits either; a terminator keeps `wc -l`/appends honest).
 */
export function serializeCsv(
  header: readonly string[],
  rows: readonly (readonly string[])[]
): string {
  return [header, ...rows].map(csvRow).join("\r\n") + "\r\n";
}
