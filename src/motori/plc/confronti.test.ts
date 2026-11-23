// Test dei blocchi di confronto (=, <>, <, >, <=, >=) e del contatore CTUD
// (attività 12.4): motore di scansione, conversione dal disegno e lista istruzioni.
import { describe, expect, it } from "vitest";
import {
  avanzaPlc,
  bobina,
  confronto,
  convertiLadder,
  ctd,
  ctu,
  ctudGiu,
  ctudSu,
  esitoConfronto,
  listaIstruzioni,
  na,
  reset,
  scansione,
  serie,
  statoInizialePlc,
  ton,
  type CollegamentoLadder,
  type ElementoLadder,
  type ProgrammaLadder,
  type StatoPlc,
} from "./index";

/** Simulatore minimo: `premi` = un ciclo con quegli ingressi, `attendi` = fa passare il tempo. */
function plc(programma: ProgrammaLadder) {
  let stato: StatoPlc = statoInizialePlc();
  let ingressi: Record<string, boolean> = {};
  let uscite: string[] = [];
  const api = {
    premi: (...i: string[]) => {
      ingressi = Object.fromEntries(i.map((x) => [x, true]));
      const r = scansione(programma, stato, ingressi, 0);
      stato = r.stato;
      uscite = r.usciteAttive;
      return api;
    },
    attendi: (secondi: number) => {
      const r = avanzaPlc(programma, stato, ingressi, secondi);
      stato = r.stato;
      uscite = r.usciteAttive;
      return api;
    },
    /** Impulso: premi e rilascia (due cicli). */
    impulso: (i: string) => api.premi(i).premi(),
    get uscite() {
      return uscite;
    },
    get stato() {
      return stato;
    },
  };
  return api;
}

describe("esito dei confronti", () => {
  it("i sei operatori, con la tolleranza sui decimali", () => {
    expect(esitoConfronto(3, "==", 3)).toBe(true);
    expect(esitoConfronto(0.1 + 0.2, "==", 0.3)).toBe(true); // somma non esatta
    expect(esitoConfronto(3, "<>", 3)).toBe(false);
    expect(esitoConfronto(2, "<>", 3)).toBe(true);
    expect(esitoConfronto(2, "<", 3)).toBe(true);
    expect(esitoConfronto(3, "<", 3)).toBe(false);
    expect(esitoConfronto(4, ">", 3)).toBe(true);
    expect(esitoConfronto(0.1 + 0.2, ">", 0.3)).toBe(false);
    expect(esitoConfronto(3, "<=", 3)).toBe(true);
    expect(esitoConfronto(4, "<=", 3)).toBe(false);
    expect(esitoConfronto(3, ">=", 3)).toBe(true);
    expect(esitoConfronto(2, ">=", 3)).toBe(false);
  });
});

describe("blocchi di confronto nel programma", () => {
  it("confronto sul conteggio: Q0.0 si accende da 3 pezzi in su, Q0.1 finché sono meno di 2", () => {
    const p = plc({
      segmenti: [
        { logica: na("I0.0"), uscite: [ctu("C0", 10)] },
        { logica: confronto("C0", ">=", 3), uscite: [bobina("Q0.0")] },
        { logica: confronto("C0", "<", 2), uscite: [bobina("Q0.1")] },
      ],
    });
    p.premi();
    expect(p.uscite).toEqual(["Q0.1"]); // contatore mai eseguito prima: vale 0
    p.impulso("I0.0").impulso("I0.0");
    expect(p.uscite).toEqual([]);
    p.impulso("I0.0");
    expect(p.stato.contatori.C0.conteggio).toBe(3);
    expect(p.uscite).toEqual(["Q0.0"]);
  });

  it("confronto sul tempo trascorso: una lampada a metà del temporizzatore", () => {
    // TON di 4 s; Q0.0 si accende dopo 1,5 s, prima che il TON finisca.
    const p = plc({
      segmenti: [
        { logica: na("I0.0"), uscite: [ton("T0", 4)] },
        { logica: confronto("T0", ">", 1.5), uscite: [bobina("Q0.0")] },
        { logica: na("T0"), uscite: [bobina("Q0.1")] },
      ],
    });
    p.premi("I0.0").attendi(1);
    expect(p.uscite).toEqual([]);
    p.attendi(1);
    expect(p.uscite).toEqual(["Q0.0"]);
    p.attendi(2.5);
    expect(p.uscite).toEqual(["Q0.0", "Q0.1"]);
    p.premi(); // il TON si azzera e con lui il confronto
    expect(p.uscite).toEqual([]);
  });

  it("uguale e diverso: semaforo a fasi con un solo contatore", () => {
    const p = plc({
      segmenti: [
        { logica: na("I0.0"), uscite: [ctu("C1", 3)] },
        { logica: confronto("C1", "==", 1), uscite: [bobina("Q0.0")] },
        { logica: serie(confronto("C1", "<>", 1), confronto("C1", "<>", 0)), uscite: [bobina("Q0.1")] },
      ],
    });
    p.impulso("I0.0");
    expect(p.uscite).toEqual(["Q0.0"]);
    p.impulso("I0.0");
    expect(p.uscite).toEqual(["Q0.1"]);
  });

  it("il blocco di confronto vero risulta fra i contatti chiusi (per colorarlo)", () => {
    const r = scansione({ segmenti: [{ logica: { ...confronto("C0", "<=", 0), id: "CMP1" } as never, uscite: [bobina("Q0.0")] }] }, statoInizialePlc(), {});
    expect(r.segmenti[0].idChiusi).toEqual(["CMP1"]);
    expect(r.usciteAttive).toEqual(["Q0.0"]);
  });
});

describe("contatore CTUD", () => {
  // Parcheggio da 3 posti: I0.0 auto che entra (CU), I0.1 auto che esce (CD),
  // I0.2 azzera; Q0.0 «COMPLETO» (uscita QU), Q0.1 «VUOTO» (confronto C0 <= 0).
  const programma: ProgrammaLadder = {
    segmenti: [
      { logica: na("I0.0"), uscite: [ctudSu("C0", 3)] },
      { logica: na("I0.1"), uscite: [ctudGiu("C0", 3)] },
      { logica: na("I0.2"), uscite: [reset("C0")] },
      { logica: na("C0"), uscite: [bobina("Q0.0")] },
      { logica: confronto("C0", "<=", 0), uscite: [bobina("Q0.1")] },
    ],
  };

  it("parte da 0, conta su e giù, accende l'uscita al preset e torna a 0 col reset", () => {
    const p = plc(programma);
    p.premi();
    expect(p.uscite).toEqual(["Q0.1"]);
    p.impulso("I0.0").impulso("I0.0").impulso("I0.0");
    expect(p.stato.contatori.C0.conteggio).toBe(3);
    expect(p.uscite).toEqual(["Q0.0"]);
    p.impulso("I0.1");
    expect(p.stato.contatori.C0.conteggio).toBe(2);
    expect(p.uscite).toEqual([]);
    p.impulso("I0.2");
    expect(p.stato.contatori.C0.conteggio).toBe(0);
    expect(p.uscite).toEqual(["Q0.1"]);
  });

  it("un ingresso tenuto premuto conta una volta sola, anche se l'altro è fermo", () => {
    const p = plc(programma);
    p.premi("I0.0").attendi(2);
    expect(p.stato.contatori.C0.conteggio).toBe(1);
    p.premi("I0.0", "I0.1").attendi(2); // CD premuto mentre CU resta premuto
    expect(p.stato.contatori.C0.conteggio).toBe(0);
  });

  it("il conteggio può scendere sotto zero (come nella norma)", () => {
    const p = plc(programma);
    p.impulso("I0.1");
    expect(p.stato.contatori.C0.conteggio).toBe(-1);
    expect(p.uscite).toEqual(["Q0.1"]);
  });

  it("CTU e CTD separati sullo stesso contatore: niente conteggi a ogni ciclo con l'ingresso tenuto", () => {
    // Prima ogni blocco sovrascriveva il fronte dell'altro e un ingresso
    // tenuto premuto contava a ogni ciclo.
    const p = plc({
      segmenti: [
        { logica: na("I0.0"), uscite: [ctu("C0", 9)] },
        { logica: na("I0.1"), uscite: [ctd("C0", 9)] },
      ],
    });
    p.premi("I0.0").attendi(1);
    expect(p.stato.contatori.C0.conteggio).toBe(1);
  });
});

const el = (id: string, tipo: string, operando: string, x: number, y: number, preset?: number): ElementoLadder => ({
  id,
  tipo,
  operando,
  x,
  y,
  ...(preset !== undefined ? { preset } : {}),
});
const filo = (da: string, a: string): CollegamentoLadder => {
  const [c1, m1] = da.split("/");
  const [c2, m2] = a.split("/");
  return { da: { componente: c1, morsetto: m1 }, a: { componente: c2, morsetto: m2 } };
};

describe("confronti e CTUD disegnati sul foglio", () => {
  it("il confronto è un ponte come un contatto, con la costante nel preset", () => {
    const elementi = [
      el("B1", "ladder-barra-sinistra", "", 0, 0),
      el("S1", "ladder-contatto-na", "I0.0", 40, 40),
      el("CMP", "ladder-confronto-maggiore-uguale", "c0", 160, 40, 2),
      el("H1", "ladder-bobina", "Q0.0", 280, 40),
    ];
    const r = convertiLadder(elementi, [filo("B1/p1", "S1/in"), filo("S1/out", "CMP/in"), filo("CMP/out", "H1/in")]);
    expect(r.problemi).toEqual([]);
    expect(r.programma.segmenti[0].logica).toEqual({
      tipo: "serie",
      elementi: [
        { tipo: "contatto", contatto: "NA", operando: "I0.0", id: "S1" },
        { tipo: "confronto", operatore: ">=", operando: "C0", valore: 2, id: "CMP" },
      ],
    });
    expect(r.ponti.map((p) => p.id)).toEqual(["S1", "CMP"]);
  });

  it("un confronto deve leggere T o C", () => {
    const r = convertiLadder(
      [el("B1", "ladder-barra-sinistra", "", 0, 0), el("CMP", "ladder-confronto-uguale", "I0.0", 40, 40, 1), el("H1", "ladder-bobina", "Q0.0", 160, 40)],
      [filo("B1/p1", "CMP/in"), filo("CMP/out", "H1/in")],
    );
    expect(r.problemi).toEqual([{ codice: "operandoConfronto", componenti: ["CMP"] }]);
  });

  it("CTUD: i due ingressi diventano due segmenti dello stesso contatore", () => {
    const elementi = [
      el("B1", "ladder-barra-sinistra", "", 0, 0),
      el("S1", "ladder-contatto-na", "I0.0", 40, 40),
      el("S2", "ladder-contatto-na", "I0.1", 40, 80),
      el("C", "ladder-ctud", "C0", 160, 40, 4),
    ];
    const r = convertiLadder(elementi, [filo("B1/p1", "S1/in"), filo("B1/p2", "S2/in"), filo("S1/out", "C/CU"), filo("S2/out", "C/CD")]);
    expect(r.problemi).toEqual([]);
    expect(r.usciteDeiSegmenti).toEqual([["C"], ["C"]]);
    expect(r.programma.segmenti.map((s) => s.uscite)).toEqual([[ctudSu("C0", 4)], [ctudGiu("C0", 4)]]);
  });

  it("CTUD con il solo CU collegato: conta in avanti senza segnalare problemi", () => {
    const r = convertiLadder(
      [el("B1", "ladder-barra-sinistra", "", 0, 0), el("S1", "ladder-contatto-na", "I0.0", 40, 40), el("C", "ladder-ctud", "C0", 160, 40, 4)],
      [filo("B1/p1", "S1/in"), filo("S1/out", "C/CU")],
    );
    expect(r.problemi).toEqual([]);
    expect(r.programma.segmenti.map((s) => s.uscite)).toEqual([[ctudSu("C0", 4)]]);
  });

  it("CTUD con l'operando sbagliato", () => {
    const r = convertiLadder([el("B1", "ladder-barra-sinistra", "", 0, 0), el("C", "ladder-ctud", "T0", 160, 40, 4)], [filo("B1/p1", "C/CU")]);
    expect(r.problemi).toEqual([{ codice: "operandoBloccoErrato", componenti: ["C"] }]);
  });
});

describe("lista istruzioni di confronti e CTUD", () => {
  const righe = (testo: string) => testo.split("\n").map((r) => r.replace(/\s+\(\*.*\*\)$/, "").replace(/\s+/g, " ").trim());

  it("confronto per primo e in serie, su contatore e temporizzatore", () => {
    const testo = listaIstruzioni({
      segmenti: [
        { logica: confronto("C0", ">=", 5), uscite: [bobina("Q0.0")] },
        { logica: serie(na("I0.0"), confronto("T1", "<", 2.5)), uscite: [bobina("Q0.1")] },
      ],
    });
    expect(righe(testo)).toEqual([
      "(* Segmento 1 *)",
      "LD C0.CV",
      "GE 5",
      "ST Q0.0",
      "",
      "(* Segmento 2 *)",
      "LD I0.0",
      "AND( T1.ET",
      "LT T#2.5s",
      ")",
      "ST Q0.1",
      "",
    ]);
  });

  it("CTUD: ingresso CU in un segmento, CD nell'altro", () => {
    const testo = listaIstruzioni({
      segmenti: [
        { logica: na("I0.0"), uscite: [ctudSu("C0", 3)] },
        { logica: na("I0.1"), uscite: [ctudGiu("C0", 3)] },
      ],
    });
    expect(righe(testo)).toEqual(["(* Segmento 1 *)", "LD I0.0", "ST C0.CU", "CAL C0(PV := 3)", "", "(* Segmento 2 *)", "LD I0.1", "ST C0.CD", "CAL C0(PV := 3)", ""]);
    expect(testo).toContain("CTUD: contatore avanti/indietro");
  });
});
