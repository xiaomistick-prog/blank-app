import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "VISION · Stock Scout", template: "%s · VISION" },
  description: "Explora y compara acciones por valoración, calidad y solidez. Fechas y cobertura visibles en cada análisis.",
  applicationName: "VISION Stock Scout",
  appleWebApp: { capable: true, title: "Stock Scout", statusBarStyle: "default" },
  icons: { icon: "/icon.svg" }
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#173b35" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
