// Fili dello schema: collegamento fra due morsetti, instradamento ortogonale
// automatico e spostamento del tratto centrale.
// Funzioni pure (nessuna interfaccia), coperte da test in fili.test.ts.
//
// Come viene disegnato un filo:
// 1. da ogni morsetto esce un breve tratto perpendicolare al lato del
//    componente su cui si trova (in alto → verso l'alto, a destra → verso destra…);
// 2. i due tratti si uniscono con una "Z" di soli segmenti orizzontali e verticali;
// 3. il tratto centrale della Z sta a metà strada oppure dove lo studente
//    l'ha trascinato (campo `medio` del filo).
// Il percorso non evita gli altri componenti: è una versione semplificata,
// lo studente sposta il filo a mano se passa sopra un simbolo.
import { PASSO_GRIGLIA, agganciaValore, type Punto } from "./geometria";
import type { MorsettoLibreria } from "./libreria";
import type { ComponenteSchema, EstremoFilo, Filo, Schema } from "./schema";

/** Da dove si ricavano i morsetti di un tipo di componente (di solito la libreria). */
export type MorsettiDelTipo = (tipo: string) => readonly MorsettoLibreria[] | undefined;

/** Direzione in cui un filo esce da un morsetto. */
export type Direzione = "su" | "giu" | "sinistra" | "destra";

const VERSORI: Record<Direzione, Punto> = {
  su: { x: 0, y: -1 },
  giu: { x: 0, y: 1 },
  sinistra: { x: -1, y: 0 },
  destra: { x: 1, y: 0 },
};

const eVerticale = (d: Direzione) => d === "su" || d === "giu";

/** Morsetto nella posizione assoluta sul foglio, con la direzione di uscita del filo. */
export interface MorsettoPosato {
  componente: string;
  morsetto: string;
  posizione: Punto;
  direzione: Direzione;
}

/**
 * Direzione di uscita: il lato del componente su cui sta il morsetto.
 * I lati superiore e inferiore hanno la precedenza (negli schemi elettrici i
 * collegamenti corrono soprattutto in verticale); un morsetto interno esce in basso.
 */
export function direzioneMorsetto(c: Pick<ComponenteSchema, "larghezza" | "altezza">, m: Punto): Direzione {
  if (m.y <= 0) return "su";
  if (m.y >= c.altezza) return "giu";
  if (m.x <= 0) return "sinistra";
  if (m.x >= c.larghezza) return "destra";
  return "giu";
}

/** Tutti i morsetti di un componente posato, in coordinate del foglio. */
export function morsettiDelComponente(c: ComponenteSchema, morsettiDi: MorsettiDelTipo): MorsettoPosato[] {
  return (morsettiDi(c.tipo) ?? []).map((m) => ({
    componente: c.id,
    morsetto: m.id,
    posizione: { x: c.x + m.x, y: c.y + m.y },
    direzione: direzioneMorsetto(c, m),
  }));
}

/** Il morsetto indicato da un capo del filo; undefined se il componente o il morsetto non esistono più. */
export function trovaMorsetto(schema: Schema, e: EstremoFilo, morsettiDi: MorsettiDelTipo): MorsettoPosato | undefined {
  const c = schema.componenti.find((x) => x.id === e.componente);
  return c ? morsettiDelComponente(c, morsettiDi).find((m) => m.morsetto === e.morsetto) : undefined;
}

const stessoEstremo = (a: EstremoFilo, b: EstremoFilo) => a.componente === b.componente && a.morsetto === b.morsetto;

/** Toglie i punti doppi e quelli in mezzo a un tratto rettilineo. */
export function semplificaPercorso(punti: readonly Punto[]): Punto[] {
  const senzaDoppi = punti.filter((p, i) => i === 0 || p.x !== punti[i - 1].x || p.y !== punti[i - 1].y);
  return senzaDoppi.filter((p, i, arr) => {
    if (i === 0 || i === arr.length - 1) return true;
    const a = arr[i - 1];
    const b = arr[i + 1];
    return !((a.x === p.x && p.x === b.x) || (a.y === p.y && p.y === b.y));
  });
}

/**
 * L'asse del tratto centrale: "y" se il filo fa verticale-orizzontale-verticale
 * (il tratto centrale è orizzontale e si sposta in su/giù), "x" altrimenti.
 */
export function asseMedio(partenza: Direzione, arrivo: Direzione): "x" | "y" {
  // Se almeno un capo esce in verticale si usa la Z verticale, la più comune negli schemi.
  return eVerticale(partenza) || eVerticale(arrivo) ? "y" : "x";
}

/** Posizione predefinita del tratto centrale: a metà fra le uscite, sulla griglia. */
export function medioPredefinito(u1: Punto, u2: Punto, asse: "x" | "y"): number {
  return agganciaValore((u1[asse] + u2[asse]) / 2);
}

/**
 * Percorso ortogonale fra due morsetti (lista di vertici, dal primo all'ultimo).
 * @param medio posizione del tratto centrale; se manca si usa quella predefinita
 */
export function instrada(p1: MorsettoPosato | { posizione: Punto; direzione: Direzione }, p2: { posizione: Punto; direzione: Direzione }, medio?: number): Punto[] {
  const a = p1.posizione;
  const b = p2.posizione;
  // Uscite: un passo di griglia fuori dal componente, perpendicolari al suo lato.
  const v1 = VERSORI[p1.direzione];
  const v2 = VERSORI[p2.direzione];
  const u1 = { x: a.x + v1.x * PASSO_GRIGLIA, y: a.y + v1.y * PASSO_GRIGLIA };
  const u2 = { x: b.x + v2.x * PASSO_GRIGLIA, y: b.y + v2.y * PASSO_GRIGLIA };
  // Morsetti allineati e "di fronte" (es. 14 di S1 sopra A1 di K1): basta un tratto dritto.
  const allineatiV = a.x === b.x && eVerticale(p1.direzione) && eVerticale(p2.direzione);
  const allineatiO = a.y === b.y && !eVerticale(p1.direzione) && !eVerticale(p2.direzione);
  if ((allineatiV || allineatiO) && medio === undefined) {
    const versoGiusto = allineatiV ? (b.y - a.y) * v1.y > 0 && (a.y - b.y) * v2.y > 0 : (b.x - a.x) * v1.x > 0 && (a.x - b.x) * v2.x > 0;
    if (versoGiusto) return [a, b];
  }
  const asse = asseMedio(p1.direzione, p2.direzione);
  const m = medio ?? medioPredefinito(u1, u2, asse);
  const centrali: Punto[] =
    asse === "y"
      ? [
          { x: u1.x, y: m },
          { x: u2.x, y: m },
        ]
      : [
          { x: m, y: u1.y },
          { x: m, y: u2.y },
        ];
  return semplificaPercorso([a, u1, ...centrali, u2, b]);
}

/** Percorso di un filo dello schema; undefined se uno dei due morsetti non esiste più. */
export function percorsoFilo(schema: Schema, filo: Filo, morsettiDi: MorsettiDelTipo): Punto[] | undefined {
  const p1 = trovaMorsetto(schema, filo.da, morsettiDi);
  const p2 = trovaMorsetto(schema, filo.a, morsettiDi);
  return p1 && p2 ? instrada(p1, p2, filo.medio) : undefined;
}

/** Primo identificativo libero del tipo "filo-3". */
export function nuovoIdFilo(schema: Schema): string {
  const usati = new Set(schema.fili.map((f) => f.id));
  let n = 1;
  while (usati.has(`filo-${n}`)) n++;
  return `filo-${n}`;
}

/** Perché un collegamento non si può fare (chiave dei testi in lingue/it.json). */
export type ErroreCollegamento = "fili.stessoMorsetto" | "fili.giaCollegati" | "fili.morsettoInesistente";

export type EsitoCollegamento = { ok: true; schema: Schema; filo: Filo } | { ok: false; errore: ErroreCollegamento };

/**
 * Collega due morsetti con un nuovo filo. Rifiuta (con il motivo) il filo da
 * un morsetto a se stesso, un secondo filo fra gli stessi due morsetti e i
 * morsetti che non esistono. Più fili sullo stesso morsetto sono ammessi:
 * negli schemi si fanno spesso i "ponticelli" fra contatti.
 */
export function collega(schema: Schema, da: EstremoFilo, a: EstremoFilo, morsettiDi: MorsettiDelTipo): EsitoCollegamento {
  if (stessoEstremo(da, a)) return { ok: false, errore: "fili.stessoMorsetto" };
  if (!trovaMorsetto(schema, da, morsettiDi) || !trovaMorsetto(schema, a, morsettiDi))
    return { ok: false, errore: "fili.morsettoInesistente" };
  const doppio = schema.fili.some(
    (f) => (stessoEstremo(f.da, da) && stessoEstremo(f.a, a)) || (stessoEstremo(f.da, a) && stessoEstremo(f.a, da)),
  );
  if (doppio) return { ok: false, errore: "fili.giaCollegati" };
  const filo: Filo = { id: nuovoIdFilo(schema), da: { ...da }, a: { ...a } };
  return { ok: true, schema: { ...schema, fili: [...schema.fili, filo] }, filo };
}

/**
 * Sposta il tratto centrale di un filo verso il punto del foglio indicato
 * (dove si trova il mouse mentre lo si trascina), agganciato alla griglia.
 * Se il filo è un tratto dritto, trascinandolo diventa una Z.
 */
export function spostaTrattoFilo(schema: Schema, id: string, verso: Punto, morsettiDi: MorsettiDelTipo): Schema {
  const filo = schema.fili.find((f) => f.id === id);
  if (!filo) return schema;
  const p1 = trovaMorsetto(schema, filo.da, morsettiDi);
  const p2 = trovaMorsetto(schema, filo.a, morsettiDi);
  if (!p1 || !p2) return schema;
  const medio = agganciaValore(verso[asseMedio(p1.direzione, p2.direzione)]);
  if (filo.medio === medio) return schema;
  return { ...schema, fili: schema.fili.map((f) => (f.id === id ? { ...f, medio } : f)) };
}

/** Riporta il filo al percorso automatico (doppio clic sul filo). */
export function ripristinaPercorso(schema: Schema, id: string): Schema {
  const filo = schema.fili.find((f) => f.id === id);
  if (!filo || filo.medio === undefined) return schema;
  return { ...schema, fili: schema.fili.map((f) => (f.id === id ? { id: f.id, da: f.da, a: f.a } : f)) };
}

/** Quanti fili arrivano a un morsetto (per disegnare il pallino di giunzione). */
export function filiSulMorsetto(schema: Schema, e: EstremoFilo): number {
  return schema.fili.filter((f) => stessoEstremo(f.da, e) || stessoEstremo(f.a, e)).length;
}
