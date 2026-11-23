// Test del tempo dei temporizzatori impostato dal pannello Proprietà.
import { describe, expect, it } from "vitest";
import { leggiProgetto, serializzaProgetto } from "../progetto/formato";
import {
  eConfronto,
  eTemporizzatore,
  impostaTempo,
  impostaTempoCiclo,
  impostaValoreConfronto,
  tempoCicloDaMostrare,
  tempoDaMostrare,
  valoreConfrontoDaMostrare,
} from "./parametri";
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

describe("tempo di ciclo del PLC (Proprietà del foglio Ladder, attività 12.3)", () => {
  const foglio: Schema = { ...SCHEMA_VUOTO };

  it("mostra 50 ms se non è stato scelto", () => {
    expect(tempoCicloDaMostrare(undefined)).toBe("50");
    expect(tempoCicloDaMostrare(0.2)).toBe("200");
  });

  it("accetta millisecondi interi, anche con «ms», e li salva in secondi", () => {
    for (const [scritto, atteso] of [
      ["100", 0.1],
      [" 250 ms", 0.25],
      ["10", 0.01],
      ["1000", 1],
    ] as const) {
      const esito = impostaTempoCiclo(foglio, scritto);
      expect(esito.ok, scritto).toBe(true);
      if (esito.ok) expect(esito.schema.tempoCiclo, scritto).toBe(atteso);
    }
  });

  it("rifiuta valori fuori dai limiti o non interi, con spiegazione", () => {
    for (const scritto of ["", "abc", "5", "1001", "2,5", "-50"]) {
      const esito = impostaTempoCiclo(foglio, scritto);
      expect(esito.ok, scritto).toBe(false);
      if (!esito.ok) expect(esito.errore).toMatch(/millisecondi da 10 a 1000/);
    }
  });

  it("il valore predefinito non viene scritto e lo stesso valore non crea passi in Annulla", () => {
    expect(impostaTempoCiclo(foglio, "50").ok && (impostaTempoCiclo(foglio, "50") as { schema: Schema }).schema).toBe(foglio);
    const conCiclo: Schema = { ...foglio, tempoCiclo: 0.2 };
    const tornato = impostaTempoCiclo(conCiclo, "50");
    expect(tornato.ok && "tempoCiclo" in tornato.schema).toBe(false);
    const uguale = impostaTempoCiclo(conCiclo, "200");
    expect(uguale.ok && uguale.schema).toBe(conCiclo);
  });

  it("il tempo di ciclo viene salvato nel file .elab e riletto, anche quello del PLC negli Impianti", () => {
    const testo = serializzaProgetto({ modulo: "plc", schema: { ...foglio, tempoCiclo: 0.3 } }, "0.1.0");
    const letto = leggiProgetto(testo);
    expect(letto.ok && letto.progetto.schema.tempoCiclo).toBe(0.3);
    const impianto = serializzaProgetto(
      { modulo: "impianti", schema: { ...foglio, plc: { componenti: [], fili: [], tempoCiclo: 0.12 } } },
      "0.1.0",
    );
    const lettoImpianto = leggiProgetto(impianto);
    expect(lettoImpianto.ok && lettoImpianto.progetto.schema.plc?.tempoCiclo).toBe(0.12);
  });

  it("un tempo di ciclo assurdo in un file viene riportato fra i limiti", () => {
    const testo = serializzaProgetto({ modulo: "plc", schema: { ...foglio, tempoCiclo: 50 } }, "0.1.0");
    const letto = leggiProgetto(testo);
    expect(letto.ok && letto.progetto.schema.tempoCiclo).toBe(1);
  });
});

describe("costante dei blocchi di confronto del PLC (attività 12.4)", () => {
  const conConfronto: Schema = {
    ...SCHEMA_VUOTO,
    componenti: [{ id: "c", tipo: "ladder-confronto-maggiore", etichetta: "T0", x: 0, y: 0, larghezza: 80, altezza: 40 }],
  };

  it("riconosce i confronti e mostra la costante con la virgola", () => {
    expect(eConfronto("ladder-confronto-uguale")).toBe(true);
    expect(eConfronto("ladder-ctud")).toBe(false);
    expect(valoreConfrontoDaMostrare(undefined)).toBe("0");
    expect(valoreConfrontoDaMostrare(2.5)).toBe("2,5");
  });

  it("accetta interi e decimali (secondi), rifiuta il resto con spiegazione", () => {
    for (const [scritto, atteso] of [
      ["5", 5],
      ["2,5", 2.5],
      ["1,256 s", 1.26],
    ] as const) {
      const esito = impostaValoreConfronto(conConfronto, "c", scritto);
      expect(esito.ok, scritto).toBe(true);
      if (esito.ok) expect(esito.schema.componenti[0].preset, scritto).toBe(atteso);
    }
    for (const scritto of ["", "abc", "-1", "40000"]) {
      const esito = impostaValoreConfronto(conConfronto, "c", scritto);
      expect(esito.ok, scritto).toBe(false);
      if (!esito.ok) expect(esito.errore).toContain("non va bene");
    }
    // Valore uguale a quello attuale (0 predefinito): stesso schema, nessun passo in Annulla.
    const uguale = impostaValoreConfronto(conConfronto, "c", "0");
    expect(uguale.ok && uguale.schema).toBe(conConfronto);
  });
});
