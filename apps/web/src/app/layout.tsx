import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: {
    default: "VETNEX — veterinary practice platform",
    template: "%s · VETNEX",
  },
  description:
    "VETNEX is a cloud-first veterinary practice platform: clinical records, scheduling, billing and team administration in one place.",
  applicationName: "VETNEX",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#1c2126" },
  ],
  width: "device-width",
  initialScale: 1,
};

// Applies the stored theme before first paint so there is no flash of the wrong theme.
const themeScript = `(function(){try{var stored=localStorage.getItem("vetnex-theme");var dark=stored?stored==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(dark){document.documentElement.classList.add("dark");}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
