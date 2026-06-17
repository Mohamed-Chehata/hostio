import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === "font" || request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "hostrack-static-assets",
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ]
      },
      manifest: {
        name: "Hostrack Property Manager",
        short_name: "Hostrack",
        description: "Hostrack keeps short-term rental properties, bookings, and expenses organized.",
        theme_color: "#080A0C",
        background_color: "#080A0C",
        display: "standalone",
        start_url: "/app",
        scope: "/app",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" }
        ]
      }
    })
  ]
});
