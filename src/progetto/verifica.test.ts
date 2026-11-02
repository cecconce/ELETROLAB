// Test della verifica automatica degli esercizi.
import { describe, expect, it } from "vitest";
import type { Schema } from "../editor/schema";
import { ESEMPI } from "./caricaEsempi";
import { apriEsempio } from "./esempi";
import { leggiProgetto, serializzaProgetto } from "./formato";
import { verificaEsercizio, verificaImpianto, verificaPlc } from "./verifica";

function esempio(file: string): Schema {
  const e = ESEMPI.find((x) => x.file === file)!;
  const r = apriEsempio(e);
  if (!r.ok) throw new Error(r.errore);
  return r.progetto.schema;
}
const senzaFili = (s: Schema, ...ids: string[]): Schema => ({ ...s, fili: s.fili.filter((f) => !ids.includes(f.id)) });

describe("verifica degli esercizi — Impianti", () => {
  const soluzione = esempio("marcia-arresto.elab");

  it("lo schema uguale alla soluzione è giusto", () => {
    const r = verificaImpianto(soluzione, soluzione);
    expect(r.riuscito).toBe(true);
    expect(r.prove).toBeGreaterThan(30);
  });

  it("anche con i fili disegnati in un altro ordine (conta solo il funzionamento)", () => {
    const rimescolato: Schema = { ...soluzione, fili: [...soluzione.fili].reverse().map((f, i) => ({ ...f, id: `x${i}`, da: f.a, a: f.da })) };
    expect(verificaImpianto(rimescolato, soluzione).riuscito).toBe(true);
  });

  it("senza il contatto di autoritenuta: spiega che il motore si ferma rilasciando S1", () => {
    const r = verificaImpianto(senzaFili(soluzione, "filo-18"), soluzione);
    expect(r.riuscito).toBe(false);
    expect(r.righe.join(" ")).toMatch(/rilascia S1/);
    expect(r.righe.join(" ")).toMatch(/K1|M1|H1/);
  });

  it("senza il pulsante di arresto collegato: il motore non si ferma più con S0", () => {
    // S0 cortocircuitato: il filo va direttamente da F1 96 alla marcia.
    const studente: Schema = {
      ...soluzione,
      fili: soluzione.fili.map((f) => (f.id === "filo-15" ? { ...f, da: { componente: "F1-95", morsetto: "96" } } : f.id === "filo-16" ? { ...f, da: { componente: "F1-95", morsetto: "96" } } : f)),
    };
    const r = verificaImpianto(studente, soluzione);
    expect(r.riuscito).toBe(false);
    expect(r.righe.join(" ")).toMatch(/S0/);
  });

  it("sigla diversa da quella della consegna: lo dice", () => {
    const studente: Schema = { ...soluzione, componenti: soluzione.componenti.map((c) => (c.id === "S1" ? { ...c, etichetta: "S9" } : c)) };
    const r = verificaImpianto(studente, soluzione);
    expect(r.riuscito).toBe(false);
    expect(r.righe[0]).toMatch(/S1/);
  });

  it("verso di rotazione sbagliato nel teleinvertitore (due fasi scambiate)", () => {
    const tele = esempio("teleinvertitore.elab");
    const f = tele.fili.find((x) => x.a.componente.startsWith("M1") || x.da.componente.startsWith("M1"))!;
    // scambia U e V del motore
    const studente: Schema = {
      ...tele,
      fili: tele.fili.map((x) => {
        const scambia = (e: typeof x.a) => (e.componente === "M1" && e.morsetto === "U" ? { ...e, morsetto: "V" } : e.componente === "M1" && e.morsetto === "V" ? { ...e, morsetto: "U" } : e);
        return { ...x, da: scambia(x.da), a: scambia(x.a) };
      }),
    };
    expect(f).toBeDefined();
    const r = verificaImpianto(studente, tele);
    expect(r.riuscito).toBe(false);
    expect(r.righe.join(" ")).toMatch(/rotazione/);
  });
});

describe("verifica degli esercizi — PLC", () => {
  const soluzione = esempio("plc-marcia-arresto.elab");
  it("lo schema uguale alla soluzione è giusto", () => {
    expect(verificaPlc(soluzione, soluzione).riuscito).toBe(true);
  });
  it("Ladder senza un componente: la differenza sulle uscite viene spiegata", () => {
    const togli = soluzione.componenti.find((c) => c.tipo === "ladder-contatto-na" && /^Q/.test(c.etichetta)) ?? soluzione.componenti.find((c) => c.tipo === "ladder-contatto-nc")!;
    const studente: Schema = { componenti: soluzione.componenti.filter((c) => c.id !== togli.id), fili: soluzione.fili.filter((f) => f.da.componente !== togli.id && f.a.componente !== togli.id) };
    const r = verificaPlc(studente, soluzione);
    expect(r.riuscito).toBe(false);
    expect(r.righe.join(" ")).toMatch(/Q\d\.\d/);
  });
});

describe("esercizio nel file .elab", () => {
  it("consegna e soluzione si salvano (soluzione codificata) e si rileggono", () => {
    const soluzione = esempio("marcia-arresto.elab");
    const esercizio: Schema = { ...soluzione, fili: [], esercizio: { consegna: "Completa i collegamenti: S1 avvia, S0 ferma.", soluzione: { componenti: soluzione.componenti, fili: soluzione.fili } } };
    const testo = serializzaProgetto({ modulo: "impianti", schema: esercizio }, "0.1.0");
    expect(testo).toContain("soluzioneCodificata");
    expect(testo).not.toContain('"soluzione"');
    const r = leggiProgetto(testo);
    if (!r.ok) throw new Error(r.errore);
    expect(r.progetto.schema.esercizio?.consegna).toBe("Completa i collegamenti: S1 avvia, S0 ferma.");
    expect(r.progetto.schema.esercizio?.soluzione?.fili).toHaveLength(soluzione.fili.length);
    // Lo studente apre l'esercizio senza fili: la verifica dice che non funziona.
    expect(verificaEsercizio("impianti", r.progetto.schema)?.riuscito).toBe(false);
    // Completato come la soluzione: funziona.
    expect(verificaEsercizio("impianti", { ...r.progetto.schema, fili: soluzione.fili })?.riuscito).toBe(true);
  });
  it("nei moduli senza verifica automatica restituisce null", () => {
    expect(verificaEsercizio("arduino", { componenti: [], fili: [], esercizio: { consegna: "x", soluzione: { componenti: [], fili: [] } } })).toBeNull();
  });
});
