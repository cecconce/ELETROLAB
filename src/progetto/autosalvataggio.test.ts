// Test del salvataggio automatico.
import { describe, expect, it } from "vitest";
import { leggiAutosalvataggio, serializzaAutosalvataggio, type Autosalvataggio } from "./autosalvataggio";
import { leggiProgetto } from "./formato";

const auto: Autosalvataggio = {
  progetto: {
    modulo: "plc",
    schema: { componenti: [{ id: "c1", tipo: "lampada", etichetta: "H1", x: 0, y: 0, larghezza: 40, altezza: 60 }], fili: [] },
  },
  percorso: "C:\\Es\\semaforo.elab",
  modificato: true,
};

describe("salvataggio automatico", () => {
  it("salvataggio e rilettura conservano schema, file d'origine e modifiche", () => {
    expect(leggiAutosalvataggio(serializzaAutosalvataggio(auto, "0.1.0"))).toEqual(auto);
    const mai = { ...auto, percorso: null, modificato: false };
    expect(leggiAutosalvataggio(serializzaAutosalvataggio(mai, "0.1.0"))).toEqual(mai);
  });

  it("è anche un normale file .elab (si può aprire a mano per recuperare il lavoro)", () => {
    const esito = leggiProgetto(serializzaAutosalvataggio(auto, "0.1.0"));
    expect(esito.ok && esito.progetto).toEqual(auto.progetto);
  });

  it("file mancante o rovinato: nessun recupero, senza errori", () => {
    expect(leggiAutosalvataggio(null)).toBeUndefined();
    expect(leggiAutosalvataggio("non json")).toBeUndefined();
    expect(leggiAutosalvataggio('{"formato":"altro"}')).toBeUndefined();
  });

  it("senza informazioni sull'origine lo schema si considera da salvare", () => {
    const testo = serializzaAutosalvataggio(auto, "0.1.0");
    const dati = JSON.parse(testo);
    delete dati.autosalvataggio;
    expect(leggiAutosalvataggio(JSON.stringify(dati))).toEqual({ ...auto, percorso: null, modificato: true });
  });
});
