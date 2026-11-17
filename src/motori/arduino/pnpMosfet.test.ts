// Transistor PNP e MOSFET a canale N nel risolutore del circuito Arduino.
import { describe, expect, it } from "vitest";
import { MASSA, risolviCircuito, type Elemento } from "./circuito";

/** LED rosso (Vf 1,8 V) con 220 Ω, comandato dal lato del positivo con un PNP. */
const pnp = (pinVolt: number): Elemento[] => [
  { tipo: "generatore", id: "5V", nodo: "vcc", volt: 5, ohm: 0.01 },
  { tipo: "generatore", id: "pin", nodo: "pin", volt: pinVolt, ohm: 25 },
  { tipo: "resistenza", id: "Rb", a: "pin", b: "b", ohm: 1000 },
  { tipo: "npn", id: "Q1", e: "vcc", b: "b", c: "c", beta: 100, pnp: true },
  { tipo: "resistenza", id: "R", a: "c", b: "led", ohm: 220 },
  { tipo: "diodo", id: "LED", anodo: "led", catodo: MASSA, vf: 1.8, ron: 15 },
];

describe("transistor PNP", () => {
  it("pin LOW: la base è tirata giù, il PNP satura e il LED si accende", () => {
    const r = risolviCircuito(pnp(0));
    expect(r.saturi.has("Q1")).toBe(true);
    expect(r.correnti.LED).toBeGreaterThan(0.01); // circa 13 mA
    expect(r.tensioni.vcc - r.tensioni.c).toBeLessThan(0.3); // Vec ≈ 0,2 V
    expect(r.tensioni.vcc - r.tensioni.b).toBeCloseTo(0.7, 1);
  });

  it("pin HIGH: base all'altezza dell'emettitore, PNP interdetto, LED spento", () => {
    const r = risolviCircuito(pnp(5));
    expect(r.correnti["Q1:BE"]).toBe(0);
    expect(r.correnti.LED).toBe(0);
  });

  it("base pilotata poco (100 kΩ): zona attiva, Ic = β·Ib", () => {
    const el = pnp(0).map((e) => (e.id === "Rb" ? { ...e, ohm: 1e6 } : e));
    const r = risolviCircuito(el);
    expect(r.saturi.has("Q1")).toBe(false);
    expect(r.correnti.Q1).toBeCloseTo(100 * r.correnti["Q1:BE"], 6);
  });
});

/** Motorino (20 Ω) alimentato a 9 V e comandato dal lato della massa con un MOSFET. */
const mos = (gateVolt: number | null): Elemento[] => [
  { tipo: "alimentatore", id: "pila", piu: "9v", meno: MASSA, volt: 9, ohm: 1.5 },
  { tipo: "resistenza", id: "M", a: "9v", b: "d", ohm: 20 },
  { tipo: "nmos", id: "Q1", d: "d", g: "g", s: MASSA, vth: 2, ron: 0.05 },
  { tipo: "resistenza", id: "Rpd", a: "g", b: MASSA, ohm: 10000 },
  ...(gateVolt === null ? [] : [{ tipo: "generatore", id: "pin", nodo: "pin", volt: gateVolt, ohm: 25 } as Elemento, { tipo: "resistenza", id: "Rg", a: "pin", b: "g", ohm: 220 } as Elemento]),
];

describe("MOSFET a canale N", () => {
  it("gate a 5 V: conduce, il motore ha quasi tutta la tensione", () => {
    const r = risolviCircuito(mos(5));
    expect(r.mosAccesi.has("Q1")).toBe(true);
    expect(r.correnti.Q1).toBeCloseTo(9 / 21.55, 2);
    expect(r.tensioni.d).toBeLessThan(0.05);
  });

  it("gate a 0 V o scollegato (resistenza verso GND): aperto, nessuna corrente", () => {
    for (const g of [0, null]) {
      const r = risolviCircuito(mos(g));
      expect(r.mosAccesi.has("Q1")).toBe(false);
      expect(r.correnti.Q1).toBe(0);
      expect(r.tensioni.d).toBeCloseTo(9, 1);
    }
  });

  it("il gate non assorbe corrente: con il MOSFET acceso la tensione del gate è quella del partitore", () => {
    const r = risolviCircuito(mos(5));
    expect(r.tensioni.g).toBeCloseTo((5 * 10000) / (10000 + 220 + 25), 2);
  });
});

describe("MOSFET con il PWM sul gate", () => {
  it("duty 30 %: il motore riceve in media il 30 % della tensione", () => {
    const el = mos(5 * 0.3).map((e) => (e.tipo === "nmos" ? { ...e, duty: 0.3 } : e));
    const r = risolviCircuito(el);
    expect(r.mosAccesi.has("Q1")).toBe(true);
    const vMotore = r.tensioni["9v"] - r.tensioni.d;
    const vPieno = 9 * (20 / 21.5); // tensione del motore da acceso, senza PWM
    expect(vMotore / vPieno).toBeCloseTo(0.3, 1);
  });
});
