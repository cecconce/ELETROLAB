// Nell'.exe (WebView di Tauri 2) window.confirm / alert / prompt non sono
// affidabili: le domande all'utente devono passare da `archivio.conferma`
// (finestra di Tauri). Solo l'archivio di prova per il browser può usarli.
// Questo test ha ritrovato il problema che impediva di passare dai blocchi
// al codice nel modulo Arduino (Fase 10).
import { describe, expect, it } from "vitest";

// Testo di tutti i sorgenti dell'interfaccia (Vite li legge come stringhe).
const sorgenti = import.meta.glob(["../**/*.ts", "../**/*.tsx", "!../**/*.test.ts", "!../**/*.test.tsx"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

describe("finestre di dialogo", () => {
  it("legge davvero i sorgenti", () => {
    expect(Object.keys(sorgenti).some((f) => f.endsWith("PannelloCodice.tsx"))).toBe(true);
  });

  it("nessun window.confirm/alert/prompt fuori dall'archivio di prova del browser", () => {
    const colpevoli = Object.entries(sorgenti)
      .filter(([f]) => !f.endsWith("progetto/archivio.ts"))
      .filter(([, testo]) => /window\.(confirm|alert|prompt)\s*\(/.test(testo))
      .map(([f]) => f);
    expect(colpevoli).toEqual([]);
  });
});
