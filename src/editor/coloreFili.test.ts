// Colore dei fili: tavolozze dei moduli, colore disegnato e modifica dello schema.
import { describe, expect, it } from "vitest";
import { COLORI_FILI, COLORI_FILI_SCHEMA, coloreDisegnoFilo, GIALLO_VERDE, tavolozzaFili } from "./fili";
import { conColoreFilo } from "./TavolozzaFilo";
import type { Schema } from "./schema";

const filo = (morsettoDa: string, morsettoA: string, colore?: string) => ({
  id: "f1",
  da: { componente: "a", morsetto: morsettoDa },
  a: { componente: "b", morsetto: morsettoA },
  ...(colore ? { colore } : {}),
});

describe("colore dei fili", () => {
  it("ogni modulo che disegna fili ha la sua tavolozza (CEI negli Impianti, cavetti in Arduino ed Elettronica)", () => {
    expect(tavolozzaFili("impianti")).toBe(COLORI_FILI_SCHEMA);
    expect(tavolozzaFili("arduino")).toBe(COLORI_FILI);
    expect(tavolozzaFili("elettronica")).toBe(COLORI_FILI);
    // Nel Ladder del PLC i "fili" sono collegamenti logici: niente colori.
    expect(tavolozzaFili("plc")).toEqual([]);
  });

  it("negli Impianti ci sono neutro blu chiaro e protezione giallo-verde, e il nero toglie il colore", () => {
    const nomi = COLORI_FILI_SCHEMA.map((c) => c.nome).join(" ");
    expect(nomi).toMatch(/neutro/);
    expect(COLORI_FILI_SCHEMA.some((c) => c.valore === GIALLO_VERDE)).toBe(true);
    expect(COLORI_FILI_SCHEMA[0].valore).toBeUndefined();
  });

  it("colore disegnato: in Arduino quello proposto se non scelto, negli altri moduli quello del tema", () => {
    expect(coloreDisegnoFilo("arduino", filo("GND", "13"))).toBe("#212121");
    expect(coloreDisegnoFilo("arduino", filo("GND", "13", "#6a1b9a"))).toBe("#6a1b9a");
    expect(coloreDisegnoFilo("impianti", filo("L", "1"))).toBeUndefined();
    expect(coloreDisegnoFilo("impianti", filo("L", "1", "#795548"))).toBe("#795548");
  });

  it("cambiare il colore tocca solo quel filo; il colore predefinito toglie il campo dal file", () => {
    const schema = { componenti: [], fili: [filo("L", "1"), { ...filo("N", "2"), id: "f2" }] } as unknown as Schema;
    const blu = conColoreFilo(schema, "f1", "#42a5f5");
    expect(blu.fili[0].colore).toBe("#42a5f5");
    expect(blu.fili[1].colore).toBeUndefined();
    const nero = conColoreFilo(blu, "f1", undefined);
    expect("colore" in nero.fili[0]).toBe(false);
  });
});
