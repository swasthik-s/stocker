"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes, ChartNoAxesCombined, ClipboardList, FileText, History, LayoutDashboard,
  Settings, PackageSearch, PanelLeftClose, PanelLeftOpen, Command, type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

type NavItem = { label: string; href: string; Icon: LucideIcon };
type NavGroup = { label: string; items: NavItem[] };

const nav: NavGroup[] = [
  { label: "Workspace", items: [
    { label: "Overview", href: "/", Icon: LayoutDashboard },
    { label: "Negative stock", href: "/negative-stock", Icon: PackageSearch },
    { label: "Master audit", href: "/master-audit", Icon: ChartNoAxesCombined },
  ]},
  { label: "Operations", items: [
    { label: "PDF tools", href: "/pdf-tools", Icon: FileText },
    { label: "Item templates", href: "/templates", Icon: ClipboardList },
    { label: "History", href: "/history", Icon: History },
  ]},
  { label: "System", items: [{ label: "Settings", href: "/settings", Icon: Settings }]},
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [token, setToken] = useState("");
  const [draft, setDraft] = useState("");
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem("stocker-api-token") ?? "";
    setToken(saved);
    setDraft(saved);
  }, []);

  async function connect() {
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: draft }),
      });
      if (!response.ok) throw new Error("Invalid API token");
      sessionStorage.setItem("stocker-api-token", draft);
      setToken(draft);
      setShowToken(false);
    } catch {
      sessionStorage.removeItem("stocker-api-token");
      setToken("");
      alert("API token rejected. Check STOCKER_API_TOKEN in Vercel.");
    }
  }

  function disconnect() {
    sessionStorage.removeItem("stocker-api-token");
    setToken("");
    setDraft("");
  }

  const activePage =
    nav.flatMap((group) => group.items).find((item) => item.href === path)?.label ?? "Workspace";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 hidden border-r border-border bg-card lg:flex lg:flex-col",
        "transition-[width] duration-200", collapsed ? "w-[72px]" : "w-[248px]",
      )}>
        <div className="flex h-16 shrink-0 items-center gap-3 px-4">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Boxes className="size-5" />
          </div>
          {!collapsed && <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight">Stocker</p>
            <p className="text-[10px] font-medium tracking-[.14em] text-muted-foreground">INVENTORY OPERATIONS</p>
          </div>}
        </div>
        <Separator />
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {nav.map((group) => <section key={group.label} className="space-y-2">
            {!collapsed && <p className="px-2 text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">{group.label}</p>}
            <div className="space-y-1">
              {group.items.map(({ label, href, Icon }) => <Button
                key={href}
                asChild
                variant={path === href ? "secondary" : "ghost"}
                className={cn("h-9 w-full justify-start gap-3 px-2.5 text-[13px]", path === href && "font-semibold text-foreground", collapsed && "justify-center px-0")}
              >
                <Link href={href} title={collapsed ? label : undefined}>
                  <Icon className="size-4 shrink-0" />
                  {!collapsed && <span>{label}</span>}
                </Link>
              </Button>)}
            </div>
          </section>)}
        </nav>
        <Separator />
        <div className="p-3">
          <Button variant="ghost" size={collapsed ? "icon" : "sm"} className="w-full gap-2 text-muted-foreground" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <PanelLeftOpen className="size-4" /> : <><PanelLeftClose className="size-4" /> Collapse sidebar</>}
          </Button>
        </div>
      </aside>

      <div className={cn("min-h-screen transition-[padding] duration-200 lg:pl-[248px]", collapsed && "lg:pl-[72px]")}>
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur-xl md:px-7">
          <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
            <Command className="size-4 shrink-0" />
            <span className="hidden sm:inline">Al Madina</span>
            <span className="hidden sm:inline text-muted-foreground/50">/</span>
            <span className="truncate font-medium text-foreground">{activePage}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground xl:inline">Inventory workspace</span>
            {showToken ? <>
              <Input type="password" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="STOCKER_API_TOKEN" className="h-9 w-44 text-xs" />
              <Button size="sm" onClick={connect}>Connect</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowToken(false)}>Cancel</Button>
            </> : <Button size="sm" variant={token ? "secondary" : "outline"} onClick={() => token ? disconnect() : setShowToken(true)}>
              {token ? <><span className="size-1.5 rounded-full bg-emerald-400" /> API connected · Disconnect</> : "Connect API"}
            </Button>}
            <div className="ml-1 flex size-8 items-center justify-center rounded-full border border-border bg-muted text-[11px] font-semibold text-muted-foreground">SS</div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] p-4 md:p-7">{children}</main>
      </div>
    </div>
  );
}
