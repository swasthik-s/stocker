"use client";

import { useState } from "react";
import { Download, FileText, ScanText } from "lucide-react";
import * as XLSX from "xlsx";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type PageText = { page: number; text: string };
export default function PdfTools() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageText[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  async function extract() {
    if (!file) return;
    setBusy(true); setError(""); setPages([]); setProgress(0);
    try {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
      const bytes = new Uint8Array(await file.arrayBuffer());
      const document = await pdfjs.getDocument({ data: bytes }).promise;
      const extracted: PageText[] = [];
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        const text = content.items.map((item: unknown) => typeof item === "object" && item !== null && "str" in item ? String((item as { str: unknown }).str) : "").join(" ").replace(/\s+/g, " ").trim();
        if (text) extracted.push({ page: pageNumber, text });
        setProgress(Math.round(pageNumber / document.numPages * 100));
      }
      if (!extracted.length) throw new Error("No selectable text found. This PDF may be scanned and needs OCR.");
      setPages(extracted);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "PDF extraction failed");
    } finally { setBusy(false); }
  }

  function exportXlsx() {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(pages), "PDF Text");
    XLSX.writeFile(workbook, "stocker-pdf-text.xlsx");
  }
  function exportTxt() {
    const content = pages.map(page => `--- PAGE ${page.page} ---\n${page.text}`).join("\n\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "stocker-pdf-text.txt"; anchor.click(); URL.revokeObjectURL(url);
  }

  return <div className="mx-auto w-full max-w-6xl space-y-6">
    <div><Badge variant="secondary">PDF utilities</Badge><h1 className="mt-2 text-2xl font-semibold tracking-tight">PDF to Excel / TXT</h1>
      <p className="mt-1 text-sm text-muted-foreground">Extract selectable text from digital PDFs and export a page-indexed worksheet.</p></div>
    <Card>
      <CardHeader><CardTitle className="text-base">Extract PDF text</CardTitle><CardDescription>Text extraction runs locally in this browser. OCR and invoice reconciliation are not implemented yet in this migration stage.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="pdf-file">PDF document</Label>
          <Input id="pdf-file" type="file" accept=".pdf,application/pdf" onChange={event => { setFile(event.target.files?.[0] ?? null); setPages([]); setError(""); }} />
          {file && <p className="text-sm text-muted-foreground">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={!file || busy} onClick={extract}><ScanText />{busy ? "Extracting…" : "Extract text"}</Button>
          <Button variant="outline" disabled={!pages.length} onClick={exportXlsx}><Download />Export XLSX</Button>
          <Button variant="outline" disabled={!pages.length} onClick={exportTxt}><Download />Export TXT</Button>
        </div>
        {busy && <div className="space-y-2"><div className="flex justify-between text-sm"><span>Processing pages</span><span>{progress}%</span></div><Progress value={progress} /></div>}
        {error && <Alert variant="destructive"><AlertTitle>Extraction failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        {pages.length > 0 && <>
          <div className="flex items-center gap-2"><Badge variant="success">{pages.length} pages with text</Badge><span className="text-sm text-muted-foreground">Extraction complete</span></div>
          <Separator />
          <div className="max-h-[520px] overflow-auto">
            <Table><TableHeader><TableRow><TableHead className="w-24">Page</TableHead><TableHead>Extracted text</TableHead></TableRow></TableHeader>
              <TableBody>{pages.map(page => <TableRow key={page.page}><TableCell className="font-mono">{page.page}</TableCell><TableCell className="whitespace-pre-wrap text-sm">{page.text}</TableCell></TableRow>)}</TableBody>
            </Table>
          </div>
        </>}
      </CardContent>
    </Card>
    <Alert><FileText /><AlertTitle>Import safety rule</AlertTitle><AlertDescription>OCR-derived iTrade import must remain blocked unless extracted line totals reconcile with the invoice header within AED 0.05. This text-only extraction stage does not generate import-ready stock transactions.</AlertDescription></Alert>
  </div>;
}
