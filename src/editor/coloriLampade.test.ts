// Test dei colori delle lampade di segnalazione (modulo Impianti).
import { describe, expect, it } from "vitest";
import { COLORI_LAMPADA, coloreLampada, impostaColoreLampada } from "./coloriLampade";
import { leggiProgetto, serializzaProgetto } from "../progetto/formato";
import type { Schema } from "./schema";

describe("colori delle lampade", () => {
  it("sigle normative e colore predefinito giallo", () => {
    expect(COLORI_LAMPADA.map((c) => c.sigla)).toEqual(["YE", "GN", "RD", "WH", "BU"]);
    expect(coloreLampada({}).sigla).toBe("YE");
    expect(coloreLampada({ parametri: { colore: "rosso" } }).sigla).toBe("RD");
    expect(coloreLampada({ parametri: { colore: "viola" } }).sigla).toBe("YE");
  });
  it("il colore scelto si salva nel file", () => {
    const schema: Schema = { componenti: [{ id: "H1", tipo: "lampada", etichetta: "H1", x: 0, y: 0, larghezza: 40, altezza: 80 }], fili: [] };
    const verde = impostaColoreLampada(schema, "H1", "verde");
    const r = leggiProgetto(serializzaProgetto({ modulo: "impianti", schema: verde }, "0.1.0"));
    if (!r.ok) throw new Error(r.errore);
    expect(coloreLampada(r.progetto.schema.componenti[0]).sigla).toBe("GN");
  });
});
