// Generatore degli esercizi di esempio (strumento per chi sviluppa): parte da
// un esempio pronto (la soluzione), toglie le parti che lo studente deve
// completare e aggiunge la consegna, come farebbe il docente con il pulsante
// «📝 Esercizio». I file vanno in esempi/ e nel catalogo esempi.json.
//
// Uso: npx vite-node strumenti/genera-esercizi.ts
import { readFileSync, writeFileSync } from "node:fs";
import { leggiProgetto, serializzaProgetto } from "../src/progetto/formato";
import type { Schema } from "../src/editor/schema";

function esercizio(daFile: string, aFile: string, consegna: string, togli: (s: Schema) => Schema) {
  const r = leggiProgetto(readFileSync(new URL(`../esempi/${daFile}`, import.meta.url), "utf8"));
  if (!r.ok) throw new Error(r.errore);
  const soluzione = r.progetto.schema;
  const studente = togli(soluzione);
  const schema: Schema = { ...studente, esercizio: { consegna, soluzione: { componenti: soluzione.componenti, fili: soluzione.fili, ...(soluzione.codice !== undefined ? { codice: soluzione.codice } : {}) } } };
  writeFileSync(new URL(`../esempi/${aFile}`, import.meta.url), serializzaProgetto({ modulo: r.progetto.modulo, schema }, "0.1.0"));
  console.log(`scritto esempi/${aFile}: ${studente.fili.length} fili su ${soluzione.fili.length}`);
}

// Impianti: il circuito di potenza è pronto, quello di comando è senza fili.
esercizio(
  "marcia-arresto.elab",
  "esercizio-marcia-arresto.elab",
  "Il circuito di potenza è già collegato. Collega il circuito di comando: con S1 il contattore K1 si eccita e resta eccitato anche lasciando il pulsante (autoritenuta con il contatto 13-14 di K1), con S0 si ferma tutto, la spia H1 si accende quando il motore gira. Il contatto 95-96 del relè termico F1 deve togliere l'alimentazione al comando in caso di sovraccarico. Poi premi «✔ Verifica il funzionamento».",
  (s) => {
    const comando = new Set(["rete-1f", "F1-95", "S0", "S1", "K1-autoritenuta", "K1", "K1-spia", "H1"]);
    return { ...s, fili: s.fili.filter((f) => !comando.has(f.da.componente) && !comando.has(f.a.componente)) };
  },
);

// PLC: quadro pronto, nel Ladder manca il contatto di autoritenuta.
esercizio(
  "plc-marcia-arresto.elab",
  "esercizio-plc-autoritenuta.elab",
  "Il pulsante di marcia I0.0 accende l'uscita Q0.0 solo finché è premuto. Completa il segmento Ladder in modo che Q0.0 resti accesa anche rilasciando I0.0 (autoritenuta) e si spenga premendo l'arresto I0.1. Poi premi «✔ Verifica il funzionamento».",
  (s) => {
    const togli = s.componenti.find((c) => c.tipo === "ladder-contatto-na" && c.etichetta === "Q0.0")!.id;
    return { componenti: s.componenti.filter((c) => c.id !== togli), fili: s.fili.filter((f) => f.da.componente !== togli && f.a.componente !== togli) };
  },
);
