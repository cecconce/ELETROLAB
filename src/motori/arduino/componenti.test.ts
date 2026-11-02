// Test dei modelli elettrici del modulo Arduino e della breadboard.
import { describe, expect, it } from "vitest";
import {
  aspettoComponenti,
  elementiCircuito,
  foriBreadboard,
  gruppoForo,
  letturaAnalogica,
  letturaDigitale,
  MASSA,
  risolviCircuito,
  type ComponenteArduino,
  type Interazioni,
  type StatoPin,
} from "./index";

const nessuna: Interazioni = { premuti: new Set(), posizioni: {}, luce: {} };

/** Collegamenti dei test: ogni morsetto è nel nodo indicato dalla tabella (o in un nodo tutto suo). */
function nodi(tabella: Record<string, string>) {
  return (c: string, m: string) => tabella[`${c}.${m}`] ?? `${c}.${m}`;
}

function calcola(componenti: ComponenteArduino[], tabella: Record<string, string>, pin: Record<string, StatoPin>, interazioni = nessuna) {
  const nodoDi = nodi(tabella);
  const r = risolviCircuito(elementiCircuito(componenti, nodoDi, pin, interazioni));
  return { r, aspetto: aspettoComponenti(componenti, nodoDi, r), nodoDi };
}

// Blink classico: D13 → resistenza 220 Ω → LED → GND
const blink: ComponenteArduino[] = [
  { id: "U", tipo: "arduino-uno" },
  { id: "R1", tipo: "resistenza", valore: 220 },
  { id: "L1", tipo: "led", colore: "rosso" },
];
const filiBlink = { "U.D13": "n1", "R1.1": "n1", "R1.2": "n2", "L1.A": "n2", "L1.K": "n3", "U.GND1": "n3" };

describe("LED comandato da un pin", () => {
  it("HIGH: LED acceso a buona luminosità", () => {
    const { aspetto } = calcola(blink, filiBlink, { D13: { modo: "OUTPUT", livello: 1 } });
    expect(aspetto.L1.luminosita).toBeGreaterThan(0.7);
    expect(aspetto.L1.bruciato).toBe(false);
  });

  it("LOW: LED spento", () => {
    const { aspetto } = calcola(blink, filiBlink, { D13: { modo: "OUTPUT", livello: 0 } });
    expect(aspetto.L1.luminosita).toBe(0);
  });

  it("PWM al 25 %: LED più debole", () => {
    const pieno = calcola(blink, filiBlink, { D13: { modo: "OUTPUT", livello: 1 } }).aspetto.L1.luminosita!;
    const quarto = calcola(blink, filiBlink, { D13: { modo: "OUTPUT", livello: 0.5 } }).aspetto.L1.luminosita!;
    expect(quarto).toBeGreaterThan(0);
    expect(quarto).toBeLessThan(pieno);
  });

  it("senza resistenza il LED si brucia", () => {
    const { aspetto } = calcola(
      [{ id: "U", tipo: "arduino-uno" }, { id: "L1", tipo: "led" }],
      { "U.D13": "n1", "L1.A": "n1", "L1.K": "g", "U.GND1": "g" },
      { D13: { modo: "OUTPUT", livello: 1 } },
    );
    expect(aspetto.L1.bruciato).toBe(true);
  });

  it("pin non impostato come uscita: LED spento", () => {
    const { aspetto } = calcola(blink, filiBlink, {});
    expect(aspetto.L1.luminosita).toBe(0);
  });
});

describe("ingressi", () => {
  const conPulsante: ComponenteArduino[] = [
    { id: "U", tipo: "arduino-uno" },
    { id: "S1", tipo: "pulsante" },
  ];
  // Pulsante fra D2 e GND, ingresso con pull-up interno.
  const fili = { "U.D2": "in", "S1.1a": "in", "S1.2a": "g", "U.GND1": "g" };

  it("INPUT_PULLUP: 1 a riposo, 0 premuto", () => {
    const pin = { D2: { modo: "INPUT_PULLUP" as const, livello: 0 } };
    const aperto = calcola(conPulsante, fili, pin);
    expect(letturaDigitale(aperto.r, aperto.nodoDi("U", "D2"))).toBe(1);
    const premuto = calcola(conPulsante, fili, pin, { ...nessuna, premuti: new Set(["S1"]) });
    expect(letturaDigitale(premuto.r, premuto.nodoDi("U", "D2"))).toBe(0);
  });

  it("ingresso senza pull-up e pulsante aperto: flottante, legge a caso", () => {
    const c = calcola(conPulsante, { "U.D2": "in", "S1.1a": "in", "S1.2a": "p5", "U.5V": "p5" }, { D2: { modo: "INPUT", livello: 0 } });
    expect(c.r.flottanti.has("in")).toBe(true);
    expect(letturaDigitale(c.r, "in", () => 0.9)).toBe(1);
    expect(letturaDigitale(c.r, "in", () => 0.1)).toBe(0);
  });

  it("potenziometro su A0: la lettura segue il cursore", () => {
    const comp: ComponenteArduino[] = [{ id: "U", tipo: "arduino-uno" }, { id: "P1", tipo: "potenziometro" }];
    const tab = { "P1.1": "g", "U.GND1": "g", "P1.2": "v", "U.5V": "v", "P1.W": "a0", "U.A0": "a0" };
    const letture = [0, 0.5, 1].map((pos) => {
      const c = calcola(comp, tab, {}, { ...nessuna, posizioni: { P1: pos } });
      return letturaAnalogica(c.r, "a0");
    });
    expect(letture[0]).toBeLessThan(5);
    expect(letture[1]).toBeGreaterThan(500);
    expect(letture[1]).toBeLessThan(523);
    expect(letture[2]).toBeGreaterThan(1018);
  });

  it("fotoresistenza in partitore: più luce, lettura più alta", () => {
    const comp: ComponenteArduino[] = [
      { id: "U", tipo: "arduino-uno" },
      { id: "LDR", tipo: "fotoresistenza" },
      { id: "R", tipo: "resistenza", valore: 10000 },
    ];
    const tab = { "LDR.1": "v", "U.5V": "v", "LDR.2": "a0", "U.A0": "a0", "R.1": "a0", "R.2": "g", "U.GND1": "g" };
    const buio = letturaAnalogica(calcola(comp, tab, {}, { ...nessuna, luce: { LDR: 0 } }).r, "a0");
    const sole = letturaAnalogica(calcola(comp, tab, {}, { ...nessuna, luce: { LDR: 1 } }).r, "a0");
    expect(buio).toBeLessThan(150);
    expect(sole).toBeGreaterThan(850);
  });
});

describe("buzzer e servo", () => {
  it("si alimentano solo se collegati fra tensione e massa", () => {
    const comp: ComponenteArduino[] = [
      { id: "U", tipo: "arduino-uno" },
      { id: "B", tipo: "buzzer" },
      { id: "M", tipo: "servo" },
    ];
    const tab = { "B.+": "d8", "U.D8": "d8", "B.-": "g", "U.GND1": "g", "M.5V": "v", "U.5V": "v", "M.GND": "g" };
    const acceso = calcola(comp, tab, { D8: { modo: "OUTPUT", livello: 1 } }).aspetto;
    expect(acceso.B.alimentato).toBe(true);
    expect(acceso.M.alimentato).toBe(true);
    expect(calcola(comp, tab, { D8: { modo: "OUTPUT", livello: 0 } }).aspetto.B.alimentato).toBe(false);
  });
});

describe("breadboard", () => {
  it("ha 30 colonne × 10 fori centrali + 4 linee da 30 fori", () => {
    expect(foriBreadboard()).toHaveLength(30 * 14);
  });

  it("i fori a…e della stessa colonna sono collegati, non con f…j né con le altre colonne", () => {
    expect(gruppoForo("a5")).toBe(gruppoForo("e5"));
    expect(gruppoForo("a5")).not.toBe(gruppoForo("f5"));
    expect(gruppoForo("a5")).not.toBe(gruppoForo("a6"));
    expect(gruppoForo("Ap1")).toBe(gruppoForo("Ap30"));
    expect(gruppoForo("Ap1")).not.toBe(gruppoForo("Am1"));
    expect(gruppoForo("z1")).toBeNull();
    expect(gruppoForo("a31")).toBeNull();
  });

  it("in un circuito la massa resta 0 V anche collegata a più pin GND", () => {
    const r = risolviCircuito([{ tipo: "resistenza", id: "x", a: "g", b: MASSA, ohm: 1e-3 }]);
    expect(r.tensioni.g).toBeCloseTo(0);
  });
});

describe("componenti aggiunti: LED RGB, motore, sensore di temperatura, interruttore a slitta", () => {
  const U = { id: "U", tipo: "arduino-uno" };
  it("LED RGB: si accendono solo i colori comandati (rosso + blu = viola)", () => {
    const comp: ComponenteArduino[] = [U, { id: "R1", tipo: "resistenza", valore: 220 }, { id: "R2", tipo: "resistenza", valore: 220 }, { id: "R3", tipo: "resistenza", valore: 220 }, { id: "L", tipo: "led-rgb" }];
    const fili = { "U.D9": "a", "R1.1": "a", "R1.2": "r", "L.R": "r", "U.D10": "b", "R2.1": "b", "R2.2": "g", "L.G": "g", "U.D11": "c", "R3.1": "c", "R3.2": "bl", "L.B": "bl", "L.K": "m", "U.GND1": "m" };
    const { aspetto } = calcola(comp, fili, { D9: { modo: "OUTPUT", livello: 1 }, D10: { modo: "OUTPUT", livello: 0 }, D11: { modo: "OUTPUT", livello: 1 } });
    const [r, g, b] = aspetto.L.rgb!;
    expect(r).toBeGreaterThan(0.5);
    expect(g).toBe(0);
    expect(b).toBeGreaterThan(0.2);
  });
  it("motore in continua: gira con il verso della tensione, fermo senza", () => {
    const comp: ComponenteArduino[] = [U, { id: "M", tipo: "motore-dc" }];
    const avanti = calcola(comp, { "U.5V": "p", "M.+": "p", "M.-": "m", "U.GND1": "m" }, {});
    expect(avanti.aspetto.M.velocita).toBeGreaterThan(0.9);
    const indietro = calcola(comp, { "U.5V": "p", "M.-": "p", "M.+": "m", "U.GND1": "m" }, {});
    expect(indietro.aspetto.M.velocita).toBeLessThan(-0.9);
    const fermo = calcola(comp, { "M.+": "p", "M.-": "m", "U.GND1": "m" }, {});
    expect(fermo.aspetto.M.velocita).toBe(0);
  });
  it("sensore di temperatura: 0,5 V + 10 mV/°C letti con analogRead", () => {
    const comp: ComponenteArduino[] = [U, { id: "T", tipo: "tmp36" }];
    const fili = { "U.5V": "p", "T.VCC": "p", "T.OUT": "o", "U.A0": "o", "T.GND": "m", "U.GND1": "m" };
    const a20 = calcola(comp, fili, {});
    expect(letturaAnalogica(a20.r, "o")).toBe(143); // 0,7 V → 143
    const a40 = calcola(comp, fili, {}, { ...nessuna, temperature: { T: 40 } });
    expect(letturaAnalogica(a40.r, "o")).toBe(184); // 0,9 V
  });
  it("interruttore a slitta: il centrale passa da un lato all'altro", () => {
    const comp: ComponenteArduino[] = [U, { id: "S", tipo: "interruttore-slitta" }];
    const fili = { "U.5V": "p", "S.1": "p", "S.2": "m", "U.GND1": "m", "S.C": "c", "U.D2": "c" };
    const sinistra = calcola(comp, fili, { D2: { modo: "INPUT", livello: 0 } });
    expect(letturaDigitale(sinistra.r, "c")).toBe(1);
    const destra = calcola(comp, fili, { D2: { modo: "INPUT", livello: 0 } }, { ...nessuna, posizioni: { S: 1 } });
    expect(letturaDigitale(destra.r, "c")).toBe(0);
  });
});
