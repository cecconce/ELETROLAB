// Test delle impostazioni e dell'elenco dei file recenti.
import { describe, expect, it } from "vitest";
import {
  aggiungiRecente,
  IMPOSTAZIONI_INIZIALI,
  leggiImpostazioni,
  MASSIMO_RECENTI,
  rimuoviRecente,
  serializzaImpostazioni,
  stessoPercorso,
} from "./impostazioni";

describe("file recenti", () => {
  it("il file aperto per ultimo va in cima, con il nome senza estensione", () => {
    let r = aggiungiRecente([], "C:\\Es\\a.elab", "impianti");
    r = aggiungiRecente(r, "C:\\Es\\b.elab", "plc");
    expect(r).toEqual([
      { nome: "b", percorso: "C:\\Es\\b.elab", modulo: "plc" },
      { nome: "a", percorso: "C:\\Es\\a.elab", modulo: "impianti" },
    ]);
  });

  it("non crea doppioni (maiuscole e barre indifferenti, come su Windows)", () => {
    let r = aggiungiRecente([], "C:\\Es\\a.elab");
    r = aggiungiRecente(r, "C:\\Es\\b.elab");
    r = aggiungiRecente(r, "c:/es/A.elab");
    expect(r.map((x) => x.percorso)).toEqual(["c:/es/A.elab", "C:\\Es\\b.elab"]);
    expect(stessoPercorso("C:\\X\\y.elab", "c:/x/Y.ELAB")).toBe(true);
  });

  it(`ricorda al massimo ${MASSIMO_RECENTI} file`, () => {
    let r = aggiungiRecente([], "f0.elab");
    for (let i = 1; i < 15; i++) r = aggiungiRecente(r, `f${i}.elab`);
    expect(r).toHaveLength(MASSIMO_RECENTI);
    expect(r[0].percorso).toBe("f14.elab");
  });

  it("toglie un file dall'elenco", () => {
    const r = aggiungiRecente(aggiungiRecente([], "a.elab"), "b.elab");
    expect(rimuoviRecente(r, "A.ELAB").map((x) => x.percorso)).toEqual(["b.elab"]);
  });
});

describe("file delle impostazioni", () => {
  it("salvataggio e rilettura", () => {
    const i = { tema: "scuro" as const, recenti: aggiungiRecente([], "C:\\Es\\a.elab", "arduino") };
    expect(leggiImpostazioni(serializzaImpostazioni(i))).toEqual(i);
  });

  it("file mancante o rovinato: valori iniziali, senza errori", () => {
    expect(leggiImpostazioni(null)).toEqual(IMPOSTAZIONI_INIZIALI);
    expect(leggiImpostazioni("")).toEqual(IMPOSTAZIONI_INIZIALI);
    expect(leggiImpostazioni("{rotto")).toEqual(IMPOSTAZIONI_INIZIALI);
    expect(leggiImpostazioni("42")).toEqual(IMPOSTAZIONI_INIZIALI);
  });

  it("scarta voci non valide, tema sconosciuto e modulo sconosciuto", () => {
    const testo = JSON.stringify({
      tema: "viola",
      recenti: [{ percorso: "a.elab", modulo: "cucina" }, { nome: "senza percorso" }, 7, { percorso: "A.elab" }, { percorso: "b.elab", modulo: "plc" }],
    });
    expect(leggiImpostazioni(testo)).toEqual({
      recenti: [
        { nome: "a", percorso: "a.elab" },
        { nome: "b", percorso: "b.elab", modulo: "plc" },
      ],
    });
  });
});
