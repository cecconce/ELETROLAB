// Test della conversione dal Ladder disegnato (componenti + fili) al programma.
import { describe, expect, it } from "vitest";
import {
  avanzaPlc,
  convertiLadder,
  scansione,
  statoInizialePlc,
  type CollegamentoLadder,
  type ElementoLadder,
  type ProgrammaLadder,
  type StatoPlc,
} from "./index";

const el = (id: string, tipo: string, operando: string, x: number, y: number, preset?: number): ElementoLadder => ({
  id,
  tipo,
  operando,
  x,
  y,
  ...(preset !== undefined ? { preset } : {}),
});
/** Filo da "comp/morsetto" a "comp/morsetto". */
const filo = (da: string, a: string): CollegamentoLadder => {
  const [c1, m1] = da.split("/");
  const [c2, m2] = a.split("/");
  return { da: { componente: c1, morsetto: m1 }, a: { componente: c2, morsetto: m2 } };
};

/** Esegue il programma con una sequenza di ingressi premuti, un ciclo per passo. */
function esegui(programma: ProgrammaLadder, sequenza: string[][]) {
  let stato: StatoPlc = statoInizialePlc();
  return sequenza.map((premuti) => {
    const r = scansione(programma, stato, Object.fromEntries(premuti.map((i) => [i, true])));
    stato = r.stato;
    return r.usciteAttive;
  });
}

describe("conversione del Ladder disegnato", () => {
  it("marcia/arresto con autoritenuta disegnata a serie e parallelo", () => {
    // Barra → [I0.0 ∥ Q0.0] → I0.1 (NC: arresto) → bobina Q0.0 → barra destra
    const elementi = [
      el("B1", "ladder-barra-sinistra", "", 0, 0),
      el("S1", "ladder-contatto-na", "I0.0", 40, 40),
      el("K1", "ladder-contatto-na", "Q0.0", 40, 100),
      el("S0", "ladder-contatto-nc", "I0.1", 160, 40),
      el("Q", "ladder-bobina", "Q0.0", 280, 40),
      el("B2", "ladder-barra-destra", "", 400, 0),
    ];
    const fili = [
      filo("B1/p1", "S1/in"),
      filo("B1/p2", "K1/in"),
      filo("S1/out", "S0/in"),
      filo("K1/out", "S0/in"),
      filo("S0/out", "Q/in"),
      filo("Q/out", "B2/p1"),
    ];
    const r = convertiLadder(elementi, fili);
    expect(r.problemi).toEqual([]);
    expect(r.usciteDeiSegmenti).toEqual([["Q"]]);
    // Arresto NC cablato come contatto NC nel programma: I0.1 = 1 quando premuto.
    expect(esegui(r.programma, [[], ["I0.0"], [], [], ["I0.1"], []])).toEqual([[], ["Q0.0"], ["Q0.0"], ["Q0.0"], [], []]);
  });

  it("tutti i morsetti della barra sono lo stesso conduttore", () => {
    const elementi = [
      el("B1", "ladder-barra-sinistra", "", 0, 0),
      el("C1", "ladder-contatto-na", "I0.0", 40, 0),
      el("C2", "ladder-contatto-na", "I0.1", 40, 80),
      el("Q1", "ladder-bobina", "Q0.0", 160, 0),
      el("Q2", "ladder-bobina", "Q0.1", 160, 80),
    ];
    const fili = [filo("B1/a", "C1/in"), filo("B1/b", "C2/in"), filo("C1/out", "Q1/in"), filo("C2/out", "Q2/in")];
    const r = convertiLadder(elementi, fili);
    expect(r.usciteDeiSegmenti).toEqual([["Q1"], ["Q2"]]);
    expect(esegui(r.programma, [["I0.1"]])).toEqual([["Q0.1"]]);
  });

  it("i segmenti seguono l'ordine dall'alto in basso del foglio", () => {
    const elementi = [
      el("B1", "ladder-barra-sinistra", "", 0, 0),
      el("Mbasso", "ladder-contatto-na", "I0.0", 40, 200),
      el("Wbasso", "ladder-bobina", "M0.0", 160, 200),
      el("Malto", "ladder-contatto-na", "M0.0", 40, 0),
      el("Walto", "ladder-bobina", "Q0.0", 160, 0),
    ];
    const fili = [filo("B1/x", "Mbasso/in"), filo("Mbasso/out", "Wbasso/in"), filo("B1/y", "Malto/in"), filo("Malto/out", "Walto/in")];
    const r = convertiLadder(elementi, fili);
    expect(r.usciteDeiSegmenti).toEqual([["Walto"], ["Wbasso"]]);
    // Il merker è scritto sotto e letto sopra: l'uscita arriva un ciclo dopo.
    expect(esegui(r.programma, [["I0.0"], ["I0.0"]])).toEqual([[], ["Q0.0"]]);
  });

  it("uscite in parallelo sullo stesso nodo formano un solo segmento", () => {
    const elementi = [
      el("B1", "ladder-barra-sinistra", "", 0, 0),
      el("C", "ladder-contatto-na", "I0.0", 40, 0),
      el("Q1", "ladder-bobina", "Q0.0", 160, 0),
      el("Q2", "ladder-bobina-set", "M0.0", 160, 60),
    ];
    const fili = [filo("B1/a", "C/in"), filo("C/out", "Q1/in"), filo("C/out", "Q2/in")];
    const r = convertiLadder(elementi, fili);
    expect(r.programma.segmenti).toHaveLength(1);
    expect(r.usciteDeiSegmenti).toEqual([["Q1", "Q2"]]);
  });

  it("uscita collegata direttamente alla barra: sempre alimentata", () => {
    const r = convertiLadder([el("B1", "ladder-barra-sinistra", "", 0, 0), el("Q", "ladder-bobina", "Q0.3", 100, 0)], [filo("B1/a", "Q/in")]);
    expect(r.programma.segmenti[0].logica).toBeNull();
    expect(esegui(r.programma, [[]])).toEqual([["Q0.3"]]);
  });

  it("circuito a ponte: trova anche il percorso che attraversa il ramo centrale", () => {
    //  barra ─ A ─ n1 ─ B ─ uscita
    //              │
    //              C (ponte)
    //              │
    //  barra ─ D ─ n2 ─ E ─ uscita
    const elementi = [
      el("B1", "ladder-barra-sinistra", "", 0, 0),
      el("A", "ladder-contatto-na", "I0.0", 40, 0),
      el("B", "ladder-contatto-na", "I0.1", 160, 0),
      el("C", "ladder-contatto-na", "I0.2", 100, 40),
      el("D", "ladder-contatto-na", "I0.3", 40, 80),
      el("E", "ladder-contatto-na", "I0.4", 160, 80),
      el("Q", "ladder-bobina", "Q0.0", 280, 40),
    ];
    const fili = [
      filo("B1/a", "A/in"),
      filo("B1/b", "D/in"),
      filo("A/out", "B/in"),
      filo("D/out", "E/in"),
      filo("A/out", "C/in"),
      filo("C/out", "D/out"),
      filo("B/out", "Q/in"),
      filo("E/out", "Q/in"),
    ];
    const r = convertiLadder(elementi, fili);
    // A-C-E e D-C-B passano dal ponte.
    expect(esegui(r.programma, [["I0.0", "I0.2", "I0.4"], ["I0.3", "I0.2", "I0.1"], ["I0.0", "I0.4"]])).toEqual([
      ["Q0.0"],
      ["Q0.0"],
      [],
    ]);
  });

  it("temporizzatore e contatore disegnati con il loro preset", () => {
    const elementi = [
      el("B1", "ladder-barra-sinistra", "", 0, 0),
      el("C", "ladder-contatto-na", "I0.0", 40, 0),
      el("T", "ladder-ton", "T0", 160, 0, 2),
      el("CT", "ladder-contatto-na", "T0", 40, 120),
      el("L", "ladder-bobina", "Q0.0", 160, 120),
    ];
    const fili = [filo("B1/a", "C/in"), filo("C/out", "T/IN"), filo("B1/b", "CT/in"), filo("CT/out", "L/in")];
    const r = convertiLadder(elementi, fili);
    expect(r.problemi).toEqual([]);
    expect(r.programma.segmenti[0].uscite[0]).toEqual({ tipo: "TON", operando: "T0", preset: 2 });
    const passo = avanzaPlc(r.programma, statoInizialePlc(), { "I0.0": true }, 2.1);
    expect(passo.usciteAttive).toEqual(["Q0.0"]);
  });

  it("indica quali contatti disegnati conducono", () => {
    const elementi = [
      el("B1", "ladder-barra-sinistra", "", 0, 0),
      el("C1", "ladder-contatto-na", "I0.0", 40, 0),
      el("C2", "ladder-contatto-nc", "I0.1", 160, 0),
      el("Q", "ladder-bobina", "Q0.0", 280, 0),
    ];
    const r = convertiLadder(elementi, [filo("B1/a", "C1/in"), filo("C1/out", "C2/in"), filo("C2/out", "Q/in")]);
    const s = scansione(r.programma, statoInizialePlc(), {});
    expect(s.segmenti[0].idChiusi).toEqual(["C2"]);
    expect(s.segmenti[0].risultato).toBe(false);
  });
});

describe("problemi trovati nella conversione", () => {
  it("manca la barra di alimentazione", () => {
    const r = convertiLadder([el("Q", "ladder-bobina", "Q0.0", 0, 0)], []);
    expect(r.problemi.map((p) => p.codice)).toContain("senzaBarra");
  });

  it("uscita senza percorso dalla barra", () => {
    const r = convertiLadder(
      [el("B1", "ladder-barra-sinistra", "", 0, 0), el("C", "ladder-contatto-na", "I0.0", 40, 0), el("Q", "ladder-bobina", "Q0.0", 160, 0)],
      [filo("C/out", "Q/in")],
    );
    expect(r.problemi).toEqual([{ codice: "uscitaNonAlimentata", componenti: ["Q"] }]);
    expect(esegui(r.programma, [["I0.0"]])).toEqual([[]]);
  });

  it("operandi non validi, bobina su ingresso, blocco con operando sbagliato", () => {
    const r = convertiLadder(
      [
        el("B1", "ladder-barra-sinistra", "", 0, 0),
        el("C", "ladder-contatto-na", "", 40, 0),
        el("Q1", "ladder-bobina", "I0.0", 160, 0),
        el("Q2", "ladder-bobina", "lampada", 160, 60),
        el("T", "ladder-ton", "C1", 160, 120, 1),
        el("R", "ladder-bobina-reset", "T0", 160, 180),
      ],
      [filo("B1/a", "C/in"), filo("C/out", "Q1/in"), filo("C/out", "Q2/in"), filo("C/out", "T/IN"), filo("C/out", "R/in")],
    );
    const codici = r.problemi.map((p) => `${p.codice}:${p.componenti.join(",")}`);
    expect(codici).toEqual(["operandoNonValido:C", "bobinaSuIngresso:Q1", "operandoNonValido:Q2", "operandoBloccoErrato:T"]);
  });

  it("fili verso componenti che non esistono vengono ignorati", () => {
    const r = convertiLadder([el("B1", "ladder-barra-sinistra", "", 0, 0), el("Q", "ladder-bobina", "Q0.0", 100, 0)], [
      filo("B1/a", "fantasma/in"),
      filo("B1/a", "Q/in"),
    ]);
    expect(r.problemi).toEqual([]);
  });

  it("un disegno troppo intricato viene segnalato invece di bloccare il programma", () => {
    // 9 stadi di 2 contatti in parallelo in serie: 2^9 = 512 percorsi.
    const elementi: ElementoLadder[] = [el("B1", "ladder-barra-sinistra", "", 0, 0), el("Q", "ladder-bobina", "Q0.0", 2000, 0)];
    const fili: CollegamentoLadder[] = [];
    let precedente = "B1/a";
    for (let i = 0; i < 9; i++) {
      for (const r of ["a", "b"]) {
        elementi.push(el(`C${i}${r}`, "ladder-contatto-na", "I0.0", i * 100, r === "a" ? 0 : 60));
        fili.push(filo(precedente, `C${i}${r}/in`));
      }
      fili.push(filo(`C${i}a/out`, `C${i}b/out`));
      precedente = `C${i}a/out`;
    }
    fili.push(filo(precedente, "Q/in"));
    const r = convertiLadder(elementi, fili);
    expect(r.problemi.map((p) => p.codice)).toEqual(["troppiPercorsi"]);
    expect(r.programma.segmenti).toEqual([]);
  });
});
