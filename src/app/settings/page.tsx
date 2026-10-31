"use client";

import { useEffect, useState } from "react";
import { Save, Settings2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

type Settings = {
  autosave_session: boolean; save_snapshots: boolean; save_runs: boolean;
  keep_sessions: number; keep_snapshots: number; keep_runs: number;
  keep_batches: number; keep_templates: number; auto_prune: boolean;
  prepared: string; checked: string; verified: string; purchaser: string;
  approved: string; txt_prefix: string; pairs_per_sheet: number; remarks: string;
  br_thresh: number; drift_tol: number; price_tol: number;
};
const defaults: Settings = {
  autosave_session: true, save_snapshots: true, save_runs: true,
  keep_sessions: 30, keep_snapshots: 90, keep_runs: 30, keep_batches: 60,
  keep_templates: 365, auto_prune: false, prepared: "SWASTHIK",
  checked: "IRSHAD", verified: "THALLATH", purchaser: "IQBAL",
  approved: "THALLATH", txt_prefix: "SML", pairs_per_sheet: 11,
  remarks: "OUTER BREAK FOR NEGATIVE STOCK", br_thresh: .8,
  drift_tol: 15, price_tol: .25,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState(defaults);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = sessionStorage.getItem("stocker-api-token") ?? "";
    fetch("/api/settings", { headers: { authorization: "Bearer " + token } })
      .then(async response => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error ?? "Could not load settings");
        setSettings(current => ({ ...current, ...json.settings }));
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : "Could not connect to settings API"))
      .finally(() => setBusy(false));
  }, []);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings(current => ({ ...current, [key]: value }));
  }

  async function save() {
    setSaving(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json", authorization: "Bearer " + (sessionStorage.getItem("stocker-api-token") ?? "") },
        body: JSON.stringify(settings),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Save failed");
      setMessage("Settings saved to MongoDB.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Save failed");
    } finally { setSaving(false); }
  }

  function textField(key: keyof Settings, label: string, description?: string) {
    return <div className="grid gap-2" key={key}>
      <Label htmlFor={key}>{label}</Label>
      <Input id={key} value={String(settings[key])} onChange={event => update(key, event.target.value as Settings[typeof key])} />
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>;
  }
  function numberField(key: keyof Settings, label: string, min = 0, max?: number, step = 1) {
    return <div className="grid gap-2" key={key}>
      <Label htmlFor={key}>{label}</Label>
      <Input id={key} type="number" min={min} max={max} step={step} value={String(settings[key])}
        onChange={event => update(key, Number(event.target.value) as Settings[typeof key])} />
    </div>;
  }
  function toggle(key: "autosave_session" | "save_snapshots" | "save_runs" | "auto_prune", label: string, description: string) {
    return <div className="flex items-center justify-between gap-6 py-3" key={key}>
      <div className="grid gap-1"><Label htmlFor={key}>{label}</Label><p className="text-sm text-muted-foreground">{description}</p></div>
      <Switch id={key} checked={settings[key]} onCheckedChange={checked => update(key, checked)} />
    </div>;
  }

  return <div className="mx-auto w-full max-w-6xl space-y-6">
    <div className="flex items-center gap-3">
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted"><Settings2 className="size-5" /></div>
      <div><Badge variant="secondary">Workspace configuration</Badge><h1 className="mt-1 text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Control matching defaults, document signatories, output format and retention.</p></div>
    </div>

    <Card>
      <CardHeader><CardTitle className="text-base">Save behavior</CardTitle><CardDescription>Choose which operational records are saved automatically.</CardDescription></CardHeader>
      <CardContent>
        {toggle("autosave_session", "Autosave working sessions", "Save the current workspace when a negative report is loaded.")}
        <Separator />
        {toggle("save_snapshots", "Save upload snapshots", "Keep upload totals for history and trend review.")}
        <Separator />
        {toggle("save_runs", "Save matching runs", "Store candidate results and matching configuration.")}
        <Separator />
        {toggle("auto_prune", "Enable automatic retention pruning", "Retention execution is a separate scheduled workflow; this switch stores the preference only.")}
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle className="text-base">Retention (days)</CardTitle><CardDescription>Set a value of 0 to retain records indefinitely.</CardDescription></CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {numberField("keep_sessions", "Sessions", 0, 3650)}
        {numberField("keep_snapshots", "Snapshots", 0, 3650)}
        {numberField("keep_runs", "Matching runs", 0, 3650)}
        {numberField("keep_batches", "Output batches", 0, 3650)}
        {numberField("keep_templates", "Item templates", 0, 3650)}
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle className="text-base">Matching and output defaults</CardTitle><CardDescription>These defaults should be changed only after validating results against known store data.</CardDescription></CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {numberField("br_thresh", "Bundle match threshold", 0, 1, .01)}
        {numberField("drift_tol", "Cost drift tolerance (%)", 0, 100, .5)}
        {numberField("price_tol", "Wrong-sale price tolerance", 0, 1, .01)}
        {textField("txt_prefix", "iTrade TXT prefix")}
        {numberField("pairs_per_sheet", "Pairs per sheet", 1, 60)}
        {textField("remarks", "Default remarks")}
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle className="text-base">Document signatories</CardTitle><CardDescription>Names printed on adjustment and item request documents.</CardDescription></CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {textField("prepared", "Prepared by")}
        {textField("checked", "Checked by")}
        {textField("verified", "Verified by")}
        {textField("purchaser", "Concerned purchaser")}
        {textField("approved", "Approved by")}
      </CardContent>
    </Card>

    {error && <Alert variant="destructive"><AlertTitle>Settings error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
    {message && <Alert><AlertTitle>Saved</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>}
    <div className="flex items-center justify-end gap-3">
      <p className="mr-auto text-sm text-muted-foreground">{busy ? "Loading settings…" : ""}</p>
      <Button onClick={save} disabled={busy || saving}><Save />{saving ? "Saving…" : "Save settings"}</Button>
    </div>
  </div>;
}
