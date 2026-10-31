import Link from "next/link";
import { ArrowUpRight, Boxes, ClipboardCheck, FileSpreadsheet, PackageSearch, ShieldCheck, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const modules = [
  { name: "Negative stock", desc: "Find bundle breaks and wrong-sale candidates with explainable matching.", href: "/negative-stock", icon: PackageSearch, status: "Core workflow" },
  { name: "Master audit", desc: "Review negative stock, below-cost pricing and data quality issues.", href: "/master-audit", icon: FileSpreadsheet, status: "Available" },
  { name: "PDF tools", desc: "Extract invoice lines and reconcile before creating import files.", href: "/pdf-tools", icon: ClipboardCheck, status: "In progress" },
  { name: "Item templates", desc: "Prepare item creation, activation and description-change sheets.", href: "/templates", icon: Boxes, status: "In progress" },
];

const metrics = [
  { label: "Negative stock workflow", value: "01", icon: TrendingDown },
  { label: "Audit & validation", value: "02", icon: FileSpreadsheet },
  { label: "Document tools", value: "03", icon: ClipboardCheck },
  { label: "Safety principle", value: "100%", icon: ShieldCheck },
];

export default function Home() {
  return <div className="space-y-7">
    <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-primary/10 shadow-sm">
      <CardContent className="flex flex-col justify-between gap-6 p-6 md:flex-row md:items-end md:p-8">
        <div className="max-w-2xl">
          <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.18em] text-primary">
            <ShieldCheck className="size-4" /> Stock operations workspace
          </div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-[32px]">Good evening. Let&apos;s keep stock accurate.</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">A focused toolkit for iTrade stock corrections, master-data quality and document preparation.</p>
        </div>
        <Badge variant="outline" className="w-fit border-primary/30 bg-primary/10 text-primary">Migration build · Review before posting</Badge>
      </CardContent>
    </Card>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(({ label, value, icon: Icon }) => <Card key={label} className="transition-colors hover:border-primary/30">
        <CardContent className="flex items-center justify-between p-4">
          <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</p></div>
          <div className="rounded-lg border border-border bg-muted/70 p-2.5"><Icon className="size-[18px] text-muted-foreground" /></div>
        </CardContent>
      </Card>)}
    </section>

    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <div><h2 className="text-base font-semibold tracking-tight">Operations</h2><p className="mt-1 text-sm text-muted-foreground">Choose a workflow to continue.</p></div>
        <span className="text-xs text-muted-foreground">04 modules</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {modules.map(({ name, desc, href, icon: Icon, status }) => <Card key={href} className="group transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-black/10">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div className="rounded-lg border border-border bg-muted/70 p-2.5"><Icon className="size-[18px] text-foreground" /></div>
            <Badge variant={status === "Core workflow" ? "success" : "secondary"}>{status}</Badge>
          </CardHeader>
          <CardContent>
            <CardTitle className="text-sm">{name}</CardTitle>
            <CardDescription className="mt-2 min-h-10 leading-5">{desc}</CardDescription>
            <Separator className="my-4" />
            <Button asChild variant="outline" className="h-9 w-full justify-between">
              <Link href={href}>Open workflow <ArrowUpRight className="size-4" /></Link>
            </Button>
          </CardContent>
        </Card>)}
      </div>
    </section>

    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-400" />
        <div><p className="text-sm font-semibold">Adjustment safety is built into the workflow</p><p className="mt-1 text-sm leading-5 text-muted-foreground">Stocker generates suggestions and draft files only. It does not post stock adjustments to iTrade. Always verify barcode, quantity, conversion and cost before import.</p></div>
      </CardContent>
    </Card>
  </div>;
}
