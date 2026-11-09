"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { NavItem } from "@/lib/navigation";
import { Icon } from "./icons";

export interface CommandPaletteProps {
  items: NavItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Keyboard-first navigation (⌘K / Ctrl+K). Filtering is client-side over the small
 * set of destinations the current role can reach, so it never leaks hidden routes.
 */
export function CommandPalette({ items, open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      `${item.label} ${item.description} ${item.group}`.toLowerCase().includes(term),
    );
  }, [items, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (activeIndex >= results.length) setActiveIndex(0);
  }, [activeIndex, results.length]);

  if (!open) return null;

  function go(item: NavItem | undefined) {
    if (!item) return;
    onOpenChange(false);
    router.push(item.href);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
      <button
        type="button"
        aria-label="Close command palette"
        className="absolute inset-0 bg-foreground/35 backdrop-blur-[2px]"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-lg overflow-hidden rounded-lg border border-border bg-card shadow-[0_24px_60px_-24px_oklch(0.2_0.02_240/0.5)]"
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Icon name="search" className="text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) => Math.min(index + 1, results.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                go(results[activeIndex]);
              } else if (event.key === "Escape") {
                onOpenChange(false);
              }
            }}
            placeholder="Search pages and actions…"
            aria-label="Search navigation"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            esc
          </kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center text-[13px] text-muted-foreground">
              No matching destination for “{query}”.
            </li>
          ) : (
            results.map((item, index) => (
              <li key={item.href}>
                <button
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => go(item)}
                  className={`flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                    index === activeIndex ? "bg-muted" : "hover:bg-muted/60"
                  }`}
                >
                  <Icon name={item.icon} className="text-muted-foreground" />
                  <span className="flex-1">
                    <span className="block font-medium text-foreground">{item.label}</span>
                    <span className="block text-[12px] text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {item.group}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
