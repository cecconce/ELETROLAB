import { describe, expect, it } from "vitest";
import {
  collega,
  direzioneMorsetto,
  filiSulMorsetto,
  instrada,
  morsettiDelComponente,
  percorsoFilo,
  ripristinaPercorso,
  semplificaPercorso,
  spostaTrattoFilo,
  type MorsettiDelTipo,
} from "./fili";
import { SCHEMA_VUOTO, spostaComponente, type ComponenteSchema, type Schema } from "./schema";
import type { Punto } from "./geometria";

// Un pulsante (morsetti 13 in alto e 14 in basso) e una bobina (A1 in alto, A2 in basso),
// come nel circuito di comando più semplice.
const MORSETTI: Record<string, { id: string; x: number; y: number }[]> = {
  pulsante: [
    { id: "13", x: 20, y: 0 },
    { id: "14", x: 20, y: 80 },
  ],
  bobina: [
    { id: "A1", x: 20, y: 0 },
    { id: "A2", x: 20, y: 80 },
  ],
  lampada: [
    { id: "X1", x: 0, y: 20 },
    { id: "X2", x: 40, y: 20 },
  ],
};
const morsettiDi: MorsettiDelTipo = (tipo) => MORSETTI[tipo];

const comp = (id: string, tipo: string, x: number, y: number): ComponenteSchema => ({
  id,
  tipo,
  etichetta: id,
  x,
  y,
  larghezza: 40,
  altezza: tipo === "lampada" ? 40 : 80,
});

const schemaBase: Schema = {
  componenti: [comp("S1", "pulsante", 100, 0), comp("K1", "bobina", 100, 200), comp("H1", "lampada", 300, 100)],
  fili: [],
};

/** Ogni tratto del percorso deve essere orizzontale o verticale. */
function eOrtogonale(punti: readonly Punto[]): boolean {
  return punti.every((p, i) => i === 0 || p.x === punti[i - 1].x || p.y === punti[i - 1].y);
}

describe("morsetti", () => {
  it("ricava la direzione di uscita dal lato del componente", () => {
    const c = { larghezza: 40, altezza: 80 };
    expect(direzioneMorsetto(c, { x: 20, y: 0 })).toBe("su");
    expect(direzioneMorsetto(c, { x: 20, y: 80 })).toBe("giu");
    expect(direzioneMorsetto(c, { x: 0, y: 40 })).toBe("sinistra");
    expect(direzioneMorsetto(c, { x: 40, y: 40 })).toBe("destra");
    expect(direzioneMorsetto(c, { x: 20, y: 40 })).toBe("giu");
  });

  it("calcola la posizione dei morsetti sul foglio", () => {
    const m = morsettiDelComponente(schemaBase.componenti[0], morsettiDi);
    expect(m.map((x) => [x.morsetto, x.posizione])).toEqual([
      ["13", { x: 120, y: 0 }],
      ["14", { x: 120, y: 80 }],
    ]);
  });
});

describe("instradamento automatico", () => {
  it("collega con un tratto dritto due morsetti allineati e affacciati", () => {
    const esito = collega(schemaBase, { componente: "S1", morsetto: "14" }, { componente: "K1", morsetto: "A1" }, morsettiDi);
    expect(esito.ok).toBe(true);
    if (!esito.ok) return;
    expect(percorsoFilo(esito.schema, esito.filo, morsettiDi)).toEqual([
      { x: 120, y: 80 },
      { x: 120, y: 200 },
    ]);
  });

  it("usa solo tratti orizzontali e verticali e parte/arriva esattamente sui morsetti", () => {
    const s = { ...schemaBase, componenti: [schemaBase.componenti[0], comp("K1", "bobina", 260, 220)] };
    const esito = collega(s, { componente: "S1", morsetto: "14" }, { componente: "K1", morsetto: "A1" }, morsettiDi);
    if (!esito.ok) throw new Error("collegamento rifiutato");
    const p = percorsoFilo(esito.schema, esito.filo, morsettiDi)!;
    expect(p[0]).toEqual({ x: 120, y: 80 });
    expect(p[p.length - 1]).toEqual({ x: 280, y: 220 });
    expect(eOrtogonale(p)).toBe(true);
    // Z verticale: giù, orizzontale a metà strada (sulla griglia), giù.
    expect(p).toEqual([
      { x: 120, y: 80 },
      { x: 120, y: 160 },
      { x: 280, y: 160 },
      { x: 280, y: 220 },
    ]);
  });

  it("fa una Z orizzontale fra due morsetti laterali", () => {
    const p = instrada(
      { posizione: { x: 0, y: 0 }, direzione: "destra" },
      { posizione: { x: 200, y: 100 }, direzione: "sinistra" },
    );
    expect(eOrtogonale(p)).toBe(true);
    expect(p).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ]);
  });

  it("resta ortogonale anche fra un morsetto in basso e uno laterale", () => {
    const esito = collega(schemaBase, { componente: "S1", morsetto: "14" }, { componente: "H1", morsetto: "X1" }, morsettiDi);
    if (!esito.ok) throw new Error("collegamento rifiutato");
    const p = percorsoFilo(esito.schema, esito.filo, morsettiDi)!;
    expect(eOrtogonale(p)).toBe(true);
    expect(p[0]).toEqual({ x: 120, y: 80 });
    expect(p[p.length - 1]).toEqual({ x: 300, y: 120 });
  });

  it("segue il componente quando viene spostato", () => {
    const esito = collega(schemaBase, { componente: "S1", morsetto: "14" }, { componente: "K1", morsetto: "A1" }, morsettiDi);
    if (!esito.ok) throw new Error("collegamento rifiutato");
    const spostato = spostaComponente(esito.schema, "K1", { x: 200, y: 200 });
    const p = percorsoFilo(spostato, esito.filo, morsettiDi)!;
    expect(p[p.length - 1]).toEqual({ x: 220, y: 200 });
    expect(eOrtogonale(p)).toBe(true);
    // Spostare un componente non tocca l'elenco dei fili.
    expect(spostato.fili).toBe(esito.schema.fili);
  });

  it("semplifica punti doppi e allineati", () => {
    expect(
      semplificaPercorso([
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 20 },
        { x: 0, y: 40 },
        { x: 20, y: 40 },
      ]),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 40 },
      { x: 20, y: 40 },
    ]);
  });
});

describe("creazione dei collegamenti", () => {
  const s14 = { componente: "S1", morsetto: "14" };
  const a1 = { componente: "K1", morsetto: "A1" };

  it("assegna id progressivi ai fili", () => {
    const e1 = collega(schemaBase, s14, a1, morsettiDi);
    if (!e1.ok) throw new Error();
    const e2 = collega(e1.schema, { componente: "S1", morsetto: "13" }, { componente: "H1", morsetto: "X1" }, morsettiDi);
    if (!e2.ok) throw new Error();
    expect(e2.schema.fili.map((f) => f.id)).toEqual(["filo-1", "filo-2"]);
    // Lo schema di partenza non viene modificato (servirà ad Annulla).
    expect(schemaBase.fili).toEqual([]);
  });

  it("rifiuta un filo da un morsetto a se stesso", () => {
    expect(collega(schemaBase, s14, { ...s14 }, morsettiDi)).toEqual({ ok: false, errore: "fili.stessoMorsetto" });
  });

  it("rifiuta un secondo filo fra gli stessi morsetti, in qualunque verso", () => {
    const e1 = collega(schemaBase, s14, a1, morsettiDi);
    if (!e1.ok) throw new Error();
    expect(collega(e1.schema, a1, s14, morsettiDi)).toEqual({ ok: false, errore: "fili.giaCollegati" });
  });

  it("rifiuta morsetti inesistenti", () => {
    expect(collega(schemaBase, s14, { componente: "K1", morsetto: "99" }, morsettiDi)).toEqual({
      ok: false,
      errore: "fili.morsettoInesistente",
    });
    expect(collega(SCHEMA_VUOTO, s14, a1, morsettiDi).ok).toBe(false);
  });

  it("ammette più fili sullo stesso morsetto e li conta", () => {
    const e1 = collega(schemaBase, s14, a1, morsettiDi);
    if (!e1.ok) throw new Error();
    const e2 = collega(e1.schema, s14, { componente: "H1", morsetto: "X1" }, morsettiDi);
    if (!e2.ok) throw new Error();
    expect(filiSulMorsetto(e2.schema, s14)).toBe(2);
    expect(filiSulMorsetto(e2.schema, a1)).toBe(1);
  });

  it("non disegna un filo il cui componente non esiste più", () => {
    const e1 = collega(schemaBase, s14, a1, morsettiDi);
    if (!e1.ok) throw new Error();
    const senzaK1 = { ...e1.schema, componenti: e1.schema.componenti.filter((c) => c.id !== "K1") };
    expect(percorsoFilo(senzaK1, e1.filo, morsettiDi)).toBeUndefined();
  });
});

describe("spostamento dei fili", () => {
  const s = { ...schemaBase, componenti: [schemaBase.componenti[0], comp("K1", "bobina", 260, 220)] };
  const esito = collega(s, { componente: "S1", morsetto: "14" }, { componente: "K1", morsetto: "A1" }, morsettiDi);
  if (!esito.ok) throw new Error("collegamento rifiutato");

  it("trascinando il filo si sposta il tratto centrale, agganciato alla griglia", () => {
    const spostato = spostaTrattoFilo(esito.schema, esito.filo.id, { x: 999, y: 127 }, morsettiDi);
    expect(spostato.fili[0].medio).toBe(120);
    const p = percorsoFilo(spostato, spostato.fili[0], morsettiDi)!;
    expect(p[1]).toEqual({ x: 120, y: 120 });
    expect(p[2]).toEqual({ x: 280, y: 120 });
    expect(eOrtogonale(p)).toBe(true);
  });

  it("restituisce lo stesso schema se il tratto non cambia posizione", () => {
    const una = spostaTrattoFilo(esito.schema, esito.filo.id, { x: 0, y: 120 }, morsettiDi);
    expect(spostaTrattoFilo(una, esito.filo.id, { x: 50, y: 118 }, morsettiDi)).toBe(una);
  });

  it("un tratto dritto trascinato diventa una Z", () => {
    const e = collega(schemaBase, { componente: "S1", morsetto: "14" }, { componente: "K1", morsetto: "A1" }, morsettiDi);
    if (!e.ok) throw new Error();
    const spostato = spostaTrattoFilo(e.schema, e.filo.id, { x: 0, y: 140 }, morsettiDi);
    expect(percorsoFilo(spostato, spostato.fili[0], morsettiDi)!.length).toBeGreaterThanOrEqual(2);
    expect(spostato.fili[0].medio).toBe(140);
  });

  it("il doppio clic riporta il percorso automatico", () => {
    const spostato = spostaTrattoFilo(esito.schema, esito.filo.id, { x: 0, y: 100 }, morsettiDi);
    const ripristinato = ripristinaPercorso(spostato, esito.filo.id);
    expect(ripristinato.fili[0].medio).toBeUndefined();
    expect(ripristinaPercorso(ripristinato, esito.filo.id)).toBe(ripristinato);
  });
});

describe("messaggi per lo studente", () => {
  it("ogni motivo di rifiuto ha il suo testo in italiano", async () => {
    const testi = (await import("../../lingue/it.json")).default as Record<string, string>;
    for (const chiave of ["fili.stessoMorsetto", "fili.giaCollegati", "fili.morsettoInesistente", "fili.inCorso"])
      expect(testi[chiave]).toBeTruthy();
  });
});
