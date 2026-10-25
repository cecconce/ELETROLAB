// Controlli sulla finestra "Informazioni" e su LICENZE.txt: l'elenco delle
// librerie deve corrispondere alle dipendenze vere del programma, e ogni
// libreria inclusa deve avere una licenza compatibile con la GPL-3.0.
import { describe, expect, it } from "vitest";
import pacchetto from "../package.json";
import lock from "../package-lock.json";
import cargoToml from "../src-tauri/Cargo.toml?raw";
import licenze from "../LICENZE.txt?raw";
import { LIBRERIE, licenzaCompatibile, istitutoDaMostrare } from "../src/informazioni/dati";

/** Nomi dei crate nella sezione [dependencies] o [build-dependencies] di Cargo.toml. */
function crateDichiarati(toml: string): string[] {
  const nomi: string[] = [];
  let inSezione = false;
  for (const riga of toml.split(/\r?\n/)) {
    const sezione = riga.match(/^\s*\[(.+)\]\s*$/);
    if (sezione) {
      inSezione = sezione[1] === "dependencies" || sezione[1] === "build-dependencies";
      continue;
    }
    const dip = riga.match(/^\s*([A-Za-z0-9_-]+)\s*=/);
    if (inSezione && dip) nomi.push(dip[1]);
  }
  return nomi;
}

const pacchettiElencati = new Set(LIBRERIE.flatMap((l) => l.npm ?? []));
const crateElencati = new Set(LIBRERIE.flatMap((l) => l.crate ?? []));

describe("elenco delle librerie", () => {
  it("ogni dipendenza npm del programma compare nella finestra Informazioni", () => {
    const mancanti = Object.keys(pacchetto.dependencies).filter((n) => !pacchettiElencati.has(n));
    expect(mancanti).toEqual([]);
  });

  it("ogni crate Rust dichiarato compare nella finestra Informazioni", () => {
    const crate = crateDichiarati(cargoToml);
    expect(crate).toContain("tauri");
    expect(crate.filter((n) => !crateElencati.has(n))).toEqual([]);
  });

  it("ogni libreria è riportata in LICENZE.txt con la sua licenza", () => {
    for (const l of LIBRERIE) {
      const riga = licenze.split(/\r?\n/).find((r) => r.startsWith(l.nome));
      expect(riga, `manca ${l.nome} in LICENZE.txt`).toBeDefined();
      expect(riga).toContain(l.licenza);
    }
    expect(licenze).toContain("Permission is hereby granted");
    expect(licenze).toContain("Apache License");
  });

  it("tutte le licenze elencate sono compatibili con la GPL-3.0", () => {
    for (const l of LIBRERIE) expect(licenzaCompatibile(l.licenza), l.nome).toBe(true);
  });

  it("anche le dipendenze indirette incluse nell'interfaccia hanno licenze compatibili", () => {
    const voci = Object.entries(lock.packages as Record<string, { dev?: boolean; license?: string }>).filter(
      ([percorso, info]) => percorso !== "" && !info.dev,
    );
    expect(voci.length).toBeGreaterThan(5);
    const problemi = voci
      .filter(([, info]) => !info.license || !licenzaCompatibile(info.license))
      .map(([percorso, info]) => `${percorso}: ${info.license ?? "licenza non indicata"}`);
    expect(problemi).toEqual([]);
  });
});

describe("controllo delle licenze", () => {
  it("riconosce le licenze permissive, anche come alternative SPDX", () => {
    expect(licenzaCompatibile("MIT")).toBe(true);
    expect(licenzaCompatibile("MIT/Apache-2.0")).toBe(true);
    expect(licenzaCompatibile("(MIT OR Apache-2.0)")).toBe(true);
    expect(licenzaCompatibile("Apache-2.0 OR MIT")).toBe(true);
  });

  it("rifiuta licenze non adatte o sconosciute", () => {
    expect(licenzaCompatibile("Proprietaria")).toBe(false);
    expect(licenzaCompatibile("CC-BY-NC-4.0")).toBe(false);
    expect(licenzaCompatibile("")).toBe(false);
  });
});

describe("istituto", () => {
  it("usa la dicitura neutra finché il nome non è indicato", () => {
    expect(istitutoDaMostrare("", "Istituto tecnico")).toBe("Istituto tecnico");
    expect(istitutoDaMostrare("   ", "Istituto tecnico")).toBe("Istituto tecnico");
    expect(istitutoDaMostrare(" ITIS Esempio ", "Istituto tecnico")).toBe("ITIS Esempio");
  });
});
