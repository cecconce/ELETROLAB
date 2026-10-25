// Impostazioni dello studente salvate in `impostazioni.json` nella cartella
// dei dati (portable: .\dati\ accanto all'exe; altrimenti %APPDATA%\ElettroLab):
// tema scelto ed elenco dei file recenti. Funzioni pure, test in impostazioni.test.ts.
import type { Tema } from "../interfaccia/tema";
import type { IdModulo } from "../interfaccia/moduli";
import { trovaModulo } from "../interfaccia/moduli";
import { nomeDaPercorso } from "./formato";

/** Quanti file recenti si ricordano. */
export const MASSIMO_RECENTI = 10;

export interface FileRecente {
  /** Nome mostrato (senza cartella né estensione). */
  nome: string;
  percorso: string;
  modulo?: IdModulo;
}

export interface Impostazioni {
  tema?: Tema;
  recenti: FileRecente[];
}

export const IMPOSTAZIONI_INIZIALI: Impostazioni = { recenti: [] };

/**
 * Due percorsi indicano lo stesso file? Su Windows maiuscole/minuscole e
 * "/" o "\" sono indifferenti.
 */
export function stessoPercorso(a: string, b: string): boolean {
  const normalizza = (p: string) => p.replace(/\//g, "\\").toLowerCase();
  return normalizza(a) === normalizza(b);
}

/** Mette il file in cima ai recenti, senza doppioni e al massimo MASSIMO_RECENTI voci. */
export function aggiungiRecente(recenti: readonly FileRecente[], percorso: string, modulo?: IdModulo): FileRecente[] {
  const voce: FileRecente = { nome: nomeDaPercorso(percorso), percorso, ...(modulo ? { modulo } : {}) };
  return [voce, ...recenti.filter((r) => !stessoPercorso(r.percorso, percorso))].slice(0, MASSIMO_RECENTI);
}

/** Toglie un file dai recenti (es. perché non esiste più). */
export function rimuoviRecente(recenti: readonly FileRecente[], percorso: string): FileRecente[] {
  return recenti.filter((r) => !stessoPercorso(r.percorso, percorso));
}

/** Legge il file delle impostazioni; qualsiasi errore riporta ai valori iniziali (mai bloccare l'avvio). */
export function leggiImpostazioni(testo: string | null | undefined): Impostazioni {
  if (!testo) return IMPOSTAZIONI_INIZIALI;
  let dati: unknown;
  try {
    dati = JSON.parse(testo.replace(/^﻿/, ""));
  } catch {
    return IMPOSTAZIONI_INIZIALI;
  }
  if (typeof dati !== "object" || dati === null) return IMPOSTAZIONI_INIZIALI;
  const d = dati as Record<string, unknown>;
  const tema = d.tema === "chiaro" || d.tema === "scuro" ? d.tema : undefined;
  const recenti: FileRecente[] = [];
  if (Array.isArray(d.recenti)) {
    for (const v of d.recenti) {
      if (typeof v !== "object" || v === null) continue;
      const r = v as Record<string, unknown>;
      if (typeof r.percorso !== "string" || r.percorso === "") continue;
      if (recenti.some((x) => stessoPercorso(x.percorso, r.percorso as string))) continue;
      const modulo = typeof r.modulo === "string" ? trovaModulo(r.modulo)?.id : undefined;
      recenti.push({ nome: nomeDaPercorso(r.percorso), percorso: r.percorso, ...(modulo ? { modulo } : {}) });
    }
  }
  return { ...(tema ? { tema } : {}), recenti: recenti.slice(0, MASSIMO_RECENTI) };
}

export function serializzaImpostazioni(i: Impostazioni): string {
  return JSON.stringify({ versione: 1, ...i }, null, 2) + "\n";
}
