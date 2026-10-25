// Copia, taglia e incolla di parti dello schema.
// Funzioni pure (nessuna interfaccia), coperte da test in appunti.test.ts.
//
// Gli appunti sono interni all'app (non usano gli appunti di Windows): così
// funzionano anche fra due moduli e non serve alcun permesso.
// Regole:
// - si copiano i componenti selezionati e i fili che collegano DUE componenti
//   copiati (anche se il filo non era selezionato: chi copia K1 e S1 collegati
//   si aspetta di ritrovarli collegati); un filo con un capo fuori dalla copia
//   viene lasciato perché resterebbe "appeso";
// - incollando, ogni componente riceve un nuovo id e una nuova sigla
//   automatica (S1 copiato diventa S2, o il primo numero libero) e la copia
//   compare spostata di qualche passo di griglia, così si vede subito;
// - i contatti di un contattore (attività 2.2) non ricevono una sigla nuova:
//   se nella copia c'è anche la loro bobina seguono la sua nuova sigla (K1 e
//   il suo contatto copiati diventano K2 e un contatto di K2), altrimenti
//   restano legati alla bobina di prima (un contatto in più di K1).
import { PASSO_GRIGLIA } from "./geometria";
import { nuovoIdFilo } from "./fili";
import { nuovoId, prossimaSigla } from "./libreria";
import type { ComponenteSchema, Filo, Schema, Selezione } from "./schema";

export interface Appunti {
  componenti: readonly ComponenteSchema[];
  fili: readonly Filo[];
}

/** Scostamento di ogni incolla successivo (due passi di griglia in basso a destra). */
export const SCOSTAMENTO_INCOLLA = 2 * PASSO_GRIGLIA;

/** Copia negli appunti la parte selezionata; undefined se non c'è nessun componente da copiare. */
export function copiaSelezione(schema: Schema, selezione: Selezione): Appunti | undefined {
  const scelti = new Set(selezione);
  const componenti = schema.componenti.filter((c) => scelti.has(c.id));
  if (componenti.length === 0) return undefined;
  const copiati = new Set(componenti.map((c) => c.id));
  const fili = schema.fili.filter((f) => copiati.has(f.da.componente) && copiati.has(f.a.componente));
  // Copie indipendenti: modifiche successive allo schema non toccano gli appunti.
  return { componenti: componenti.map((c) => ({ ...c })), fili: fili.map((f) => ({ ...f, da: { ...f.da }, a: { ...f.a } })) };
}

/** Da dove si ricavano le lettere della sigla di un tipo (di solito la voce della libreria). */
export type LettereDelTipo = (tipo: string) => string | undefined;

/**
 * Lettere della sigla di un componente: quelle della libreria se il tipo è
 * noto, altrimenti quelle iniziali della sigla attuale ("KA3" → "KA").
 */
function lettereSigla(c: ComponenteSchema, lettereDi: LettereDelTipo): string {
  return lettereDi(c.tipo) ?? c.etichetta.replace(/\d+$/, "");
}

/**
 * Incolla gli appunti nello schema.
 * @param volta quante volte è già stato incollato lo stesso contenuto (0 = prima):
 *   ogni incolla è spostato un po' più in là, così le copie non si sovrappongono
 * @returns il nuovo schema e gli id degli elementi incollati (da selezionare)
 */
export function incolla(
  schema: Schema,
  appunti: Appunti,
  lettereDi: LettereDelTipo,
  volta = 0,
  /** Tipi che sono contatti azionati da bobina (vedi libreria.tipiContatto). */
  tipiContatto: ReadonlySet<string> = new Set(),
): { schema: Schema; incollati: string[] } {
  const d = SCOSTAMENTO_INCOLLA * (volta + 1);
  const nuoviId = new Map<string, string>();
  // Sigla vecchia → sigla nuova dei componenti copiati (per i contatti delle bobine copiate).
  const nuoveSigle = new Map<string, string>();
  let risultato = schema;
  // Uno alla volta: ogni nuovo id e ogni sigla tengono conto di quelli appena aggiunti.
  for (const c of appunti.componenti) {
    const base = c.id.replace(/-\d+$/, "");
    const contatto = tipiContatto.has(c.tipo);
    const etichetta = contatto ? c.etichetta : prossimaSigla(risultato, lettereSigla(c, lettereDi), tipiContatto);
    if (!contatto && c.etichetta !== "") nuoveSigle.set(c.etichetta, etichetta);
    const nuovo: ComponenteSchema = { ...c, id: nuovoId(risultato, base), etichetta, x: c.x + d, y: c.y + d };
    nuoviId.set(c.id, nuovo.id);
    risultato = { ...risultato, componenti: [...risultato.componenti, nuovo] };
  }
  // I contatti incollati seguono la loro bobina se è stata copiata insieme a loro.
  const incollati = new Set(nuoviId.values());
  risultato = {
    ...risultato,
    componenti: risultato.componenti.map((c) =>
      incollati.has(c.id) && tipiContatto.has(c.tipo) && nuoveSigle.has(c.etichetta)
        ? { ...c, etichetta: nuoveSigle.get(c.etichetta)! }
        : c,
    ),
  };
  const idFili: string[] = [];
  for (const f of appunti.fili) {
    const da = nuoviId.get(f.da.componente);
    const a = nuoviId.get(f.a.componente);
    if (!da || !a) continue;
    const nuovo: Filo = {
      id: nuovoIdFilo(risultato),
      da: { componente: da, morsetto: f.da.morsetto },
      a: { componente: a, morsetto: f.a.morsetto },
      // Il tratto centrale spostato a mano segue la copia.
      ...(f.medio !== undefined ? { medio: f.medio + d } : {}),
    };
    idFili.push(nuovo.id);
    risultato = { ...risultato, fili: [...risultato.fili, nuovo] };
  }
  return { schema: risultato, incollati: [...nuoviId.values(), ...idFili] };
}
