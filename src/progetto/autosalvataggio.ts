// Salvataggio automatico: ogni modulo ha un file nella cartella dei dati
// (autosalvataggi/<modulo>.elab) aggiornato poco dopo ogni modifica.
// Riaprendo il modulo lo studente ritrova il lavoro, anche dopo una chiusura
// improvvisa del programma o del PC. Il file dello studente NON viene mai
// sovrascritto in automatico: per quello serve "Salva".
//
// Il file è un normale .elab con in più il campo "autosalvataggio", che
// ricorda da quale file proveniva lo schema e se c'erano modifiche non salvate.
// Funzioni pure, test in autosalvataggio.test.ts.
import { leggiProgetto, serializzaProgetto, type Progetto } from "./formato";

/** Attesa dopo l'ultima modifica prima di scrivere (evita scritture a ogni movimento). */
export const RITARDO_AUTOSALVATAGGIO_MS = 1500;

export interface Autosalvataggio {
  progetto: Progetto;
  /** File da cui proveniva lo schema (null se mai salvato). */
  percorso: string | null;
  /** true se c'erano modifiche non ancora salvate nel file dello studente. */
  modificato: boolean;
}

export function serializzaAutosalvataggio(a: Autosalvataggio, versioneProgramma: string, adesso?: Date): string {
  const base = JSON.parse(serializzaProgetto(a.progetto, versioneProgramma, adesso)) as Record<string, unknown>;
  return JSON.stringify({ ...base, autosalvataggio: { percorso: a.percorso, modificato: a.modificato } }, null, 2) + "\n";
}

/** Legge un salvataggio automatico; undefined se manca o è illeggibile (si riparte da un foglio vuoto). */
export function leggiAutosalvataggio(testo: string | null | undefined): Autosalvataggio | undefined {
  if (!testo) return undefined;
  const esito = leggiProgetto(testo);
  if (!esito.ok) return undefined;
  let info: unknown;
  try {
    info = (JSON.parse(testo.replace(/^﻿/, "")) as Record<string, unknown>).autosalvataggio;
  } catch {
    return undefined;
  }
  const i = (typeof info === "object" && info !== null ? info : {}) as Record<string, unknown>;
  const percorso = typeof i.percorso === "string" && i.percorso !== "" ? i.percorso : null;
  // Senza informazioni si considera "modificato": meglio chiedere di salvare una volta in più.
  const modificato = typeof i.modificato === "boolean" ? i.modificato : true;
  return { progetto: esito.progetto, percorso, modificato };
}
