// Test di eliminazione, copia e incolla.
import { describe, expect, it } from "vitest";
import { SCOSTAMENTO_INCOLLA, copiaSelezione, incolla, type LettereDelTipo } from "./appunti";
import { collega, spostaTrattoFilo, type MorsettiDelTipo } from "./fili";
import { SCHEMA_VUOTO, eliminaSelezione, tuttiGliId, type ComponenteSchema, type Schema } from "./schema";

const MORSETTI: Record<string, { id: string; x: number; y: number }[]> = {
  "pulsante-na": [
    { id: "13", x: 20, y: 0 },
    { id: "14", x: 20, y: 80 },
  ],
  bobina: [
    { id: "A1", x: 20, y: 0 },
    { id: "A2", x: 20, y: 80 },
  ],
};
const morsettiDi: MorsettiDelTipo = (tipo) => MORSETTI[tipo];
const LETTERE: Record<string, string> = { "pulsante-na": "S", bobina: "K" };
const lettereDi: LettereDelTipo = (tipo) => LETTERE[tipo];

const comp = (id: string, tipo: string, etichetta: string, x: number, y: number): ComponenteSchema => ({
  id,
  tipo,
  etichetta,
  x,
  y,
  larghezza: 40,
  altezza: 80,
});

/** S1 sopra K1 collegati da un filo (14 → A1), più una seconda bobina K2 isolata. */
function schemaDiProva(): Schema {
  let s: Schema = {
    componenti: [
      comp("pulsante-na-1", "pulsante-na", "S1", 0, 0),
      comp("bobina-1", "bobina", "K1", 0, 200),
      comp("bobina-2", "bobina", "K2", 200, 200),
    ],
    fili: [],
  };
  const e1 = collega(s, { componente: "pulsante-na-1", morsetto: "14" }, { componente: "bobina-1", morsetto: "A1" }, morsettiDi);
  if (!e1.ok) throw new Error("collegamento di prova fallito");
  s = e1.schema;
  const e2 = collega(s, { componente: "bobina-1", morsetto: "A2" }, { componente: "bobina-2", morsetto: "A2" }, morsettiDi);
  if (!e2.ok) throw new Error("collegamento di prova fallito");
  return e2.schema;
}

describe("eliminaSelezione", () => {
  it("elimina un filo selezionato lasciando i componenti", () => {
    const s = eliminaSelezione(schemaDiProva(), ["filo-1"]);
    expect(s.componenti).toHaveLength(3);
    expect(s.fili.map((f) => f.id)).toEqual(["filo-2"]);
  });

  it("eliminando un componente spariscono anche i fili collegati ai suoi morsetti", () => {
    const s = eliminaSelezione(schemaDiProva(), ["bobina-1"]);
    expect(s.componenti.map((c) => c.id)).toEqual(["pulsante-na-1", "bobina-2"]);
    expect(s.fili).toHaveLength(0);
  });

  it("con selezione vuota o id inesistenti restituisce lo stesso schema", () => {
    const s = schemaDiProva();
    expect(eliminaSelezione(s, [])).toBe(s);
    expect(eliminaSelezione(s, ["non-esiste"])).toBe(s);
  });

  it("non modifica lo schema ricevuto (serve ad Annulla)", () => {
    const s = schemaDiProva();
    const copia = JSON.stringify(s);
    eliminaSelezione(s, tuttiGliId(s));
    expect(JSON.stringify(s)).toBe(copia);
    expect(eliminaSelezione(s, tuttiGliId(s))).toEqual(SCHEMA_VUOTO);
  });
});

describe("copia e incolla", () => {
  it("senza componenti selezionati non copia nulla", () => {
    expect(copiaSelezione(schemaDiProva(), [])).toBeUndefined();
    expect(copiaSelezione(schemaDiProva(), ["filo-1"])).toBeUndefined();
  });

  it("copia i fili fra componenti copiati, non quelli che resterebbero appesi", () => {
    const a = copiaSelezione(schemaDiProva(), ["pulsante-na-1", "bobina-1"]);
    expect(a?.componenti.map((c) => c.id)).toEqual(["pulsante-na-1", "bobina-1"]);
    expect(a?.fili.map((f) => f.id)).toEqual(["filo-1"]); // filo-2 va verso K2, non copiato
  });

  it("incollando dà nuovi id, nuove sigle e sposta la copia", () => {
    const s = schemaDiProva();
    const a = copiaSelezione(s, ["pulsante-na-1", "bobina-1"])!;
    const { schema, incollati } = incolla(s, a, lettereDi);
    expect(schema.componenti).toHaveLength(5);
    const nuovi = schema.componenti.slice(3);
    expect(nuovi.map((c) => c.id)).toEqual(["pulsante-na-2", "bobina-3"]);
    expect(nuovi.map((c) => c.etichetta)).toEqual(["S2", "K3"]); // K2 è già usata
    expect(nuovi[0]).toMatchObject({ x: SCOSTAMENTO_INCOLLA, y: SCOSTAMENTO_INCOLLA });
    // Il filo copiato collega le copie, non gli originali.
    const filo = schema.fili[2];
    expect(filo).toMatchObject({
      id: "filo-3",
      da: { componente: "pulsante-na-2", morsetto: "14" },
      a: { componente: "bobina-3", morsetto: "A1" },
    });
    expect(incollati).toEqual(["pulsante-na-2", "bobina-3", "filo-3"]);
  });

  it("incolla più volte spostando ogni copia un po' più in là", () => {
    const s = schemaDiProva();
    const a = copiaSelezione(s, ["bobina-2"])!;
    const r1 = incolla(s, a, lettereDi, 0);
    const r2 = incolla(r1.schema, a, lettereDi, 1);
    const xs = r2.schema.componenti.slice(3).map((c) => c.x);
    expect(xs).toEqual([200 + SCOSTAMENTO_INCOLLA, 200 + 2 * SCOSTAMENTO_INCOLLA]);
    expect(r2.schema.componenti.slice(3).map((c) => c.etichetta)).toEqual(["K3", "K4"]);
  });

  it("gli appunti non cambiano se poi lo schema viene modificato o il componente eliminato", () => {
    const s = schemaDiProva();
    const a = copiaSelezione(s, ["pulsante-na-1", "bobina-1"])!;
    const vuoto = eliminaSelezione(s, tuttiGliId(s));
    const { schema } = incolla(vuoto, a, lettereDi);
    expect(schema.componenti.map((c) => c.etichetta)).toEqual(["S1", "K1"]);
    expect(schema.fili).toHaveLength(1);
  });

  it("il tratto centrale spostato a mano segue la copia", () => {
    const s = spostaTrattoFilo(schemaDiProva(), "filo-1", { x: 0, y: 140 }, morsettiDi);
    const a = copiaSelezione(s, ["pulsante-na-1", "bobina-1"])!;
    const { schema } = incolla(s, a, lettereDi);
    expect(schema.fili[2].medio).toBe(140 + SCOSTAMENTO_INCOLLA);
  });

  it("con un tipo sconosciuto riusa le lettere della sigla esistente", () => {
    const s: Schema = { componenti: [comp("strano-1", "strano", "KA1", 0, 0)], fili: [] };
    const { schema } = incolla(s, copiaSelezione(s, ["strano-1"])!, lettereDi);
    expect(schema.componenti[1].etichetta).toBe("KA2");
  });
});
