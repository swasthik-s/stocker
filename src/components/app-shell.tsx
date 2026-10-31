"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  ChartNoAxesCombined,
  ClipboardList,
  FileText,
  History,
  LayoutDashboard,
  Settings,
  PackageSearch,
  PanelLeftClose,
  PanelLeftOpen,
  Command,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  Icon: LucideIcon;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const nav: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { label: "Overview", href: "/", Icon: LayoutDashboard },
      { label: "Negative stock", href: "/negative-stock", Icon: PackageSearch },
      { label: "Master audit", href: "/master-audit", Icon: ChartNoAxesCombined },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "PDF tools", href: "/pdf-tools", Icon: FileText },
      { label: "Item templates", href: "/templates", Icon: ClipboardList },
      { label: "History", href: "/history", Icon: History },
    ],
  },
  {
    label: "System",
    items: [{ label: "Settings", href: "/settings", Icon: Settings }],
  },
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
    nav.flatMap((group) => group.items).find((item) => item.href === path)?.label ??
    "Workspace";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r bg-card transition-all lg:flex lg:flex-col",
          collapsed ? "w-[76px]" : "w-[248px]",
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b px-5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Boxes className="size-5" />
          </div>
          {!collapsed && (
            <div>
              <p className="font-semibold tracking-tight">Stocker</p>
              <p className="text-[11px] text-muted-foreground">INVENTORY OPERATIONS</p>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-7 overflow-y-auto px-3 py-6">
          {nav.map((group) => (
            <div key={group.label}>
              <p
                className={cn(
                  "mb-2 px-3 text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground",
                  collapsed && "sr-only",
                )}
              >
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map(({ label, href, Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    title={collapsed ? label : undefined}
                    className={cn(
                      "flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                      path === href
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      collapsed && "justify-center px-0",
                    )}
                  >
                    <Icon className="size-[18px] shrink-0" />
                    {!collapsed && label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t p-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-md text-xs text-muted-foreground hover:bg-muted"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <>
                <PanelLeftClose className="size-4" />
                Collapse sidebar
              </>
            )}
          </button>
        </div>
      </aside>

      <div
        className={cn(
          "min-h-screen transition-[padding] lg:pl-[248px]",
          collapsed && "lg:pl-[76px]",
        )}
      >
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/90 px-5 backdrop-blur md:px-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Command className="size-4" />
            <span>Al Madina</span>
            <span>/</span>
            <span className="font-medium text-foreground">{activePage}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Inventory workspace
            </span>
            {showToken ? (
              <>
                <input
                  type="password"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="STOCKER_API_TOKEN"
                  className="h-8 w-40 rounded-md border bg-background px-2 text-xs"
                />
                <button
                  onClick={connect}
                  className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground"
                >
                  Connect
                </button>
                <button
                  onClick={() => setShowToken(false)}
                  className="text-xs text-muted-foreground"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => (token ? disconnect() : setShowToken(true))}
                className="h-8 rounded-md border px-3 text-xs"
              >
                {token ? "API connected · Disconnect" : "Connect API"}
              </button>
            )}
            <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              SS
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
