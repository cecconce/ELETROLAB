/// <reference types="vitest" />
// Configurazione di Vite (sviluppo e build dell'interfaccia) e di Vitest (test).
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Percorsi relativi: l'app viene caricata da Tauri come file locali.
  base: "./",
  // Porta fissa richiesta da Tauri in modalità sviluppo.
  server: { port: 1420, strictPort: true },
  clearScreen: false,
  build: {
    // WebView2 su Windows 10 supporta ES2021.
    target: "es2021",
    outDir: "dist",
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "test/**/*.test.ts"],
  },
});
