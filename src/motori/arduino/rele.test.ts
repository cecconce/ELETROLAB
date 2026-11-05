// Test del modulo relè 5 V e della lampadina 12 V del modulo Arduino.
import { describe, expect, it } from "vitest";
import { aspettoComponenti, risolviBanco, type ComponenteArduino, type Interazioni, type StatoPin } from "./componenti";

const nessuna: Interazioni = { premuti: new Set(), posizioni: {}, luce: {} };
const nodi = (tabella: Record<string, string>) => (c: string, m: string) => tabella[`${c}.${m}`] ?? `${c}.${m}`;

// Scheda: 5V e GND al modulo, pin 7 su IN. Lampadina sull'alimentatore attraverso COM e NO (o NC).
const componenti: ComponenteArduino[] = [
  { id: "U", tipo: "arduino-uno" },
  { id: "K1", tipo: "modulo-rele" },
  { id: "PS", tipo: "alimentatore", tensione: 12, correnteMax: 1 },
  { id: "H1", tipo: "lampadina" },
];
const fili = (contatto: "NO" | "NC", alimentato = true): Record<string, string> => ({
  ...(alimentato ? { "U.5V": "v5", "K1.VCC": "v5" } : {}),
  "U.GND1": "g",
  "K1.GND": "g",
  "U.D7": "in",
  "K1.IN": "in",
  "PS.+": "p",
  "K1.COM": "p",
  [`K1.${contatto}`]: "h",
  "H1.1": "h",
  "H1.2": "m",
  "PS.-": "m",
});

function banco(tabella: Record<string, string>, livello: number | null, iniziali: ReadonlySet<string> = new Set()) {
  const nodoDi = nodi(tabella);
  const pin: Record<string, StatoPin> = livello === null ? {} : { D7: { modo: "OUTPUT", livello } };
  const esito = risolviBanco(componenti, nodoDi, pin, nessuna, iniziali);
  return { ...esito, aspetto: aspettoComponenti(componenti, nodoDi, esito.risultato, esito.inCorrenteCostante, esito.releEccitati) };
}

describe("modulo relè 5 V", () => {
  it("IN alto: il relè scatta, il contatto NO accende la lampadina a piena luce", () => {
    const { aspetto } = banco(fili("NO"), 1);
    expect(aspetto.K1.eccitato).toBe(true);
    expect(aspetto.H1.luminosita).toBeCloseTo(1, 2);
    expect(aspetto.PS.corrente).toBeCloseTo(0.1, 3);
  });

  it("IN basso: a riposo il contatto NO è aperto", () => {
    const { aspetto } = banco(fili("NO"), 0);
    expect(aspetto.K1.eccitato).toBe(false);
    expect(aspetto.H1.luminosita).toBe(0);
  });

  it("collegata a NC la lampadina funziona al contrario", () => {
    expect(banco(fili("NC"), 0).aspetto.H1.luminosita).toBeCloseTo(1, 2);
    expect(banco(fili("NC"), 1).aspetto.H1.luminosita).toBe(0);
  });

  it("senza VCC il relè non scatta anche con IN alto", () => {
    const { aspetto } = banco(fili("NO", false), 1);
    expect(aspetto.K1.alimentato).toBe(false);
    expect(aspetto.K1.eccitato).toBe(false);
  });

  it("isteresi: a metà fra le soglie il relè resta com'era", () => {
    // PWM al 50 %: 2,5 V su IN, fra la soglia di rilascio (1,5 V) e quella di eccitazione (3 V).
    expect(banco(fili("NO"), 0.5).releEccitati.has("K1")).toBe(false);
    expect(banco(fili("NO"), 0.5, new Set(["K1"])).releEccitati.has("K1")).toBe(true);
  });
});

describe("lampadina 12 V", () => {
  it("a 6 V fa un quarto della potenza; a 30 V si brucia", () => {
    const sei = banco({ ...fili("NC") }, 0);
    expect(sei.aspetto.H1.luminosita).toBeCloseTo(1, 2);
    const nodoDi = nodi({ "PS.+": "p", "H1.1": "p", "H1.2": "m", "PS.-": "m" });
    const prova = (volt: number) => {
      const c: ComponenteArduino[] = [{ id: "PS", tipo: "alimentatore", tensione: volt, correnteMax: 5 }, { id: "H1", tipo: "lampadina" }];
      const r = risolviBanco(c, nodoDi, {}, nessuna);
      return aspettoComponenti(c, nodoDi, r.risultato).H1;
    };
    expect(prova(6).luminosita).toBeCloseTo(0.25, 2);
    expect(prova(6).bruciato).toBe(false);
    expect(prova(30).bruciato).toBe(true);
  });
});
