// Verifica automatica degli esercizi (moduli Impianti elettrici e PLC).
//
// Idea: lo schema dello studente "funziona" se si comporta come la soluzione
// del docente. Il programma prova i due schemi con la stessa sequenza di
// azioni sui comandi (chiude i sezionatori, preme i pulsanti uno alla volta,
// poi una lunga serie di azioni pseudo-casuali sempre uguali, con attese per i
// temporizzatori) e dopo ogni azione confronta ciò che si vede: bobine
// eccitate, lampade accese, motori fermi o in rotazione (con il verso); nel
// PLC le uscite Q. Comandi e utilizzatori si riconoscono dalla sigla (S1, K1,
// M1… / I0.0, Q0.1…), quindi lo studente deve usare le sigle della consegna.
// Non conta come sono disegnati i fili: conta solo il funzionamento.
import { MODELLI_IMPIANTI, avviaSessione, azioneClic, clicGiu, clicSu, passo, type SessioneImpianto } from "../motori/impianti";
import { avviaSessionePlc, commutaIngresso, passoPlc, valoreBit, type SessionePlc } from "../motori/plc";
import { impiantiDaSchema, programmaDaSchema } from "../editor/ladder";
import { tipoUtilizzatore } from "../editor/vistaSimulazione";
import type { Schema } from "../editor/schema";
import { t } from "../testi";

export interface EsitoVerifica {
  riuscito: boolean;
  /** Spiegazioni in italiano (le prime differenze trovate o i componenti mancanti). */
  righe: string[];
  /** Quante situazioni sono state confrontate. */
  prove: number;
}

/** Generatore pseudo-casuale con seme fisso: la sequenza è sempre la stessa. */
function casuale(seme: number) {
  let x = seme >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

type Azione = { tipo: "premi" | "commuta"; sigla: string } | { tipo: "attendi"; secondi: number };

/** Sequenza di prova: prima i comandi a posizione mantenuta, poi ogni pulsante da solo, poi azioni miste. */
function sequenza(pulsanti: string[], manuali: string[], passi = 60): Azione[] {
  const a: Azione[] = [];
  for (const m of manuali) a.push({ tipo: "commuta", sigla: m });
  for (const p of pulsanti) a.push({ tipo: "premi", sigla: p });
  const r = casuale(12345);
  const tutti = [...pulsanti.map((s) => ({ tipo: "premi" as const, sigla: s })), ...manuali.map((s) => ({ tipo: "commuta" as const, sigla: s }))];
  if (tutti.length === 0) return [{ tipo: "attendi", secondi: 6 }];
  for (let i = 0; i < passi; i++) {
    if (r() < 0.15) a.push({ tipo: "attendi", secondi: 6 });
    else a.push(tutti[Math.floor(r() * tutti.length)]);
  }
  a.push({ tipo: "attendi", secondi: 6 });
  return a;
}

function descrivi(azione: Azione): string {
  if (azione.tipo === "attendi") return t("verifica.attendi", { secondi: azione.secondi });
  return t(azione.tipo === "premi" ? "verifica.premi" : "verifica.commuta", { sigla: azione.sigla });
}

/** Confronta due serie di osservazioni; restituisce le spiegazioni delle prime differenze. */
function confronta(
  azioni: Azione[],
  attese: Record<string, string>[],
  ottenute: Record<string, string>[],
): string[] {
  const righe: string[] = [];
  const giaDette = new Set<string>();
  for (let i = 0; i < attese.length && righe.length < 3; i++) {
    // Tutte le differenze nuove dello stesso momento vanno in una sola frase.
    const dettagli: string[] = [];
    for (const [chi, valore] of Object.entries(attese[i])) {
      const suo = ottenute[i][chi];
      if (suo === valore || giaDette.has(chi)) continue;
      giaDette.add(chi);
      dettagli.push(t("verifica.dettaglio", { chi, atteso: valore, ottenuto: suo ?? "?" }));
    }
    if (dettagli.length === 0) continue;
    const storia = azioni
      .slice(Math.max(0, i - 2), i + 1)
      .map(descrivi)
      .join(" → ");
    righe.push(t("verifica.differenza", { storia, dettagli: dettagli.join("; ") }));
  }
  return righe;
}

// ---------------------------------------------------------------- Impianti

function statoCarico(tipo: string, acceso: boolean, motore?: { verso: string; collegamento?: string }): string {
  const u = tipoUtilizzatore(tipo);
  if (u === "motore") {
    if (!motore) return t("verifica.fermo");
    return `${t(motore.verso === "orario" ? "verifica.giraOrario" : "verifica.giraAntiorario")}${motore.collegamento ? ` (${motore.collegamento})` : ""}`;
  }
  if (u === "bobina") return acceso ? t("verifica.eccitata") : t("verifica.diseccitata");
  if (u === "suono") return acceso ? t("verifica.suona") : t("verifica.muta");
  return acceso ? t("verifica.accesa") : t("verifica.spenta");
}

function osservaImpianto(s: SessioneImpianto, carichi: { sigla: string; tipo: string }[], idPerSigla: Map<string, string>): Record<string, string> {
  const accesi = new Set(s.risultato.carichiAlimentati);
  const o: Record<string, string> = {};
  for (const c of carichi) {
    const id = idPerSigla.get(`${c.sigla}|${c.tipo}`);
    if (!id) continue;
    o[c.sigla] = statoCarico(c.tipo, accesi.has(id), s.risultato.motori[id]);
  }
  return o;
}

export function verificaImpianto(studente: Schema, soluzione: Pick<Schema, "componenti" | "fili">): EsitoVerifica {
  const chiave = (c: { etichetta: string; tipo: string }) => `${c.etichetta}|${c.tipo}`;
  const comandi = soluzione.componenti.filter((c) => c.etichetta && (azioneClic(c.tipo) === "pulsante" || azioneClic(c.tipo) === "manuale"));
  const carichi = soluzione.componenti.filter((c) => c.etichetta && MODELLI_IMPIANTI[c.tipo]?.tipo === "carico").map((c) => ({ sigla: c.etichetta, tipo: c.tipo }));
  const delloStudente = new Map(studente.componenti.map((c) => [chiave(c), c.id]));
  const dellaSoluzione = new Map(soluzione.componenti.map((c) => [chiave(c), c.id]));
  const mancanti = [...comandi.map((c) => ({ sigla: c.etichetta, tipo: c.tipo })), ...carichi].filter((c) => !delloStudente.has(`${c.sigla}|${c.tipo}`));
  if (mancanti.length > 0) {
    return { riuscito: false, prove: 0, righe: [...new Set(mancanti.map((m) => t("verifica.manca", { sigla: m.sigla })))] };
  }
  const pulsanti = [...new Set(comandi.filter((c) => azioneClic(c.tipo) === "pulsante").map((c) => c.etichetta))];
  const manuali = [...new Set(comandi.filter((c) => azioneClic(c.tipo) === "manuale").map((c) => c.etichetta))];
  const azioni = sequenza(pulsanti, manuali);
  const esegui = (schema: Pick<Schema, "componenti" | "fili">, ids: Map<string, string>) => {
    let s = avviaSessione(schema);
    const idDi = (sigla: string) => schema.componenti.filter((c) => c.etichetta === sigla && comandi.some((k) => k.etichetta === sigla && k.tipo === c.tipo)).map((c) => c.id);
    const osservazioni: Record<string, string>[] = [];
    for (const a of azioni) {
      if (a.tipo === "attendi") s = passo(s, a.secondi);
      else if (a.tipo === "commuta") {
        for (const id of idDi(a.sigla)) s = clicGiu(s, id);
        s = passo(s, 0.3);
      } else {
        for (const id of idDi(a.sigla)) s = clicGiu(s, id);
        s = passo(s, 0.3);
        for (const id of idDi(a.sigla)) s = clicSu(s, id);
        s = passo(s, 0.3);
      }
      osservazioni.push(osservaImpianto(s, carichi, ids));
    }
    return osservazioni;
  };
  const attese = esegui(soluzione, dellaSoluzione);
  const ottenute = esegui(studente, delloStudente);
  const righe = confronta(azioni, attese, ottenute);
  return { riuscito: righe.length === 0, righe: righe.length ? righe : [t("verifica.tutteUguali", { prove: azioni.length })], prove: azioni.length };
}

// ---------------------------------------------------------------- PLC

const OPERANDO_I = /^I\d+\.[0-7]$/i;
const OPERANDO_Q = /^Q\d+\.[0-7]$/i;

function sessionePlc(schema: Schema): SessionePlc {
  return avviaSessionePlc(
    programmaDaSchema(schema),
    Object.fromEntries(schema.componenti.map((c) => [c.id, c.etichetta])),
    undefined,
    Object.fromEntries(schema.componenti.map((c) => [c.id, c.tipo])),
    impiantiDaSchema(schema),
  );
}

export function verificaPlc(studente: Schema, soluzione: Pick<Schema, "componenti" | "fili">): EsitoVerifica {
  const sol: Schema = { componenti: soluzione.componenti, fili: soluzione.fili };
  const operandi = (re: RegExp) => [...new Set([...sol.componenti, ...studente.componenti].map((c) => c.etichetta.toUpperCase()).filter((e) => re.test(e)))].sort();
  const ingressi = operandi(OPERANDO_I);
  const uscite = [...new Set(sol.componenti.map((c) => c.etichetta.toUpperCase()).filter((e) => OPERANDO_Q.test(e)))].sort();
  if (uscite.length === 0) return { riuscito: false, prove: 0, righe: [t("verifica.senzaUscite")] };
  // Gli ingressi del PLC si commutano (1/0): come un pulsante tenuto premuto e poi rilasciato.
  const azioni = sequenza([], ingressi);
  const esegui = (schema: Schema) => {
    let s = sessionePlc(schema);
    const osservazioni: Record<string, string>[] = [];
    for (const a of azioni) {
      if (a.tipo === "attendi") s = passoPlc(s, a.secondi);
      else {
        s = commutaIngresso(s, a.sigla);
        s = passoPlc(s, 0.3);
      }
      osservazioni.push(Object.fromEntries(uscite.map((q) => [q, valoreBit(s.stato, q) ? "1" : "0"])));
    }
    return osservazioni;
  };
  const attese = esegui(sol);
  const ottenute = esegui(studente);
  const righe = confronta(azioni, attese, ottenute);
  return { riuscito: righe.length === 0, righe: righe.length ? righe : [t("verifica.tutteUguali", { prove: azioni.length })], prove: azioni.length };
}

/** Moduli in cui la verifica automatica è disponibile. */
export const MODULI_VERIFICABILI = new Set(["impianti", "plc"]);

export function verificaEsercizio(modulo: string, studente: Schema): EsitoVerifica | null {
  const soluzione = studente.esercizio?.soluzione;
  if (!soluzione) return null;
  if (modulo === "impianti") return verificaImpianto(studente, soluzione);
  if (modulo === "plc") return verificaPlc(studente, soluzione);
  return null;
}
