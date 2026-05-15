import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { execSync } from "child_process";
import pkg from "./package.json";

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
              cacheName: "hf-models-v1",
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
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
