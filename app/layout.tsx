import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorker from "@/components/service-worker";

export const metadata: Metadata = {
  title: "RUN",
  description: "Mobile-first training planner",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "RUN" },
  icons: { icon: "/icon-192.png", apple: "/icon-192.png" },
};
export const viewport: Viewport = {
  width: "device-width", initialScale: 1, viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f7f7f5" }, { media: "(prefers-color-scheme: dark)", color: "#09090b" }],
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><ServiceWorker />{children}</body></html>;
}
