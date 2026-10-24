// Test del modello dello schema: posa, spostamento e selezione dei componenti.
import { describe, expect, it } from "vitest";
import {
  SCHEMA_VUOTO,
  aggiungiComponente,
  componentiNelRettangolo,
  ingombroSchema,
  rettangoloTra,
  selezionaConClic,
  selezionePerTrascinamento,
  spostaComponente,
  spostaSelezione,
  type ComponenteSchema,
  type Schema,
} from "./schema";

const base = (id: string, x: number, y: number): ComponenteSchema => ({
  id,
  tipo: "prova",
  etichetta: id,
  x,
  y,
  larghezza: 40,
  altezza: 60,
});

function schemaDiProva(): Schema {
  let s = SCHEMA_VUOTO;
  s = aggiungiComponente(s, base("a", 0, 0));
  s = aggiungiComponente(s, base("b", 100, 0));
  s = aggiungiComponente(s, base("c", 0, 200));
  return s;
}

describe("posa e spostamento", () => {
  it("aggancia alla griglia il componente aggiunto", () => {
    const s = aggiungiComponente(SCHEMA_VUOTO, base("x", 13, 29));
    expect(s.componenti[0]).toMatchObject({ x: 20, y: 20 });
    expect(SCHEMA_VUOTO.componenti).toHaveLength(0); // l'originale non cambia
  });

  it("sposta un componente agganciandolo alla griglia", () => {
    const s = spostaComponente(schemaDiProva(), "a", { x: 51, y: 68 });
    expect(s.componenti.find((c) => c.id === "a")).toMatchObject({ x: 60, y: 60 });
    expect(s.componenti.find((c) => c.id === "b")).toMatchObject({ x: 100, y: 0 });
  });

  it("restituisce lo stesso schema se la posizione non cambia", () => {
    const s = schemaDiProva();
    expect(spostaComponente(s, "a", { x: 3, y: -4 })).toBe(s);
    expect(spostaComponente(s, "inesistente", { x: 100, y: 100 })).toBe(s);
  });

  it("sposta insieme i componenti selezionati", () => {
    const s = spostaSelezione(schemaDiProva(), ["a", "b"], 38, 21);
    expect(s.componenti.map((c) => [c.id, c.x, c.y])).toEqual([
      ["a", 40, 20],
      ["b", 140, 20],
      ["c", 0, 200],
    ]);
    const fermo = schemaDiProva();
    expect(spostaSelezione(fermo, ["a"], 4, -6)).toBe(fermo);
  });
});

describe("selezione", () => {
  it("il clic semplice seleziona un solo componente", () => {
    expect(selezionaConClic([], "a", false)).toEqual(["a"]);
    expect(selezionaConClic(["a", "b"], "c", false)).toEqual(["c"]);
    const sel = ["a"];
    expect(selezionaConClic(sel, "a", false)).toBe(sel);
  });

  it("con Maiusc o Ctrl aggiunge o toglie", () => {
    expect(selezionaConClic(["a"], "b", true)).toEqual(["a", "b"]);
    expect(selezionaConClic(["a", "b"], "a", true)).toEqual(["b"]);
  });

  it("trascinare un componente selezionato muove tutto il gruppo", () => {
    expect(selezionePerTrascinamento(["a", "b"], "b")).toEqual(["a", "b"]);
    expect(selezionePerTrascinamento(["a", "b"], "c")).toEqual(["c"]);
  });

  it("il rettangolo prende solo i componenti interamente dentro", () => {
    const s = schemaDiProva();
    const r = rettangoloTra({ x: 150, y: 70 }, { x: -10, y: -10 });
    expect(r).toEqual({ x: -10, y: -10, larghezza: 160, altezza: 80 });
    expect(componentiNelRettangolo(s, r)).toEqual(["a", "b"]);
    expect(componentiNelRettangolo(s, rettangoloTra({ x: 0, y: 0 }, { x: 20, y: 20 }))).toEqual([]);
  });
});

describe("ingombro", () => {
  it("racchiude tutti i componenti", () => {
    expect(ingombroSchema(SCHEMA_VUOTO)).toBeUndefined();
    expect(ingombroSchema(schemaDiProva())).toEqual({ x: 0, y: 0, larghezza: 140, altezza: 260 });
  });
});
