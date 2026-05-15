import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { execSync } from "child_process";
import pkg from "./package.json";
import { seoConfig } from "./src/seo/seoConfig";

// Build-time version: package.json version + short git SHA.
// Fallback gracefully if git is unavailable (e.g. CI without history).
const gitSha = (() => {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
})();
const buildVersion = `${pkg.version}+${gitSha}`;

const SITE_ORIGIN = "https://voice-tally.app.scot";

// HTML-escape a string for safe interpolation into the static fallback.
const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Build a JSON-LD WebApplication blob for a given SEO route. Mirrors the
// runtime SEOContext output so JS and no-JS crawlers see the same schema.
function jsonLdFor(cfg: { h1: string; description: string; canonical: string }) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: cfg.h1,
    alternateName: "Voice Tally",
    url: cfg.canonical,
    description: cfg.description,
    applicationCategory: "UtilityApplication",
    operatingSystem: "Web, Android, iOS",
    browserRequirements: "Requires JavaScript and a modern browser",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: [
      "Real-time voice recognition",
      "Multi-word simultaneous counting",
      "Offline on-device ASR (Vosk, Whisper, Moonshine)",
      "Undo/redo with full history",
      "Custom homophones per word",
      "Free, no signup",
    ],
  });
}

// Transforms the built dist/index.html (a fully-hydrating SPA shell) into a
// per-route variant: route-specific <title>, meta tags, canonical, JSON-LD,
// and a <noscript>-visible content block. JS-capable crawlers and humans get
// the SPA; no-JS crawlers (Bing/Yandex/DDG bot, social previewers, Linear
// preview cards, etc.) see meaningful content + an h1 matching the route.
function transformIndexHtml(
  html: string,
  cfg: { title: string; h1: string; subtitle: string; description: string; keywords: string; canonical: string },
): string {
  // Inject route-specific <head> tags (idempotent: replaces if already present)
  const headInjections = [
    `<title>${esc(cfg.title)}</title>`,
    `<meta name="description" content="${esc(cfg.description)}" />`,
    `<meta name="keywords" content="${esc(cfg.keywords)}" />`,
    `<link rel="canonical" href="${esc(cfg.canonical)}" />`,
    `<meta property="og:title" content="${esc(cfg.title)}" />`,
    `<meta property="og:description" content="${esc(cfg.description)}" />`,
    `<meta property="og:url" content="${esc(cfg.canonical)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(cfg.title)}" />`,
    `<meta name="twitter:description" content="${esc(cfg.description)}" />`,
    `<script type="application/ld+json">${jsonLdFor(cfg)}</script>`,
  ].join("\n    ");

  // Remove the original boilerplate title + description + og tags so the
  // route-specific ones aren't shadowed by stale defaults. Strip HTML
  // comments first — otherwise a comment that mentions "<title>" would be
  // consumed by the title regex below.
  let out = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\s+name="description"[^>]*>/gi, "")
    .replace(/<meta\s+name="keywords"[^>]*>/gi, "")
    .replace(/<meta\s+property="og:[^"]+"[^>]*>/gi, "")
    .replace(/<meta\s+name="twitter:[^"]+"[^>]*>/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*>/gi, "")
    .replace(/<script\s+type="application\/ld\+json"[\s\S]*?<\/script>/gi, "");

  out = out.replace("</head>", `    ${headInjections}\n  </head>`);

  // Build a noscript fallback. Each variant lists every other variant so
  // non-JS crawlers can traverse the whole topical cluster from any URL.
  const otherLinks = Object.entries(seoConfig)
    .filter(([, v]) => v.canonical !== cfg.canonical)
    .map(([, v]) => `<li><a href="${esc(v.canonical)}">${esc(v.h1)}</a></li>`)
    .join("");

  const noscript = `
<noscript>
  <main>
    <h1>${esc(cfg.h1)}</h1>
    <p>${esc(cfg.subtitle)}</p>
    <p>${esc(cfg.description)}</p>
    <h2>Features</h2>
    <ul>
      <li>Real-time voice recognition — hands-free counting as you speak</li>
      <li>Multi-word simultaneous counting with custom homophones</li>
      <li>Offline, on-device ASR engines (Vosk, Whisper, Moonshine)</li>
      <li>Undo/redo with full history and exportable logs</li>
      <li>Free, no signup, installable as a PWA or Android app</li>
    </ul>
    <h2>Related counters</h2>
    <ul>${otherLinks}</ul>
    <p><em>This site requires JavaScript to run. Enable JavaScript or use the static info above.</em></p>
  </main>
</noscript>
`.trim();

  out = out.replace('<div id="root"></div>', `<div id="root"></div>\n    ${noscript}`);
  return out;
}

// Vite plugin: after the main bundle is written, emit one HTML file per SEO
// route plus a sitemap.xml. Also rewrites the root dist/index.html with the
// homepage SEO config so it's not shipped with the boilerplate Lovable meta.
function seoPrerenderPlugin(): Plugin {
  return {
    name: "seo-prerender",
    apply: "build",
    enforce: "post",
    closeBundle() {
      const distDir = path.resolve(__dirname, "dist");
      const indexPath = path.join(distDir, "index.html");
      if (!fs.existsSync(indexPath)) return;
      const indexHtml = fs.readFileSync(indexPath, "utf8");

      // Per-route variant pages (skip "/" — handled separately below)
      for (const [route, cfg] of Object.entries(seoConfig)) {
        if (route === "/") continue;
        const slug = route.replace(/^\//, "");
        const outDir = path.join(distDir, slug);
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, "index.html"), transformIndexHtml(indexHtml, cfg));
      }

      // Overwrite the root index.html with homepage SEO (replaces Lovable boilerplate)
      fs.writeFileSync(indexPath, transformIndexHtml(indexHtml, seoConfig["/"]));

      // sitemap.xml — list every SEO route. Lastmod = build time.
      const now = new Date().toISOString().slice(0, 10);
      const urls = Object.values(seoConfig)
        .map(
          (cfg) =>
            `  <url><loc>${cfg.canonical}</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq><priority>${cfg.canonical.endsWith("//") || cfg.canonical === SITE_ORIGIN + "/" ? "1.0" : "0.8"}</priority></url>`,
        )
        .join("\n");
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
      fs.writeFileSync(path.join(distDir, "sitemap.xml"), sitemap);

      // robots.txt — append Sitemap URL if missing. Always allow crawl.
      const robotsPath = path.join(distDir, "robots.txt");
      let robots = fs.existsSync(robotsPath) ? fs.readFileSync(robotsPath, "utf8") : "User-agent: *\nAllow: /\n";
      if (!robots.includes("Sitemap:")) {
        robots = robots.trimEnd() + `\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`;
      }
      fs.writeFileSync(robotsPath, robots);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  define: {
    __APP_VERSION__: JSON.stringify(buildVersion),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["favicon.ico", "robots.txt", "placeholder.svg"],
      manifest: {
        name: "Voice Tally Counter",
        short_name: "Voice Tally",
        description:
          "Speech recognition word counter with offline ASR engines.",
        theme_color: "#3b82f6",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "favicon.ico",
            sizes: "64x64 32x32 24x24 16x16",
            type: "image/x-icon",
          },
        ],
      },
      workbox: {
        // Models are large — bump cache limit to 200MB so the app shell can
        // include the SW + the engines' WASM. Individual model weights are
        // cached at runtime via runtimeCaching below, not precached.
        maximumFileSizeToCacheInBytes: 200 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,wasm}"],
        runtimeCaching: [
          // Vosk models (small-en) hosted on the maintainer's GitHub Pages
          {
            urlPattern: ({ url }) =>
              url.hostname === "ccoreilly.github.io" &&
              url.pathname.includes("/vosk-browser/models/"),
            handler: "CacheFirst",
            options: {
              cacheName: "vosk-models-v1",
              expiration: {
                maxEntries: 4,
                maxAgeSeconds: 60 * 60 * 24 * 90,
              },
              cacheableResponse: { statuses: [0, 200] },
              rangeRequests: true,
            },
          },
          // HuggingFace ONNX model weights (Whisper, Moonshine)
          {
            urlPattern: ({ url }) =>
              url.hostname === "huggingface.co" ||
              url.hostname === "cdn-lfs.huggingface.co" ||
              url.hostname === "cdn-lfs-us-1.huggingface.co" ||
              url.hostname.endsWith(".huggingface.co"),
            handler: "CacheFirst",
            options: {
              cacheName: "hf-models-v2-fp32",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 90,
              },
              cacheableResponse: { statuses: [0, 200] },
              rangeRequests: true,
            },
          },
        ],
      },
    }),
    seoPrerenderPlugin(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
