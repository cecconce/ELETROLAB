// Struttura di un programma Ladder (KOP) per il motore del PLC.
//
// Un programma è un elenco di segmenti (rung) eseguiti dall'alto in basso.
// Ogni segmento ha:
// - una logica di contatti fra la barra di sinistra e le uscite, descritta
//   come albero di serie e paralleli (l'editor a griglia della Fase 3 la
//   produrrà a partire dal disegno);
// - una o più uscite in parallelo a destra (bobine, set, reset).
//
// La rappresentazione ad albero rende la valutazione semplice e sicura:
// nessun ciclo, nessun "corto" fra rami, risultato sempre definito.

/** Tipo di contatto. */
export type TipoContatto =
  | "NA" // normalmente aperto: conduce se l'operando vale 1
  | "NC" // normalmente chiuso: conduce se l'operando vale 0
  | "P" //  fronte di salita: conduce per un solo ciclo quando l'operando passa da 0 a 1
  | "N"; // fronte di discesa: conduce per un solo ciclo quando l'operando passa da 1 a 0

/** Elemento della logica di un segmento. */
export type Logica =
  /** `id`: componente disegnato da cui viene il contatto (per colorarlo in simulazione). */
  | { tipo: "contatto"; contatto: TipoContatto; operando: string; id?: string }
  | { tipo: "serie"; elementi: Logica[] }
  | { tipo: "parallelo"; rami: Logica[] };

/** Tipo di uscita di un segmento. */
export type TipoUscita =
  | "bobina" //        -( )-  copia il risultato del segmento
  | "bobinaNegata" //  -(/)-  copia il risultato negato
  | "set" //           -(S)-  porta a 1 e lascia così (memoria)
  | "reset"; //        -(R)-  porta a 0 e lascia così

/**
 * Temporizzatori (norma IEC 61131-3):
 * - TON ritardo all'inserzione: l'uscita si accende dopo `preset` secondi di
 *   segmento alimentato e si spegne subito quando il segmento si apre;
 * - TOF ritardo alla disinserzione: l'uscita si accende subito e si spegne
 *   `preset` secondi dopo che il segmento si è aperto;
 * - TP impulso: sul fronte di salita l'uscita resta accesa esattamente
 *   `preset` secondi, qualunque cosa faccia il segmento nel frattempo.
 */
export type TipoTemporizzatore = "TON" | "TOF" | "TP";

/**
 * Contatori:
 * - CTU in avanti: +1 a ogni fronte di salita del segmento; uscita accesa
 *   quando il conteggio arriva al `preset`; il reset lo riporta a 0;
 * - CTD all'indietro: parte dal `preset`, −1 a ogni fronte di salita;
 *   uscita accesa quando arriva a 0; il reset lo ricarica al `preset`.
 */
export type TipoContatore = "CTU" | "CTD";

export type Uscita =
  | { tipo: TipoUscita; operando: string }
  /** Temporizzatore T0…T63; `preset` in secondi. */
  | { tipo: TipoTemporizzatore; operando: string; preset: number }
  /** Contatore C0…C63; `preset` = numero di impulsi. */
  | { tipo: TipoContatore; operando: string; preset: number };

/** Vero se l'uscita è un temporizzatore. */
export function eTemporizzatore(u: Uscita): u is { tipo: TipoTemporizzatore; operando: string; preset: number } {
  return u.tipo === "TON" || u.tipo === "TOF" || u.tipo === "TP";
}

/** Vero se l'uscita è un contatore. */
export function eContatore(u: Uscita): u is { tipo: TipoContatore; operando: string; preset: number } {
  return u.tipo === "CTU" || u.tipo === "CTD";
}

export interface Segmento {
  /** Commento dello studente (facoltativo, non influisce sulla logica). */
  commento?: string;
  /** Logica dei contatti; null = uscite collegate direttamente alla barra (sempre alimentate). */
  logica: Logica | null;
  uscite: Uscita[];
}

export interface ProgrammaLadder {
  segmenti: Segmento[];
}

// --- Costruttori brevi, comodi nei test e negli esempi ---

export const na = (operando: string): Logica => ({ tipo: "contatto", contatto: "NA", operando });
export const nc = (operando: string): Logica => ({ tipo: "contatto", contatto: "NC", operando });
export const fronteSalita = (operando: string): Logica => ({ tipo: "contatto", contatto: "P", operando });
export const fronteDiscesa = (operando: string): Logica => ({ tipo: "contatto", contatto: "N", operando });
export const serie = (...elementi: Logica[]): Logica => ({ tipo: "serie", elementi });
export const parallelo = (...rami: Logica[]): Logica => ({ tipo: "parallelo", rami });

export const bobina = (operando: string): Uscita => ({ tipo: "bobina", operando });
export const bobinaNegata = (operando: string): Uscita => ({ tipo: "bobinaNegata", operando });
export const set = (operando: string): Uscita => ({ tipo: "set", operando });
export const reset = (operando: string): Uscita => ({ tipo: "reset", operando });
export const ton = (operando: string, preset: number): Uscita => ({ tipo: "TON", operando, preset });
export const tof = (operando: string, preset: number): Uscita => ({ tipo: "TOF", operando, preset });
export const tp = (operando: string, preset: number): Uscita => ({ tipo: "TP", operando, preset });
export const ctu = (operando: string, preset: number): Uscita => ({ tipo: "CTU", operando, preset });
export const ctd = (operando: string, preset: number): Uscita => ({ tipo: "CTD", operando, preset });
