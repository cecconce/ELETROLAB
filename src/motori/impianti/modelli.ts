// Modelli elettrici dei componenti del modulo Impianti elettrici.
// Ogni tipo della libreria (libreria/impianti.json) viene descritto in modo
// astratto: sorgente (poli della rete), conduttore (sempre chiuso), contatto
// (chiuso o aperto secondo pulsante o bobina) oppure carico (bobina, lampada,
// motore). Il motore di simulazione lavora solo su questi modelli, così
// aggiungere un componente significa aggiungere una riga qui.

/**
 * Poli della rete. Le fasi della rete monofase (L) e trifase (L1) sono
 * considerate la stessa fase: semplificazione didattica, come nei quadri
 * reali dove il comando è spesso derivato da L1 e N.
 * "+" e "-" sono i poli dell'alimentatore in corrente continua.
 */
export type Polo = "L1" | "L2" | "L3" | "N" | "+" | "-";

/** Poli della corrente alternata e della continua: non si possono mescolare su un carico. */
export const POLI_ALTERNATA: readonly Polo[] = ["L1", "L2", "L3", "N"];
export const POLI_CONTINUA: readonly Polo[] = ["+", "-"];

/** Tempo predefinito di un temporizzatore appena posato, in secondi. */
export const TEMPO_PREDEFINITO = 3;
/** Limiti del tempo impostabile di un temporizzatore, in secondi. */
export const TEMPO_MINIMO = 0;
export const TEMPO_MASSIMO = 600;
/**
 * Tempo dopo cui il relè termico (o il salvamotore) interviene se il motore
 * che protegge resta in sovraccarico, in secondi. Nella realtà dipende da
 * quanto è grande il sovraccarico (curva di intervento): qui è fisso.
 */
export const TEMPO_INTERVENTO_TERMICO = 3;

/**
 * Tipo di motore, per calcolare se gira e in che verso:
 * - trifase: morsetti U, V, W (collegamento interno a stella);
 * - trifase6: morsetti U1, V1, W1, U2, V2, W2 da collegare a stella o a triangolo;
 * - monofase: fase e neutro, verso fisso;
 * - cc: corrente continua, il verso dipende dalla polarità.
 */
export type TipoMotore = "trifase" | "trifase6" | "monofase" | "cc";

/** Protezioni: che cosa le fa intervenire. */
export interface Protezione {
  /** Interviene (si apre) quando passa una corrente di cortocircuito. */
  cortocircuito: boolean;
  /** Interviene dopo un po' se il motore che alimenta è in sovraccarico. */
  sovraccarico: boolean;
}

/** Uscita di una sorgente: il morsetto `morsetto` porta il polo `polo`. */
export interface UscitaSorgente {
  morsetto: string;
  polo: Polo;
}

/** Comando che decide se un contatto è chiuso. */
export type Comando =
  /** Pulsante: cambia stato solo mentre lo studente lo tiene premuto. */
  | { tipo: "pulsante" }
  /**
   * Comando a posizione mantenuta: selettore, finecorsa, sensore, sezionatore,
   * salvamotore. Un clic lo aziona e resta azionato fino al clic successivo.
   */
  | { tipo: "manuale" }
  /** Contatto azionato dalla bobina con la stessa sigla (K1, KA1, KT1…). */
  | { tipo: "bobina" }
  /** Contatto del relè termico con la stessa sigla: commuta quando il relè interviene. */
  | { tipo: "termico" };

/** Coppia di morsetti fra cui un conduttore o un contatto chiude il circuito. */
export type Tratto = readonly [string, string];

export type ModelloComponente =
  | { tipo: "sorgente"; uscite: UscitaSorgente[] }
  /**
   * Tratti sempre chiusi (fusibile integro, relè termico non intervenuto):
   * uno per polo, per esempio tre nel relè termico tripolare.
   */
  | { tipo: "conduttore"; tratti: readonly Tratto[] }
  /**
   * Contatto NA (`normalmenteChiuso: false`) o NC. Più tratti = più poli
   * azionati insieme (contatti principali, sezionatore tripolare).
   */
  | { tipo: "contatto"; tratti: readonly Tratto[]; normalmenteChiuso: boolean; comando: Comando }
  /**
   * Utilizzatore: è alimentato quando i suoi morsetti raggiungono poli
   * diversi. `bobina: true` indica che, eccitandosi, aziona i contatti con la
   * sua stessa sigla.
   */
  | {
      tipo: "carico";
      morsetti: string[];
      bobina: boolean;
      /**
       * Solo per le bobine dei temporizzatori: ritardo all'eccitazione o alla
       * diseccitazione. Il tempo si imposta nel componente (campo `tempo`);
       * il conteggio del tempo è fatto da tempo.ts.
       */
      temporizzata?: "eccitazione" | "diseccitazione";
      /** Solo per i motori: come calcolare rotazione e verso. */
      motore?: TipoMotore;
    };

/** I tre poli di un componente tripolare con morsetti 1-2, 3-4, 5-6. */
const TRIPOLARE: readonly Tratto[] = [
  ["1", "2"],
  ["3", "4"],
  ["5", "6"],
];

/** Tabella tipo della libreria → modello elettrico. */
export const MODELLI_IMPIANTI: Readonly<Record<string, ModelloComponente>> = {
  "rete-monofase": {
    tipo: "sorgente",
    uscite: [
      { morsetto: "L", polo: "L1" },
      { morsetto: "N", polo: "N" },
    ],
  },
  "alimentatore-cc": {
    tipo: "sorgente",
    uscite: [
      { morsetto: "+", polo: "+" },
      { morsetto: "-", polo: "-" },
    ],
  },
  "rete-trifase": {
    tipo: "sorgente",
    uscite: [
      { morsetto: "L1", polo: "L1" },
      { morsetto: "L2", polo: "L2" },
      { morsetto: "L3", polo: "L3" },
    ],
  },
  // Le protezioni conducono finché non intervengono: l'intervento (vedi
  // PROTEZIONI qui sotto) è gestito dal simulatore e da tempo.ts.
  fusibile: { tipo: "conduttore", tratti: [["1", "2"]] },
  magnetotermico: { tipo: "conduttore", tratti: [["1", "2"]] },
  "rele-termico": { tipo: "conduttore", tratti: TRIPOLARE },
  // Organi di manovra: aperti a riposo, lo studente li chiude con un clic.
  sezionatore: { tipo: "contatto", tratti: TRIPOLARE, normalmenteChiuso: false, comando: { tipo: "manuale" } },
  salvamotore: { tipo: "contatto", tratti: TRIPOLARE, normalmenteChiuso: false, comando: { tipo: "manuale" } },
  // Comandi.
  "pulsante-na": { tipo: "contatto", tratti: [["13", "14"]], normalmenteChiuso: false, comando: { tipo: "pulsante" } },
  "pulsante-nc": { tipo: "contatto", tratti: [["11", "12"]], normalmenteChiuso: true, comando: { tipo: "pulsante" } },
  selettore: { tipo: "contatto", tratti: [["13", "14"]], normalmenteChiuso: false, comando: { tipo: "manuale" } },
  "finecorsa-na": { tipo: "contatto", tratti: [["13", "14"]], normalmenteChiuso: false, comando: { tipo: "manuale" } },
  "finecorsa-nc": { tipo: "contatto", tratti: [["11", "12"]], normalmenteChiuso: true, comando: { tipo: "manuale" } },
  "sensore-prossimita": { tipo: "contatto", tratti: [["13", "14"]], normalmenteChiuso: false, comando: { tipo: "manuale" } },
  // Bobine e contatti comandati.
  "bobina-contattore": { tipo: "carico", morsetti: ["A1", "A2"], bobina: true },
  "bobina-rele": { tipo: "carico", morsetti: ["A1", "A2"], bobina: true },
  "bobina-ritardata-eccitazione": { tipo: "carico", morsetti: ["A1", "A2"], bobina: true, temporizzata: "eccitazione" },
  "bobina-ritardata-diseccitazione": { tipo: "carico", morsetti: ["A1", "A2"], bobina: true, temporizzata: "diseccitazione" },
  "contatto-na": { tipo: "contatto", tratti: [["13", "14"]], normalmenteChiuso: false, comando: { tipo: "bobina" } },
  "contatto-nc": { tipo: "contatto", tratti: [["21", "22"]], normalmenteChiuso: true, comando: { tipo: "bobina" } },
  "contatti-principali": { tipo: "contatto", tratti: TRIPOLARE, normalmenteChiuso: false, comando: { tipo: "bobina" } },
  "contatto-temporizzato-na": { tipo: "contatto", tratti: [["17", "18"]], normalmenteChiuso: false, comando: { tipo: "bobina" } },
  "contatto-temporizzato-nc": { tipo: "contatto", tratti: [["15", "16"]], normalmenteChiuso: true, comando: { tipo: "bobina" } },
  "contatto-termico-nc": { tipo: "contatto", tratti: [["95", "96"]], normalmenteChiuso: true, comando: { tipo: "termico" } },
  "contatto-termico-na": { tipo: "contatto", tratti: [["97", "98"]], normalmenteChiuso: false, comando: { tipo: "termico" } },
  // Utilizzatori.
  lampada: { tipo: "carico", morsetti: ["X1", "X2"], bobina: false },
  sirena: { tipo: "carico", morsetti: ["X1", "X2"], bobina: false },
  "motore-trifase": { tipo: "carico", morsetti: ["U", "V", "W"], bobina: false, motore: "trifase" },
  "motore-trifase-6": {
    tipo: "carico",
    morsetti: ["U1", "V1", "W1", "U2", "V2", "W2"],
    bobina: false,
    motore: "trifase6",
  },
  "motore-monofase": { tipo: "carico", morsetti: ["U1", "U2"], bobina: false, motore: "monofase" },
  "motore-cc": { tipo: "carico", morsetti: ["A1", "A2"], bobina: false, motore: "cc" },
};

/**
 * Componenti che proteggono il circuito. Semplificazioni:
 * - il magnetotermico interviene solo in cortocircuito (la parte termica
 *   per i sovraccarichi delle linee non è simulata);
 * - il relè termico non apre i propri poli: apre il contatto 95-96 (e chiude
 *   97-98), che nello schema toglie tensione alla bobina del contattore.
 */
export const PROTEZIONI: Readonly<Record<string, Protezione>> = {
  fusibile: { cortocircuito: true, sovraccarico: false },
  magnetotermico: { cortocircuito: true, sovraccarico: false },
  salvamotore: { cortocircuito: true, sovraccarico: true },
  "rele-termico": { cortocircuito: false, sovraccarico: true },
};
