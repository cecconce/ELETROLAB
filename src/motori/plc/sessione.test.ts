// Test della sessione di simulazione del PLC: clic sui contatti, ingressi
// fissi, scorrere del tempo a cicli e nodi sotto tensione.
import { describe, expect, it } from "vitest";
import {
  avviaSessionePlc,
  clicGiuPlc,
  clicSuPlc,
  commutaIngresso,
  convertiLadder,
  nodiAlimentati,
  passoPlc,
  rilasciaTuttiPlc,
  type CollegamentoLadder,
  type ElementoLadder,
} from "./index";

const el = (id: string, tipo: string, operando: string, y = 0, preset?: number): ElementoLadder => ({
  id,
  tipo,
  operando,
  x: 0,
  y,
  ...(preset !== undefined ? { preset } : {}),
});
const filo = (da: string, a: string): CollegamentoLadder => {
  const [c1, m1] = da.split("/");
  const [c2, m2] = a.split("/");
  return { da: { componente: c1, morsetto: m1 }, a: { componente: c2, morsetto: m2 } };
};

// Segmento 1: S1 (I0.0) → bobina Q0.0. Segmento 2: S2 (I0.1) → TON T0 2 s. Segmento 3: T0 → Q0.1.
const elementi = [
  el("B", "ladder-barra-sinistra", ""),
  el("S1", "ladder-contatto-na", "I0.0"),
  el("H1", "ladder-bobina", "Q0.0"),
  el("S2", "ladder-contatto-na", "I0.1", 80),
  el("T", "ladder-ton", "T0", 80, 2),
  el("CT", "ladder-contatto-na", "T0", 200),
  el("H2", "ladder-bobina", "Q0.1", 200),
];
const fili = [
  filo("B/p1", "S1/in"),
  filo("S1/out", "H1/in"),
  filo("B/p2", "S2/in"),
  filo("S2/out", "T/IN"),
  filo("B/p3", "CT/in"),
  filo("CT/out", "H2/in"),
];
const operandi = Object.fromEntries(elementi.map((e) => [e.id, e.operando]));
const avvia = () => avviaSessionePlc(convertiLadder(elementi, fili), operandi);

describe("sessione del PLC", () => {
  it("tenendo premuto un contatto su un ingresso l'ingresso vale 1", () => {
    let s = avvia();
    expect(s.risultato.usciteAttive).toEqual([]);
    s = clicGiuPlc(s, "S1");
    expect(s.risultato.usciteAttive).toEqual(["Q0.0"]);
    s = clicSuPlc(s, "S1");
    expect(s.risultato.usciteAttive).toEqual([]);
  });

  it("il clic su un contatto che non legge un ingresso non fa nulla", () => {
    const s = avvia();
    expect(clicGiuPlc(s, "CT")).toBe(s);
    expect(clicGiuPlc(s, "H1")).toBe(s);
  });

  it("rilascio generale: tutti gli ingressi premuti tornano a 0", () => {
    let s = clicGiuPlc(clicGiuPlc(avvia(), "S1"), "S2");
    expect(s.premuti.sort()).toEqual(["I0.0", "I0.1"]);
    s = rilasciaTuttiPlc(s);
    expect(s.premuti).toEqual([]);
    expect(s.risultato.usciteAttive).toEqual([]);
  });

  it("un ingresso fisso resta a 1 finché non lo si commuta di nuovo", () => {
    let s = commutaIngresso(avvia(), "i0.0");
    expect(s.fissi).toEqual(["I0.0"]);
    s = passoPlc(s, 1);
    expect(s.risultato.usciteAttive).toEqual(["Q0.0"]);
    s = commutaIngresso(s, "I0.0");
    expect(s.risultato.usciteAttive).toEqual([]);
    // Solo gli ingressi si possono commutare.
    expect(commutaIngresso(s, "Q0.0")).toBe(s);
  });

  it("il tempo scorre a cicli interi e il resto si accumula", () => {
    let s = commutaIngresso(avvia(), "I0.1");
    s = passoPlc(s, 0.03); // meno di un ciclo (50 ms): nessun ciclo
    expect(s.stato.tempo).toBe(0);
    s = passoPlc(s, 0.03); // ora 60 ms: un ciclo, 10 ms di resto
    expect(s.stato.tempo).toBeCloseTo(0.05);
    expect(s.resto).toBeCloseTo(0.01);
    s = passoPlc(s, 2);
    expect(s.risultato.usciteAttive).toEqual(["Q0.1"]);
  });

  it("dopo una lunga pausa non esegue più di un numero massimo di cicli", () => {
    const s = passoPlc(avvia(), 1e6);
    expect(s.stato.cicli).toBeLessThanOrEqual(2001);
    expect(s.resto).toBe(0);
  });
});

describe("nodi sotto tensione", () => {
  it("dalla barra fino ai contatti chiusi", () => {
    const conv = convertiLadder(elementi, fili);
    const nodoUscitaS1 = conv.nodi["S1/out"];
    expect(nodiAlimentati(conv, new Set()).has(nodoUscitaS1)).toBe(false);
    expect(nodiAlimentati(conv, new Set(["S1"])).has(nodoUscitaS1)).toBe(true);
    expect(nodiAlimentati({ nodoAlimentato: null, ponti: [] }, new Set()).size).toBe(0);
  });
});
