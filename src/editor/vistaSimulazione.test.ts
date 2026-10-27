// Test dell'attività 2.5: aspetto dello schema durante la simulazione.
import { describe, expect, it } from "vitest";
import { avviaSessione, clicGiu } from "../motori/impianti";
import { coloriEditor } from "./colori";
import { coloreFilo, firmaVista, formattaTempo, tipoUtilizzatore, trattiDelContatto, vistaDaSessione } from "./vistaSimulazione";
import type { ComponenteSchema, Filo, Schema } from "./schema";

const comp = (id: string, tipo: string, etichetta = id): ComponenteSchema => ({
  id,
  tipo,
  etichetta,
  x: 0,
  y: 0,
  larghezza: 40,
  altezza: 40,
});
const filo = (id: string, da: string, a: string): Filo => {
  const [c1, m1] = da.split(":");
  const [c2, m2] = a.split(":");
  return { id, da: { componente: c1, morsetto: m1 }, a: { componente: c2, morsetto: m2 } };
};

/** Rete → pulsante S1 → lampada H1 → neutro. */
const schema: Schema = {
  componenti: [comp("RM", "rete-monofase", ""), comp("S1", "pulsante-na"), comp("H1", "lampada")],
  fili: [filo("f1", "RM:L", "S1:13"), filo("f2", "S1:14", "H1:X1"), filo("f3", "H1:X2", "RM:N")],
};

describe("aspetto dello schema in simulazione", () => {
  it("a riposo: solo i fili collegati direttamente alla rete sono in tensione", () => {
    const v = vistaDaSessione(avviaSessione(schema), schema.fili);
    expect(v.poliDeiFili).toEqual({ f1: ["L1"], f2: [], f3: ["N"] });
    expect(v.componenti.S1).toMatchObject({ clic: "pulsante", chiuso: false, azionato: false });
    expect(v.componenti.H1).toMatchObject({ clic: null, alimentato: false });
    expect(v.morsettiInCorto.size).toBe(0);
  });

  it("con il pulsante premuto il contatto è chiuso, il filo è in tensione e la lampada accesa", () => {
    const v = vistaDaSessione(clicGiu(avviaSessione(schema), "S1"), schema.fili);
    expect(v.poliDeiFili.f2).toEqual(["L1"]);
    expect(v.componenti.S1).toMatchObject({ chiuso: true, azionato: true });
    expect(v.componenti.H1.alimentato).toBe(true);
  });

  it("i morsetti in cortocircuito vengono segnalati", () => {
    const corto: Schema = { componenti: [comp("RM", "rete-monofase", "")], fili: [filo("f1", "RM:L", "RM:N")] };
    const v = vistaDaSessione(avviaSessione(corto), corto.fili);
    expect([...v.morsettiInCorto].sort()).toEqual(["RM:L", "RM:N"]);
    expect(v.poliDeiFili.f1.sort()).toEqual(["L1", "N"]);
  });

  it("motore che gira: verso nel suo aspetto", () => {
    const m: Schema = {
      componenti: [comp("RT", "rete-trifase", ""), comp("M1", "motore-trifase")],
      fili: [filo("a", "RT:L1", "M1:U"), filo("b", "RT:L2", "M1:V"), filo("c", "RT:L3", "M1:W")],
    };
    const v = vistaDaSessione(avviaSessione(m), m.fili);
    expect(v.componenti.M1.motore).toEqual({ verso: "orario" });
    expect(v.componenti.M1.clic).toBe("motore");
  });

  it("la firma cambia solo quando cambia qualcosa di visibile", () => {
    const a = vistaDaSessione(avviaSessione(schema), schema.fili);
    const b = { ...a, tempo: 12 };
    expect(firmaVista(a)).toBe(firmaVista(b));
    const c = vistaDaSessione(clicGiu(avviaSessione(schema), "S1"), schema.fili);
    expect(firmaVista(a)).not.toBe(firmaVista(c));
  });
});

describe("colori e simboli", () => {
  const colori = coloriEditor("chiaro");
  it("colore dei fili secondo il polo", () => {
    expect(coloreFilo([], colori)).toBeNull();
    expect(coloreFilo(["L1"], colori)).toBe(colori.tensione.L1);
    expect(coloreFilo(["N"], colori)).toBe(colori.tensione.N);
    expect(coloreFilo(["L1", "N"], colori)).toBe(colori.corto);
    // Ogni fase ha un colore diverso dalle altre e dal filo senza tensione.
    const fasi = (["L1", "L2", "L3", "N"] as const).map((p) => colori.tensione[p]);
    expect(new Set([...fasi, colori.filo]).size).toBe(5);
    const scuro = coloriEditor("scuro");
    expect(new Set([...(["L1", "L2", "L3", "N"] as const).map((p) => scuro.tensione[p]), scuro.filo]).size).toBe(5);
  });

  it("tratti dei contatti e tipo di utilizzatore", () => {
    expect(trattiDelContatto("pulsante-na")).toEqual([["13", "14"]]);
    expect(trattiDelContatto("contatti-principali")).toHaveLength(3);
    expect(trattiDelContatto("lampada")).toEqual([]);
    expect(tipoUtilizzatore("bobina-contattore")).toBe("bobina");
    expect(tipoUtilizzatore("bobina-ritardata-eccitazione")).toBe("bobina");
    expect(tipoUtilizzatore("lampada")).toBe("luce");
    expect(tipoUtilizzatore("sirena")).toBe("suono");
    expect(tipoUtilizzatore("motore-trifase-6")).toBe("motore");
    expect(tipoUtilizzatore("pulsante-na")).toBeNull();
  });

  it("orologio della simulazione", () => {
    expect(formattaTempo(0)).toBe("0,0 s");
    expect(formattaTempo(12.36)).toBe("12,3 s");
    expect(formattaTempo(3)).toBe("3,0 s");
  });
});

describe("problemi nella vista (attività 2.6)", () => {
  it("la vista porta i problemi e la firma cambia quando compaiono", () => {
    // Senza il filo verso il neutro la lampada non potrà mai accendersi.
    const aperto: Schema = { ...schema, fili: schema.fili.slice(0, 2) };
    const v = vistaDaSessione(avviaSessione(aperto), aperto.fili);
    expect(v.problemi.map((p) => p.codice)).toEqual(["circuitoAperto"]);
    const ok = vistaDaSessione(avviaSessione(schema), schema.fili);
    expect(ok.problemi).toEqual([]);
    expect(firmaVista(v)).not.toBe(firmaVista({ ...v, problemi: [] }));
  });
});
