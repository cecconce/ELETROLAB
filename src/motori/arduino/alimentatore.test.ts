// Test dell'alimentazione esterna del modulo Arduino: alimentatore da banco
// (tensione regolabile, limite di corrente CV/CC) e pile.
import { describe, expect, it } from "vitest";
import { risolviCircuito, type Elemento } from "./circuito";
import {
  aspettoComponenti,
  letturaAnalogica,
  misureMultimetri,
  risolviBanco,
  testoMultimetro,
  type ComponenteArduino,
  type Interazioni,
} from "./componenti";
import { avviaSessioneArduino, clicGiuArduino, passoArduino } from "./sessione";

const nessuna: Interazioni = { premuti: new Set(), posizioni: {}, luce: {} };
const nodi = (tabella: Record<string, string>) => (c: string, m: string) => tabella[`${c}.${m}`] ?? `${c}.${m}`;

function banco(componenti: ComponenteArduino[], tabella: Record<string, string>, interazioni = nessuna) {
  const nodoDi = nodi(tabella);
  const { risultato, inCorrenteCostante } = risolviBanco(componenti, nodoDi, {}, interazioni);
  return { r: risultato, cc: inCorrenteCostante, aspetto: aspettoComponenti(componenti, nodoDi, risultato, inCorrenteCostante), nodoDi };
}

describe("generatore flottante nel risolutore", () => {
  it("fa circolare corrente anche senza collegamento a massa", () => {
    const el: Elemento[] = [
      { tipo: "alimentatore", id: "G", piu: "p", meno: "m", volt: 9, ohm: 0.01 },
      { tipo: "resistenza", id: "R", a: "p", b: "m", ohm: 900 },
    ];
    const r = risolviCircuito(el);
    expect(r.correnti.R).toBeCloseTo(0.01, 4);
    expect(r.correnti.G).toBeCloseTo(0.01, 4);
    expect(r.tensioni.p - r.tensioni.m).toBeCloseTo(9, 2);
    // Senza GND comune con la scheda, per l'Arduino questi nodi sono flottanti.
    expect(r.flottanti.has("p")).toBe(true);
  });

  it("con il − a massa il + vale la tensione del generatore", () => {
    const r = risolviCircuito([
      { tipo: "alimentatore", id: "G", piu: "p", meno: "massa", volt: 12, ohm: 0.01 },
      { tipo: "resistenza", id: "R", a: "p", b: "massa", ohm: 1000 },
    ]);
    expect(r.tensioni.p).toBeCloseTo(12, 2);
  });
});

describe("alimentatore da banco", () => {
  // Alimentatore 9 V → resistenza 470 Ω → LED rosso → ritorno al −.
  const circuito: ComponenteArduino[] = [
    { id: "PS1", tipo: "alimentatore", tensione: 9, correnteMax: 1 },
    { id: "R1", tipo: "resistenza", valore: 470 },
    { id: "D1", tipo: "led", colore: "rosso" },
  ];
  const fili = { "PS1.+": "a", "R1.1": "a", "R1.2": "b", "D1.A": "b", "D1.K": "c", "PS1.-": "c" };

  it("accende un LED con la resistenza, senza Arduino", () => {
    const { aspetto } = banco(circuito, fili);
    expect(aspetto.D1.luminosita).toBeGreaterThan(0.5);
    expect(aspetto.PS1.tensione).toBeCloseTo(9, 1);
    // (9 − 1,8) / (470 + 15) ≈ 14,8 mA
    expect(aspetto.PS1.corrente).toBeCloseTo(7.2 / 485, 3);
    expect(aspetto.PS1.correnteCostante).toBe(false);
  });

  it("la tensione scelta con i clic sostituisce quella delle Proprietà", () => {
    const { aspetto } = banco(circuito, fili, { ...nessuna, posizioni: { PS1: 3 } });
    expect(aspetto.PS1.tensione).toBeCloseTo(3, 1);
    expect(aspetto.D1.luminosita!).toBeLessThan(0.2);
  });

  it("supera il limite di corrente: passa in CC e la tensione scende", () => {
    // 10 V su 10 Ω vorrebbero 1 A, ma il limite è 0,2 A.
    const c: ComponenteArduino[] = [
      { id: "PS1", tipo: "alimentatore", tensione: 10, correnteMax: 0.2 },
      { id: "R1", tipo: "resistenza", valore: 10 },
    ];
    const { aspetto, cc } = banco(c, { "PS1.+": "a", "R1.1": "a", "R1.2": "b", "PS1.-": "b" });
    expect(cc.has("PS1")).toBe(true);
    expect(aspetto.PS1.correnteCostante).toBe(true);
    expect(aspetto.PS1.corrente).toBeCloseTo(0.2, 3);
    expect(aspetto.PS1.tensione).toBeCloseTo(2, 2);
  });

  it("morsetti in corto: la corrente resta al limite (nessun guasto)", () => {
    const c: ComponenteArduino[] = [{ id: "PS1", tipo: "alimentatore", tensione: 12, correnteMax: 0.5 }];
    const { aspetto } = banco(c, { "PS1.+": "x", "PS1.-": "x" });
    expect(aspetto.PS1.correnteCostante).toBe(true);
    expect(aspetto.PS1.tensione).toBeCloseTo(0, 3);
  });

  it("protegge un LED senza resistenza se il limite è basso", () => {
    const c: ComponenteArduino[] = [
      { id: "PS1", tipo: "alimentatore", tensione: 5, correnteMax: 0.02 },
      { id: "D1", tipo: "led", colore: "verde" },
    ];
    const { aspetto } = banco(c, { "PS1.+": "a", "D1.A": "a", "D1.K": "b", "PS1.-": "b" });
    expect(aspetto.D1.bruciato).toBe(false);
    expect(aspetto.PS1.correnteCostante).toBe(true);
    // Con il limite a 1 A lo stesso LED si brucia.
    const forte = banco([{ ...c[0], correnteMax: 1 }, c[1]], { "PS1.+": "a", "D1.A": "a", "D1.K": "b", "PS1.-": "b" });
    expect(forte.aspetto.D1.bruciato).toBe(true);
  });

  it("il multimetro misura la tensione dell'alimentatore", () => {
    const c: ComponenteArduino[] = [
      { id: "PS1", tipo: "alimentatore", tensione: 7.5 },
      { id: "XMM1", tipo: "multimetro", funzione: "V" },
    ];
    const nodoDi = nodi({ "PS1.+": "a", "XMM1.V": "a", "PS1.-": "b", "XMM1.COM": "b" });
    const { risultato } = risolviBanco(c, nodoDi, {}, nessuna);
    const m = misureMultimetri(c, nodoDi, nessuna, risultato).XMM1;
    expect(testoMultimetro(m.funzione!, m.misura!)).toBe("7,50 V");
  });
});

describe("pile", () => {
  it("pila da 9 V con 1,5 Ω di resistenza interna", () => {
    const c: ComponenteArduino[] = [
      { id: "B1", tipo: "batteria-9v" },
      { id: "R1", tipo: "resistenza", valore: 88.5 },
    ];
    const { aspetto } = banco(c, { "B1.+": "a", "R1.1": "a", "R1.2": "b", "B1.-": "b" });
    expect(aspetto.B1.corrente).toBeCloseTo(0.1, 4);
    expect(aspetto.B1.tensione).toBeCloseTo(8.85, 2);
  });

  it("portapile con 4 stilo: 6 V a vuoto", () => {
    const c: ComponenteArduino[] = [
      { id: "B1", tipo: "portapile-4aa" },
      { id: "R1", tipo: "resistenza", valore: 1e6 },
    ];
    const { aspetto } = banco(c, { "B1.+": "a", "R1.1": "a", "R1.2": "b", "B1.-": "b" });
    expect(aspetto.B1.tensione).toBeCloseTo(6, 2);
  });
});

describe("alimentatore e Arduino insieme", () => {
  // Partitore 10 k / 10 k sull'alimentatore, con il − sul GND della scheda e il centro su A0.
  const componenti: ComponenteArduino[] = [
    { id: "U1", tipo: "arduino-uno" },
    { id: "PS1", tipo: "alimentatore", tensione: 6 },
    { id: "R1", tipo: "resistenza", valore: 10000 },
    { id: "R2", tipo: "resistenza", valore: 10000 },
  ];
  const tabella = { "PS1.+": "p", "R1.1": "p", "R1.2": "m", "R2.1": "m", "U1.A0": "m", "R2.2": "g", "PS1.-": "g", "U1.GND1": "g" };

  it("senza il − sul GND della scheda la lettura di A0 è flottante", () => {
    const nodoDi = nodi({ ...tabella, "PS1.-": "staccato", "R2.2": "staccato" });
    const { risultato } = risolviBanco(componenti, nodoDi, {}, nessuna);
    expect(risultato.flottanti.has(nodoDi("U1", "A0"))).toBe(true);
  });

  it("analogRead legge metà della tensione dell'alimentatore", () => {
    const nodoDi = nodi(tabella);
    const { risultato } = risolviBanco(componenti, nodoDi, {}, nessuna);
    expect(letturaAnalogica(risultato, nodoDi("U1", "A0"))).toBe(Math.round((3 / 5) * 1023));
  });

  it("in simulazione un clic alza la tensione di 0,5 V e il programma lo legge", () => {
    const codice = `int v;\nvoid setup() { Serial.begin(9600); }\nvoid loop() { v = analogRead(A0); Serial.println(v); delay(100); }`;
    const s = avviaSessioneArduino(codice, componenti, nodi(tabella));
    passoArduino(s, 150);
    expect(s.aspetto.PS1.tensione).toBeCloseTo(6, 2);
    clicGiuArduino(s, "PS1");
    clicGiuArduino(s, "PS1");
    expect(s.aspetto.PS1.tensione).toBeCloseTo(7, 2);
    passoArduino(s, 150);
    const righe = s.seriale.trim().split(/\r?\n/);
    expect(Number(righe[righe.length - 1])).toBe(Math.round((3.5 / 5) * 1023));
    clicGiuArduino(s, "PS1", true);
    expect(s.aspetto.PS1.tensione).toBeCloseTo(6.5, 2);
  });
});
