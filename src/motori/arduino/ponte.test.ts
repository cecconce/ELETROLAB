// Test del ponte H L293D del modulo Arduino.
import { describe, expect, it } from "vitest";
import { aspettoComponenti, risolviBanco, type ComponenteArduino, type Interazioni, type StatoPin } from "./componenti";

const nessuna: Interazioni = { premuti: new Set(), posizioni: {}, luce: {} };
const nodi = (tabella: Record<string, string>) => (c: string, m: string) => tabella[`${c}.${m}`] ?? `${c}.${m}`;

const componenti: ComponenteArduino[] = [
  { id: "U", tipo: "arduino-uno" },
  { id: "P", tipo: "l293d" },
  { id: "PS", tipo: "alimentatore", tensione: 9, correnteMax: 2 },
  { id: "M", tipo: "motore-dc" },
];
const fili = (vss = true): Record<string, string> => ({
  ...(vss ? { "U.5V": "v5", "P.VSS": "v5" } : {}),
  "U.GND1": "g",
  "P.GND1": "g",
  "PS.-": "g",
  "PS.+": "vs",
  "P.VS": "vs",
  "U.D9": "en",
  "P.EN12": "en",
  "U.D8": "in1",
  "P.IN1": "in1",
  "U.D7": "in2",
  "P.IN2": "in2",
  "P.OUT1": "m1",
  "M.+": "m1",
  "P.OUT2": "m2",
  "M.-": "m2",
});
const uscita = (livello: number): StatoPin => ({ modo: "OUTPUT", livello });

function banco(en: number, in1: number, in2: number, vss = true) {
  const nodoDi = nodi(fili(vss));
  const e = risolviBanco(componenti, nodoDi, { D9: uscita(en), D8: uscita(in1), D7: uscita(in2) }, nessuna);
  const aspetto = aspettoComponenti(componenti, nodoDi, e.risultato, e.inCorrenteCostante, e.releEccitati, e.statiPonti);
  const vMotore = (e.risultato.tensioni.m1 ?? 0) - (e.risultato.tensioni.m2 ?? 0);
  return { aspetto, vMotore };
}

describe("ponte H L293D", () => {
  it("IN1 alto, IN2 basso: avanti; il motore riceve VS meno circa 2,5 V", () => {
    const { aspetto, vMotore } = banco(1, 1, 0);
    expect(aspetto.P.uscite!.map((u) => u.stato).slice(0, 2)).toEqual(["alto", "basso"]);
    expect(vMotore).toBeGreaterThan(5.5);
    expect(vMotore).toBeLessThan(6.5);
    expect(aspetto.M.velocita).toBeGreaterThan(0);
  });

  it("al contrario: indietro", () => {
    const { vMotore, aspetto } = banco(1, 0, 1);
    expect(vMotore).toBeLessThan(-5.5);
    expect(aspetto.M.velocita).toBeLessThan(0);
  });

  it("ingressi uguali: fermo (frenato)", () => {
    expect(Math.abs(banco(1, 1, 1).vMotore)).toBeLessThan(0.1);
    expect(Math.abs(banco(1, 0, 0).vMotore)).toBeLessThan(0.1);
  });

  it("EN basso o logica non alimentata: uscite scollegate", () => {
    expect(banco(0, 1, 0).aspetto.P.uscite!.every((u) => u.stato === "aperto")).toBe(true);
    expect(banco(1, 1, 0, false).aspetto.P.uscite!.every((u) => u.stato === "aperto")).toBe(true);
    expect(Math.abs(banco(0, 1, 0).aspetto.M.velocita ?? 0)).toBe(0);
  });

  it("PWM su EN: la tensione media sul motore è proporzionale", () => {
    const pieno = banco(1, 1, 0).vMotore;
    const meta = banco(0.5, 1, 0).vMotore;
    expect(meta).toBeGreaterThan(0.35 * pieno);
    expect(meta).toBeLessThan(0.6 * pieno);
  });
});
