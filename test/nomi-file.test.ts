// Su Windows i nomi dei file non distinguono maiuscole e minuscole: due file
// come «PlotterSeriale.tsx» e «plotterSeriale.ts» si confondono e la build
// dell'.exe si rompe (in Linux invece funziona). Questo test lo impedisce.
import { describe, expect, it } from "vitest";

// Elenco dei file (i moduli non vengono caricati: servono solo i nomi).
const FILE = Object.keys(import.meta.glob(["../src/**/*", "../libreria/**/*", "../esempi/*", "../lingue/*"]));

describe("nomi dei file", () => {
  it("nessun file o modulo differisce da un altro solo per maiuscole e minuscole", () => {
    const visti = new Map<string, string>();
    const doppi: string[] = [];
    for (const f of FILE) {
      // Un import senza estensione ("./PlotterSeriale") trova sia .ts sia .tsx: si confronta senza.
      const senza = f.replace(/\.(tsx?|json|svg|elab|css)$/, "");
      const altro = visti.get(senza.toLowerCase());
      if (altro !== undefined && altro !== senza) doppi.push(`${altro} / ${f}`);
      else visti.set(senza.toLowerCase(), senza);
    }
    expect(FILE.length).toBeGreaterThan(100);
    expect(doppi).toEqual([]);
  });
});
