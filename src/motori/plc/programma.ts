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
  | { tipo: "contatto"; contatto: TipoContatto; operando: string }
  | { tipo: "serie"; elementi: Logica[] }
  | { tipo: "parallelo"; rami: Logica[] };

/** Tipo di uscita di un segmento. */
export type TipoUscita =
  | "bobina" //        -( )-  copia il risultato del segmento
  | "bobinaNegata" //  -(/)-  copia il risultato negato
  | "set" //           -(S)-  porta a 1 e lascia così (memoria)
  | "reset"; //        -(R)-  porta a 0 e lascia così

export interface Uscita {
  tipo: TipoUscita;
  operando: string;
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
