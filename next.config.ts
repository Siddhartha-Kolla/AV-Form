import type { NextConfig } from "next";

/*
  Sicherheitsköpfe für alle Seiten. Die Content-Security-Policy ist bewusst schmal gehalten:
  Sie verbietet das Einbetten in fremde Seiten (Clickjacking), fremde Formularziele, Plug-ins und das
  Nachladen von Bildern aus dem Netz. Letzteres schützt das Team davor, dass ein hochgeladenes Dokument
  beim Ansehen ein Bild von einem fremden Server holt und so die Adresse des Betrachters verrät.
  Skripte schränkt sie nicht ein, weil Next.js dafür Nonces bräuchte.
*/
const SICHERHEITSKOEPFE = [
  {
    key: "Content-Security-Policy",
    value: ["base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'", "object-src 'none'", "img-src 'self' blob: data:"].join("; "),
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Nur im Betrieb, wo es HTTPS gibt. Browser merken sich dann, die Seite nie unverschlüsselt zu öffnen.
  ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
];

const nextConfig: NextConfig = {
  /* config options here */
  async headers() {
    return [{ source: "/:path*", headers: SICHERHEITSKOEPFE }];
  },
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
