// Test del motore analogico: circuiti classici con risultati noti.
import { describe, expect, it } from "vitest";
import { analisiDC, DIODO_SILICIO, LED_ROSSO, zener, type Elemento } from "./simulatore";

const V = (id: string, p: string, n: string, valore: number): Elemento => ({ tipo: "V", id, p, n, onda: { tipo: "continua", valore } });
const R = (id: string, a: string, b: string, ohm: number): Elemento => ({ tipo: "R", id, a, b, ohm });

describe("analisi DC", () => {
  it("partitore di tensione: 12 V su 1 kΩ + 2 kΩ → 8 V", () => {
    const s = analisiDC([V("V1", "a", "0", 12), R("R1", "a", "b", 1000), R("R2", "b", "0", 2000)]);
    expect(s.converge).toBe(true);
    expect(s.tensioni.b).toBeCloseTo(8, 6);
    expect(s.correnti.R1).toBeCloseTo(0.004, 8);
    expect(s.correnti.V1).toBeCloseTo(0.004, 8);
  });

  it("generatore di corrente su una resistenza: 2 mA × 1 kΩ = 2 V", () => {
    const s = analisiDC([{ tipo: "I", id: "I1", p: "a", n: "0", onda: { tipo: "continua", valore: 0.002 } }, R("R1", "a", "0", 1000)]);
    expect(s.tensioni.a).toBeCloseTo(2, 6);
  });

  it("diodo in conduzione diretta: circa 0,6–0,75 V ai capi", () => {
    const s = analisiDC([V("V1", "a", "0", 5), R("R1", "a", "d", 1000), { tipo: "D", id: "D1", a: "d", k: "0", modello: DIODO_SILICIO }]);
    expect(s.converge).toBe(true);
    expect(s.tensioni.d).toBeGreaterThan(0.6);
    expect(s.tensioni.d).toBeLessThan(0.75);
    expect(s.correnti.D1).toBeCloseTo((5 - s.tensioni.d) / 1000, 5);
  });

  it("diodo in inversa: non conduce, tutta la tensione è sul diodo", () => {
    const s = analisiDC([V("V1", "a", "0", 5), R("R1", "a", "d", 1000), { tipo: "D", id: "D1", a: "0", k: "d", modello: DIODO_SILICIO }]);
    expect(s.tensioni.d).toBeCloseTo(5, 3);
    expect(Math.abs(s.correnti.D1)).toBeLessThan(1e-9);
  });

  it("LED rosso con 220 Ω da 5 V: circa 1,8 V e 13–15 mA", () => {
    const s = analisiDC([V("V1", "a", "0", 5), R("R1", "a", "d", 220), { tipo: "D", id: "LED1", a: "d", k: "0", modello: LED_ROSSO }]);
    expect(s.converge).toBe(true);
    expect(s.tensioni.d).toBeGreaterThan(1.7);
    expect(s.tensioni.d).toBeLessThan(2.1);
    expect(s.correnti.LED1).toBeGreaterThan(0.012);
    expect(s.correnti.LED1).toBeLessThan(0.016);
  });

  it("zener da 5,1 V stabilizza una tensione di 12 V", () => {
    const s = analisiDC([V("V1", "a", "0", 12), R("R1", "a", "z", 470), { tipo: "D", id: "DZ", a: "0", k: "z", modello: zener(5.1) }]);
    expect(s.converge).toBe(true);
    expect(s.tensioni.z).toBeGreaterThan(5.0);
    expect(s.tensioni.z).toBeLessThan(5.6);
  });

  it("raddrizzatore a ponte di Graetz in DC: uscita = ingresso − 2 diodi", () => {
    const d = (id: string, a: string, k: string): Elemento => ({ tipo: "D", id, a, k, modello: DIODO_SILICIO });
    const s = analisiDC([V("V1", "x", "y", 10), d("D1", "x", "p"), d("D2", "y", "p"), d("D3", "n", "x"), d("D4", "n", "y"), R("RL", "p", "n", 1000), R("Rm", "n", "0", 1e9)]);
    expect(s.converge).toBe(true);
    const vu = s.tensioni.p - s.tensioni.n;
    expect(vu).toBeGreaterThan(8.4);
    expect(vu).toBeLessThan(8.9);
  });

  it("transistor NPN in zona attiva: Ic ≈ β·Ib", () => {
    const s = analisiDC([
      V("VCC", "vcc", "0", 12),
      R("RB", "vcc", "b", 1e6),
      R("RC", "vcc", "c", 1000),
      { tipo: "Q", id: "Q1", c: "c", b: "b", e: "0", pnp: false, beta: 100 },
    ]);
    expect(s.converge).toBe(true);
    const { c: ic, b: ib } = s.terminali.Q1;
    expect(ib).toBeGreaterThan(10e-6);
    expect(ib).toBeLessThan(12e-6);
    expect(ic / ib).toBeCloseTo(100, 0);
    expect(s.tensioni.c).toBeGreaterThan(10);
  });

  it("transistor NPN in saturazione accende un LED (interruttore)", () => {
    const s = analisiDC([
      V("VCC", "vcc", "0", 5),
      R("RB", "vcc", "b", 4700),
      R("RC", "vcc", "l", 220),
      { tipo: "D", id: "LED1", a: "l", k: "c", modello: LED_ROSSO },
      { tipo: "Q", id: "Q1", c: "c", b: "b", e: "0", pnp: false, beta: 100 },
    ]);
    expect(s.converge).toBe(true);
    expect(s.tensioni.c).toBeLessThan(0.3); // Vce(sat)
    expect(s.correnti.LED1).toBeGreaterThan(0.01);
  });

  it("transistor PNP: corrente che esce dal collettore", () => {
    const s = analisiDC([
      V("VCC", "vcc", "0", 12),
      R("RB", "b", "0", 1e6),
      R("RC", "c", "0", 1000),
      { tipo: "Q", id: "Q1", c: "c", b: "b", e: "vcc", pnp: true, beta: 100 },
    ]);
    expect(s.converge).toBe(true);
    expect(s.tensioni.c).toBeGreaterThan(0.9);
    expect(s.tensioni.c).toBeLessThan(1.3);
  });

  it("MOSFET a canale N come interruttore: gate a 10 V → drain quasi a massa", () => {
    const circuito = (vg: number) =>
      analisiDC([
        V("VDD", "vdd", "0", 12),
        V("VG", "g", "0", vg),
        R("RD", "vdd", "d", 100),
        { tipo: "M", id: "M1", d: "d", g: "g", s: "0", canaleP: false, vth: 2, k: 0.5 },
      ]);
    const acceso = circuito(10);
    const spento = circuito(0);
    expect(acceso.converge).toBe(true);
    expect(acceso.tensioni.d).toBeLessThan(0.5);
    expect(spento.tensioni.d).toBeCloseTo(12, 3);
  });

  it("MOSFET a canale P: gate a massa con source a 12 V → conduce", () => {
    const s = analisiDC([
      V("VDD", "vdd", "0", 12),
      R("RD", "d", "0", 100),
      { tipo: "M", id: "M1", d: "d", g: "0", s: "vdd", canaleP: true, vth: 2, k: 0.5 },
    ]);
    expect(s.converge).toBe(true);
    expect(s.tensioni.d).toBeGreaterThan(11.5);
  });

  it("amplificatore invertente: guadagno −R2/R1 = −10", () => {
    const amp = (vin: number) =>
      analisiDC([
        V("VIN", "in", "0", vin),
        R("R1", "in", "meno", 1000),
        R("R2", "meno", "out", 10000),
        { tipo: "OP", id: "U1", piu: "0", meno: "meno", uscita: "out", vsat: 13.5 },
      ]);
    const s = amp(0.5);
    expect(s.converge).toBe(true);
    expect(s.tensioni.out).toBeCloseTo(-5, 2);
    expect(s.tensioni.meno).toBeCloseTo(0, 3); // massa virtuale
    // Con 2 V l'uscita andrebbe a −20 V: satura a −13,5 V.
    expect(amp(2).tensioni.out).toBeCloseTo(-13.5, 1);
  });

  it("amplificatore non invertente e inseguitore di tensione", () => {
    const ni = analisiDC([
      V("VIN", "in", "0", 1),
      R("R1", "meno", "0", 1000),
      R("R2", "meno", "out", 2000),
      { tipo: "OP", id: "U1", piu: "in", meno: "meno", uscita: "out", vsat: 13.5 },
    ]);
    expect(ni.tensioni.out).toBeCloseTo(3, 2);
    const ins = analisiDC([V("VIN", "in", "0", 2.5), { tipo: "OP", id: "U1", piu: "in", meno: "out", uscita: "out", vsat: 13.5 }, R("RL", "out", "0", 1000)]);
    expect(ins.tensioni.out).toBeCloseTo(2.5, 3);
  });

  it("comparatore: l'uscita satura dalla parte dell'ingresso più alto", () => {
    const comp = (vin: number) => analisiDC([V("VIN", "in", "0", vin), V("VREF", "ref", "0", 2.5), { tipo: "OP", id: "U1", piu: "in", meno: "ref", uscita: "out", vsat: 12 }]);
    expect(comp(3).tensioni.out).toBeCloseTo(12, 1);
    expect(comp(2).tensioni.out).toBeCloseTo(-12, 1);
  });

  it("induttore in DC è un corto, condensatore è un circuito aperto", () => {
    const s = analisiDC([V("V1", "a", "0", 10), R("R1", "a", "b", 1000), { tipo: "L", id: "L1", a: "b", b: "c", henry: 0.1 }, R("R2", "c", "0", 1000), { tipo: "C", id: "C1", a: "c", b: "0", farad: 1e-6 }]);
    expect(s.tensioni.b).toBeCloseTo(5, 4);
    expect(s.tensioni.c).toBeCloseTo(5, 4);
    expect(s.correnti.L1).toBeCloseTo(0.005, 6);
  });

  it("circuito con un nodo isolato non blocca il simulatore", () => {
    const s = analisiDC([V("V1", "a", "0", 5), R("R1", "a", "0", 1000), R("R2", "x", "y", 1000)]);
    expect(Number.isFinite(s.tensioni.x)).toBe(true);
    expect(s.tensioni.a).toBeCloseTo(5, 6);
  });
});
