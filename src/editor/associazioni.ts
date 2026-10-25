// Contatti legati alla bobina di un contattore o relè (attività 2.2).
// Funzioni pure, coperte da test in associazioni.test.ts.
//
// Come negli schemi su carta, un contatto appartiene a un contattore perché
// porta la sua stessa sigla: il contatto NA "K1" commuta quando si eccita la
// bobina "K1". Il motore di simulazione (src/motori/impianti) usa proprio la
// sigla, quindi qui basta tenerla coerente.
//
// Numerazione dei morsetti secondo la norma (CEI EN 60947 / IEC 60445):
// - contatti AUSILIARI: due cifre. La prima è il numero d'ordine del contatto
//   nel contattore (1, 2, 3…), la seconda dice la funzione: 3-4 per i NA,
//   1-2 per i NC. Esempio K1 con NA, NC, NA, NC → 13-14, 21-22, 33-34, 41-42.
// - contatti PRINCIPALI (di potenza): 1-2, 3-4, 5-6 (poi 7-8…).
// L'ordine è quello di posa sul foglio: il primo contatto disegnato è il n. 1.
import { t } from "../testi";
import { tipiContatto, vocePerTipo, type DatiContatto, type Libreria } from "./libreria";
import type { ComponenteSchema, Schema } from "./schema";

/** Numeri dei due morsetti del contatto `ordine` (1 = primo) di un contattore. */
export function numeriContatto(dati: DatiContatto, ordine: number): [string, string] {
  if (dati.tipo === "principale") return [String(2 * ordine - 1), String(2 * ordine)];
  return dati.stato === "NA" ? [`${ordine}3`, `${ordine}4`] : [`${ordine}1`, `${ordine}2`];
}

/** Le bobine (contattori, relè) presenti nello schema, nell'ordine di posa. */
export function bobineDelloSchema(schema: Schema, libreria: Libreria): ComponenteSchema[] {
  return schema.componenti.filter((c) => vocePerTipo(libreria, c.tipo)?.comandaContatti === true);
}

/** true se il componente è un contatto azionato da bobina. */
export function eContatto(c: ComponenteSchema, libreria: Libreria): boolean {
  return vocePerTipo(libreria, c.tipo)?.contatto !== undefined;
}

/** true se il contatto ha una bobina con la sua sigla nello schema. */
export function contattoAssociato(schema: Schema, contatto: ComponenteSchema, libreria: Libreria): boolean {
  return contatto.etichetta !== "" && bobineDelloSchema(schema, libreria).some((b) => b.etichetta === contatto.etichetta);
}

function numeriUguali(a: Record<string, string> | undefined, b: Record<string, string> | undefined): boolean {
  const ka = Object.keys(a ?? {});
  const kb = Object.keys(b ?? {});
  return ka.length === kb.length && ka.every((k) => a?.[k] === b?.[k]);
}

/**
 * Ricalcola la numerazione di tutti i contatti dello schema.
 * I contatti senza sigla (non associati) tornano ai numeri della libreria.
 * Se non cambia nulla restituisce lo stesso oggetto: si può chiamare a ogni
 * modifica senza creare passi inutili in Annulla/Ripeti.
 */
export function rinumeraContatti(schema: Schema, libreria: Libreria): Schema {
  // Contatori separati per sigla e per tipo (ausiliari e principali hanno numerazioni distinte).
  const contatori = new Map<string, number>();
  let cambiato = false;
  const componenti = schema.componenti.map((c) => {
    const voce = vocePerTipo(libreria, c.tipo);
    if (!voce?.contatto) return c;
    let numeri: Record<string, string> | undefined;
    if (c.etichetta !== "") {
      const chiave = `${c.etichetta}|${voce.contatto.tipo}`;
      const ordine = (contatori.get(chiave) ?? 0) + 1;
      contatori.set(chiave, ordine);
      const [n1, n2] = numeriContatto(voce.contatto, ordine);
      numeri = { [voce.morsetti[0].id]: n1, [voce.morsetti[1].id]: n2 };
    }
    if (numeriUguali(numeri, c.numeriMorsetti)) return c;
    cambiato = true;
    const nuovo: ComponenteSchema = { ...c };
    if (numeri) nuovo.numeriMorsetti = numeri;
    else delete nuovo.numeriMorsetti;
    return nuovo;
  });
  return cambiato ? { ...schema, componenti } : schema;
}

/**
 * Lega il contatto alla bobina con la sigla indicata (stringa vuota = nessuna
 * bobina) e rinumera i contatti.
 */
export function associaContatto(schema: Schema, idContatto: string, sigla: string, libreria: Libreria): Schema {
  const componenti = schema.componenti.map((c) => (c.id === idContatto && eContatto(c, libreria) ? { ...c, etichetta: sigla } : c));
  return rinumeraContatti({ ...schema, componenti }, libreria);
}

export type EsitoSigla = { ok: true; schema: Schema } | { ok: false; errore: string };

/** Lettere iniziali (1–4) seguite da cifre facoltative: K1, KA2, KT1, S0, Q1… */
const FORMA_SIGLA = /^[A-Z]{1,4}[0-9]{0,3}$/;

/**
 * Cambia la sigla di un componente scritta dallo studente nelle Proprietà.
 * - la sigla viene scritta in maiuscolo e deve avere la forma "lettere + numero";
 * - non può ripetere quella di un altro componente (i contatti non contano:
 *   portano apposta la sigla della loro bobina);
 * - se il componente è una bobina, i suoi contatti la seguono.
 * I contatti non si rinominano qui: si sceglie la bobina con `associaContatto`.
 */
export function cambiaSigla(schema: Schema, id: string, scritta: string, libreria: Libreria): EsitoSigla {
  const componente = schema.componenti.find((c) => c.id === id);
  if (!componente) return { ok: false, errore: t("proprieta.componenteSparito") };
  const nuova = scritta.trim().toUpperCase();
  if (nuova === componente.etichetta) return { ok: true, schema };
  if (!FORMA_SIGLA.test(nuova)) return { ok: false, errore: t("proprieta.siglaNonValida", { sigla: scritta.trim() }) };
  const contatti = tipiContatto(libreria);
  if (schema.componenti.some((c) => c.id !== id && !contatti.has(c.tipo) && c.etichetta === nuova))
    return { ok: false, errore: t("proprieta.siglaUsata", { sigla: nuova }) };
  const vecchia = componente.etichetta;
  const bobina = vocePerTipo(libreria, componente.tipo)?.comandaContatti === true;
  const componenti = schema.componenti.map((c) => {
    if (c.id === id) return { ...c, etichetta: nuova };
    // I contatti della bobina rinominata la seguono.
    if (bobina && vecchia !== "" && contatti.has(c.tipo) && c.etichetta === vecchia) return { ...c, etichetta: nuova };
    return c;
  });
  return { ok: true, schema: rinumeraContatti({ ...schema, componenti }, libreria) };
}

/** Numero da mostrare accanto a un morsetto: quello calcolato o, se manca, l'id della libreria. */
export function numeroMorsetto(c: ComponenteSchema, morsetto: string): string {
  return c.numeriMorsetti?.[morsetto] ?? morsetto;
}
