"use client";

import { useEffect, useState } from "react";
import { Button } from "@vetnex/ui";
import { Icon } from "./icons";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("vetnex-theme", next);
    } catch {
      // Storage can be blocked; the toggle still applies for this session.
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={mounted && theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title="Toggle theme"
    >
      <Icon name={mounted && theme === "dark" ? "sun" : "moon"} />
    </Button>
  );
}
