import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "VISION Stock Scout", short_name: "Stock Scout", description: "Scoring y análisis fundamental con cobertura visible.", start_url: "/", display: "standalone", background_color: "#f6f7f5", theme_color: "#173b35", lang: "es", icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }] };
}
