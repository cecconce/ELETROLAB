// Test dell'analisi nel tempo e in frequenza.
import { describe, expect, it } from "vitest";
import { analisiAC, analisiTransitorio, DIODO_SILICIO, frequenzeLogaritmiche, valoreOnda, type Elemento } from "./simulatore";

const R = (id: string, a: string, b: string, ohm: number): Elemento => ({ tipo: "R", id, a, b, ohm });
const C = (id: string, a: string, b: string, farad: number): Elemento => ({ tipo: "C", id, a, b, farad });

describe("forme d'onda", () => {
  it("sinusoide, quadra e triangolare hanno i valori attesi", () => {
    const sin = { tipo: "sinusoide", ampiezza: 2, frequenza: 50 } as const;
    expect(valoreOnda(sin, 0.005)).toBeCloseTo(2, 6); // un quarto di periodo
    expect(valoreOnda(sin, 0.01)).toBeCloseTo(0, 6);
    const q = { tipo: "quadra", ampiezza: 5, frequenza: 1000, offset: 5 } as const;
    expect(valoreOnda(q, 0.0001)).toBe(10);
    expect(valoreOnda(q, 0.0007)).toBe(0);
    const tr = { tipo: "triangolare", ampiezza: 1, frequenza: 1 } as const;
    expect(valoreOnda(tr, 0)).toBeCloseTo(-1);
    expect(valoreOnda(tr, 0.25)).toBeCloseTo(0);
    expect(valoreOnda(tr, 0.5)).toBeCloseTo(1);
  });
});

describe("transitorio", () => {
  it("carica di un condensatore: dopo τ = RC la tensione è il 63 %", () => {
    // 10 V, R = 1 kΩ, C = 1 µF → τ = 1 ms
    const el: Elemento[] = [{ tipo: "V", id: "V1", p: "a", n: "0", onda: { tipo: "continua", valore: 10 } }, R("R1", "a", "c", 1000), C("C1", "c", "0", 1e-6)];
    const campioni = analisiTransitorio(el, 0.005, 1e-5, { nodi: ["c"] });
    const a = (t: number) => campioni[Math.round(t / 1e-5)].tensioni.c;
    expect(a(0.001)).toBeCloseTo(6.32, 1);
    expect(a(0.003)).toBeCloseTo(9.5, 1);
    expect(a(0.005)).toBeGreaterThan(9.9);
  });

  it("corrente in un induttore: cresce con τ = L/R", () => {
    // 10 V, R = 100 Ω, L = 0,1 H → τ = 1 ms, corrente finale 100 mA
    const el: Elemento[] = [{ tipo: "V", id: "V1", p: "a", n: "0", onda: { tipo: "continua", valore: 10 } }, R("R1", "a", "b", 100), { tipo: "L", id: "L1", a: "b", b: "0", henry: 0.1 }];
    const campioni = analisiTransitorio(el, 0.005, 1e-5, { correnti: ["L1"] });
    expect(campioni[100].correnti.L1).toBeCloseTo(0.0632, 2);
    expect(campioni[500].correnti.L1).toBeGreaterThan(0.099);
  });

  it("onda quadra su un filtro RC: il condensatore si carica e si scarica", () => {
    const el: Elemento[] = [
      { tipo: "V", id: "V1", p: "a", n: "0", onda: { tipo: "quadra", ampiezza: 2.5, offset: 2.5, frequenza: 100 } },
      R("R1", "a", "c", 1000),
      C("C1", "c", "0", 1e-6),
    ];
    const campioni = analisiTransitorio(el, 0.02, 1e-5, { nodi: ["c"] });
    expect(campioni[499].tensioni.c).toBeGreaterThan(4.9); // fine del semiperiodo alto (5 ms ≫ τ)
    expect(campioni[999].tensioni.c).toBeLessThan(0.1); // fine del semiperiodo basso
  });

  it("raddrizzatore a una semionda con condensatore di filtro: picco − 0,7 V e piccola ondulazione", () => {
    const el: Elemento[] = [
      { tipo: "V", id: "V1", p: "a", n: "0", onda: { tipo: "sinusoide", ampiezza: 12, frequenza: 50 } },
      { tipo: "D", id: "D1", a: "a", k: "u", modello: DIODO_SILICIO },
      C("C1", "u", "0", 470e-6),
      R("RL", "u", "0", 1000),
    ];
    const campioni = analisiTransitorio(el, 0.1, 5e-5, { nodi: ["u"] });
    // Ultimo periodo (80–100 ms): tensione quasi costante vicino al picco.
    const ultimi = campioni.filter((c) => c.t >= 0.08).map((c) => c.tensioni.u);
    const max = Math.max(...ultimi);
    const min = Math.min(...ultimi);
    expect(max).toBeGreaterThan(11);
    expect(max).toBeLessThan(11.5);
    // Ondulazione ≈ I/(f·C) = 11 mA / (50 · 470 µF) ≈ 0,47 V
    expect(max - min).toBeGreaterThan(0.3);
    expect(max - min).toBeLessThan(0.7);
  });

  it("senza condensatore il raddrizzatore lascia passare solo le semionde positive", () => {
    const el: Elemento[] = [
      { tipo: "V", id: "V1", p: "a", n: "0", onda: { tipo: "sinusoide", ampiezza: 10, frequenza: 50 } },
      { tipo: "D", id: "D1", a: "a", k: "u", modello: DIODO_SILICIO },
      R("RL", "u", "0", 1000),
    ];
    const campioni = analisiTransitorio(el, 0.02, 1e-4, { nodi: ["u"] });
    expect(campioni[50].tensioni.u).toBeGreaterThan(9); // 5 ms: picco positivo
    expect(campioni[150].tensioni.u).toBeCloseTo(0, 3); // 15 ms: semionda negativa bloccata
  });
});

describe("analisi in frequenza", () => {
  it("frequenze logaritmiche da 10 Hz a 100 kHz", () => {
    const f = frequenzeLogaritmiche(10, 100000, 10);
    expect(f).toHaveLength(41);
    expect(f[0]).toBeCloseTo(10);
    expect(f[10]).toBeCloseTo(100);
    expect(f[40]).toBeCloseTo(100000);
  });

  it("filtro RC passa-basso: −3 dB e −45° alla frequenza di taglio, −20 dB/decade dopo", () => {
    // R = 1 kΩ, C = 100 nF → fc = 1/(2πRC) ≈ 1591,5 Hz
    const fc = 1 / (2 * Math.PI * 1000 * 100e-9);
    const el: Elemento[] = [{ tipo: "V", id: "VIN", p: "in", n: "0", onda: { tipo: "continua", valore: 0 } }, R("R1", "in", "u", 1000), C("C1", "u", "0", 100e-9)];
    const [basso, taglio, alto] = analisiAC(el, "VIN", [fc / 100, fc, fc * 10]);
    expect(basso.db.u).toBeCloseTo(0, 2);
    expect(taglio.db.u).toBeCloseTo(-3.01, 1);
    expect(taglio.fase.u).toBeCloseTo(-45, 1);
    expect(alto.db.u).toBeCloseTo(-20, 0);
  });

  it("filtro RC passa-alto: fase +45° alla frequenza di taglio", () => {
    const fc = 1 / (2 * Math.PI * 1000 * 100e-9);
    const el: Elemento[] = [{ tipo: "V", id: "VIN", p: "in", n: "0", onda: { tipo: "continua", valore: 0 } }, C("C1", "in", "u", 100e-9), R("R1", "u", "0", 1000)];
    const [p] = analisiAC(el, "VIN", [fc]);
    expect(p.db.u).toBeCloseTo(-3.01, 1);
    expect(p.fase.u).toBeCloseTo(45, 1);
  });

  it("circuito risonante RLC serie: massimo sulla resistenza alla frequenza di risonanza", () => {
    // L = 10 mH, C = 1 µF → f0 = 1/(2π√LC) ≈ 1591,5 Hz
    const f0 = 1 / (2 * Math.PI * Math.sqrt(0.01 * 1e-6));
    const el: Elemento[] = [
      { tipo: "V", id: "VIN", p: "in", n: "0", onda: { tipo: "continua", valore: 0 } },
      { tipo: "L", id: "L1", a: "in", b: "x", henry: 0.01 },
      C("C1", "x", "u", 1e-6),
      R("R1", "u", "0", 10),
    ];
    const [prima, centro, dopo] = analisiAC(el, "VIN", [f0 / 2, f0, f0 * 2]);
    expect(centro.modulo.u).toBeCloseTo(1, 2);
    expect(prima.modulo.u).toBeLessThan(0.2);
    expect(dopo.modulo.u).toBeLessThan(0.2);
  });

  it("amplificatore invertente con operazionale: guadagno 20 dB e fase 180°", () => {
    const el: Elemento[] = [
      { tipo: "V", id: "VIN", p: "in", n: "0", onda: { tipo: "continua", valore: 0 } },
      R("R1", "in", "meno", 1000),
      R("R2", "meno", "out", 10000),
      { tipo: "OP", id: "U1", piu: "0", meno: "meno", uscita: "out", vsat: 13.5 },
    ];
    const [p] = analisiAC(el, "VIN", [1000]);
    expect(p.db.out).toBeCloseTo(20, 1);
    expect(Math.abs(p.fase.out)).toBeCloseTo(180, 0);
  });

  it("stadio a emettitore comune: il transistor amplifica il segnale", () => {
    const el: Elemento[] = [
      { tipo: "V", id: "VCC", p: "vcc", n: "0", onda: { tipo: "continua", valore: 12 } },
      { tipo: "V", id: "VIN", p: "in", n: "0", onda: { tipo: "continua", valore: 0 } },
      C("C1", "in", "b", 10e-6),
      R("R1", "vcc", "b", 47000),
      R("R2", "b", "0", 10000),
      R("RC", "vcc", "c", 2200),
      R("RE", "e", "0", 470),
      C("CE", "e", "0", 100e-6),
      { tipo: "Q", id: "Q1", c: "c", b: "b", e: "e", pnp: false, beta: 150 },
    ];
    const [p] = analisiAC(el, "VIN", [1000]);
    expect(p.modulo.c).toBeGreaterThan(20); // guadagno elevato con l'emettitore a massa per il segnale
    expect(Math.abs(p.fase.c)).toBeGreaterThan(150); // uscita in opposizione di fase
  });
});
