/**
 * Unit tests for src/lib/csv.ts — the CSV serialisation behind the admin
 * waitlist export (Task 7b). Two properties matter:
 *  - RFC-4180 escaping: quotes/commas/CR/LF in a field can never break a row;
 *  - CSV-injection hardening: leading =+-@ (formula starters) are
 *    apostrophe-prefixed so spreadsheets don't execute member-typed names.
 */
import { describe, expect, it } from "vitest";
import { csvField, csvRow, serializeCsv } from "@/lib/csv";

describe("csvField", () => {
  it("passes plain values through untouched", () => {
    expect(csvField("Aoife Byrne")).toBe("Aoife Byrne");
    expect(csvField("T12")).toBe("T12");
    expect(csvField("")).toBe("");
  });

  it("quotes fields containing commas", () => {
    expect(csvField("Byrne, Aoife")).toBe('"Byrne, Aoife"');
  });

  it("quotes and doubles embedded double quotes", () => {
    expect(csvField('Aoife "Ferrari" Byrne')).toBe('"Aoife ""Ferrari"" Byrne"');
  });

  it("quotes fields containing newlines (LF and CRLF)", () => {
    expect(csvField("line1\nline2")).toBe('"line1\nline2"');
    expect(csvField("line1\r\nline2")).toBe('"line1\r\nline2"');
  });

  it("keeps unicode intact (fadas, emoji)", () => {
    expect(csvField("Sinéad Ní Bhraonáin")).toBe("Sinéad Ní Bhraonáin");
    expect(csvField("Pádraic 🏃")).toBe("Pádraic 🏃");
  });

  it("apostrophe-prefixes formula starters (=, +, -, @, tab, CR)", () => {
    expect(csvField("=HYPERLINK(\"http://evil\")")).toBe(
      "\"'=HYPERLINK(\"\"http://evil\"\")\""
    );
    expect(csvField("+353871234567")).toBe("'+353871234567");
    expect(csvField("-Ann")).toBe("'-Ann");
    expect(csvField("@import")).toBe("'@import");
    expect(csvField("\tcmd")).toBe("'\tcmd");
  });

  it("does not prefix values that merely contain (not start with) =+-@", () => {
    expect(csvField("mary-kate@example.ie")).toBe("mary-kate@example.ie");
  });
});

describe("csvRow / serializeCsv", () => {
  it("joins escaped fields with commas", () => {
    expect(csvRow(["a", "b,c", 'd"e'])).toBe('a,"b,c","d""e"');
  });

  it("serialises header + rows with CRLF line endings and a trailing CRLF", () => {
    const out = serializeCsv(
      ["name", "email", "position"],
      [
        ["Byrne, Aoife", "aoife@example.ie", "1"],
        ["=SUM(A1)", "evil@example.ie", "2"],
      ]
    );
    expect(out).toBe(
      "name,email,position\r\n" +
        '"Byrne, Aoife",aoife@example.ie,1\r\n' +
        "'=SUM(A1),evil@example.ie,2\r\n"
    );
  });

  it("round-trips: every logical row stays one physical record", () => {
    // A field with an embedded newline must not add a record — split on CRLF
    // outside quotes by counting unescaped quote parity.
    const out = serializeCsv(["name"], [["two\nlines"], ["plain"]]);
    const records: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < out.length; i++) {
      const ch = out[i];
      if (ch === '"') inQuotes = !inQuotes;
      if (!inQuotes && ch === "\r" && out[i + 1] === "\n") {
        records.push(current);
        current = "";
        i++;
        continue;
      }
      current += ch;
    }
    expect(records).toEqual(["name", '"two\nlines"', "plain"]);
  });
});
