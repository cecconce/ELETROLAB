// Modello dei dati dello schema mostrato nell'editor: i componenti posati sul
// foglio, i fili che collegano i loro morsetti e la selezione corrente. Tutte le funzioni restituiscono un nuovo
// oggetto senza modificare quello ricevuto: servirà ad Annulla/Ripeti (1.7).
import { agganciaPunto, type Punto } from "./geometria";

/** Un componente posato sul foglio (per ora solo posizione e ingombro). */
export interface ComponenteSchema {
  id: string;
  /** Tipo di componente: con la 1.5 corrisponderà a una voce della libreria. */
  tipo: string;
  /** Sigla mostrata accanto al componente (K1, S2, H1…); vuota per reti e masse. */
  etichetta: string;
  /** Angolo in alto a sinistra, in unità del foglio, sempre sulla griglia. */
  x: number;
  y: number;
  larghezza: number;
  altezza: number;
}

/** Un capo di un filo: il morsetto `morsetto` (es. "14") del componente `componente`. */
export interface EstremoFilo {
  componente: string;
  morsetto: string;
}

/**
 * Filo fra due morsetti. Il percorso non viene salvato punto per punto ma
 * ricalcolato (vedi fili.ts), così segue i componenti quando si spostano.
 * `medio` è la posizione del tratto centrale scelta dallo studente
 * trascinando il filo (y per i fili verticali, x per quelli orizzontali);
 * se manca il tratto centrale sta a metà strada.
 */
export interface Filo {
  id: string;
  da: EstremoFilo;
  a: EstremoFilo;
  medio?: number;
}

export interface Schema {
  componenti: ComponenteSchema[];
  fili: Filo[];
}

export const SCHEMA_VUOTO: Schema = { componenti: [], fili: [] };

/** Insieme degli id selezionati (array senza doppioni, per semplicità di confronto). */
export type Selezione = readonly string[];

/** Aggiunge un componente, già agganciato alla griglia. */
export function aggiungiComponente(schema: Schema, c: ComponenteSchema): Schema {
  const p = agganciaPunto(c);
  return { ...schema, componenti: [...schema.componenti, { ...c, x: p.x, y: p.y }] };
}

/** Porta il componente nella posizione indicata (agganciata alla griglia). */
export function spostaComponente(schema: Schema, id: string, posizione: Punto): Schema {
  const p = agganciaPunto(posizione);
  let cambiato = false;
  const componenti = schema.componenti.map((c) => {
    if (c.id !== id || (c.x === p.x && c.y === p.y)) return c;
    cambiato = true;
    return { ...c, x: p.x, y: p.y };
  });
  // Se nulla cambia restituiamo lo stesso oggetto: React non ridisegna inutilmente.
  return cambiato ? { ...schema, componenti } : schema;
}

/**
 * Sposta insieme tutti i componenti selezionati dello stesso scostamento,
 * agganciato alla griglia: così restano allineati fra loro.
 */
export function spostaSelezione(schema: Schema, selezione: Selezione, dx: number, dy: number): Schema {
  const d = agganciaPunto({ x: dx, y: dy });
  if (d.x === 0 && d.y === 0) return schema;
  const scelti = new Set(selezione);
  return {
    ...schema,
    componenti: schema.componenti.map((c) => (scelti.has(c.id) ? { ...c, x: c.x + d.x, y: c.y + d.y } : c)),
  };
}

/**
 * Selezione dopo un clic su un componente.
 * Clic semplice: seleziona solo quello. Con Maiusc o Ctrl: lo aggiunge o lo toglie.
 */
export function selezionaConClic(selezione: Selezione, id: string, aggiuntivo: boolean): Selezione {
  if (!aggiuntivo) return selezione.length === 1 && selezione[0] === id ? selezione : [id];
  return selezione.includes(id) ? selezione.filter((x) => x !== id) : [...selezione, id];
}

/**
 * Selezione all'inizio di un trascinamento: se si trascina un componente già
 * selezionato si muove tutto il gruppo, altrimenti si seleziona solo lui.
 */
export function selezionePerTrascinamento(selezione: Selezione, id: string): Selezione {
  return selezione.includes(id) ? selezione : [id];
}

/** Rettangolo in coordinate del foglio. */
export interface Rettangolo {
  x: number;
  y: number;
  larghezza: number;
  altezza: number;
}

/** Normalizza il rettangolo tracciato fra due punti (in qualunque direzione). */
export function rettangoloTra(a: Punto, b: Punto): Rettangolo {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    larghezza: Math.abs(a.x - b.x),
    altezza: Math.abs(a.y - b.y),
  };
}

/** Id dei componenti interamente contenuti nel rettangolo di selezione. */
export function componentiNelRettangolo(schema: Schema, r: Rettangolo): string[] {
  return schema.componenti
    .filter(
      (c) => c.x >= r.x && c.y >= r.y && c.x + c.larghezza <= r.x + r.larghezza && c.y + c.altezza <= r.y + r.altezza,
    )
    .map((c) => c.id);
}

/** Rettangolo che contiene tutti i componenti (per "Adatta alla finestra"); undefined se lo schema è vuoto. */
export function ingombroSchema(schema: Schema): Rettangolo | undefined {
  if (schema.componenti.length === 0) return undefined;
  const xs = schema.componenti.map((c) => c.x);
  const ys = schema.componenti.map((c) => c.y);
  const x2 = schema.componenti.map((c) => c.x + c.larghezza);
  const y2 = schema.componenti.map((c) => c.y + c.altezza);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, larghezza: Math.max(...x2) - x, altezza: Math.max(...y2) - y };
}
