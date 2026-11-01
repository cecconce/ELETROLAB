// Test degli impianti animati: modelli da soli e collegati al PLC.
import { describe, expect, it } from "vitest";
import {
  APERTURA_MINIMA_CON_AUTO,
  CANCELLO,
  MODELLI_IMPIANTI_PLC,
  NASTRO,
  SEMAFORO,
  luciIncompatibili,
  operandiImpianto,
  type StatoCancello,
  type StatoNastro,
} from "./index";
import { avviaSessionePlc, clicGiuPlc, clicSuPlc, commutaIngresso, passoPlc, rilasciaTuttiPlc } from "../sessione";
import { convertiLadder, type CollegamentoLadder, type ElementoLadder } from "../rete";

/** Fa avanzare un modello per `secondi` a passi di 50 ms. */
function avanti<S>(modello: { avanza: (s: S, a: Record<string, boolean>, dt: number) => S }, s: S, attuatori: Record<string, boolean>, secondi: number): S {
  for (let t = 0; t < secondi - 1e-9; t += 0.05) s = modello.avanza(s, attuatori, 0.05);
  return s;
}

describe("nastro trasportatore", () => {
  it("un clic posa un pacco che il motore porta fino in fondo", () => {
    let s: StatoNastro = NASTRO.clicGiu!(NASTRO.statoIniziale());
    expect(NASTRO.letturaSensori(s)).toEqual({ inizio: true, fine: false });
    s = avanti(NASTRO, s, { motore: true }, 2);
    expect(s.pacchi[0]).toBeCloseTo(0.4);
    expect(NASTRO.letturaSensori(s)).toEqual({ inizio: false, fine: false });
    s = avanti(NASTRO, s, { motore: true }, 2.6);
    expect(NASTRO.letturaSensori(s).fine).toBe(true);
    s = avanti(NASTRO, s, { motore: true }, 1);
    expect(s.pacchi).toEqual([]);
    expect(s.consegnati).toBe(1);
  });

  it("a motore fermo i pacchi restano dove sono", () => {
    const s = avanti(NASTRO, NASTRO.clicGiu!(NASTRO.statoIniziale()), { motore: false }, 3);
    expect(s.pacchi).toEqual([0]);
  });

  it("non posa un pacco sopra un altro", () => {
    const s = NASTRO.clicGiu!(NASTRO.statoIniziale());
    expect(NASTRO.clicGiu!(s)).toBe(s);
  });
});

describe("semaforo", () => {
  it("le luci seguono le uscite e il pulsante pedonale si tiene premuto", () => {
    let s = SEMAFORO.avanza(SEMAFORO.statoIniziale(), { verde: true }, 0.05);
    expect([s.rosso, s.giallo, s.verde]).toEqual([false, false, true]);
    s = SEMAFORO.clicGiu!(s);
    expect(SEMAFORO.letturaSensori(s)).toEqual({ chiamata: true });
    s = SEMAFORO.clicSu!(s);
    expect(SEMAFORO.letturaSensori(s)).toEqual({ chiamata: false });
    expect(luciIncompatibili({ rosso: true, giallo: false, verde: true })).toBe(true);
  });
});

describe("cancello automatico", () => {
  it("si apre in 5 s fino al finecorsa e si richiude", () => {
    let s: StatoCancello = CANCELLO.statoIniziale();
    expect(CANCELLO.letturaSensori(s)).toEqual({ chiuso: true, aperto: false, fotocellula: false });
    s = avanti(CANCELLO, s, { apri: true }, 2.5);
    expect(s.apertura).toBeCloseTo(0.5);
    expect(CANCELLO.letturaSensori(s)).toEqual({ chiuso: false, aperto: false, fotocellula: false });
    s = avanti(CANCELLO, s, { apri: true }, 3);
    expect(CANCELLO.letturaSensori(s).aperto).toBe(true);
    s = avanti(CANCELLO, s, { chiudi: true }, 6);
    expect(CANCELLO.letturaSensori(s).chiuso).toBe(true);
  });

  it("con apertura e chiusura insieme resta fermo e lo segnala", () => {
    const s = avanti(CANCELLO, CANCELLO.statoIniziale(), { apri: true, chiudi: true }, 1);
    expect(s.apertura).toBe(0);
    expect(s.comandiOpposti).toBe(true);
  });

  it("l'auto entra solo a cancello aperto; chiudendo contro l'auto c'è l'urto", () => {
    let s = CANCELLO.statoIniziale();
    expect(CANCELLO.clicGiu!(s)).toBe(s); // cancello chiuso: l'auto non passa
    s = CANCELLO.clicGiu!(avanti(CANCELLO, s, { apri: true }, 5));
    expect(CANCELLO.letturaSensori(s).fotocellula).toBe(true);
    s = avanti(CANCELLO, s, { chiudi: true }, 5);
    expect(s.apertura).toBeCloseTo(APERTURA_MINIMA_CON_AUTO);
    expect(s.urto).toBe(true);
    s = CANCELLO.clicGiu!(s); // l'auto se ne va
    expect(s.ostacolo).toBe(false);
    expect(s.urto).toBe(false);
  });
});

describe("catalogo e operandi", () => {
  it("ogni impianto ha sensori su I e attuatori su Q proposti", () => {
    for (const m of Object.values(MODELLI_IMPIANTI_PLC)) {
      for (const s of m.sensori) expect(s.operandoPredefinito).toMatch(/^I\d+\.\d$/);
      for (const a of m.attuatori) expect(a.operandoPredefinito).toMatch(/^Q\d+\.\d$/);
    }
  });

  it("gli operandi scelti dallo studente sostituiscono i predefiniti", () => {
    expect(operandiImpianto(NASTRO, { motore: "Q1.0" })).toEqual({ inizio: "I0.2", fine: "I0.3", motore: "Q1.0" });
  });
});

describe("impianto collegato al PLC", () => {
  const el = (id: string, tipo: string, operando: string, y = 0): ElementoLadder => ({ id, tipo, operando, x: 0, y });
  const filo = (da: string, a: string): CollegamentoLadder => {
    const [c1, m1] = da.split("/");
    const [c2, m2] = a.split("/");
    return { da: { componente: c1, morsetto: m1 }, a: { componente: c2, morsetto: m2 } };
  };

  it("nastro: il motore gira finché il pacco non arriva alla fotocellula di fine", () => {
    // Q0.0 = NOT I0.3 (il nastro si ferma quando il pacco è in fondo).
    const elementi = [el("B", "ladder-barra-sinistra", ""), el("F", "ladder-contatto-nc", "I0.3"), el("M", "ladder-bobina", "Q0.0")];
    const conv = convertiLadder(elementi, [filo("B/p1", "F/in"), filo("F/out", "M/in")]);
    let s = avviaSessionePlc(conv, Object.fromEntries(elementi.map((e) => [e.id, e.operando])), undefined, undefined, {
      N1: { tipo: "impianto-nastro", operandi: operandiImpianto(NASTRO, undefined) },
    });
    s = clicGiuPlc(s, "N1"); // posa un pacco
    s = passoPlc(s, 10);
    const nastro = s.impianti.N1.stato as StatoNastro;
    expect(nastro.pacchi).toHaveLength(1);
    expect(nastro.pacchi[0]).toBeGreaterThanOrEqual(0.9);
    expect(nastro.pacchi[0]).toBeLessThan(0.95);
    expect(s.risultato.usciteAttive).toEqual([]);
  });

  it("cancello: apre con il comando, si ferma al finecorsa di aperto", () => {
    // Q0.0 (apri) = I0.0 (interruttore dalla tabella) AND NOT I0.3 (aperto)
    const elementi = [
      el("B", "ladder-barra-sinistra", ""),
      el("A", "ladder-contatto-na", "I0.0"),
      el("F", "ladder-contatto-nc", "I0.3"),
      el("M", "ladder-bobina", "Q0.0"),
    ];
    const conv = convertiLadder(elementi, [filo("B/p1", "A/in"), filo("A/out", "F/in"), filo("F/out", "M/in")]);
    let s = avviaSessionePlc(conv, Object.fromEntries(elementi.map((e) => [e.id, e.operando])), undefined, undefined, {
      C1: { tipo: "impianto-cancello", operandi: operandiImpianto(CANCELLO, undefined) },
    });
    s = passoPlc(commutaIngresso(s, "I0.0"), 6);
    expect((s.impianti.C1.stato as StatoCancello).apertura).toBe(1);
    expect(s.risultato.usciteAttive).toEqual([]);
    expect(s.risultato.stato.bit["I0.3"]).toBe(true);
  });

  it("semaforo: il pulsante pedonale arriva al PLC e si rilascia con il mouse", () => {
    const elementi = [el("B", "ladder-barra-sinistra", ""), el("P", "ladder-contatto-na", "I0.0"), el("G", "ladder-bobina", "Q0.1")];
    const conv = convertiLadder(elementi, [filo("B/p1", "P/in"), filo("P/out", "G/in")]);
    let s = avviaSessionePlc(conv, Object.fromEntries(elementi.map((e) => [e.id, e.operando])), undefined, undefined, {
      S1: { tipo: "impianto-semaforo", operandi: operandiImpianto(SEMAFORO, undefined) },
    });
    s = clicGiuPlc(s, "S1");
    expect(s.risultato.usciteAttive).toEqual(["Q0.1"]);
    expect((s.impianti.S1.stato as { giallo: boolean }).giallo).toBe(true);
    s = rilasciaTuttiPlc(s);
    expect(s.risultato.usciteAttive).toEqual([]);
    s = clicSuPlc(clicGiuPlc(s, "S1"), "S1");
    expect(s.risultato.usciteAttive).toEqual([]);
  });
});
