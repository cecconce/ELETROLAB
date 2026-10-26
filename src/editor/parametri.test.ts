// Test del tempo dei temporizzatori impostato dal pannello Proprietà.
import { describe, expect, it } from "vitest";
import { leggiProgetto, serializzaProgetto } from "../progetto/formato";
import { eTemporizzatore, impostaTempo, tempoDaMostrare } from "./parametri";
import { SCHEMA_VUOTO, type Schema } from "./schema";

const schema: Schema = {
  ...SCHEMA_VUOTO,
  componenti: [
    { id: "a", tipo: "bobina-ritardata-eccitazione", etichetta: "KT1", x: 0, y: 0, larghezza: 40, altezza: 80 },
    { id: "b", tipo: "bobina-contattore", etichetta: "K1", x: 60, y: 0, larghezza: 40, altezza: 80 },
  ],
};

describe("tempo dei temporizzatori", () => {
  it("riconosce le bobine dei temporizzatori", () => {
    expect(eTemporizzatore("bobina-ritardata-eccitazione")).toBe(true);
    expect(eTemporizzatore("bobina-ritardata-diseccitazione")).toBe(true);
    expect(eTemporizzatore("bobina-contattore")).toBe(false);
    expect(eTemporizzatore("lampada")).toBe(false);
  });

  it("accetta numeri con virgola, punto e unità", () => {
    for (const [scritto, atteso] of [
      ["5", 5],
      ["2,5", 2.5],
      ["0.75", 0.75],
      [" 10 s", 10],
      ["1,234", 1.23],
    ] as const) {
      const esito = impostaTempo(schema, "a", scritto);
      expect(esito.ok, scritto).toBe(true);
      if (esito.ok) expect(esito.schema.componenti[0].tempo, scritto).toBe(atteso);
    }
  });

  it("rifiuta testi non numerici e valori fuori dai limiti, con spiegazione", () => {
    for (const scritto of ["", "abc", "-1", "601", "1,2,3"]) {
      const esito = impostaTempo(schema, "a", scritto);
      expect(esito.ok, scritto).toBe(false);
      if (!esito.ok) expect(esito.errore).toMatch(/secondi/);
    }
  });

  it("se il tempo non cambia lo schema resta lo stesso (nessun passo in Annulla)", () => {
    const esito = impostaTempo(schema, "a", "3");
    expect(esito.ok && esito.schema).toBe(schema);
  });

  it("mostra il tempo con la virgola e il predefinito se manca", () => {
    expect(tempoDaMostrare(undefined)).toBe("3");
    expect(tempoDaMostrare(2.5)).toBe("2,5");
  });

  it("il tempo viene salvato nel file .elab e riletto", () => {
    const esito = impostaTempo(schema, "a", "7,5");
    if (!esito.ok) throw new Error(esito.errore);
    const testo = serializzaProgetto({ modulo: "impianti", schema: esito.schema }, "0.1.0");
    const letto = leggiProgetto(testo);
    if (!letto.ok) throw new Error("lettura fallita");
    expect(letto.progetto.schema.componenti[0].tempo).toBe(7.5);
    expect(letto.progetto.schema.componenti[1].tempo).toBeUndefined();
  });
});
