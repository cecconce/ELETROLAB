// Controlla che ogni chiave t("...") usata nel codice esista in lingue/it.json:
// così non compaiono mai chiavi grezze nell'interfaccia.
import { describe, expect, it } from "vitest";
import it_json from "../lingue/it.json";

const sorgenti = import.meta.glob("../src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;

describe("testi dell'interfaccia", () => {
  it("tutte le chiavi usate nel codice sono presenti in it.json", () => {
    expect(Object.keys(sorgenti).length).toBeGreaterThan(3);
    const mancanti: string[] = [];
    for (const [file, codice] of Object.entries(sorgenti)) {
      if (file.includes(".test.")) continue;
      // Chiavi letterali in t("...") e nei campi chiaveTitolo/chiaveDescrizione.
      const espressioni = /(?:\bt\(|chiave\w*:\s*)"([a-zA-Z0-9_.]+)"/g;
      for (const m of codice.matchAll(espressioni)) {
        if (!(m[1] in it_json)) mancanti.push(`${file}: ${m[1]}`);
      }
    }
    expect(mancanti).toEqual([]);
  });
});
