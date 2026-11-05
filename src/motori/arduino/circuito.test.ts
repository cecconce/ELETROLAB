// Test del risolutore elettrico.
import { describe, expect, it } from "vitest";
import { MASSA, risolviCircuito, type Elemento } from "./circuito";

describe("risolutore del circuito", () => {
  it("partitore di tensione", () => {
    const r = risolviCircuito([
      { tipo: "generatore", id: "V", nodo: "n1", volt: 10, ohm: 0.001 },
      { tipo: "resistenza", id: "R1", a: "n1", b: "n2", ohm: 1000 },
      { tipo: "resistenza", id: "R2", a: "n2", b: MASSA, ohm: 1000 },
    ]);
    expect(r.tensioni.n2).toBeCloseTo(5, 2);
    expect(r.correnti.R1).toBeCloseTo(0.005, 5);
  });

  it("LED con resistenza da 220 Ω su 5 V: circa 14 mA", () => {
    const r = risolviCircuito([
      { tipo: "generatore", id: "pin", nodo: "p", volt: 5, ohm: 25 },
      { tipo: "resistenza", id: "R", a: "p", b: "a", ohm: 220 },
      { tipo: "diodo", id: "LED", anodo: "a", catodo: MASSA, vf: 1.8, ron: 15 },
    ]);
    expect(r.diodiAccesi.has("LED")).toBe(true);
    expect(r.correnti.LED).toBeCloseTo((5 - 1.8) / (25 + 220 + 15), 4);
  });

  it("LED montato al contrario: spento", () => {
    const r = risolviCircuito([
      { tipo: "generatore", id: "pin", nodo: "p", volt: 5, ohm: 25 },
      { tipo: "resistenza", id: "R", a: "p", b: "a", ohm: 220 },
      { tipo: "diodo", id: "LED", anodo: MASSA, catodo: "a", vf: 1.8, ron: 15 },
    ]);
    expect(r.diodiAccesi.size).toBe(0);
    expect(r.correnti.LED).toBe(0);
  });

  it("pin a 0 V: il LED non si accende", () => {
    const r = risolviCircuito([
      { tipo: "generatore", id: "pin", nodo: "p", volt: 0, ohm: 25 },
      { tipo: "resistenza", id: "R", a: "p", b: "a", ohm: 220 },
      { tipo: "diodo", id: "LED", anodo: "a", catodo: MASSA, vf: 1.8, ron: 15 },
    ]);
    expect(r.diodiAccesi.size).toBe(0);
  });

  it("due LED in parallelo di colore diverso: si accende solo quello a soglia più bassa se la tensione è poca", () => {
    const r = risolviCircuito([
      { tipo: "generatore", id: "V", nodo: "p", volt: 3.3, ohm: 0.01 },
      { tipo: "resistenza", id: "R", a: "p", b: "a", ohm: 100 },
      { tipo: "diodo", id: "rosso", anodo: "a", catodo: MASSA, vf: 1.8, ron: 15 },
      { tipo: "diodo", id: "blu", anodo: "a", catodo: MASSA, vf: 3.0, ron: 15 },
    ]);
    expect([...r.diodiAccesi]).toEqual(["rosso"]);
  });

  it("nodo collegato solo a una resistenza aperta è flottante", () => {
    const r = risolviCircuito([
      { tipo: "generatore", id: "V", nodo: "p", volt: 5, ohm: 0.01 },
      { tipo: "resistenza", id: "R", a: "x", b: "y", ohm: 1000 },
    ]);
    expect([...r.flottanti].sort()).toEqual(["x", "y"]);
  });

  it("pulsante con resistenza di pull-up: aperto = 5 V, chiuso = 0 V", () => {
    const base: Elemento[] = [
      { tipo: "generatore", id: "pullup", nodo: "in", volt: 5, ohm: 20000 },
    ];
    expect(risolviCircuito(base).tensioni.in).toBeCloseTo(5, 3);
    const chiuso = risolviCircuito([...base, { tipo: "resistenza", id: "S", a: "in", b: MASSA, ohm: 0.01 }]);
    expect(chiuso.tensioni.in).toBeLessThan(0.01);
  });
});

describe("transistor NPN (modello semplificato)", () => {
  // Base da un generatore attraverso Rb; collettore da 9 V attraverso Rc; emettitore a massa.
  const circuito = (vb: number, rb: number, rc: number, beta = 100): Elemento[] => [
    { tipo: "generatore", id: "Vb", nodo: "in", volt: vb, ohm: 0.01 },
    { tipo: "resistenza", id: "Rb", a: "in", b: "b", ohm: rb },
    { tipo: "generatore", id: "Vcc", nodo: "vcc", volt: 9, ohm: 0.01 },
    { tipo: "resistenza", id: "Rc", a: "vcc", b: "c", ohm: rc },
    { tipo: "npn", id: "Q1", c: "c", b: "b", e: MASSA, beta },
  ];

  it("base a 0 V: interdizione, nessuna corrente di collettore", () => {
    const r = risolviCircuito(circuito(0, 10000, 1000));
    expect(r.correnti.Q1).toBe(0);
    expect(r.tensioni.c).toBeCloseTo(9, 2);
    expect(r.saturi.has("Q1")).toBe(false);
  });

  it("zona attiva: Ic = β·Ib", () => {
    // Ib ≈ (1,7 − 0,7) / 100 kΩ = 10 µA → Ic = 1 mA, Vce = 9 − 1 = 8 V.
    const r = risolviCircuito(circuito(1.7, 100000, 1000));
    const ib = r.correnti["Q1:BE"];
    expect(ib).toBeCloseTo(1 / 100010, 7);
    expect(r.correnti.Q1).toBeCloseTo(100 * ib, 6);
    expect(r.tensioni.c).toBeCloseTo(9 - 100 * ib * 1000, 2);
    expect(r.saturi.has("Q1")).toBe(false);
  });

  it("saturazione: come un interruttore chiuso (Vce = 0,2 V)", () => {
    // Ib ≈ 4,3 mA, β·Ib = 430 mA, ma Rc limita a circa 8,8 mA: saturo.
    const r = risolviCircuito(circuito(5, 1000, 1000));
    expect(r.saturi.has("Q1")).toBe(true);
    expect(r.tensioni.c).toBeCloseTo(0.2, 1);
    expect(r.correnti.Q1).toBeCloseTo(0.0088, 3);
  });

  it("con la resistenza di emettitore la corrente si stabilizza (niente oscillazioni)", () => {
    const el: Elemento[] = [
      { tipo: "generatore", id: "Vb", nodo: "b", volt: 2.7, ohm: 0.01 },
      { tipo: "generatore", id: "Vcc", nodo: "vcc", volt: 12, ohm: 0.01 },
      { tipo: "resistenza", id: "Rc", a: "vcc", b: "c", ohm: 1000 },
      { tipo: "resistenza", id: "Re", a: "e", b: MASSA, ohm: 1000 },
      { tipo: "npn", id: "Q1", c: "c", b: "b", e: "e", beta: 200 },
    ];
    const r = risolviCircuito(el);
    // Ve ≈ 2,7 − 0,7 = 2 V (meno la piccola caduta sulla giunzione): Ie ≈ 2 mA.
    expect(r.tensioni.e).toBeGreaterThan(1.95);
    expect(r.tensioni.e).toBeLessThan(2.0);
    expect(r.saturi.has("Q1")).toBe(false);
  });
});
