"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { Download, FileSearch } from "lucide-react";
import { auditMaster, type AuditFinding } from "@/lib/engine/master-audit";
import { readMasterFile } from "@/lib/engine/importers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type MasterRecord = Record<string, unknown>;

export default function MasterAuditPage() {
  const [file, setFile] = useState<File | null>(null);
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState(0);

  async function runAudit() {
    if (!file) return;

    setBusy(true);
    setError("");
    setFindings([]);

    try {
      let records: MasterRecord[];

      if (file.name.toLowerCase().endsWith(".csv")) {
        records = (await readMasterFile(file)) as unknown as MasterRecord[];
      } else {
        const workbook = XLSX.read(await file.arrayBuffer(), {
          type: "array",
          cellDates: false,
        });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

        if (!firstSheet) {
          throw new Error("Workbook has no sheets");
        }

        records = XLSX.utils.sheet_to_json<MasterRecord>(firstSheet, {
          defval: "",
          raw: false,
        });
      }

      setRows(records.length);
      setFindings(auditMaster(records));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not audit file",
      );
    } finally {
      setBusy(false);
    }
  }

  function exportFindings() {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(findings);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Audit");
    XLSX.writeFile(workbook, "stocker-master-audit.xlsx");
  }

  const counts = findings.reduce<Record<string, number>>((result, finding) => {
    result[finding.issue] = (result[finding.issue] ?? 0) + 1;
    return result;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="secondary">Master data quality</Badge>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Master sheet audit
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Find negative stock, below-cost items, missing fields and duplicate
          barcodes locally in your browser.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload master workbook</CardTitle>
          <CardDescription>
            Files are processed in the browser; large workbooks are not posted
            to a Vercel function.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <Button disabled={!file || busy} onClick={runAudit}>
            <FileSearch />
            {busy ? "Auditing…" : "Run audit"}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/5 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {rows > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Rows scanned</p>
                <p className="mt-2 text-2xl font-semibold">
                  {rows.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total findings</p>
                <p className="mt-2 text-2xl font-semibold">
                  {findings.length.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            {Object.entries(counts)
              .slice(0, 2)
              .map(([issue, count]) => (
                <Card key={issue}>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">
                      {issue.replaceAll("_", " ")}
                    </p>
                    <p className="mt-2 text-2xl font-semibold">{count}</p>
                  </CardContent>
                </Card>
              ))}
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Audit findings</CardTitle>
                <CardDescription>
                  Review the source workbook before correcting master data.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={exportFindings}
                disabled={!findings.length}
              >
                <Download />
                Export XLSX
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Issue</TableHead>
                      <TableHead>Barcode</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Sell price</TableHead>
                      <TableHead>Detail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {findings.map((finding, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Badge
                            variant={
                              finding.issue === "BELOW_COST" ||
                              finding.issue === "NEGATIVE_STOCK"
                                ? "destructive"
                                : "warning"
                            }
                          >
                            {finding.issue.replaceAll("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {finding.barcode || "—"}
                        </TableCell>
                        <TableCell>{finding.name || "—"}</TableCell>
                        <TableCell>{finding.stock}</TableCell>
                        <TableCell>{finding.cost}</TableCell>
                        <TableCell>{finding.sellingPrice}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {finding.detail}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
