import { describe, expect, it } from "vitest";
import {
  createItradeText, createTextRows, invoiceHead, invoiceLines,
  invoiceReconciliation, linesFromText, tidyTable, type PdfTable,
} from "./pdf-extraction";

describe("Streamlit PDF extraction port", () => {
  it("detects invoice metadata and totals", () => {
    const head = invoiceHead("INV NO: INV-12345\nDate: 31-Oct-2026\nTRN: 100123456789012\nTotal 7.00\nVAT 0.35\nNet Total 7.35");
    expect(head["Invoice no"]).toBe("INV-12345");
    expect(head.Date).toBe("31-Oct-2026");
    expect(head["Supplier TRN"]).toBe("100123456789012");
    expect(head.Total).toBe(7);
    expect(head["Net Total"]).toBe(7.35);
  });

  it("extracts invoice rows from table columns using aliases", () => {
    const tables: PdfTable[] = [{
      page: 1, block: 1,
      rows: [
        ["SL.NO", "ITEM CODE", "DESCRIPTION", "UNIT", "QTY", "UNIT PRICE", "AMOUNT", "VAT AMT", "AFTER VAT AMT"],
        ["1", "1234567890123", "WATERMELON JUICE", "PCS", "2", "3.5", "7.00", "0.35", "7.35"],
        ["2", "not-a-barcode", "subtotal", "", "", "", "", "", ""],
      ],
    }];
    const lines = invoiceLines(tables);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ Barcode: "1234567890123", Description: "WATERMELON JUICE", Qty: 2, UnitPrice: 3.5, Amount: 7, AfterVat: 7.35 });
  });

  it("reconstructs invoice lines from the rightmost numeric columns", () => {
    const lines = linesFromText("1 1234567890123 WATERMELON JUICE PCS 2 3.50 7.00 5 0.35 7.35");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ Barcode: "1234567890123", Description: "WATERMELON JUICE PCS", Qty: 2, UnitPrice: 3.5, Amount: 7, VatAmt: .35, AfterVat: 7.35 });
  });

  it("deduplicates text lines by barcode", () => {
    const lines = linesFromText([
      "1 1234567890123 JUICE 2 3.50 7.00 5 0.35 7.35",
      "1 1234567890123 JUICE 2 3.50 7.00 5 0.35 7.35",
    ].join("\n"));
    expect(lines).toHaveLength(1);
  });

  it("enforces the AED 0.05 reconciliation threshold", () => {
    const lines = linesFromText("1 1234567890123 JUICE 2 3.50 7.00 5 0.35 7.35");
    const head = invoiceHead("Total 7.04\nNet Total 7.35");
    expect(invoiceReconciliation(lines, head).totalMatches).toBe(true);
    expect(invoiceReconciliation(lines, head).netMatches).toBe(true);
    const mismatch = invoiceHead("Total 7.06\nNet Total 7.35");
    expect(invoiceReconciliation(lines, mismatch).totalMatches).toBe(false);
  });

  it("flags line arithmetic differences above AED 0.02", () => {
    const lines = linesFromText("1 1234567890123 JUICE 2 3.50 7.10 5 0.35 7.45");
    expect(invoiceReconciliation(lines, invoiceHead("Total 7.10")).arithmeticIssues).toHaveLength(1);
  });

  it("formats iTrade import with prefix, barcode, price and quantity only", () => {
    const lines = linesFromText("1 1234567890123 JUICE 2 3.123456789 6.25 5 0.31 6.56");
    expect(createItradeText(lines, "SML")).toBe("SML,1234567890123,3.1234568,2\n");
  });

  it("cleans table preambles and blank columns", () => {
    const table = tidyTable([
      ["SUPPLIER INVOICE", "", "", ""],
      ["Barcode", "Description", "Qty", "Empty"],
      ["1234567890123", "JUICE", "2", ""],
      ["1234567890124", "MILK", "3", ""],
    ]);
    expect(table?.columns).toEqual(["Barcode", "Description", "Qty"]);
    expect(table?.rows).toHaveLength(2);
  });

  it("exports selected page text and page-indexed line records", () => {
    const result = createTextRows([
      { n: 1, text: "First\nline" },
      { n: 2, text: "Second page" },
    ], [2], true);
    expect(result.text).toBe("--- page 2 ---\nSecond page");
    expect(result.rows).toEqual([{ page: 2, line: 1, text: "Second page" }]);
  });
});
