// Modello dei dati dello schema mostrato nell'editor: i componenti posati sul
// foglio, i fili che collegano i loro morsetti e la selezione corrente. Tutte le funzioni restituiscono un nuovo
// oggetto senza modificare quello ricevuto: servirà ad Annulla/Ripeti (1.7).
import { agganciaPunto, type Punto } from "./geometria";

/** Rotazioni ammesse (gradi, senso orario). */
export type Rotazione = 0 | 90 | 180 | 270;

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
  /**
   * Rotazione in senso orario (0, 90, 180, 270 gradi); se manca vale 0.
   * `x`, `y` restano l'angolo in alto a sinistra del componente ruotato;
   * `larghezza`/`altezza` sono quelle del disegno non ruotato.
   */
  rotazione?: Rotazione;
  /**
   * Numeri mostrati accanto ai morsetti al posto dell'id della libreria
   * (es. il secondo contatto NA di K1 ha i morsetti "13"/"14" numerati
   * "33"/"34"). Calcolati in automatico da associazioni.ts e salvati nel file.
   */
  numeriMorsetti?: Record<string, string>;
  /**
   * Solo per i temporizzatori: tempo di ritardo in secondi (se manca vale il
   * tempo predefinito del motore di simulazione). Salvato nel file.
   */
  tempo?: number;
  /** Solo per i contatori del PLC: valore di preset (numero di impulsi). Salvato nel file. */
  preset?: number;
  /**
   * Solo per gli impianti animati del PLC: operando scelto per ogni segnale
   * (es. { motore: "Q1.0" }). I segnali assenti usano l'operando proposto.
   */
  collegamenti?: Record<string, string>;
  /** Solo per le resistenze del modulo Arduino: valore in ohm (se manca 220 Ω). */
  valore?: number;
  /**
   * Solo nel modulo Elettronica: parametri del componente (resistenza,
   * capacità, tensione, forma d'onda…). I parametri assenti valgono il
   * valore predefinito del motore. Salvati nel file.
   */
  parametri?: Record<string, number | string>;
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
 * `punti` sono i vertici interni di un filo piegato a mano dallo studente
 * (pieghe cliccate mentre lo si disegna o tratti trascinati): se ci sono,
 * hanno la precedenza su `medio` e il percorso automatico.
 */
export interface Filo {
  id: string;
  da: EstremoFilo;
  a: EstremoFilo;
  medio?: number;
  punti?: Punto[];
  /** Colore del filo (modulo Arduino, come i cavetti veri): es. "#d32f2f". */
  colore?: string;
}

export interface Schema {
  componenti: ComponenteSchema[];
  fili: Filo[];
  /**
   * Solo nel modulo Arduino: il programma (sketch) scritto dallo studente.
   * Sta nello schema così Annulla/Ripeti, salvataggio automatico e file .elab
   * lo trattano come il resto del progetto.
   */
  codice?: string;
  /** Solo nel modulo Arduino: programma a blocchi (JSON di Blockly), se c'è. */
  blocchi?: string;
  /** Solo nel modulo Arduino: si programma con i blocchi o con il testo. */
  modoCodice?: "blocchi" | "testo";
  /**
   * Modalità Esercizio (preparata dal docente): consegna mostrata allo
   * studente e, facoltativa, la soluzione completa usata dalla verifica
   * automatica. Nel file la soluzione è codificata (non leggibile a colpo d'occhio).
   */
  esercizio?: Esercizio;
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
    // I fili fra due componenti spostati insieme si spostano anche loro, pieghe comprese.
    fili: schema.fili.map((f) =>
      f.punti && scelti.has(f.da.componente) && scelti.has(f.a.componente)
        ? { ...f, punti: f.punti.map((p) => ({ x: p.x + d.x, y: p.y + d.y })) }
        : f,
    ),
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
      (c) => {
        const d = dimensioni(c);
        return c.x >= r.x && c.y >= r.y && c.x + d.larghezza <= r.x + r.larghezza && c.y + d.altezza <= r.y + r.altezza;
      },
    )
    .map((c) => c.id);
}

/** Rettangolo che contiene tutti i componenti (per "Adatta alla finestra"); undefined se lo schema è vuoto. */
export function ingombroSchema(schema: Schema): Rettangolo | undefined {
  if (schema.componenti.length === 0) return undefined;
  const xs = schema.componenti.map((c) => c.x);
  const ys = schema.componenti.map((c) => c.y);
  const x2 = schema.componenti.map((c) => c.x + dimensioni(c).larghezza);
  const y2 = schema.componenti.map((c) => c.y + dimensioni(c).altezza);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, larghezza: Math.max(...x2) - x, altezza: Math.max(...y2) - y };
}

/**
 * Elimina gli elementi selezionati (componenti e fili). Insieme a un
 * componente spariscono anche i fili collegati ai suoi morsetti: un filo con
 * un capo "nel vuoto" non avrebbe senso nello schema.
 */
export function eliminaSelezione(schema: Schema, selezione: Selezione): Schema {
  if (selezione.length === 0) return schema;
  const scelti = new Set(selezione);
  const componenti = schema.componenti.filter((c) => !scelti.has(c.id));
  const rimasti = new Set(componenti.map((c) => c.id));
  const fili = schema.fili.filter((f) => !scelti.has(f.id) && rimasti.has(f.da.componente) && rimasti.has(f.a.componente));
  if (componenti.length === schema.componenti.length && fili.length === schema.fili.length) return schema;
  return { componenti, fili };
}

/** Id di tutti gli elementi dello schema (Ctrl+A). */
export function tuttiGliId(schema: Schema): string[] {
  return [...schema.componenti.map((c) => c.id), ...schema.fili.map((f) => f.id)];
}

// --- Rotazione dei componenti ---

/** Ingombro sul foglio tenendo conto della rotazione (a 90° e 270° larghezza e altezza si scambiano). */
export function dimensioni(c: Pick<ComponenteSchema, "larghezza" | "altezza" | "rotazione">): { larghezza: number; altezza: number } {
  const r = c.rotazione ?? 0;
  return r === 90 || r === 270 ? { larghezza: c.altezza, altezza: c.larghezza } : { larghezza: c.larghezza, altezza: c.altezza };
}

/**
 * Posizione di un punto del disegno (coordinate del componente non ruotato)
 * dopo la rotazione, sempre rispetto all'angolo in alto a sinistra del
 * componente ruotato. I punti sulla griglia restano sulla griglia.
 */
export function ruotaPunto(c: Pick<ComponenteSchema, "larghezza" | "altezza" | "rotazione">, p: Punto): Punto {
  const w = c.larghezza;
  const h = c.altezza;
  switch (c.rotazione ?? 0) {
    case 90:
      return { x: h - p.y, y: p.x };
    case 180:
      return { x: w - p.x, y: h - p.y };
    case 270:
      return { x: p.y, y: w - p.x };
    default:
      return { x: p.x, y: p.y };
  }
}

/**
 * Trasformazione da dare al disegno (Konva): rotazione e spostamento che
 * portano il disegno non ruotato nel riquadro del componente ruotato.
 */
export function trasformazioneRotazione(c: Pick<ComponenteSchema, "larghezza" | "altezza" | "rotazione">): { x: number; y: number; rotazione: number } {
  const r = c.rotazione ?? 0;
  if (r === 90) return { x: c.altezza, y: 0, rotazione: 90 };
  if (r === 180) return { x: c.larghezza, y: c.altezza, rotazione: 180 };
  if (r === 270) return { x: 0, y: c.larghezza, rotazione: 270 };
  return { x: 0, y: 0, rotazione: 0 };
}

/**
 * Ruota di 90° in senso orario i componenti selezionati, ognuno attorno al
 * proprio centro (agganciato alla griglia). I fili seguono i morsetti da soli.
 */
export function ruotaSelezione(schema: Schema, selezione: Selezione): Schema {
  const scelti = new Set(selezione);
  if (!schema.componenti.some((c) => scelti.has(c.id))) return schema;
  return {
    ...schema,
    componenti: schema.componenti.map((c) => {
      if (!scelti.has(c.id)) return c;
      const prima = dimensioni(c);
      const rotazione = (((c.rotazione ?? 0) + 90) % 360) as Rotazione;
      const dopo = dimensioni({ ...c, rotazione });
      const centro = { x: c.x + prima.larghezza / 2, y: c.y + prima.altezza / 2 };
      const angolo = agganciaPunto({ x: centro.x - dopo.larghezza / 2, y: centro.y - dopo.altezza / 2 });
      const nuovo: ComponenteSchema = { ...c, x: angolo.x, y: angolo.y, rotazione };
      // Tornato a 0° il campo si toglie: il file resta uguale a prima.
      if (rotazione === 0) delete nuovo.rotazione;
      return nuovo;
    }),
  };
}

/** Esercizio preparato dal docente. */
export interface Esercizio {
  /** Testo della consegna (cosa deve fare lo studente). */
  consegna: string;
  /** Schema completo e funzionante del docente. */
  soluzione?: { componenti: ComponenteSchema[]; fili: Filo[] };
}
