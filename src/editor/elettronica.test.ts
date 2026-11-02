// Test del collegamento editor ↔ motore del modulo Elettronica.
import { describe, expect, it } from "vitest";
import { avviaSessioneElettronica, clicGiuElettronica, passoElettronica } from "../motori/elettronica";
import { nodiDaSchema } from "./arduino";
import { libreriaDelModulo } from "./caricaLibreria";
import { componentiDaSchemaElettronica, etichettaValore, impostaParametro, PARAMETRI_ELETTRONICA, problemiElettronica, testoLettura, valoreParametro, vistaDaSessioneElettronica } from "./elettronica";
import { vocePerTipo } from "./libreria";
import { finestraTraccia } from "./PannelloOscilloscopio";
import type { ComponenteSchema, Schema } from "./schema";
import { leggiProgetto, serializzaProgetto } from "../progetto/formato";

const libreria = libreriaDelModulo("elettronica");
const morsettiDi = (tipo: string) => vocePerTipo(libreria, tipo)?.morsetti;
const comp = (id: string, tipo: string, x: number, y: number, parametri?: Record<string, number | string>): ComponenteSchema => {
  const v = vocePerTipo(libreria, tipo)!;
  return { id, tipo, etichetta: id, x, y, larghezza: v.larghezza, altezza: v.altezza, ...(parametri ? { parametri } : {}) };
};
const filo = (n: number, a: string, b: string) => {
  const [ca, ma] = a.split(".");
  const [cb, mb] = b.split(".");
  return { id: `f${n}`, da: { componente: ca, morsetto: ma }, a: { componente: cb, morsetto: mb } };
};

/** Pila, interruttore, resistenza e LED rosso. */
const SCHEMA: Schema = {
  componenti: [comp("V1", "generatore-dc", 0, 0, { tensione: 5 }), comp("S1", "interruttore", 100, 0), comp("R1", "resistenza", 200, 0, { resistenza: 220 }), comp("D1", "led", 300, 0), comp("GND", "massa", 0, 200)],
  fili: [filo(1, "V1.+", "S1.1"), filo(2, "S1.2", "R1.1"), filo(3, "R1.2", "D1.a"), filo(4, "D1.k", "GND.0"), filo(5, "V1.-", "GND.0")],
};

describe("modulo Elettronica nell'editor", () => {
  it("ogni componente della libreria con parametri li ha descritti e con valore predefinito", () => {
    for (const [tipo, parametri] of Object.entries(PARAMETRI_ELETTRONICA)) {
      expect(vocePerTipo(libreria, tipo), tipo).toBeDefined();
      for (const p of parametri) expect(valoreParametro(undefined, tipo, p.id), `${tipo}.${p.id}`).not.toBe("");
    }
  });

  it("etichette dei valori come sugli schemi", () => {
    expect(etichettaValore("resistenza", { resistenza: 4700 })).toBe("4,7 kΩ");
    expect(etichettaValore("resistenza")).toBe("1 kΩ");
    expect(etichettaValore("condensatore", { capacita: 1e-7 })).toBe("100 nF");
    expect(etichettaValore("generatore-funzioni", { forma: "quadra", frequenza: 50, ampiezza: 5 })).toBe("⊓ 50 Hz 5 Vp");
    expect(etichettaValore("regolatore", { tensione: 12 })).toBe("7812");
    expect(testoLettura({ valore: null, unita: "Ω" })).toBe("OL");
    expect(testoLettura({ valore: 0.0123, unita: "A" })).toBe("12,3 mA");
  });

  it("impostaParametro cambia solo il componente scelto e i parametri si salvano nel file .elab", () => {
    const s2 = impostaParametro(SCHEMA, "R1", "resistenza", 1000);
    expect(s2.componenti.find((c) => c.id === "R1")!.parametri).toEqual({ resistenza: 1000 });
    expect(impostaParametro(s2, "R1", "resistenza", 1000)).toBe(s2);
    const letto = leggiProgetto(serializzaProgetto({ modulo: "elettronica", schema: s2 }, "0.1.0"));
    if (!letto.ok) throw new Error(letto.errore);
    expect(letto.progetto.schema.componenti.find((c) => c.id === "R1")!.parametri).toEqual({ resistenza: 1000 });
    expect(letto.progetto.schema.componenti.find((c) => c.id === "V1")!.parametri).toEqual({ tensione: 5 });
  });

  it("dallo schema disegnato alla simulazione: interruttore e LED", () => {
    const s = avviaSessioneElettronica(componentiDaSchemaElettronica(SCHEMA), nodiDaSchema(SCHEMA, morsettiDi));
    expect(vistaDaSessioneElettronica(s, SCHEMA, libreria).componenti.D1.elettronica?.luminosita).toBe(0);
    clicGiuElettronica(s, "S1");
    passoElettronica(s, 0.01);
    const v = vistaDaSessioneElettronica(s, SCHEMA, libreria);
    expect(v.componenti.S1.chiuso).toBe(true);
    expect(v.componenti.S1.clic).toBe("manuale");
    expect(v.componenti.D1.elettronica?.luminosita).toBeGreaterThan(0.5);
    expect(v.problemiPlc).toEqual([]);
  });

  it("problemi spiegati: manca la massa, LED senza resistenza bruciato", () => {
    const senzaMassa: Schema = { componenti: SCHEMA.componenti.filter((c) => c.id !== "GND"), fili: [] };
    const s = avviaSessioneElettronica(componentiDaSchemaElettronica(senzaMassa), nodiDaSchema(senzaMassa, morsettiDi));
    expect(problemiElettronica(s, senzaMassa, libreria).map((p) => p.chiave)).toContain("senza-massa");
    const bruciato = impostaParametro(SCHEMA, "R1", "resistenza", 1);
    const s2 = avviaSessioneElettronica(componentiDaSchemaElettronica(bruciato), nodiDaSchema(bruciato, morsettiDi));
    clicGiuElettronica(s2, "S1");
    passoElettronica(s2, 0.01);
    const p = problemiElettronica(s2, bruciato, libreria);
    expect(p.map((x) => x.chiave)).toContain("bruciato-D1");
    expect(p.find((x) => x.chiave === "bruciato-D1")!.testo).toContain("D1");
  });

  it("trigger dell'oscilloscopio: la traccia parte su un fronte di salita del canale A", () => {
    const t: number[] = [];
    const a: number[] = [];
    for (let k = 0; k < 1000; k++) {
      t.push(k * 1e-5);
      a.push(Math.sin(2 * Math.PI * 1000 * k * 1e-5));
    }
    const f = finestraTraccia({ t, a }, 2e-3);
    expect(a[f.da - 1]).toBeLessThan(0);
    expect(a[f.da]).toBeGreaterThanOrEqual(0);
    expect(t[t.length - 1] - f.inizio).toBeGreaterThanOrEqual(2e-3);
    // Segnale piatto: ultime 10 divisioni.
    const piatto = finestraTraccia({ t, a: t.map(() => 1) }, 2e-3);
    expect(piatto.inizio).toBeCloseTo(t[t.length - 1] - 2e-3, 6);
  });
});
