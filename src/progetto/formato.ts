// Formato dei file di progetto `.elab`: JSON leggibile e modificabile a mano,
// con un numero di versione per poter cambiare il formato in futuro senza
// rompere i file degli anni precedenti.
//
// Esempio:
// {
//   "formato": "elettrolab",
//   "versione": 1,
//   "modulo": "impianti",
//   "programma": "0.1.0",
//   "salvato": "2026-10-25T21:00:00.000Z",
//   "schema": { "componenti": [ … ], "fili": [ … ] }
// }
//
// Funzioni pure, coperte da test in formato.test.ts.
import { t } from "../testi";
import { trovaModulo, type IdModulo } from "../interfaccia/moduli";
import type { ComponenteSchema, EstremoFilo, Filo, Schema } from "../editor/schema";

/** Identificativo scritto in ogni file, per riconoscere i file di ElettroLab. */
export const NOME_FORMATO = "elettrolab";
/** Versione attuale del formato. Aumentarla quando cambia la struttura e aggiungere la conversione in `aggiorna`. */
export const VERSIONE_FORMATO = 1;
export const ESTENSIONE = "elab";

/** Contenuto di un progetto, indipendente dal file in cui è salvato. */
export interface Progetto {
  modulo: IdModulo;
  schema: Schema;
}

export type EsitoLettura =
  | { ok: true; progetto: Progetto; /** Correzioni fatte durante la lettura (spiegate in italiano). */ avvisi: string[] }
  | { ok: false; errore: string };

/** Trasforma il progetto nel testo da scrivere nel file (JSON indentato, leggibile). */
export function serializzaProgetto(progetto: Progetto, versioneProgramma: string, adesso: Date = new Date()): string {
  const dati = {
    formato: NOME_FORMATO,
    versione: VERSIONE_FORMATO,
    modulo: progetto.modulo,
    programma: versioneProgramma,
    salvato: adesso.toISOString(),
    schema: schemaDaScrivere(progetto.schema),
  };
  return JSON.stringify(dati, null, 2) + "\n";
}

/** Base64 di un testo UTF-8 (per la soluzione degli esercizi). */
export function codificaTesto(testo: string): string {
  const b = new TextEncoder().encode(testo);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}
export function decodificaTesto(base64: string): string | null {
  try {
    const s = atob(base64);
    return new TextDecoder().decode(Uint8Array.from(s, (c) => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

/** Nel file la soluzione dell'esercizio va codificata, così lo studente non la legge aprendo il file. */
function schemaDaScrivere(schema: Schema): unknown {
  if (!schema.esercizio) return schema;
  const { soluzione, ...resto } = schema.esercizio;
  return { ...schema, esercizio: soluzione ? { ...resto, soluzioneCodificata: codificaTesto(JSON.stringify(soluzione)) } : resto };
}

type Oggetto = Record<string, unknown>;
const eOggetto = (v: unknown): v is Oggetto => typeof v === "object" && v !== null && !Array.isArray(v);
const eNumero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const eTesto = (v: unknown): v is string => typeof v === "string";

/** Legge un componente; undefined se mancano dati essenziali. */
function leggiComponente(v: unknown): ComponenteSchema | undefined {
  if (!eOggetto(v)) return undefined;
  const { id, tipo, etichetta, x, y, larghezza, altezza } = v;
  if (!eTesto(id) || id === "" || !eTesto(tipo) || !eNumero(x) || !eNumero(y) || !eNumero(larghezza) || !eNumero(altezza)) {
    return undefined;
  }
  const c: ComponenteSchema = { id, tipo, etichetta: eTesto(etichetta) ? etichetta : "", x, y, larghezza, altezza };
  // Numerazione dei morsetti (facoltativa): si tengono solo le coppie testo → testo.
  if (eOggetto(v.numeriMorsetti)) {
    const numeri = Object.fromEntries(Object.entries(v.numeriMorsetti).filter(([, n]) => eTesto(n) && n !== ""));
    if (Object.keys(numeri).length > 0) c.numeriMorsetti = numeri as Record<string, string>;
  }
  // Tempo dei temporizzatori (facoltativo, in secondi, mai negativo).
  if (eNumero(v.tempo) && v.tempo >= 0) c.tempo = v.tempo;
  // Preset dei contatori del PLC (facoltativo, intero non negativo).
  if (eNumero(v.preset) && v.preset >= 0) c.preset = Math.round(v.preset);
  if (eNumero(v.valore) && v.valore > 0) c.valore = v.valore;
  if (eOggetto(v.parametri)) {
    const parametri = Object.fromEntries(Object.entries(v.parametri).filter((x): x is [string, number | string] => eNumero(x[1]) || eTesto(x[1])));
    if (Object.keys(parametri).length > 0) c.parametri = parametri;
  }
  if (v.rotazione === 90 || v.rotazione === 180 || v.rotazione === 270) c.rotazione = v.rotazione;
  // Operandi dei segnali degli impianti animati (solo testi).
  if (eOggetto(v.collegamenti)) {
    const collegamenti = Object.fromEntries(Object.entries(v.collegamenti).filter((x): x is [string, string] => eTesto(x[1])));
    if (Object.keys(collegamenti).length > 0) c.collegamenti = collegamenti;
  }
  return c;
}

function leggiEstremo(v: unknown): EstremoFilo | undefined {
  if (!eOggetto(v) || !eTesto(v.componente) || !eTesto(v.morsetto)) return undefined;
  return { componente: v.componente, morsetto: v.morsetto };
}

function leggiFilo(v: unknown): Filo | undefined {
  if (!eOggetto(v) || !eTesto(v.id)) return undefined;
  const da = leggiEstremo(v.da);
  const a = leggiEstremo(v.a);
  if (!da || !a) return undefined;
  const filo: Filo = eNumero(v.medio) ? { id: v.id, da, a, medio: v.medio } : { id: v.id, da, a };
  if (eTesto(v.colore) && /^#[0-9a-fA-F]{6}$/.test(v.colore)) filo.colore = v.colore;
  // Pieghe fatte a mano: si tengono solo i punti con coordinate numeriche.
  if (Array.isArray(v.punti)) {
    const punti = v.punti.filter((p): p is { x: number; y: number } => eOggetto(p) && eNumero(p.x) && eNumero(p.y));
    if (punti.length > 0) filo.punti = punti.map((p) => ({ x: p.x, y: p.y }));
  }
  return filo;
}

/**
 * Conversione dei file di versioni precedenti alla versione attuale.
 * Per ora esiste solo la versione 1: quando il formato cambierà, qui si
 * aggiungerà un passo per ogni versione (1 → 2, 2 → 3…).
 */
function aggiorna(dati: Oggetto): Oggetto {
  return dati;
}

/**
 * Legge il testo di un file `.elab`. È tollerante con i file modificati a mano:
 * scarta i componenti incompleti e i fili che puntano a componenti
 * inesistenti, segnalandolo negli avvisi; rifiuta invece i file che non sono
 * di ElettroLab o che arrivano da una versione più nuova del programma.
 */
export function leggiProgetto(testo: string): EsitoLettura {
  let dati: unknown;
  try {
    dati = JSON.parse(testo.replace(/^\uFEFF/, "")); // il BOM aggiunto da Blocco note non deve dare fastidio
  } catch {
    return { ok: false, errore: t("file.nonJson") };
  }
  if (!eOggetto(dati) || dati.formato !== NOME_FORMATO) return { ok: false, errore: t("file.nonElettrolab") };
  const versione = dati.versione;
  if (!eNumero(versione) || !Number.isInteger(versione) || versione < 1) return { ok: false, errore: t("file.versioneNonValida") };
  if (versione > VERSIONE_FORMATO) return { ok: false, errore: t("file.versioneNuova") };
  dati = aggiorna(dati);
  const d = dati as Oggetto;
  const modulo = eTesto(d.modulo) ? trovaModulo(d.modulo) : undefined;
  if (!modulo) return { ok: false, errore: t("file.moduloSconosciuto") };
  const schemaGrezzo = eOggetto(d.schema) ? d.schema : {};
  const avvisi: string[] = [];
  const { componenti, fili } = leggiComponentiEFili(schemaGrezzo, avvisi);

  // Programma Arduino (facoltativo).
  const schema: Schema = eTesto(schemaGrezzo.codice) ? { componenti, fili, codice: schemaGrezzo.codice } : { componenti, fili };
  if (eTesto(schemaGrezzo.blocchi)) schema.blocchi = schemaGrezzo.blocchi;
  if (schemaGrezzo.modoCodice === "blocchi" || schemaGrezzo.modoCodice === "testo") schema.modoCodice = schemaGrezzo.modoCodice;
  // Programma Ladder del PLC posato nello schema degli Impianti (facoltativo).
  if (eOggetto(schemaGrezzo.plc)) schema.plc = leggiComponentiEFili(schemaGrezzo.plc, avvisi);
  // Esercizio (facoltativo): consegna e soluzione codificata.
  if (eOggetto(schemaGrezzo.esercizio) && eTesto(schemaGrezzo.esercizio.consegna)) {
    const esercizio: NonNullable<Schema["esercizio"]> = { consegna: schemaGrezzo.esercizio.consegna };
    const cod = schemaGrezzo.esercizio.soluzioneCodificata;
    const testo = eTesto(cod) ? decodificaTesto(cod) : null;
    if (testo !== null) {
      try {
        const grezza = JSON.parse(testo) as unknown;
        if (eOggetto(grezza)) {
          esercizio.soluzione = leggiComponentiEFili(grezza, []);
          if (eTesto(grezza.codice)) esercizio.soluzione.codice = grezza.codice;
        }
      } catch {
        // soluzione rovinata: l'esercizio resta senza verifica automatica
      }
    }
    schema.esercizio = esercizio;
  }
  return { ok: true, progetto: { modulo: modulo.id, schema }, avvisi };
}

/** Legge componenti e fili di uno schema, scartando (con un avviso) quelli rovinati. */
function leggiComponentiEFili(schemaGrezzo: Oggetto, avvisi: string[]): { componenti: ComponenteSchema[]; fili: Filo[] } {
  const componentiGrezzi = Array.isArray(schemaGrezzo.componenti) ? schemaGrezzo.componenti : [];
  const filiGrezzi = Array.isArray(schemaGrezzo.fili) ? schemaGrezzo.fili : [];

  const componenti: ComponenteSchema[] = [];
  const idVisti = new Set<string>();
  let scartati = 0;
  for (const v of componentiGrezzi) {
    const c = leggiComponente(v);
    // Due componenti con lo stesso id confonderebbero i fili: si tiene il primo.
    if (!c || idVisti.has(c.id)) {
      scartati++;
      continue;
    }
    idVisti.add(c.id);
    componenti.push(c);
  }
  if (scartati > 0) avvisi.push(t("file.componentiScartati", { numero: scartati }));

  const fili: Filo[] = [];
  let filiScartati = 0;
  for (const v of filiGrezzi) {
    const f = leggiFilo(v);
    if (!f || !idVisti.has(f.da.componente) || !idVisti.has(f.a.componente) || idVisti.has(f.id)) {
      filiScartati++;
      continue;
    }
    idVisti.add(f.id);
    fili.push(f);
  }
  if (filiScartati > 0) avvisi.push(t("file.filiScartati", { numero: filiScartati }));

  return { componenti, fili };
}

/** Nome del file senza cartella né estensione ("C:\\Esercizi\\marcia.elab" → "marcia"). */
export function nomeDaPercorso(percorso: string): string {
  const nome = percorso.split(/[\\/]/).pop() ?? percorso;
  return nome.replace(/\.elab$/i, "");
}

/** Aggiunge `.elab` se lo studente ha scritto il nome senza estensione. */
export function conEstensioneElab(percorso: string): string {
  return /\.elab$/i.test(percorso) ? percorso : `${percorso}.${ESTENSIONE}`;
}
