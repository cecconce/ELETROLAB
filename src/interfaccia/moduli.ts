// Elenco dei quattro moduli mostrati come tessere nella schermata iniziale.
// Ogni modulo ha un identificativo stabile (usato anche nei file .elab),
// le chiavi dei testi in lingue/it.json e un colore d'accento.

export type IdModulo = "impianti" | "plc" | "arduino" | "elettronica";

export interface DefinizioneModulo {
  id: IdModulo;
  /** Chiave del titolo in lingue/<lingua>.json */
  chiaveTitolo: string;
  /** Chiave della breve descrizione didattica */
  chiaveDescrizione: string;
  /** Colore d'accento della tessera (variabile CSS) */
  coloreAccento: string;
}

/** Ordine fisso delle tessere: lo studente le ritrova sempre nello stesso posto. */
export const MODULI: readonly DefinizioneModulo[] = [
  {
    id: "impianti",
    chiaveTitolo: "modulo.impianti.titolo",
    chiaveDescrizione: "modulo.impianti.descrizione",
    coloreAccento: "var(--accento-impianti)",
  },
  {
    id: "plc",
    chiaveTitolo: "modulo.plc.titolo",
    chiaveDescrizione: "modulo.plc.descrizione",
    coloreAccento: "var(--accento-plc)",
  },
  {
    id: "arduino",
    chiaveTitolo: "modulo.arduino.titolo",
    chiaveDescrizione: "modulo.arduino.descrizione",
    coloreAccento: "var(--accento-arduino)",
  },
  {
    id: "elettronica",
    chiaveTitolo: "modulo.elettronica.titolo",
    chiaveDescrizione: "modulo.elettronica.descrizione",
    coloreAccento: "var(--accento-elettronica)",
  },
];

/** Cerca un modulo per identificativo; undefined se non esiste. */
export function trovaModulo(id: string): DefinizioneModulo | undefined {
  return MODULI.find((m) => m.id === id);
}
