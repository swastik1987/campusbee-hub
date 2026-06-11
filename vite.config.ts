import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      // "prompt" + our own toast: users on installed PWAs otherwise stay on
      // stale bundles for weeks because the app shell never hard-reloads.
      registerType: "prompt",
      includeAssets: [
        "favicon.ico",
        "logo-icon.png",
        "logo-full.png",
        "apple-touch-icon.png",
        "robots.txt",
      ],
      manifest: {
        name: "CampusBee — Classes Near You",
        short_name: "CampusBee",
        description:
          "Discover sports, dance, arts, music & academic classes near your home. Free trials, real local reviews, verified instructors.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#F59E0B",
        background_color: "#F8FAFC",
        lang: "en-IN",
        categories: ["education", "lifestyle"],
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/pwa-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // SPA deep links (e.g. /class/:id) must resolve to the app shell
        // when launched offline or from the home screen.
        navigateFallback: "/index.html",
        // Never let the SPA fallback swallow Supabase auth callbacks or
        // any non-app asset paths.
        navigateFallbackDenylist: [/^\/auth\/v1\//, /\.[a-z0-9]+$/i],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Main bundle is currently ~2.5 MB (no route-level code splitting
        // yet); allow it into the precache so the app shell works offline.
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // Supabase (auth, RLS-scoped data, Realtime) is intentionally NOT
        // runtime-cached — stale tokens/data must never be served. Only
        // immutable-ish media below gets cached.
        runtimeCaching: [
          {
            // Class covers / avatars / banners served from Supabase storage
            // are content-addressed-ish uploads; cache-first with expiry.
            urlPattern: /^https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "supabase-public-media",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Mappls JS SDK + tiles
            urlPattern: /^https:\/\/apis\.mappls\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "mappls-sdk",
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
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
