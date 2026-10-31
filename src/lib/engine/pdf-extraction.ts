export type PdfPage = { n: number; text: string; ocr?: boolean };
export type PdfTable = { page: number; block: number; rows: string[][] };
export type InvoiceLine = {
  SL: number | null; Barcode: string; Description: string; Unit: string;
  Qty: number | null; UnitPrice: number | null; Amount: number | null;
  VatAmt: number | null; AfterVat: number | null;
};
export type InvoiceHead = {
  "Invoice no": string | null; Date: string | null; "Supplier TRN": string | null;
  Total: number | null; VAT: number | null; "Net Total": number | null;
};
export type CleanTable = { columns: string[]; rows: string[][] };
export type TableResult = { name: string; rows: string[][]; columns: string[] };

const ALIAS: Record<string, string[]> = {
  BARCODE: ["BARCODE", "ITEM CODE", "ITEMCODE", "CODE", "EAN"],
  DESCRIPTION: ["DESCRIPTION", "ITEM NAME", "PARTICULARS", "ITEM"],
  QTY: ["QTY", "QUANTITY", "RECD QTY", "REC QTY"],
  PRICE: ["UNIT PRICE", "RATE", "PRICE", "COST", "UNIT COST"],
  AMOUNT: ["AMOUNT", "VALUE", "NET AMOUNT"],
  UNIT: ["UNIT", "UOM"],
  SL: ["SL.NO", "SL NO", "S.NO", "SR.NO", "SR"],
  VAT: ["VAT AMT", "VAT AMOUNT", "TAX AMT"],
  AFTER: ["AFTER VAT AMT", "AFTER VAT", "GROSS"],
};
const NUMTOK = /^[\d,]+(?:\.\d+)?$/;

export function clean(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}
export function num(value: unknown): number | null {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) && String(value ?? "").trim() !== "" ? parsed : null;
}
function findHeader(headers: string[], keys: string[]): number | null {
  for (const key of keys) { const exact = headers.indexOf(key); if (exact >= 0) return exact; }
  for (let i = 0; i < headers.length; i++) for (const key of keys) if (headers[i] && headers[i].includes(key)) return i;
  return null;
}
export function headerScore(row: unknown[]): number {
  const cells = row.map(clean), filled = cells.filter(Boolean);
  if (filled.length < 3) return 0;
  const numeric = filled.filter(cell => /^[\d,.\-]+$/.test(cell)).length;
  if (numeric >= filled.length / 2) return 0;
  return filled.filter(cell => cell.length <= 24).length +
    filled.filter(cell => /[A-Za-z]/.test(cell)).length + new Set(filled).size;
}
export function tidyTable(rows: string[][], minRows = 2): CleanTable | null {
  if (rows.length < 2) return null;
  let bestIndex = -1, best = 0;
  rows.slice(0, 8).forEach((row, index) => { const score = headerScore(row); if (score > best) { best = score; bestIndex = index; } });
  if (bestIndex < 0) return null;
  const headers = rows[bestIndex].map((cell, index) => clean(cell) || `col${index + 1}`);
  const body = rows.slice(bestIndex + 1).filter(row => row.some(cell => clean(cell)) && headerScore(row) < best)
    .map(row => headers.map((_, index) => clean(row[index] ?? "")));
  if (body.length < minRows) return null;
  const keep = headers.map((_, index) => index).filter(index => body.some(row => row[index] !== ""));
  const filtered = body.map(row => keep.map(index => row[index])).filter(row => row.some(Boolean));
  if (keep.length < 3 || filtered.length < minRows) return null;
  return { columns: keep.map(index => headers[index]), rows: filtered };
}
export function invoiceLines(tables: PdfTable[]): InvoiceLine[] {
  const out: InvoiceLine[] = [];
  for (const table of tables) {
    let headerIndex = -1, headers: string[] = [];
    for (let index = 0; index < table.rows.length; index++) {
      const current = table.rows[index].map(cell => clean(cell).toUpperCase());
      if (findHeader(current, ALIAS.BARCODE) !== null && findHeader(current, ALIAS.QTY) !== null) { headerIndex = index; headers = current; break; }
    }
    if (headerIndex < 0) continue;
    const ix = Object.fromEntries(Object.entries(ALIAS).map(([key, aliases]) => [key, findHeader(headers, aliases)])) as Record<string, number | null>;
    for (const row of table.rows.slice(headerIndex + 1)) {
      const codeIndex = ix.BARCODE;
      const barcode = codeIndex !== null ? clean(row[codeIndex]) : "";
      if (!/^\d{6,14}$/.test(barcode)) continue;
      const cell = (key: string, numeric = false): string | number | null => {
        const index = ix[key];
        if (index === null || index === undefined || index >= row.length) return numeric ? null : "";
        return numeric ? num(row[index]) : clean(row[index]);
      };
      out.push({
        SL: cell("SL", true) as number | null, Barcode: barcode,
        Description: cell("DESCRIPTION") as string, Unit: cell("UNIT") as string,
        Qty: cell("QTY", true) as number | null, UnitPrice: cell("PRICE", true) as number | null,
        Amount: cell("AMOUNT", true) as number | null, VatAmt: cell("VAT", true) as number | null,
        AfterVat: cell("AFTER", true) as number | null,
      });
    }
  }
  const seen = new Set<string>();
  return out.filter(line => { const key = `${line.SL ?? ""}| ${line.Barcode}`; if (seen.has(key)) return false; seen.add(key); return true; });
}
export function linesFromText(text: string, trailing = 6): InvoiceLine[] {
  const out: InvoiceLine[] = [];
  for (const line of text.split(/\r?\n/)) {
    const tokens = line.trim().split(/\s+/);
    const barcodeIndex = tokens.findIndex(token => /^\d{6,14}$/.test(token));
    if (barcodeIndex < 0) continue;
    const tail: string[] = [];
    for (const token of [...tokens].reverse()) { if (NUMTOK.test(token)) tail.push(token); else break; }
    if (tail.length < trailing) continue;
    const selectedTail = tail.slice(0, trailing).reverse();
    const values = selectedTail.map(num);
    const [qty, unitPrice, amount, , vatAmt, afterVat] = values;
    const sl = barcodeIndex > 0 && /^\d+$/.test(tokens[0]) ? num(tokens[0]) : null;
    const description = tokens.slice(barcodeIndex + 1, tokens.length - selectedTail.length).join(" ");
    out.push({ SL: sl, Barcode: tokens[barcodeIndex], Description: description, Unit: "", Qty: qty, UnitPrice: unitPrice, Amount: amount, VatAmt: vatAmt, AfterVat: afterVat });
  }
  const seen = new Set<string>();
  return out.filter(line => { if (seen.has(line.Barcode)) return false; seen.add(line.Barcode); return true; });
}
export function invoiceHead(fullText: string): InvoiceHead {
  const grab = (pattern: string) => fullText.match(new RegExp(pattern, "i"))?.[1]?.trim() ?? null;
  return {
    "Invoice no": grab("INV NO\\s*:?\\s*([A-Z0-9\\-/]+)"),
    Date: grab("Date\\s*:?\\s*(\\d{1,2}-[A-Za-z]{3}-\\d{4})"),
    "Supplier TRN": grab("TRN\\s*:?\\s*(\\d{10,20})"),
    Total: num(grab("\\bTotal\\s+([\\d,]+\\.\\d\\d)")),
    VAT: num(grab("\\bVAT\\s+([\\d,]+\\.\\d\\d)")),
    "Net Total": num(grab("Net Total\\s+([\\d,]+\\.\\d\\d)")),
  };
}
export function formatNumber(value: number | null, decimals = 7): string {
  if (value === null || !Number.isFinite(value)) return "0";
  return value.toFixed(decimals).replace(/0+$/, "").replace(/\.$/, "") || "0";
}
export function invoiceReconciliation(lines: InvoiceLine[], head: InvoiceHead) {
  const amounts = lines.map(line => line.Amount).filter((value): value is number => value !== null);
  const gross = lines.map(line => line.AfterVat).filter((value): value is number => value !== null);
  const amountSum = amounts.length ? amounts.reduce((sum, value) => sum + value, 0) : null;
  const grossSum = gross.length ? gross.reduce((sum, value) => sum + value, 0) : null;
  const totalDelta = amountSum !== null && head.Total !== null ? Number((amountSum - head.Total).toFixed(2)) : null;
  const netDelta = grossSum !== null && head["Net Total"] !== null ? Number((grossSum - head["Net Total"]).toFixed(2)) : null;
  const arithmeticIssues = lines.filter(line => line.Qty !== null && line.UnitPrice !== null && line.Amount !== null &&
    Math.abs(Number(((line.Qty * line.UnitPrice) - line.Amount).toFixed(2))) > 0.02);
  return { amountSum, grossSum, totalDelta, netDelta, arithmeticIssues,
    totalMatches: totalDelta !== null && Math.abs(totalDelta) <= 0.05,
    netMatches: netDelta !== null && Math.abs(netDelta) <= 0.05 };
}
export function createItradeText(lines: InvoiceLine[], prefix = "SML"): string {
  return lines.filter(line => line.UnitPrice !== null).map(line =>
    `${prefix},${line.Barcode},${formatNumber(line.UnitPrice)},${formatNumber(line.Qty, 3)}`).join("\n") + "\n";
}
export function createTextRows(pages: { n: number; text: string }[], selected: number[], markBreaks: boolean) {
  const keep = pages.filter(page => selected.includes(page.n));
  const text = keep.map(page => markBreaks ? `--- page ${page.n} ---\n${page.text}` : page.text).join("\n\n").replace(/\n{3,}/g, "\n\n");
  const rows = keep.flatMap(page => page.text.split(/\r?\n/).map((line, index) => ({ page: page.n, line: index + 1, text: line })).filter(row => row.text.trim()));
  return { text, rows };
}
export function extractTablesFromTextItems(items: { str: string; x: number; y: number; width: number }[], page: number): PdfTable[] {
  const sorted = [...items].filter(item => item.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: typeof sorted[] = [];
  for (const item of sorted) {
    let line = lines.find(group => Math.abs(group[0].y - item.y) <= 3);
    if (!line) { line = []; lines.push(line); }
    line.push(item);
  }
  const rows = lines.sort((a, b) => b[0].y - a[0].y).map(line => {
    const ordered = line.sort((a, b) => a.x - b.x);
    const cells: string[] = [];
    let current = "", end = Number.NEGATIVE_INFINITY;
    for (const item of ordered) {
      if (current && item.x - end > 16) { cells.push(clean(current)); current = ""; }
      current += (current ? " " : "") + item.str;
      end = item.x + item.width;
    }
    if (current) cells.push(clean(current));
    return cells;
  });
  const blocks: string[][][] = [];
  let block: string[][] = [];
  for (const row of rows) {
    if (row.length >= 3) block.push(row);
    else if (block.length) { if (block.length >= 2) blocks.push(block); block = []; }
  }
  if (block.length >= 2) blocks.push(block);
  return blocks.map((blockRows, index) => ({ page, block: index + 1, rows: blockRows }));
}
