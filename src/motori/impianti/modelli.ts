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
 */
export type Polo = "L1" | "L2" | "L3" | "N";

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
       * diseccitazione. Il tempo vero e proprio arriva con l'attività 2.4; per
       * ora i contatti commutano subito, come quelli di una bobina normale.
       */
      temporizzata?: "eccitazione" | "diseccitazione";
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
  "rete-trifase": {
    tipo: "sorgente",
    uscite: [
      { morsetto: "L1", polo: "L1" },
      { morsetto: "L2", polo: "L2" },
      { morsetto: "L3", polo: "L3" },
    ],
  },
  // Le protezioni per ora sono sempre chiuse: l'intervento in caso di
  // cortocircuito o sovraccarico arriva con l'attività 2.4.
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
  "motore-trifase": { tipo: "carico", morsetti: ["U", "V", "W"], bobina: false },
  "motore-monofase": { tipo: "carico", morsetti: ["U1", "U2"], bobina: false },
  // Semplificazione: nel modulo non c'è ancora un'alimentazione in continua,
  // quindi il motore in CC gira quando riceve due poli diversi (vedi limiti).
  "motore-cc": { tipo: "carico", morsetti: ["A1", "A2"], bobina: false },
};
