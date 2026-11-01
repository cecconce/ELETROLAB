// Test dell'attività 3.8: gli esempi pronti del PLC si aprono senza problemi
// e funzionano come descritto in "Come provarlo".
import { describe, expect, it } from "vitest";
import { ESEMPI, ERRORI_ESEMPI } from "./caricaEsempi";
import { apriEsempio } from "./esempi";
import type { Schema } from "../editor/schema";
import { impiantiDaSchema, programmaDaSchema } from "../editor/ladder";
import {
  avviaSessionePlc,
  clicGiuPlc,
  clicSuPlc,
  passoPlc,
  valoreBit,
  type SessionePlc,
  type StatoAscensore,
  type StatoCancello,
  type StatoNastro,
  type StatoParcheggio,
  type StatoSemaforo,
  type StatoSerbatoio,
} from "../motori/plc";

function schemaEsempio(file: string): Schema {
  const esempio = ESEMPI.find((e) => e.file === file);
  if (!esempio) throw new Error(`Esempio mancante: ${file}`);
  const esito = apriEsempio(esempio);
  if (!esito.ok) throw new Error(esito.errore);
  return esito.progetto.schema;
}

function avvia(schema: Schema): SessionePlc {
  const conv = programmaDaSchema(schema);
  expect(conv.problemi).toEqual([]);
  return avviaSessionePlc(
    conv,
    Object.fromEntries(schema.componenti.map((c) => [c.id, c.etichetta])),
    undefined,
    Object.fromEntries(schema.componenti.map((c) => [c.id, c.tipo])),
    impiantiDaSchema(schema),
  );
}

/** Id del primo componente di quel tipo con quell'operando (o del solo impianto). */
function trova(schema: Schema, tipo: string, etichetta = ""): string {
  const c = schema.componenti.find((x) => x.tipo === tipo && x.etichetta === etichetta);
  if (!c) throw new Error(`${tipo} ${etichetta} non trovato`);
  return c.id;
}

const premiERilascia = (s: SessionePlc, id: string, punto?: { x: number; y: number }) => clicSuPlc(clicGiuPlc(s, id, punto), id);

describe("catalogo degli esempi PLC", () => {
  it("ci sono gli 8 esempi del PLC, tutti apribili e senza problemi", () => {
    expect(ERRORI_ESEMPI).toEqual([]);
    const plc = ESEMPI.filter((e) => e.modulo === "plc");
    expect(plc).toHaveLength(8);
    for (const e of plc) {
      const schema = schemaEsempio(e.file);
      expect(programmaDaSchema(schema).problemi, e.file).toEqual([]);
      expect(e.descrizione.length, e.file).toBeGreaterThan(20);
      expect(e.prova.length, e.file).toBeGreaterThan(20);
    }
  });
});

describe("esempi PLC simulati", () => {
  it("marcia/arresto: resta acceso dopo la marcia, si spegne con l'arresto", () => {
    const schema = schemaEsempio("plc-marcia-arresto.elab");
    let s = avvia(schema);
    expect(s.risultato.usciteAttive).toEqual([]);
    s = premiERilascia(s, trova(schema, "quadro-pulsante-na", "I0.0"));
    s = passoPlc(s, 1);
    expect(s.risultato.usciteAttive).toEqual(["Q0.0"]);
    s = premiERilascia(s, trova(schema, "quadro-pulsante-nc", "I0.1"));
    expect(s.risultato.usciteAttive).toEqual([]);
  });

  it("telerruttore: ogni pressione cambia lo stato della lampada", () => {
    const schema = schemaEsempio("plc-telerruttore.elab");
    const pulsante = trova(schema, "quadro-pulsante-na", "I0.0");
    let s = avvia(schema);
    const stati: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      s = clicGiuPlc(s, pulsante);
      s = passoPlc(s, 0.3); // tenuto premuto un po': cambia comunque una volta sola
      s = clicSuPlc(s, pulsante);
      s = passoPlc(s, 0.2);
      stati.push(valoreBit(s.stato, "Q0.0"));
    }
    expect(stati).toEqual([true, false, true, false]);
  });

  it("nastro: dopo la marcia porta il pacco in fondo e si ferma", () => {
    const schema = schemaEsempio("plc-nastro.elab");
    const nastro = trova(schema, "impianto-nastro");
    let s = premiERilascia(avvia(schema), trova(schema, "quadro-pulsante-na", "I0.0"));
    s = clicGiuPlc(s, nastro);
    s = passoPlc(s, 8);
    expect((s.impianti[nastro].stato as StatoNastro).pacchi[0]).toBeGreaterThanOrEqual(0.9);
    expect(s.risultato.usciteAttive).toEqual(["Q0.1"]); // motore fermo, lampada "ritira il pacco"
  });

  it("semaforo: verde, giallo, rosso e di nuovo verde", () => {
    const schema = schemaEsempio("plc-semaforo.elab");
    const sem = trova(schema, "impianto-semaforo");
    let s = avvia(schema);
    const luce = () => {
      const st = s.impianti[sem].stato as StatoSemaforo;
      return [st.rosso && "rosso", st.giallo && "giallo", st.verde && "verde"].filter(Boolean).join("+");
    };
    const sequenza: string[] = [];
    for (const t of [1, 5, 2, 5]) {
      s = passoPlc(s, t);
      sequenza.push(luce());
    }
    expect(sequenza).toEqual(["verde", "giallo", "rosso", "verde"]);
  });

  it("cancello: apre fino al finecorsa, chiude e si ferma se c'è un'auto", () => {
    const schema = schemaEsempio("plc-cancello.elab");
    const cancello = trova(schema, "impianto-cancello");
    const stato = () => s.impianti[cancello].stato as StatoCancello;
    let s = premiERilascia(avvia(schema), trova(schema, "quadro-pulsante-na", "I0.0"));
    s = passoPlc(s, 6);
    expect(stato().apertura).toBe(1);
    expect(s.risultato.usciteAttive).toEqual([]);
    s = premiERilascia(s, trova(schema, "quadro-pulsante-na", "I0.1"));
    s = passoPlc(s, 1);
    expect(s.risultato.usciteAttive).toEqual(["Q0.1", "Q0.2"]);
    s = clicGiuPlc(s, cancello); // arriva un'auto
    s = passoPlc(s, 3);
    expect(stato().urto).toBe(false);
    expect(stato().apertura).toBeGreaterThan(0.6);
    expect(s.risultato.usciteAttive).toEqual([]);
  });

  it("serbatoio: si riempie fino al massimo e la pompa riparte sotto il minimo", () => {
    const schema = schemaEsempio("plc-serbatoio.elab");
    const serb = trova(schema, "impianto-serbatoio");
    const stato = () => s.impianti[serb].stato as StatoSerbatoio;
    let s = passoPlc(avvia(schema), 12);
    expect(stato().livello).toBeGreaterThanOrEqual(0.9);
    expect(valoreBit(s.stato, "Q0.0")).toBe(false);
    s = clicGiuPlc(s, trova(schema, "quadro-selettore", "I0.0")); // scarico aperto
    s = passoPlc(s, 9);
    expect(stato().livello).toBeLessThan(0.3);
    expect(valoreBit(s.stato, "Q0.0")).toBe(true); // ha ripreso a pompare sotto il minimo
    expect(stato().trabocca).toBe(false);
  });

  it("ascensore: chiamata al piano 2 e ritorno al piano 0", () => {
    const schema = schemaEsempio("plc-ascensore.elab");
    const asc = trova(schema, "impianto-ascensore");
    const pos = () => (s.impianti[asc].stato as StatoAscensore).posizione;
    let s = premiERilascia(avvia(schema), asc, { x: 130, y: 45 });
    s = passoPlc(s, 5);
    expect(pos()).toBeCloseTo(2, 1);
    expect(s.risultato.usciteAttive).toEqual([]);
    s = premiERilascia(s, asc, { x: 130, y: 245 });
    s = passoPlc(s, 5);
    expect(pos()).toBeCloseTo(0, 1);
  });

  it("parcheggio: entrano 5 auto, compare COMPLETO, la sesta aspetta finché una non esce", () => {
    const schema = schemaEsempio("plc-parcheggio.elab");
    const park = trova(schema, "impianto-parcheggio");
    const stato = () => s.impianti[park].stato as StatoParcheggio;
    let s = avvia(schema);
    for (let i = 0; i < 5; i++) {
      s = clicGiuPlc(s, park, { x: 20, y: 140 });
      s = passoPlc(s, 4);
    }
    expect(stato().auto).toBe(5);
    expect(valoreBit(s.stato, "Q0.2")).toBe(true);
    s = passoPlc(clicGiuPlc(s, park, { x: 20, y: 140 }), 4);
    expect(stato().auto).toBe(5);
    expect(stato().ingresso).toEqual({ fase: "attesa" });
    s = passoPlc(clicGiuPlc(s, park, { x: 300, y: 140 }), 4); // ne esce una
    s = passoPlc(s, 5); // la sesta entra
    expect(stato().auto).toBe(5);
    expect(stato().troppeAuto).toBe(false);
    expect(s.stato.contatori.C0.conteggio).toBe(5);
  });
});
