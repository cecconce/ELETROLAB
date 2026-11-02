// Test della parte digitale del modulo Elettronica.
import { describe, expect, it } from "vitest";
import { aggiornaDigitale, livello, nuovoStatoDigitale, SEGMENTI } from "./digitale";
import { avviaSessioneElettronica, clicGiuElettronica, passoElettronica, tensioneMorsetto, type ComponenteElettronico, type NodoDi } from "./sessione";

function circuito(componenti: [string, string, Record<string, number | string>?][], nodi: string[][]) {
  const mappa = new Map<string, string>();
  nodi.forEach((gruppo, i) => gruppo.forEach((m) => mappa.set(m, `n${i}`)));
  const nodoDi: NodoDi = (c, m) => mappa.get(`${c}.${m}`) ?? `${c}.${m}`;
  const comp: ComponenteElettronico[] = componenti.map(([id, tipo, parametri]) => ({ id, tipo, parametri: parametri ?? {} }));
  return avviaSessioneElettronica(comp, nodoDi);
}

/** Tabella di verità di una porta a due ingressi. */
function tabella(tipo: string): number[] {
  return [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ].map(([a, b]) => {
    const s = nuovoStatoDigitale(tipo);
    aggiornaDigitale(tipo, s, { A: a * 5, B: b * 5 });
    return s.uscite.Y;
  });
}

describe("logica", () => {
  it("tabelle di verità delle porte", () => {
    expect(tabella("porta-and")).toEqual([0, 0, 0, 1]);
    expect(tabella("porta-or")).toEqual([0, 1, 1, 1]);
    expect(tabella("porta-nand")).toEqual([1, 1, 1, 0]);
    expect(tabella("porta-nor")).toEqual([1, 0, 0, 0]);
    expect(tabella("porta-xor")).toEqual([0, 1, 1, 0]);
    const not = nuovoStatoDigitale("porta-not");
    expect(not.uscite.Y).toBe(1);
    aggiornaDigitale("porta-not", not, { A: 5 });
    expect(not.uscite.Y).toBe(0);
  });

  it("soglie con isteresi: fra 2,3 V e 2,7 V il livello resta quello di prima", () => {
    expect(livello(2.5, 0)).toBe(0);
    expect(livello(2.5, 1)).toBe(1);
    expect(livello(2.8, 0)).toBe(1);
    expect(livello(2.2, 1)).toBe(0);
  });

  it("flip-flop D: copia D sul fronte di salita del clock", () => {
    const s = nuovoStatoDigitale("flip-flop-d");
    aggiornaDigitale("flip-flop-d", s, { D: 5, CLK: 0 });
    expect(s.uscite.Q).toBe(0);
    aggiornaDigitale("flip-flop-d", s, { D: 5, CLK: 5 });
    expect(s.uscite).toEqual({ Q: 1, QN: 0 });
    aggiornaDigitale("flip-flop-d", s, { D: 0, CLK: 5 }); // clock alto fermo: non cambia
    expect(s.uscite.Q).toBe(1);
  });

  it("flip-flop JK: J=K=1 commuta a ogni fronte", () => {
    const s = nuovoStatoDigitale("flip-flop-jk");
    const q: number[] = [];
    for (let k = 0; k < 4; k++) {
      aggiornaDigitale("flip-flop-jk", s, { J: 5, K: 5, CLK: 0 });
      aggiornaDigitale("flip-flop-jk", s, { J: 5, K: 5, CLK: 5 });
      q.push(s.uscite.Q);
    }
    expect(q).toEqual([1, 0, 1, 0]);
    aggiornaDigitale("flip-flop-jk", s, { J: 0, K: 5, CLK: 0 });
    aggiornaDigitale("flip-flop-jk", s, { J: 1, K: 5, CLK: 5 }); // J sotto soglia = 0 → reset
    expect(s.uscite.Q).toBe(0);
  });

  it("contatore a 4 bit con reset e decodificatore per il display", () => {
    const s = nuovoStatoDigitale("contatore");
    for (let k = 0; k < 11; k++) {
      aggiornaDigitale("contatore", s, { CLK: 0, R: 0 });
      aggiornaDigitale("contatore", s, { CLK: 5, R: 0 });
    }
    expect(s.uscite).toEqual({ Q0: 1, Q1: 1, Q2: 0, Q3: 1 }); // 11
    aggiornaDigitale("contatore", s, { CLK: 0, R: 5 });
    expect(s.memoria).toBe(0);
    const d = nuovoStatoDigitale("decodificatore");
    aggiornaDigitale("decodificatore", d, { A: 5, B: 5, C: 0, D: 0 }); // 3
    expect(Object.entries(d.uscite).filter(([, v]) => v === 1).map(([k]) => k).join("")).toBe(SEGMENTI[3]);
  });
});

describe("circuiti digitali e misti", () => {
  it("interruttori logici → porta AND → LED: il LED si accende solo con entrambi a 1", () => {
    const s = circuito(
      [["S1", "interruttore-logico"], ["S2", "interruttore-logico"], ["U1", "porta-and"], ["R1", "resistenza", { resistenza: 220 }], ["D1", "led"], ["GND", "massa"]],
      [["S1.out", "U1.A"], ["S2.out", "U1.B"], ["U1.Y", "R1.1"], ["R1.2", "D1.a"], ["D1.k", "GND.0"]],
    );
    const tensioneLed = () => tensioneMorsetto(s, "U1", "Y");
    passoElettronica(s, 0.01);
    expect(tensioneLed()).toBeLessThan(0.1);
    clicGiuElettronica(s, "S1");
    passoElettronica(s, 0.01);
    expect(tensioneLed()).toBeLessThan(0.1);
    clicGiuElettronica(s, "S2");
    passoElettronica(s, 0.01);
    // Uscita a 5 V con 50 Ω interni: col LED che assorbe ~13 mA scende di poco.
    expect(tensioneLed()).toBeGreaterThan(4);
    expect(s.soluzione!.correnti.D1).toBeGreaterThan(0.008);
  });

  it("generatore di clock → contatore → decodificatore → display: conta i secondi", () => {
    const s = circuito(
      [["CLK", "generatore-clock", { frequenza: 10 }], ["U1", "contatore"], ["U2", "decodificatore"], ["DS1", "display-7-segmenti"], ["GND", "massa"]],
      [["CLK.out", "U1.CLK"], ["U1.Q0", "U2.A"], ["U1.Q1", "U2.B"], ["U1.Q2", "U2.C"], ["U1.Q3", "U2.D"], ...["a", "b", "c", "d", "e", "f", "g"].map((x) => [`U2.${x}`, `DS1.${x}`])],
    );
    expect(s.dt).toBeCloseTo(1 / 10 / 40);
    // 0,7 s a 10 Hz: 7 fronti di salita (a 0,05 s, 0,15 s… no: il clock parte alto, il primo fronte è a 0,1 s).
    for (let k = 0; k < 14; k++) passoElettronica(s, 0.05);
    const conteggio = s.digitali.U1.memoria;
    expect(conteggio).toBeGreaterThanOrEqual(6);
    expect(conteggio).toBeLessThanOrEqual(7);
    const accesi = Object.entries(s.digitali.DS1.ingressi).filter(([, v]) => v === 1).map(([k]) => k).join("");
    expect(accesi).toBe(SEGMENTI[conteggio]);
  });

  it("analizzatore logico: registra i livelli dei canali", () => {
    const s = circuito(
      [["CLK", "generatore-clock", { frequenza: 5 }], ["XLA1", "analizzatore-logico"], ["U1", "porta-not"], ["GND", "massa"]],
      [["CLK.out", "XLA1.D0", "U1.A"], ["U1.Y", "XLA1.D1"]],
    );
    for (let k = 0; k < 10; k++) passoElettronica(s, 0.05);
    const st = s.analizzatori.XLA1;
    expect(st.canali[0]).toContain(1);
    expect(st.canali[0]).toContain(0);
    // D1 è il negato di D0 (a parte il passo di ritardo della porta).
    const diversi = st.canali[0].filter((v, k) => k > 0 && v === st.canali[1][k]).length;
    expect(diversi / st.t.length).toBeLessThan(0.1);
  });

  it("transistor comandato da un'uscita logica (interfaccia digitale → potenza)", () => {
    const s = circuito(
      [["S1", "interruttore-logico"], ["RB", "resistenza", { resistenza: 4700 }], ["Q1", "transistor-npn"], ["H1", "lampadina", { tensione: 12, potenza: 1.2 }], ["V1", "generatore-dc", { tensione: 12 }], ["GND", "massa"]],
      [["S1.out", "RB.1"], ["RB.2", "Q1.b"], ["V1.+", "H1.1"], ["H1.2", "Q1.c"], ["Q1.e", "V1.-", "GND.0"]],
    );
    passoElettronica(s, 0.01);
    expect(Math.abs(s.soluzione!.correnti.H1)).toBeLessThan(0.001);
    clicGiuElettronica(s, "S1");
    passoElettronica(s, 0.01);
    expect(Math.abs(s.soluzione!.correnti.H1)).toBeGreaterThan(0.08);
  });
});
