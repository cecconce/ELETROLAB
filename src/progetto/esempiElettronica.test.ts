// Gli esempi pronti del modulo Elettronica funzionano come descritto in «Come provarlo».
import { describe, expect, it } from "vitest";
import { avviaSessioneElettronica, clicGiuElettronica, clicSuElettronica, luminosita, passoElettronica, tensioneMorsetto, type SessioneElettronica } from "../motori/elettronica";
import { nodiDaSchema } from "../editor/arduino";
import { libreriaDelModulo } from "../editor/caricaLibreria";
import { componentiDaSchemaElettronica, problemiElettronica } from "../editor/elettronica";
import { vocePerTipo } from "../editor/libreria";
import { ESEMPI } from "./caricaEsempi";
import { apriEsempio } from "./esempi";

const libreria = libreriaDelModulo("elettronica");
const morsettiDi = (tipo: string) => vocePerTipo(libreria, tipo)?.morsetti;

function apri(file: string) {
  const esempio = ESEMPI.find((e) => e.file === file);
  if (!esempio) throw new Error(`Esempio ${file} non nel catalogo`);
  const r = apriEsempio(esempio);
  if (!r.ok) throw new Error(r.errore);
  expect(r.avvisi).toEqual([]);
  const schema = r.progetto.schema;
  // Ogni componente esiste nella libreria e ogni filo collega morsetti veri.
  for (const c of schema.componenti) expect(vocePerTipo(libreria, c.tipo), c.tipo).toBeDefined();
  const s = avviaSessioneElettronica(componentiDaSchemaElettronica(schema), nodiDaSchema(schema, morsettiDi));
  return { schema, s };
}
const scorri = (s: SessioneElettronica, secondi: number) => {
  for (let t = 0; t < secondi; t += 0.05) passoElettronica(s, 0.05);
};
const massimo = (v: number[]) => Math.max(...v);

describe("esempi del modulo Elettronica", () => {
  it("il catalogo ha 9 esempi di Elettronica con descrizione e «Come provarlo»", () => {
    const el = ESEMPI.filter((e) => e.modulo === "elettronica");
    expect(el).toHaveLength(9);
    for (const e of el) expect(e.prova.length).toBeGreaterThan(40);
  });

  it("partitore: il multimetro indica 6 V, senza problemi", () => {
    const { schema, s } = apri("elettronica-partitore.elab");
    expect(s.letture.XMM1.valore).toBeCloseTo(6, 2);
    expect(problemiElettronica(s, schema, libreria)).toEqual([]);
  });

  it("filtro RC: all'uscita circa il 71 % dell'ingresso", () => {
    const { s } = apri("elettronica-filtro-rc.elab");
    scorri(s, 0.5);
    const st = s.oscilloscopi.XSC1;
    const n = st.t.length - 200;
    const rapporto = massimo(st.canali[1].slice(n)) / massimo(st.canali[0].slice(n));
    expect(rapporto).toBeGreaterThan(0.66);
    expect(rapporto).toBeLessThan(0.76);
  });

  it("porte logiche: tabella di verità con S1 e S2", () => {
    const { s } = apri("elettronica-porte-logiche.elab");
    const sonde = () => ["X1", "X2", "X3"].map((x) => s.digitali[x].ingressi.in).join("");
    const righe: string[] = [];
    for (const [a, b] of [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ]) {
      if (s.interazioni.chiusi.has("S1") !== (a === 1)) clicGiuElettronica(s, "S1");
      if (s.interazioni.chiusi.has("S2") !== (b === 1)) clicGiuElettronica(s, "S2");
      scorri(s, 0.1);
      righe.push(sonde());
    }
    // AND, OR, XOR
    expect(righe).toEqual(["000", "011", "011", "110"]);
  });

  it("contatore: conta un impulso al secondo e S1 lo azzera", () => {
    const { s } = apri("elettronica-contatore.elab");
    // Fronti di salita a 0,5 s, 1,5 s, 2,5 s…
    scorri(s, 3.2);
    expect(s.digitali.U1.memoria).toBe(3);
    expect(s.analizzatori.XLA1.canali[0]).toContain(1);
    clicGiuElettronica(s, "S1");
    scorri(s, 0.2);
    expect(s.digitali.U1.memoria).toBe(0);
  });

  it("alimentatore: circa 13,5 V dopo il filtro e 5 V stabilizzati, LED acceso", () => {
    const { schema, s } = apri("elettronica-alimentatore.elab");
    scorri(s, 1.5);
    const st = s.oscilloscopi.XSC1;
    const n = st.t.length - 200;
    const filtrata = st.canali[0].slice(n);
    expect(Math.min(...filtrata)).toBeGreaterThan(12);
    expect(massimo(filtrata)).toBeLessThan(14.2);
    expect(tensioneMorsetto(s, "U1", "out")).toBeCloseTo(5, 1);
    expect(luminosita(s, s.componenti.find((c) => c.id === "D5")!)).toBeGreaterThan(0.2);
    expect(problemiElettronica(s, schema, libreria)).toEqual([]);
  });

  it("transistor: con S1 chiuso il LED si accende e la Vce scende quasi a zero", () => {
    const { s } = apri("elettronica-transistor.elab");
    const led = s.componenti.find((c) => c.id === "D1")!;
    expect(luminosita(s, led)).toBe(0);
    clicGiuElettronica(s, "S1");
    scorri(s, 0.1);
    expect(luminosita(s, led)).toBeGreaterThan(0.5);
    expect(s.letture.XMM1.valore!).toBeLessThan(0.3);
  });

  it("multivibratore: i due LED si accendono a turno", () => {
    const { s } = apri("elettronica-multivibratore.elab");
    const [d1, d2] = ["D1", "D2"].map((id) => s.componenti.find((c) => c.id === id)!);
    const stati = new Set<string>();
    for (let k = 0; k < 60; k++) {
      passoElettronica(s, 0.05);
      stati.add(`${luminosita(s, d1) > 0.5 ? 1 : 0}${luminosita(s, d2) > 0.5 ? 1 : 0}`);
    }
    // In 3 s si vedono sia «solo il rosso» sia «solo il verde».
    expect(stati.has("10")).toBe(true);
    expect(stati.has("01")).toBe(true);
  });

  it("amplificatore invertente: uscita 10 volte l'ingresso", () => {
    const { s } = apri("elettronica-amplificatore.elab");
    scorri(s, 0.2);
    const st = s.oscilloscopi.XSC1;
    const n = st.t.length - 200;
    expect(massimo(st.canali[0].slice(n))).toBeCloseTo(0.5, 1);
    expect(massimo(st.canali[1].slice(n))).toBeCloseTo(5, 0);
  });

  it("condensatore: con S1 si carica (63 % dopo 1 s), con S2 si scarica", () => {
    const { s } = apri("elettronica-condensatore.elab");
    expect(s.letture.XMM1.valore!).toBeCloseTo(0, 2);
    clicGiuElettronica(s, "S1");
    scorri(s, 1);
    expect(s.letture.XMM1.valore!).toBeGreaterThan(5.5);
    expect(s.letture.XMM1.valore!).toBeLessThan(7);
    scorri(s, 4);
    expect(s.letture.XMM1.valore!).toBeGreaterThan(9.8);
    clicGiuElettronica(s, "S1"); // apre: il condensatore resta carico
    scorri(s, 0.5);
    expect(s.letture.XMM1.valore!).toBeGreaterThan(9.5);
    clicGiuElettronica(s, "S2"); // tiene premuto lo scarico (τ = 1 kΩ · 100 µF = 0,1 s)
    scorri(s, 0.5);
    clicSuElettronica(s, "S2");
    expect(s.letture.XMM1.valore!).toBeLessThan(0.2);
  });
});
