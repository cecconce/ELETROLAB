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
  /** Contatto azionato dalla bobina con la stessa sigla (K1, KA1…). */
  | { tipo: "bobina" };

export type ModelloComponente =
  | { tipo: "sorgente"; uscite: UscitaSorgente[] }
  /** Tratto sempre chiuso fra due morsetti (fusibile integro, interruttore chiuso). */
  | { tipo: "conduttore"; morsetti: [string, string] }
  /** Contatto NA (`normalmenteChiuso: false`) o NC fra due morsetti. */
  | { tipo: "contatto"; morsetti: [string, string]; normalmenteChiuso: boolean; comando: Comando }
  /**
   * Utilizzatore: è alimentato quando i suoi morsetti raggiungono poli
   * diversi. `bobina: true` indica che, eccitandosi, aziona i contatti con la
   * sua stessa sigla.
   */
  | { tipo: "carico"; morsetti: string[]; bobina: boolean };

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
  // cortocircuito arriva con l'attività 2.4.
  fusibile: { tipo: "conduttore", morsetti: ["1", "2"] },
  magnetotermico: { tipo: "conduttore", morsetti: ["1", "2"] },
  "pulsante-na": { tipo: "contatto", morsetti: ["13", "14"], normalmenteChiuso: false, comando: { tipo: "pulsante" } },
  "pulsante-nc": { tipo: "contatto", morsetti: ["11", "12"], normalmenteChiuso: true, comando: { tipo: "pulsante" } },
  "contatto-na": { tipo: "contatto", morsetti: ["13", "14"], normalmenteChiuso: false, comando: { tipo: "bobina" } },
  "contatto-nc": { tipo: "contatto", morsetti: ["21", "22"], normalmenteChiuso: true, comando: { tipo: "bobina" } },
  "bobina-contattore": { tipo: "carico", morsetti: ["A1", "A2"], bobina: true },
  lampada: { tipo: "carico", morsetti: ["X1", "X2"], bobina: false },
  "motore-trifase": { tipo: "carico", morsetti: ["U", "V", "W"], bobina: false },
};
