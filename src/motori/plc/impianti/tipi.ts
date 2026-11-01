// Impianti animati collegabili al PLC (puri: nessuna interfaccia).
//
// Un impianto è una piccola "macchina" simulata posata sul foglio accanto al
// Ladder. Scambia segnali con il PLC:
// - i SENSORI dell'impianto (fotocellule, finecorsa…) vanno agli ingressi I;
// - gli ATTUATORI (motori, lampade…) sono comandati dalle uscite Q.
// Ogni segnale ha un operando proposto (es. motore del nastro = Q0.0), che lo
// studente può cambiare nelle Proprietà.
//
// Ad ogni ciclo del PLC: sensori → ingressi, scansione, uscite → attuatori,
// poi l'impianto avanza di un tempo di ciclo. Lo studente può anche
// intervenire sull'impianto con un clic (posare un pacco, passare davanti
// alla fotocellula…).

/** Segnale fra impianto e PLC. */
export interface SegnaleImpianto {
  /** Identificativo stabile (salvato nel file). */
  id: string;
  /** Nome per lo studente (chiave dei testi in lingue/it.json). */
  chiaveNome: string;
  /** Operando proposto: I… per i sensori, Q… per gli attuatori. */
  operandoPredefinito: string;
}

export interface ModelloImpianto<S = unknown> {
  /** Tipo del componente nella libreria (es. "impianto-nastro"). */
  tipo: string;
  sensori: readonly SegnaleImpianto[];
  attuatori: readonly SegnaleImpianto[];
  statoIniziale(): S;
  /** Fa avanzare l'impianto di `dt` secondi con gli attuatori indicati. */
  avanza(stato: S, attuatori: Readonly<Record<string, boolean>>, dt: number): S;
  /** Valore dei sensori nello stato attuale. */
  letturaSensori(stato: S): Record<string, boolean>;
  /** Pressione del mouse sull'impianto (facoltativa). */
  clicGiu?(stato: S): S;
  /** Rilascio del mouse sull'impianto (facoltativo). */
  clicSu?(stato: S): S;
}

/** Limita un valore fra minimo e massimo. */
export const limita = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
