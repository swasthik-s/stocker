"use client";

import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, Play, RefreshCw, Search, ShieldCheck } from "lucide-react";
import type { MasterItem, NegativeLine, MatchCandidate, SkippedCombo } from "@/lib/domain/types";
import { readMasterFile, readNegativeFile, getNegativeSheetNames } from "@/lib/engine/importers";
import { findBreaks, findSwaps } from "@/lib/engine/matching";
import { createManualPair } from "@/lib/engine/manual-pair";
import { calculateTotals, formatItradeTxt } from "@/lib/engine/stock";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Mode = "breaks" | "swaps";
const NONE = "__none__";

export default function NegativeStock() {
  const [masterFile, setMasterFile] = useState<File | null>(null);
  const [negativeFile, setNegativeFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [sheet, setSheet] = useState("");
  const [master, setMaster] = useState<MasterItem[]>([]);
  const [negatives, setNegatives] = useState<NegativeLine[]>([]);
  const [mode, setMode] = useState<Mode>("breaks");
  const [threshold, setThreshold] = useState(.8);
  const [priceTolerance, setPriceTolerance] = useState(.25);
  const [candidates, setCandidates] = useState<MatchCandidate[]>([]);
  const [combos, setCombos] = useState<SkippedCombo[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [manualNeg, setManualNeg] = useState("");
  const [manualOuter, setManualOuter] = useState("");
  const [manualConv, setManualConv] = useState(6);
  const [masterSearch, setMasterSearch] = useState("");

  const totals = useMemo(() => calculateTotals(negatives), [negatives]);
  const filteredMaster = useMemo(() => {
    const query = masterSearch.trim().toLowerCase();
    return master.filter(item => !query ||
      String(item["Item Barcode"]).toLowerCase().includes(query) ||
      item["Item Name"].toLowerCase().includes(query)).slice(0, 200);
  }, [master, masterSearch]);

  async function chooseNegative(file: File | null) {
    setNegativeFile(file); setNegatives([]); setCandidates([]); setCombos([]); setError("");
    if (!file) { setSheets([]); setSheet(""); return; }
    try {
      const names = await getNegativeSheetNames(file);
      setSheets(names); setSheet(names[0] ?? "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to read workbook");
    }
  }

  async function load() {
    if (!masterFile || !negativeFile) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const [masterRows, negativeRows] = await Promise.all([
        readMasterFile(masterFile), readNegativeFile(negativeFile, sheet),
      ]);
      setMaster(masterRows); setNegatives(negativeRows); setCandidates([]); setCombos([]);
      setNotice(`Loaded ${masterRows.length.toLocaleString()} master items and ${negativeRows.length.toLocaleString()} negative lines.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "File import failed");
    } finally { setBusy(false); }
  }

  async function match() {
    if (!master.length || !negatives.length) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = mode === "breaks"
        ? findBreaks(master, negatives, threshold, true)
        : { candidates: findSwaps(master, negatives, threshold, .9, priceTolerance), combos: [] as SkippedCombo[] };
      const selected = result.candidates.map(candidate => ({ ...candidate, use: true }));
      setCandidates(selected); setCombos(result.combos);
      setNotice(`Matching finished: ${result.candidates.length} candidates; ${result.combos.length} manual-review cases.`);
      try {
        const saved = await fetch("/api/runs", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: "Bearer " + (sessionStorage.getItem("stocker-api-token") ?? "") },
          body: JSON.stringify({ mode, settings: { threshold, priceTolerance }, candidates: selected, combos: result.combos, note: "Saved from negative-stock workspace" }),
        });
        if (!saved.ok) setNotice("Matching finished locally; history was not saved.");
      } catch { setNotice("Matching finished locally; MongoDB history is currently unavailable."); }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Matching failed");
    } finally { setBusy(false); }
  }

  function addManual() {
    try {
      const negative = negatives.find(item => item.bc === manualNeg);
      if (!negative) throw new Error("Choose a negative item first.");
      const candidate = createManualPair(master, negative, manualOuter, manualConv);
      setCandidates(old => [...old.filter(item => item.neg_bc !== candidate.neg_bc), candidate]);
      setNotice("Manual pairing added. Check the MANUAL_OVERRIDE warning before exporting.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Manual pairing failed");
    }
  }

  function download() {
    const content = formatItradeTxt("SML", candidates.filter(item => item.use !== false));
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "stocker-itrade-import.txt"; anchor.click();
    URL.revokeObjectURL(url);
  }

  function resetWorkspace() {
    setMasterFile(null); setNegativeFile(null); setSheets([]); setSheet("");
    setMaster([]); setNegatives([]); setCandidates([]); setCombos([]);
    setNotice(""); setError(""); setManualNeg(""); setManualOuter(""); setMasterSearch("");
  }

  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <div className="flex items-center gap-2"><Badge variant="secondary">Suggestion engine</Badge><Badge variant="outline">Browser processing</Badge></div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Negative stock</h1>
        <p className="mt-1 text-sm text-muted-foreground">Find bundle breaks and wrong-sale candidates. Nothing is posted to iTrade.</p>
      </div>
      <Button variant="outline" onClick={resetWorkspace}><RefreshCw /> Reset workspace</Button>
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileSpreadsheet className="size-4" /> Master list</CardTitle><CardDescription>CSV, XLSX or XLS. Barcode values are read as text.</CardDescription></CardHeader>
        <CardContent className="grid gap-2">
          <Label htmlFor="master-file">Master workbook</Label>
          <Input id="master-file" type="file" accept=".csv,.xlsx,.xls" onChange={event => setMasterFile(event.target.files?.[0] ?? null)} />
          <p className="text-xs text-muted-foreground">{masterFile ? masterFile.name : "Choose a master workbook."}{master.length ? ` · ${master.length.toLocaleString()} rows loaded` : ""}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileSpreadsheet className="size-4" /> Negative stock report</CardTitle><CardDescription>Excel workbook. Header detection scans the first 40 rows.</CardDescription></CardHeader>
        <CardContent className="grid gap-2">
          <Label htmlFor="negative-file">Negative stock workbook</Label>
          <Input id="negative-file" type="file" accept=".xlsx,.xls" onChange={event => void chooseNegative(event.target.files?.[0] ?? null)} />
          <p className="text-xs text-muted-foreground">{negativeFile ? negativeFile.name : "Choose a negative stock report."}{negatives.length ? ` · ${negatives.length.toLocaleString()} negative rows loaded` : ""}</p>
          {sheets.length > 0 && <div className="grid gap-2"><Label>Workbook sheet</Label><Select value={sheet} onValueChange={setSheet}><SelectTrigger><SelectValue placeholder="Select worksheet" /></SelectTrigger><SelectContent>{sheets.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select></div>}
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardHeader><CardTitle className="text-base">Matching configuration</CardTitle><CardDescription>Use conservative defaults unless you have validated another threshold against store data.</CardDescription></CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-4">
        <div className="grid gap-2"><Label>Match mode</Label><Select value={mode} onValueChange={value => setMode(value as Mode)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="breaks">Bundle break</SelectItem><SelectItem value="swaps">Wrong sale</SelectItem></SelectContent></Select></div>
        <div className="grid gap-2"><Label htmlFor="threshold">Minimum score</Label><Input id="threshold" type="number" min="0" max="1" step=".01" value={threshold} onChange={event => setThreshold(Number(event.target.value))} /></div>
        {mode === "swaps" && <div className="grid gap-2"><Label htmlFor="price-tolerance">Price tolerance</Label><Input id="price-tolerance" type="number" min="0" max="1" step=".01" value={priceTolerance} onChange={event => setPriceTolerance(Number(event.target.value))} /></div>}
        <div className="flex items-end"><Button className="w-full" disabled={!masterFile || !negativeFile || busy} onClick={() => void load()}>{busy ? "Loading…" : "Load files"}</Button></div>
        <div className="md:col-span-4"><Button variant="secondary" disabled={!master.length || !negatives.length || busy} onClick={() => void match()}><Play /> Find candidates</Button></div>
      </CardContent>
    </Card>

    {error && <Alert variant="destructive"><AlertTitle>Action failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
    {notice && <Alert><AlertDescription>{notice}</AlertDescription></Alert>}

    {negatives.length > 0 && <>
      <div className="grid gap-4 sm:grid-cols-3">
        {[{ label: "Negative lines", value: totals.count.toLocaleString() }, { label: "Net negative quantity", value: totals.quantity.toLocaleString() }, { label: "Negative value", value: totals.value.toFixed(2) + " AED" }].map(item => <Card key={item.label}><CardContent className="p-5"><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{item.value}</p></CardContent></Card>)}
      </div>
      <Card><CardHeader><CardTitle className="text-base">Category breakdown</CardTitle><CardDescription>Negative line count and total quantity by report category.</CardDescription></CardHeader>
        <CardContent><Table><TableHeader><TableRow><TableHead>Category</TableHead><TableHead>Lines</TableHead><TableHead>Quantity</TableHead><TableHead>Value</TableHead></TableRow></TableHeader><TableBody>{totals.byCategory.map(item => <TableRow key={item.category}><TableCell>{item.category}</TableCell><TableCell>{item.count}</TableCell><TableCell>{item.qty.toLocaleString()}</TableCell><TableCell>{item.value.toFixed(2)}</TableCell></TableRow>)}</TableBody></Table></CardContent>
      </Card>
    </>}

    {candidates.length > 0 && <Card>
      <CardHeader className="flex flex-row items-center justify-between"><div><CardTitle className="text-base">Candidate review</CardTitle><CardDescription>{candidates.filter(item => item.use !== false).length} of {candidates.length} selected. Verify every conversion.</CardDescription></div><Button onClick={download}><Download /> Export selected TXT</Button></CardHeader>
      <CardContent><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Use</TableHead><TableHead>Type</TableHead><TableHead>Negative barcode / item</TableHead><TableHead>Outer barcode / item</TableHead><TableHead>Pack</TableHead><TableHead>Outers</TableHead><TableHead>Stock</TableHead><TableHead>Score</TableHead><TableHead>Unit cost</TableHead><TableHead>Drift</TableHead></TableRow></TableHeader>
        <TableBody>{candidates.map((candidate, index) => <TableRow key={candidate.neg_bc}>
          <TableCell><Checkbox checked={candidate.use !== false} aria-label={"Include " + candidate.neg_bc} onCheckedChange={checked => setCandidates(old => old.map((item, itemIndex) => itemIndex === index ? { ...item, use: checked === true } : item))} /></TableCell>
          <TableCell><Badge variant={candidate.problems?.includes("MANUAL_OVERRIDE") ? "warning" : candidate.kind === "Bundle break" ? "secondary" : "warning"}>{candidate.kind}{candidate.problems?.includes("MANUAL_OVERRIDE") ? " · MANUAL" : ""}</Badge></TableCell>
          <TableCell><div className="font-mono text-xs">{candidate.neg_bc}</div><div className="max-w-56 truncate text-xs text-muted-foreground">{candidate.neg_desc}</div></TableCell>
          <TableCell><div className="font-mono text-xs">{candidate.par_bc}</div><div className="max-w-56 truncate text-xs text-muted-foreground">{candidate.par_desc}</div></TableCell>
          <TableCell>{candidate.conv}</TableCell><TableCell>{candidate.outers_needed}</TableCell><TableCell>{candidate.par_stock}</TableCell><TableCell>{(candidate.score * 100).toFixed(1)}%</TableCell><TableCell>{candidate.derived_cost.toFixed(7)}</TableCell><TableCell>{candidate.cost_drift_pct === null ? "—" : candidate.cost_drift_pct + "%"}</TableCell>
        </TableRow>)}</TableBody></Table></div></CardContent>
    </Card>}

    {combos.length > 0 && <Card><CardHeader><CardTitle className="text-base">Manual review required</CardTitle><CardDescription>These cases are deliberately excluded from automatic matching.</CardDescription></CardHeader>
      <CardContent><Table><TableHeader><TableRow><TableHead>Barcode</TableHead><TableHead>Item</TableHead><TableHead>Reason</TableHead></TableRow></TableHeader><TableBody>{combos.map((item, index) => <TableRow key={item.neg_bc + index}><TableCell className="font-mono">{item.neg_bc}</TableCell><TableCell>{item.neg_desc}</TableCell><TableCell>{item.why}</TableCell></TableRow>)}</TableBody></Table></CardContent>
    </Card>}

    <Card>
      <CardHeader><CardTitle className="text-base">Manual pairing</CardTitle><CardDescription>Use only when the automatic matcher cannot identify a valid outer. This bypasses description matching and is explicitly marked as a manual override.</CardDescription></CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="grid gap-2"><Label>Negative item</Label><Select value={manualNeg || NONE} onValueChange={value => setManualNeg(value === NONE ? "" : value)}><SelectTrigger><SelectValue placeholder="Select negative barcode" /></SelectTrigger><SelectContent><SelectItem value={NONE}>Select negative barcode</SelectItem>{negatives.map(item => <SelectItem key={item.bc} value={item.bc}>{item.bc} · {item["Item Name"]}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid gap-2"><Label htmlFor="master-search">Search master outer</Label><Input id="master-search" value={masterSearch} onChange={event => setMasterSearch(event.target.value)} placeholder="Barcode or description" /></div>
        <div className="grid gap-2"><Label>Outer item</Label><Select value={manualOuter || NONE} onValueChange={value => setManualOuter(value === NONE ? "" : value)}><SelectTrigger><SelectValue placeholder="Select outer item" /></SelectTrigger><SelectContent><SelectItem value={NONE}>Select outer item</SelectItem>{filteredMaster.map(item => <SelectItem key={item["Item Barcode"]} value={String(item["Item Barcode"])}>{item["Item Barcode"]} · {item["Item Name"]}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid gap-2"><Label htmlFor="manual-conversion">Pieces per outer</Label><Input id="manual-conversion" type="number" min="2" max="1000" step="1" value={manualConv} onChange={event => setManualConv(Number(event.target.value))} /></div>
        <div className="md:col-span-2 xl:col-span-4"><Button variant="secondary" onClick={addManual} disabled={!manualNeg || !manualOuter}>Add manual pairing</Button></div>
      </CardContent>
    </Card>

    <Alert><ShieldCheck /><AlertTitle>Safety check</AlertTitle><AlertDescription>Generated candidates are suggestions only. Verify single and outer barcodes, pack conversion, stock availability and cost before importing. TXT is a draft; Stocker never posts stock adjustments.</AlertDescription></Alert>
  </div>;
}
