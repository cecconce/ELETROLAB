// Cronologia delle modifiche allo schema per Annulla/Ripeti illimitati.
// Funzioni pure (nessuna interfaccia), coperte da test in cronologia.test.ts.
//
// Idea: lo schema non viene mai modificato "sul posto" (vedi schema.ts e
// fili.ts), quindi per annullare basta conservare gli schemi precedenti.
// - `passato`: schemi prima delle ultime modifiche (l'ultimo è il più recente);
// - `presente`: lo schema mostrato;
// - `futuro`: schemi annullati che si possono ripristinare con Ripeti.
// Non c'è limite al numero di passi: gli schemi condividono quasi tutti i
// loro oggetti (solo ciò che cambia viene ricreato), quindi la memoria
// occupata da ogni passo è piccola.
//
// Gesti continui (trascinare un componente o un filo): durante il movimento
// lo schema cambia decine di volte, ma per lo studente è UNA sola modifica.
// Le modifiche "provvisorie" aggiornano il presente senza creare passi e
// ricordano lo schema di partenza del gesto; la modifica definitiva al
// rilascio del mouse crea un unico passo che riporta a quello schema.
import type { Schema } from "./schema";

export interface Cronologia {
  readonly passato: readonly Schema[];
  readonly presente: Schema;
  readonly futuro: readonly Schema[];
  /** Schema all'inizio del gesto in corso (solo durante le modifiche provvisorie). */
  readonly inizioGesto?: Schema;
}

/** Cronologia nuova, senza passi da annullare (all'apertura di uno schema). */
export function nuovaCronologia(schema: Schema): Cronologia {
  return { passato: [], presente: schema, futuro: [] };
}

/** Due schemi uguali nel contenuto (stesso oggetto o stessi dati). */
export function schemiUguali(a: Schema, b: Schema): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Registra una modifica allo schema.
 * @param provvisoria true durante un trascinamento: aggiorna lo schema senza creare un passo
 * Una modifica definitiva che non cambia nulla rispetto a prima non crea
 * passi (es. un componente trascinato e lasciato dov'era).
 * Ogni nuova modifica cancella i passi annullati (non si può più "ripetere").
 */
export function modifica(c: Cronologia, schema: Schema, provvisoria = false): Cronologia {
  if (provvisoria) {
    if (schema === c.presente) return c;
    return { ...c, presente: schema, inizioGesto: c.inizioGesto ?? c.presente };
  }
  const base = c.inizioGesto ?? c.presente;
  if (schemiUguali(schema, base)) {
    // Nessun cambiamento reale: si chiude l'eventuale gesto e basta.
    return c.inizioGesto === undefined && schema === c.presente ? c : { passato: c.passato, presente: schema, futuro: c.futuro };
  }
  return { passato: [...c.passato, base], presente: schema, futuro: [] };
}

/** Chiude un gesto rimasto aperto (es. Ctrl+Z premuto mentre si trascina). */
function chiudiGesto(c: Cronologia): Cronologia {
  return c.inizioGesto === undefined ? c : modifica(c, c.presente);
}

export const puoAnnullare = (c: Cronologia): boolean => c.passato.length > 0 || c.inizioGesto !== undefined;
export const puoRipetere = (c: Cronologia): boolean => c.futuro.length > 0 && c.inizioGesto === undefined;

/** Torna allo schema precedente; se non c'è nulla da annullare restituisce la stessa cronologia. */
export function annulla(c: Cronologia): Cronologia {
  const chiusa = chiudiGesto(c);
  if (chiusa.passato.length === 0) return chiusa;
  const precedente = chiusa.passato[chiusa.passato.length - 1];
  return {
    passato: chiusa.passato.slice(0, -1),
    presente: precedente,
    futuro: [chiusa.presente, ...chiusa.futuro],
  };
}

/** Ripristina l'ultima modifica annullata; se non ce ne sono restituisce la stessa cronologia. */
export function ripeti(c: Cronologia): Cronologia {
  const chiusa = chiudiGesto(c);
  if (chiusa.futuro.length === 0) return chiusa;
  const [successivo, ...resto] = chiusa.futuro;
  return { passato: [...chiusa.passato, chiusa.presente], presente: successivo, futuro: resto };
}
