"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { SessionPayload } from "@vetnex/shared";
import { Badge, Button, cn } from "@vetnex/ui";
import type { NavItem } from "@/lib/navigation";
import { apiRequest, errorMessage } from "@/lib/client-api";
import { Icon, Wordmark } from "./icons";
import { ThemeToggle } from "./theme-toggle";
import { CommandPalette } from "./command-palette";

export interface AppShellProps {
  session: SessionPayload;
  items: NavItem[];
  children: ReactNode;
}

export function AppShell({ session, items, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function signOut() {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await apiRequest("/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setSignOutError(errorMessage(error));
      setSigningOut(false);
    }
  }

  const current = items.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  const groups = Array.from(new Set(items.map((item) => item.group)));

  const sidebar = (
    <div className="flex h-full flex-col gap-6 bg-sidebar px-3 py-4">
      <div className="flex items-center justify-between px-2">
        <Link href="/dashboard" className="text-primary" aria-label="VETNEX home">
          <Wordmark />
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted lg:hidden"
          aria-label="Close navigation"
        >
          <Icon name="close" />
        </button>
      </div>

      <div className="rounded-md border border-border/80 bg-card/70 px-3 py-2.5">
        <p className="truncate text-[13px] font-semibold text-foreground">
          {session.organisation.name}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <Badge tone="info">{session.membership.roleName}</Badge>
          <span className="text-[11px] text-muted-foreground">
            {session.clinics.length}{" "}
            {session.clinics.length === 1 ? "clinic" : "clinics"}
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto" aria-label="Main navigation">
        {groups.map((group) => (
          <div key={group} className="space-y-1">
            <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {group}
            </p>
            {items
              .filter((item) => item.group === group)
              .map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors",
                      active
                        ? "bg-card text-foreground shadow-xs ring-1 ring-border/80"
                        : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                    )}
                  >
                    <Icon
                      name={item.icon}
                      className={active ? "text-primary" : "text-muted-foreground"}
                    />
                    {item.label}
                  </Link>
                );
              })}
          </div>
        ))}
      </nav>

      <div className="space-y-2 border-t border-border/70 pt-3">
        <div className="px-2">
          <p className="truncate text-[13px] font-medium text-foreground">{session.user.fullName}</p>
          <p className="truncate text-[11px] text-muted-foreground">{session.user.email}</p>
        </div>
        {signOutError ? (
          <p className="px-2 text-[11px] text-destructive" role="alert">
            {signOutError}
          </p>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={signOut}
          loading={signingOut}
          leadingIcon={<Icon name="logout" />}
        >
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh border-r border-border lg:block">{sidebar}</aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-foreground/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative h-full w-[17rem] border-r border-border shadow-lg">{sidebar}</div>
        </div>
      ) : null}

      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Icon name="menu" />
          </Button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-foreground">
              {current?.label ?? "VETNEX"}
            </p>
            <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
              {session.organisation.name} · {session.organisation.timezone.replace("_", " ")}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="hidden items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-[12px] text-muted-foreground shadow-xs transition-colors hover:bg-muted sm:flex"
          >
            <Icon name="search" size={15} />
            Search
            <kbd className="ml-6 rounded border border-border px-1 py-0.5 text-[10px]">⌘K</kbd>
          </button>

          <ThemeToggle />
        </header>

        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-8">
          {children}
        </main>

        <footer className="border-t border-border px-4 py-3 text-[11px] text-muted-foreground sm:px-6">
          VETNEX development build · Australian English · All clinical content requires clinician
          review
        </footer>
      </div>

      <CommandPalette items={items} open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
