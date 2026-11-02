// PLC posato nello schema elettrico (Fase 8): gli ingressi vengono dai fili,
// le uscite a relè comandano le bobine; il programma Ladder gira insieme.
import { describe, expect, it } from "vitest";
import type { Circuito, ComponenteCircuito, FiloCircuito } from "./simulatore";
import { avviaSessione, clicGiu, clicSu, ingressiPlcAttivi, passo, problemiSessione, uscitePlcAttive } from "./index";
import { bobina, na, parallelo, serie, type RisultatoConversione } from "../plc";

const filo = (da: string, a: string): FiloCircuito => {
  const [c1, m1] = da.split(":");
  const [c2, m2] = a.split(":");
  return { da: { componente: c1, morsetto: m1 }, a: { componente: c2, morsetto: m2 } };
};
const comp = (id: string, tipo: string, etichetta = id): ComponenteCircuito => ({ id, tipo, etichetta });

/** Programma: Q0.0 = (I0.0 OR Q0.0) AND I0.1 (marcia/arresto con autoritenuta; S0 cablato NC). */
const programma: RisultatoConversione = {
  programma: { segmenti: [{ logica: serie(parallelo(na("I0.0"), na("Q0.0")), na("I0.1")), uscite: [bobina("Q0.0")] }] },
  nodi: {},
  nodoAlimentato: null,
  ponti: [],
  usciteDeiSegmenti: [[]],
  problemi: [],
};

const circuito: Circuito = {
  componenti: [comp("RM", "rete-monofase", ""), comp("PLC1", "plc", "PLC1"), comp("S1", "pulsante-na"), comp("S0", "pulsante-nc"), comp("K1", "bobina-contattore")],
  fili: [
    filo("RM:L", "PLC1:L"),
    filo("RM:N", "PLC1:N"),
    filo("RM:L", "S1:13"),
    filo("S1:14", "PLC1:I0.0"),
    filo("RM:L", "S0:11"),
    filo("S0:12", "PLC1:I0.1"),
    filo("RM:L", "PLC1:1L"),
    filo("PLC1:Q0.0", "K1:A1"),
    filo("K1:A2", "RM:N"),
  ],
};
const k1 = (s: ReturnType<typeof avviaSessione>) => s.risultato.bobineEccitate.includes("K1");

describe("PLC nello schema degli impianti", () => {
  it("marcia/arresto: il pulsante sull'ingresso, il programma, l'uscita che eccita K1", () => {
    let s = avviaSessione(circuito, programma);
    expect(problemiSessione(s)).toEqual([]);
    expect(ingressiPlcAttivi(s)).toEqual(["I0.1"]); // S0 è NC: a riposo porta la fase
    s = passo(s, 0.1);
    expect(k1(s)).toBe(false);
    s = clicGiu(s, "S1");
    expect(ingressiPlcAttivi(s)).toEqual(["I0.0", "I0.1"]);
    s = passo(s, 0.1);
    expect(uscitePlcAttive(s)).toEqual(["Q0.0"]);
    expect(k1(s)).toBe(true);
    s = passo(clicSu(s, "S1"), 0.1);
    expect(k1(s)).toBe(true); // autoritenuta nel programma
    s = passo(clicGiu(s, "S0"), 0.1);
    expect(k1(s)).toBe(false);
  });

  it("senza alimentazione il PLC non legge gli ingressi e le uscite restano aperte", () => {
    const senzaN: Circuito = { ...circuito, fili: circuito.fili.filter((f) => !(f.a.componente === "PLC1" && f.a.morsetto === "N")) };
    let s = avviaSessione(senzaN, programma);
    s = passo(clicGiu(s, "S1"), 0.1);
    expect(ingressiPlcAttivi(s)).toEqual([]);
    expect(k1(s)).toBe(false);
  });

  it("senza programma il PLC c'è ma non comanda niente", () => {
    let s = avviaSessione(circuito);
    s = passo(clicGiu(s, "S1"), 0.1);
    expect(k1(s)).toBe(false);
  });
});
