// Test degli impianti animati (2): serbatoio con pompa, ascensore, parcheggio.
import { describe, expect, it } from "vitest";
import {
  ASCENSORE,
  PARCHEGGIO,
  POSTI_PARCHEGGIO,
  SERBATOIO,
  X_PULSANTI,
  Y_PIANO,
  operandiImpianto,
  type StatoAscensore,
  type StatoParcheggio,
  type StatoSerbatoio,
} from "./index";
import { avviaSessionePlc, passoPlc } from "../sessione";
import { convertiLadder, type CollegamentoLadder, type ElementoLadder } from "../rete";

function avanti<S>(modello: { avanza: (s: S, a: Record<string, boolean>, dt: number) => S }, s: S, attuatori: Record<string, boolean>, secondi: number): S {
  for (let t = 0; t < secondi - 1e-9; t += 0.05) s = modello.avanza(s, attuatori, 0.05);
  return s;
}

describe("serbatoio con pompa", () => {
  it("la pompa lo riempie: prima il galleggiante di minimo, poi quello di massimo", () => {
    let s: StatoSerbatoio = SERBATOIO.statoIniziale();
    expect(SERBATOIO.letturaSensori(s)).toEqual({ minimo: false, massimo: false });
    s = avanti(SERBATOIO, s, { pompa: true }, 2);
    expect(SERBATOIO.letturaSensori(s)).toEqual({ minimo: true, massimo: false });
    s = avanti(SERBATOIO, s, { pompa: true }, 7);
    expect(SERBATOIO.letturaSensori(s)).toEqual({ minimo: true, massimo: true });
    expect(s.trabocca).toBe(false);
    s = avanti(SERBATOIO, s, { pompa: true }, 2);
    expect(s.livello).toBe(1);
    expect(s.trabocca).toBe(true);
  });

  it("scarico e consumo lo svuotano; il clic apre e chiude il rubinetto", () => {
    let s: StatoSerbatoio = { ...SERBATOIO.statoIniziale(), livello: 0.5 };
    s = avanti(SERBATOIO, s, { scarico: true }, 2.5);
    expect(s.livello).toBeCloseTo(0.3);
    s = SERBATOIO.clicGiu!(s);
    expect(s.consumo).toBe(true);
    s = avanti(SERBATOIO, s, {}, 20);
    expect(s.livello).toBe(0);
    expect(SERBATOIO.clicGiu!(s).consumo).toBe(false);
  });
});

describe("ascensore", () => {
  it("sale di un piano in 2 s e il finecorsa del piano lo vede", () => {
    let s: StatoAscensore = ASCENSORE.statoIniziale();
    expect(ASCENSORE.letturaSensori(s).piano0).toBe(true);
    s = avanti(ASCENSORE, s, { sali: true }, 1);
    expect(ASCENSORE.letturaSensori(s)).toMatchObject({ piano0: false, piano1: false, piano2: false });
    s = avanti(ASCENSORE, s, { sali: true }, 1);
    expect(ASCENSORE.letturaSensori(s).piano1).toBe(true);
    s = avanti(ASCENSORE, s, { sali: true }, 3);
    expect(s.posizione).toBe(2);
    expect(s.fineCorsaSuperato).toBe(true);
    s = avanti(ASCENSORE, s, { scendi: true }, 4);
    expect(s.posizione).toBeCloseTo(0);
  });

  it("salita e discesa insieme: fermo e segnalato", () => {
    const s = avanti(ASCENSORE, ASCENSORE.statoIniziale(), { sali: true, scendi: true }, 1);
    expect(s.posizione).toBe(0);
    expect(s.comandiOpposti).toBe(true);
  });

  it("i pulsanti di chiamata si scelgono con il punto del clic", () => {
    let s = ASCENSORE.clicGiu!(ASCENSORE.statoIniziale(), { x: X_PULSANTI, y: Y_PIANO[2] - 25 });
    expect(ASCENSORE.letturaSensori(s)).toMatchObject({ chiamata2: true, chiamata0: false });
    s = ASCENSORE.clicSu!(s);
    expect(ASCENSORE.letturaSensori(s).chiamata2).toBe(false);
    // Clic sul vano (non sui pulsanti): nessuna chiamata.
    expect(ASCENSORE.clicGiu!(s, { x: 40, y: 100 })).toBe(s);
  });
});

describe("parcheggio", () => {
  it("l'auto aspetta la sbarra, passa in 1,5 s e viene contata", () => {
    let s: StatoParcheggio = PARCHEGGIO.clicGiu!(PARCHEGGIO.statoIniziale(), { x: 50, y: 50 });
    expect(PARCHEGGIO.letturaSensori(s)).toEqual({ fotoIngresso: true, fotoUscita: false });
    s = avanti(PARCHEGGIO, s, {}, 2);
    expect(s.ingresso).toEqual({ fase: "attesa" });
    s = avanti(PARCHEGGIO, s, { sbarraIngresso: true }, 1.05);
    expect(s.ingresso?.fase).toBe("transito");
    s = avanti(PARCHEGGIO, s, { sbarraIngresso: true }, 1.6);
    expect(s.auto).toBe(1);
    expect(PARCHEGGIO.letturaSensori(s).fotoIngresso).toBe(false);
  });

  it("all'uscita si presenta un'auto solo se ce n'è una dentro", () => {
    const vuoto = PARCHEGGIO.statoIniziale();
    expect(PARCHEGGIO.clicGiu!(vuoto, { x: 300, y: 50 })).toBe(vuoto);
    let s: StatoParcheggio = PARCHEGGIO.clicGiu!({ ...vuoto, auto: 2 }, { x: 300, y: 50 });
    s = avanti(PARCHEGGIO, s, { sbarraUscita: true }, 3);
    expect(s.auto).toBe(1);
  });

  it("un'auto in più dei posti viene segnalata", () => {
    let s: StatoParcheggio = PARCHEGGIO.clicGiu!({ ...PARCHEGGIO.statoIniziale(), auto: POSTI_PARCHEGGIO }, { x: 10, y: 10 });
    s = avanti(PARCHEGGIO, s, { sbarraIngresso: true }, 3);
    expect(s.troppeAuto).toBe(true);
  });
});

describe("serbatoio collegato al PLC", () => {
  const el = (id: string, tipo: string, operando: string): ElementoLadder => ({ id, tipo, operando, x: 0, y: 0 });
  const filo = (da: string, a: string): CollegamentoLadder => {
    const [c1, m1] = da.split("/");
    const [c2, m2] = a.split("/");
    return { da: { componente: c1, morsetto: m1 }, a: { componente: c2, morsetto: m2 } };
  };

  it("la pompa si ferma al livello massimo", () => {
    // Pompa Q0.0 = NOT I0.3 (massimo)
    const elementi = [el("B", "ladder-barra-sinistra", ""), el("L", "ladder-contatto-nc", "I0.3"), el("P", "ladder-bobina", "Q0.0")];
    const conv = convertiLadder(elementi, [filo("B/p1", "L/in"), filo("L/out", "P/in")]);
    let s = avviaSessionePlc(conv, Object.fromEntries(elementi.map((e) => [e.id, e.operando])), undefined, undefined, {
      T: { tipo: "impianto-serbatoio", operandi: operandiImpianto(SERBATOIO, undefined) },
    });
    s = passoPlc(s, 15);
    const st = s.impianti.T.stato as StatoSerbatoio;
    expect(st.livello).toBeGreaterThanOrEqual(0.9);
    expect(st.livello).toBeLessThan(0.92);
    expect(st.trabocca).toBe(false);
  });
});
