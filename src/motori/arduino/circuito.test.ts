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
