// Test del collegamento fra editor e motore PLC: operandi proposti alla posa,
// cambio dell'operando nelle Proprietà, preset, conversione dello schema.
import { describe, expect, it } from "vitest";
import { MODELLI_LADDER, avanzaPlc, scansione, statoInizialePlc } from "../motori/plc";
import { leggiProgetto, serializzaProgetto } from "../progetto/formato";
import { cambiaSigla } from "./associazioni";
import { ICONE, libreriaDelModulo } from "./caricaLibreria";
import { collega } from "./fili";
import { eContatore, eTemporizzatore, impostaPreset, impostaTempo } from "./parametri";
import { componenteDaVoce, vocePerTipo } from "./libreria";
import { programmaDaSchema, prossimoOperando, tipiSimili } from "./ladder";
import { SCHEMA_VUOTO, aggiungiComponente, type Schema } from "./schema";

const lib = libreriaDelModulo("plc");
const morsettiDi = (tipo: string) => vocePerTipo(lib, tipo)?.morsetti;

/** Posa un componente della libreria PLC con l'angolo in alto a sinistra in (x, y). */
function posa(schema: Schema, tipo: string, x: number, y: number): { schema: Schema; id: string } {
  const voce = vocePerTipo(lib, tipo)!;
  const c = componenteDaVoce(schema, voce, { x: x + voce.larghezza / 2, y: y + voce.altezza / 2 }, lib);
  return { schema: aggiungiComponente(schema, c), id: c.id };
}

function filo(schema: Schema, da: string, a: string): Schema {
  const [c1, m1] = da.split("/");
  const [c2, m2] = a.split("/");
  const r = collega(schema, { componente: c1, morsetto: m1 }, { componente: c2, morsetto: m2 }, morsettiDi);
  if (!r.ok) throw new Error(`collegamento ${da} → ${a}: ${r.errore}`);
  return r.schema;
}

describe("libreria del PLC", () => {
  it("ogni voce ha un modello nel motore e viceversa, con icona e morsetti giusti", () => {
    const voci = lib.componenti.map((v) => v.id).sort();
    expect(voci).toEqual(Object.keys(MODELLI_LADDER).sort());
    for (const v of lib.componenti) {
      expect(ICONE.has(v.icona), v.icona).toBe(true);
      const m = MODELLI_LADDER[v.id];
      const ids = v.morsetti.map((x) => x.id);
      if (m.ruolo === "contatto") expect(ids).toEqual(expect.arrayContaining(m.morsetti));
      if (m.ruolo === "uscita") expect(ids).toContain(m.ingresso);
    }
  });
});

describe("operandi proposti alla posa", () => {
  it("contatti I0.0, I0.1…, bobine Q0.0…, temporizzatori T0…, contatori C0…", () => {
    let s = SCHEMA_VUOTO;
    const etichette: string[] = [];
    for (const tipo of ["ladder-contatto-na", "ladder-contatto-nc", "ladder-bobina", "ladder-ton", "ladder-tp", "ladder-ctu", "ladder-barra-sinistra"]) {
      const r = posa(s, tipo, 0, 0);
      s = r.schema;
      etichette.push(s.componenti.find((c) => c.id === r.id)!.etichetta);
    }
    expect(etichette).toEqual(["I0.0", "I0.1", "Q0.0", "T0", "T1", "C0", ""]);
  });

  it("dopo I0.7 si passa a I1.0 e si riempiono i buchi", () => {
    const simili = tipiSimili("ladder-contatto-na");
    const schema: Schema = {
      componenti: Array.from({ length: 8 }, (_, i) => ({
        id: `c${i}`,
        tipo: "ladder-contatto-na",
        etichetta: i === 3 ? "I5.5" : `I0.${i}`,
        x: 0,
        y: 0,
        larghezza: 80,
        altezza: 40,
      })),
      fili: [],
    };
    expect(prossimoOperando(schema, "I", simili)).toBe("I0.3");
    expect(prossimoOperando({ ...schema, componenti: schema.componenti.map((c, i) => ({ ...c, etichetta: `I0.${i}` })) }, "I", simili)).toBe("I1.0");
  });
});

describe("Proprietà nel modulo PLC", () => {
  it("l'operando si scrive al posto della sigla, anche ripetuto", () => {
    let s = posa(SCHEMA_VUOTO, "ladder-contatto-na", 0, 0).schema;
    const r2 = posa(s, "ladder-contatto-na", 0, 80);
    s = r2.schema;
    const esito = cambiaSigla(s, r2.id, " i0.0 ", lib);
    expect(esito.ok && esito.schema.componenti.map((c) => c.etichetta)).toEqual(["I0.0", "I0.0"]);
  });

  it("rifiuta operandi che il PLC non capisce", () => {
    const { schema, id } = posa(SCHEMA_VUOTO, "ladder-bobina", 0, 0);
    for (const sbagliato of ["K1", "Q0.8", "lampada"]) {
      const esito = cambiaSigla(schema, id, sbagliato, lib);
      expect(esito.ok).toBe(false);
      if (!esito.ok) expect(esito.errore).toMatch(/non è un operando del PLC/);
    }
  });

  it("temporizzatori con il tempo, contatori con il preset", () => {
    expect(eTemporizzatore("ladder-ton")).toBe(true);
    expect(eTemporizzatore("ladder-ctu")).toBe(false);
    expect(eContatore("ladder-ctd")).toBe(true);
    const { schema, id } = posa(SCHEMA_VUOTO, "ladder-ctu", 0, 0);
    const ok = impostaPreset(schema, id, "12");
    expect(ok.ok && ok.schema.componenti[0].preset).toBe(12);
    expect(impostaPreset(schema, id, "2,5").ok).toBe(false);
    expect(impostaPreset(schema, id, "-1").ok).toBe(false);
    // Il preset proposto (5) non registra modifiche inutili.
    const uguale = impostaPreset(schema, id, "5");
    expect(uguale.ok && uguale.schema).toBe(schema);
  });

  it("il preset dei contatori si salva nel file .elab", () => {
    const { schema, id } = posa(SCHEMA_VUOTO, "ladder-ctu", 0, 0);
    const esito = impostaPreset(schema, id, "7");
    if (!esito.ok) throw new Error(esito.errore);
    const riletto = leggiProgetto(serializzaProgetto({ modulo: "plc", schema: esito.schema }, "0.1.0"));
    expect(riletto.ok && riletto.progetto.schema.componenti[0].preset).toBe(7);
  });
});

describe("dallo schema disegnato al programma", () => {
  /** Marcia/arresto con autoritenuta disegnato come lo farebbe lo studente. */
  function marciaArresto(): Schema {
    let s = SCHEMA_VUOTO;
    const barra = posa(s, "ladder-barra-sinistra", 0, 0);
    s = barra.schema;
    const marcia = posa(s, "ladder-contatto-na", 60, 0); // I0.0
    s = marcia.schema;
    const arresto = posa(s, "ladder-contatto-nc", 200, 0); // I0.1
    s = arresto.schema;
    const bobina = posa(s, "ladder-bobina", 340, 0); // Q0.0
    s = bobina.schema;
    const ritenuta = posa(s, "ladder-contatto-na", 60, 40);
    s = ritenuta.schema;
    const r = cambiaSigla(s, ritenuta.id, "Q0.0", lib);
    if (!r.ok) throw new Error(r.errore);
    s = r.schema;
    s = filo(s, `${barra.id}/p1`, `${marcia.id}/in`);
    s = filo(s, `${barra.id}/p2`, `${ritenuta.id}/in`);
    s = filo(s, `${marcia.id}/out`, `${arresto.id}/in`);
    s = filo(s, `${ritenuta.id}/out`, `${arresto.id}/in`);
    s = filo(s, `${arresto.id}/out`, `${bobina.id}/in`);
    return s;
  }

  it("marcia/arresto disegnato funziona nel motore", () => {
    const { programma, problemi } = programmaDaSchema(marciaArresto());
    expect(problemi).toEqual([]);
    let stato = statoInizialePlc();
    const uscite: string[][] = [];
    for (const premuti of [["I0.0"], [], ["I0.1"], []]) {
      const r = scansione(programma, stato, Object.fromEntries(premuti.map((i) => [i, true])));
      stato = r.stato;
      uscite.push(r.usciteAttive);
    }
    expect(uscite).toEqual([["Q0.0"], ["Q0.0"], [], []]);
  });

  it("il tempo del temporizzatore disegnato diventa il suo preset", () => {
    let s = SCHEMA_VUOTO;
    const barra = posa(s, "ladder-barra-sinistra", 0, 0);
    s = barra.schema;
    const c = posa(s, "ladder-contatto-na", 60, 0);
    s = c.schema;
    const t0 = posa(s, "ladder-ton", 200, 0);
    s = t0.schema;
    const e = impostaTempo(s, t0.id, "1,5");
    if (!e.ok) throw new Error(e.errore);
    s = filo(filo(e.schema, `${barra.id}/p1`, `${c.id}/in`), `${c.id}/out`, `${t0.id}/IN`);
    const { programma } = programmaDaSchema(s);
    expect(programma.segmenti[0].uscite[0]).toEqual({ tipo: "TON", operando: "T0", preset: 1.5 });
    expect(avanzaPlc(programma, statoInizialePlc(), { "I0.0": true }, 1.6).stato.temporizzatori.T0.uscita).toBe(true);
  });
});
