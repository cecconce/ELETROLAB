// Test dell'attività 2.6: frasi in italiano dei problemi dello schema.
import { describe, expect, it } from "vitest";
import { diagnosiSchema, type CodiceProblema, type Problema } from "../motori/impianti";
import { libreriaDelModulo } from "./caricaLibreria";
import { elenco, problemiDaMostrare, testoPoli, testoProblema } from "./messaggiProblemi";
import type { ComponenteSchema, Filo, Schema } from "./schema";

const libreria = libreriaDelModulo("impianti");
const comp = (id: string, tipo: string, etichetta = id, numeri?: Record<string, string>): ComponenteSchema => ({
  id,
  tipo,
  etichetta,
  x: 0,
  y: 0,
  larghezza: 40,
  altezza: 40,
  ...(numeri ? { numeriMorsetti: numeri } : {}),
});
const filo = (id: string, da: string, a: string): Filo => {
  const [c1, m1] = da.split(":");
  const [c2, m2] = a.split(":");
  return { id, da: { componente: c1, morsetto: m1 }, a: { componente: c2, morsetto: m2 } };
};

describe("frasi dei problemi", () => {
  it("elenchi e poli", () => {
    expect(elenco(["K1"])).toBe("K1");
    expect(elenco(["K1", "K2"])).toBe("K1 e K2");
    expect(elenco(["K1", "K2", "K3"])).toBe("K1, K2 e K3");
    expect(testoPoli(["L1", "N"])).toBe("L1 e N");
    expect(testoPoli(["+", "-"])).toBe("+ e −");
  });

  it("circuito aperto: cita la sigla, il morsetto e i morsetti senza filo", () => {
    // Manca il filo dalla rete al pulsante.
    const schema: Schema = {
      componenti: [comp("R", "rete-monofase", ""), comp("S1", "pulsante-na"), comp("H1", "lampada")],
      fili: [filo("f2", "S1:14", "H1:X1"), filo("f3", "H1:X2", "R:N")],
    };
    const [p] = problemiDaMostrare(diagnosiSchema(schema), schema, libreria);
    expect(p.gravita).toBe("avviso");
    expect(p.testo).toContain("Il circuito è aperto");
    expect(p.testo).toContain("il morsetto X1 di H1");
    expect(p.testo).toContain("Controlla i morsetti senza filo: il morsetto 13 di S1.");
    expect(p.componenti).toEqual(["H1", "S1"]);
  });

  it("contatto non associato: usa il nome e i numeri normativi mostrati sul foglio", () => {
    const schema: Schema = { componenti: [comp("Ka", "contatto-na", "", { "13": "33", "14": "34" })], fili: [] };
    const [p] = diagnosiSchema(schema).map((x) => testoProblema(x, schema, libreria));
    expect(p).toMatch(/^Il contatto ausiliario NA 33-34 non è legato a nessuna bobina/);
  });

  it("rete senza sigla: si usa il nome del componente", () => {
    const schema: Schema = { componenti: [comp("R", "rete-monofase", "")], fili: [] };
    const p: Problema = { codice: "stessoPolo", gravita: "avviso", componenti: ["R"], morsetti: [], poli: ["N"] };
    expect(testoProblema(p, schema, libreria)).toContain("di rete monofase sono collegati allo stesso polo (N)");
  });

  it("oscillazione: singolare e plurale", () => {
    const schema: Schema = { componenti: [comp("K1", "bobina-contattore"), comp("K2", "bobina-contattore")], fili: [] };
    const una: Problema = { codice: "oscillazione", gravita: "errore", componenti: ["K1"], morsetti: [] };
    expect(testoProblema(una, schema, libreria)).toContain("K1 continua a eccitarsi");
    expect(testoProblema({ ...una, componenti: ["K1", "K2"] }, schema, libreria)).toContain("K1 e K2 continuano");
  });

  it("ogni codice ha una frase vera (nessuna chiave grezza né segnaposto rimasto)", () => {
    const schema: Schema = { componenti: [comp("K1", "bobina-contattore"), comp("F1", "fusibile")], fili: [] };
    const codiciTutti: CodiceProblema[] = [
      "nessunaAlimentazione",
      "contattoSenzaBobina",
      "contattoBobinaMancante",
      "contattoTermicoSenzaRele",
      "circuitoAperto",
      "bobinaSenzaAlimentazione",
      "inSerie",
      "stessoPolo",
      "cortocircuito",
      "interventoCortocircuito",
      "interventoSovraccarico",
      "oscillazione",
    ];
    for (const codice of codiciTutti) {
      const testo = testoProblema(
        { codice, gravita: "avviso", componenti: ["K1", "F1"], morsetti: ["K1:A2"], morsettoPrincipale: "K1:A1", poli: ["L1", "N"], sigla: "K9" },
        schema,
        libreria,
      );
      expect(testo, codice).not.toMatch(/problemi\.|\{\w+\}/);
      expect(testo.length, codice).toBeGreaterThan(30);
    }
  });
});
