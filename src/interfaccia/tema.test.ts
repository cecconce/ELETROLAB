// Test della logica del tema chiaro/scuro.
import { describe, expect, it } from "vitest";
import { CHIAVE_TEMA, alternaTema, interpretaTema, leggiTemaSalvato, salvaTema, temaIniziale } from "./tema";

function archivioFinto() {
  const dati = new Map<string, string>();
  return {
    dati,
    getItem: (k: string) => dati.get(k) ?? null,
    setItem: (k: string, v: string) => void dati.set(k, v),
  };
}

describe("tema", () => {
  it("riconosce solo i valori validi", () => {
    expect(interpretaTema("chiaro")).toBe("chiaro");
    expect(interpretaTema("scuro")).toBe("scuro");
    expect(interpretaTema("viola")).toBeNull();
    expect(interpretaTema(null)).toBeNull();
  });

  it("all'avvio la scelta salvata vince sull'impostazione di sistema", () => {
    expect(temaIniziale("chiaro", true)).toBe("chiaro");
    expect(temaIniziale("scuro", false)).toBe("scuro");
  });

  it("senza scelta salvata segue il sistema", () => {
    expect(temaIniziale(null, true)).toBe("scuro");
    expect(temaIniziale(null, false)).toBe("chiaro");
    expect(temaIniziale("valore-rotto", true)).toBe("scuro");
  });

  it("alterna tra chiaro e scuro", () => {
    expect(alternaTema("chiaro")).toBe("scuro");
    expect(alternaTema(alternaTema("chiaro"))).toBe("chiaro");
  });

  it("salva e rilegge il tema", () => {
    const a = archivioFinto();
    salvaTema(a, "scuro");
    expect(a.dati.get(CHIAVE_TEMA)).toBe("scuro");
    expect(leggiTemaSalvato(a)).toBe("scuro");
  });

  it("non si blocca se l'archivio manca o genera errori", () => {
    const rotto = {
      getItem: () => {
        throw new Error("bloccato");
      },
      setItem: () => {
        throw new Error("bloccato");
      },
    };
    expect(leggiTemaSalvato(undefined)).toBeNull();
    expect(leggiTemaSalvato(rotto)).toBeNull();
    expect(() => salvaTema(rotto, "chiaro")).not.toThrow();
    expect(() => salvaTema(undefined, "chiaro")).not.toThrow();
  });
});
