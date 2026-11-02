// Fili dello schema: collegamento fra due morsetti, instradamento ortogonale
// automatico e spostamento del tratto centrale.
// Funzioni pure (nessuna interfaccia), coperte da test in fili.test.ts.
//
// Come viene disegnato un filo:
// 1. da ogni morsetto esce un breve tratto perpendicolare al lato del
//    componente su cui si trova (in alto → verso l'alto, a destra → verso destra…);
// 2. i due tratti si uniscono con una "Z" di soli segmenti orizzontali e verticali;
// 3. il tratto centrale della Z sta a metà strada oppure dove lo studente
//    l'ha trascinato (campo `medio`, usato dai file delle versioni precedenti).
//
// Fili piegati a mano (campo `punti`): lo studente può
// - fare clic sul foglio vuoto mentre disegna il filo: ogni clic aggiunge
//   una piega, come nei programmi di disegno degli schemi;
// - trascinare QUALSIASI tratto di un filo già fatto: i tratti orizzontali
//   si spostano in su/giù, quelli verticali a destra/sinistra; trascinando
//   il primo o l'ultimo tratto il filo può uscire dal morsetto anche di lato.
// In questi casi il filo memorizza i suoi vertici interni e li unisce sempre
// con tratti solo orizzontali e verticali (vedi `ortogonalizza`).
// Il percorso non evita gli altri componenti: è una versione semplificata,
// lo studente sposta il filo a mano se passa sopra un simbolo.
import { PASSO_GRIGLIA, agganciaValore, type Punto } from "./geometria";
import type { MorsettoLibreria } from "./libreria";
import { dimensioni, ruotaPunto, type ComponenteSchema, type EstremoFilo, type Filo, type Schema } from "./schema";

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
  // Con la rotazione si spostano anche i morsetti e cambia il lato da cui esce il filo.
  const d = dimensioni(c);
  return (morsettiDi(c.tipo) ?? []).map((m) => {
    const r = ruotaPunto(c, m);
    return {
      componente: c.id,
      morsetto: m.id,
      posizione: { x: c.x + r.x, y: c.y + r.y },
      direzione: direzioneMorsetto(d, r),
    };
  });
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
/**
 * Stile dei fili: "ortogonale" negli schemi elettrici (solo tratti
 * orizzontali e verticali), "diretto" nel banco Arduino (cavetti dritti da
 * un punto all'altro, con le pieghe scelte dallo studente, come in un
 * simulatore di breadboard).
 */
export type StileFili = "ortogonale" | "diretto";

export function percorsoFilo(schema: Schema, filo: Filo, morsettiDi: MorsettiDelTipo, stile: StileFili = "ortogonale"): Punto[] | undefined {
  const p1 = trovaMorsetto(schema, filo.da, morsettiDi);
  const p2 = trovaMorsetto(schema, filo.a, morsettiDi);
  if (!p1 || !p2) return undefined;
  if (stile === "diretto") return [p1.posizione, ...(filo.punti ?? []), p2.posizione];
  if (filo.punti && filo.punti.length > 0) return ortogonalizza([p1.posizione, ...filo.punti, p2.posizione]);
  return instrada(p1, p2, filo.medio);
}

/**
 * Unisce una sequenza di punti con soli tratti orizzontali e verticali:
 * fra due punti non allineati aggiunge un angolo. L'angolo è scelto in modo
 * da "girare" rispetto al tratto precedente (dopo un tratto verticale si va
 * prima in orizzontale e viceversa), così il filo non torna su se stesso.
 * Il primo tratto parte in verticale, la direzione più comune negli schemi.
 */
export function ortogonalizza(punti: readonly Punto[]): Punto[] {
  if (punti.length === 0) return [];
  const out: Punto[] = [punti[0]];
  let ultimoVerticale = false;
  for (let i = 1; i < punti.length; i++) {
    const q = out[out.length - 1];
    const r = punti[i];
    if (q.x !== r.x && q.y !== r.y) {
      // Angolo: dopo un tratto verticale si gira in orizzontale (e viceversa).
      out.push(ultimoVerticale ? { x: r.x, y: q.y } : { x: q.x, y: r.y });
    }
    out.push(r);
    const a = out[out.length - 2];
    if (a.x !== r.x || a.y !== r.y) ultimoVerticale = a.x === r.x;
  }
  return semplificaPercorso(out);
}

/** Distanza di un punto da un segmento (per capire quale tratto si è afferrato). */
function distanzaDaSegmento(p: Punto, a: Punto, b: Punto): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Indice del tratto del percorso più vicino al punto (tratto i = dal vertice i al vertice i+1). */
export function trattoPiuVicino(percorso: readonly Punto[], p: Punto): number {
  let migliore = 0;
  let distanza = Infinity;
  for (let i = 0; i + 1 < percorso.length; i++) {
    const d = distanzaDaSegmento(p, percorso[i], percorso[i + 1]);
    if (d < distanza) {
      distanza = d;
      migliore = i;
    }
  }
  return migliore;
}

/**
 * Sposta il tratto `indice` del percorso perpendicolarmente a se stesso fino
 * al punto `verso` (agganciato alla griglia): un tratto orizzontale va in
 * su/giù, uno verticale a destra/sinistra. I capi attaccati ai morsetti non
 * si staccano: se si sposta il primo o l'ultimo tratto si aggiunge un piccolo
 * tratto che lo ricollega al morsetto (così il filo può uscire di lato).
 */
export function spostaTratto(percorso: readonly Punto[], indice: number, verso: Punto): Punto[] {
  if (indice < 0 || indice + 1 >= percorso.length) return [...percorso];
  const a = percorso[indice];
  const b = percorso[indice + 1];
  const orizzontale = a.y === b.y;
  const v = agganciaValore(orizzontale ? verso.y : verso.x);
  const sposta = (p: Punto): Punto => (orizzontale ? { x: p.x, y: v } : { x: v, y: p.y });
  const ultimo = percorso.length - 1;
  const out: Punto[] = [];
  percorso.forEach((p, j) => {
    if (j === indice) {
      if (j === 0) out.push(p); // il morsetto resta dov'è
      out.push(sposta(p));
    } else if (j === indice + 1) {
      out.push(sposta(p));
      if (j === ultimo) out.push(p);
    } else out.push(p);
  });
  return semplificaPercorso(out);
}

/**
 * Trascinamento di un tratto di un filo: parte sempre dal percorso che il filo
 * aveva quando lo si è afferrato (non si accumulano errori) e salva i vertici
 * interni nel filo, che da quel momento è "piegato a mano".
 */
export function spostaTrattoDelFilo(schema: Schema, id: string, percorsoIniziale: readonly Punto[], indice: number, verso: Punto): Schema {
  const filo = schema.fili.find((f) => f.id === id);
  if (!filo) return schema;
  const nuovo = spostaTratto(percorsoIniziale, indice, verso);
  const punti = nuovo.slice(1, -1);
  if (filo.punti && stessiPunti(filo.punti, punti)) return schema;
  return {
    ...schema,
    fili: schema.fili.map((f) => (f.id === id ? { id: f.id, da: f.da, a: f.a, punti } : f)),
  };
}

function stessiPunti(a: readonly Punto[], b: readonly Punto[]): boolean {
  return a.length === b.length && a.every((p, i) => p.x === b[i].x && p.y === b[i].y);
}

/** Anteprima del filo che si sta disegnando: dal morsetto, per le pieghe cliccate, fino al mouse. */
export function anteprimaConPieghe(partenza: Punto, pieghe: readonly Punto[], arrivo: Punto): Punto[] {
  return ortogonalizza([partenza, ...pieghe, arrivo]);
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
export function collega(
  schema: Schema,
  da: EstremoFilo,
  a: EstremoFilo,
  morsettiDi: MorsettiDelTipo,
  pieghe: readonly Punto[] = [],
): EsitoCollegamento {
  if (stessoEstremo(da, a)) return { ok: false, errore: "fili.stessoMorsetto" };
  if (!trovaMorsetto(schema, da, morsettiDi) || !trovaMorsetto(schema, a, morsettiDi))
    return { ok: false, errore: "fili.morsettoInesistente" };
  const doppio = schema.fili.some(
    (f) => (stessoEstremo(f.da, da) && stessoEstremo(f.a, a)) || (stessoEstremo(f.da, a) && stessoEstremo(f.a, da)),
  );
  if (doppio) return { ok: false, errore: "fili.giaCollegati" };
  const filo: Filo = { id: nuovoIdFilo(schema), da: { ...da }, a: { ...a } };
  // Pieghe cliccate durante il disegno: il filo nasce già "piegato a mano".
  if (pieghe.length > 0) filo.punti = pieghe.map((p) => ({ x: agganciaValore(p.x), y: agganciaValore(p.y) }));
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
  if (!filo || (filo.medio === undefined && filo.punti === undefined)) return schema;
  return { ...schema, fili: schema.fili.map((f) => (f.id === id ? { id: f.id, da: f.da, a: f.a } : f)) };
}

/** Quanti fili arrivano a un morsetto (per disegnare il pallino di giunzione). */
export function filiSulMorsetto(schema: Schema, e: EstremoFilo): number {
  return schema.fili.filter((f) => stessoEstremo(f.da, e) || stessoEstremo(f.a, e)).length;
}

/**
 * Filo diretto: afferrando un tratto si crea una piega nel punto del mouse
 * (inserita fra i vertici del tratto). Restituisce lo schema e l'indice della
 * nuova piega, da spostare poi con `spostaPiega`.
 */
export function inserisciPiega(schema: Schema, id: string, tratto: number, punto: Punto): { schema: Schema; indice: number } {
  const filo = schema.fili.find((f) => f.id === id);
  if (!filo) return { schema, indice: -1 };
  const punti = [...(filo.punti ?? [])];
  // Il tratto i va dal vertice i al vertice i+1 del percorso [inizio, ...punti, fine].
  const indice = Math.max(0, Math.min(punti.length, tratto));
  punti.splice(indice, 0, { x: agganciaValore(punto.x, 10), y: agganciaValore(punto.y, 10) });
  return { schema: { ...schema, fili: schema.fili.map((f) => (f.id === id ? { ...f, punti } : f)) }, indice };
}

/** Sposta una piega di un filo diretto (agganciata a mezzo passo di griglia). */
export function spostaPiega(schema: Schema, id: string, indice: number, punto: Punto): Schema {
  const filo = schema.fili.find((f) => f.id === id);
  if (!filo?.punti || indice < 0 || indice >= filo.punti.length) return schema;
  const nuovo = { x: agganciaValore(punto.x, 10), y: agganciaValore(punto.y, 10) };
  const vecchio = filo.punti[indice];
  if (vecchio.x === nuovo.x && vecchio.y === nuovo.y) return schema;
  const punti = filo.punti.map((p, i) => (i === indice ? nuovo : p));
  return { ...schema, fili: schema.fili.map((f) => (f.id === id ? { ...f, punti } : f)) };
}

/** Colori dei cavetti, come nella cassetta del laboratorio. */
export const COLORI_FILI: { nome: string; valore: string }[] = [
  { nome: "verde", valore: "#2e7d32" },
  { nome: "rosso", valore: "#d32f2f" },
  { nome: "nero", valore: "#212121" },
  { nome: "blu", valore: "#1565c0" },
  { nome: "giallo", valore: "#f9a825" },
  { nome: "arancione", valore: "#ef6c00" },
  { nome: "bianco", valore: "#eeeeee" },
  { nome: "viola", valore: "#6a1b9a" },
];

/**
 * Colore proposto per un nuovo cavetto, secondo l'abitudine del laboratorio:
 * rosso se tocca un'alimentazione positiva (5V, 3V3, linea + della
 * breadboard), nero se tocca la massa (GND, linea −), verde negli altri casi.
 */
export function colorePropostoFilo(da: EstremoFilo, a: EstremoFilo): string {
  const tipo = (m: string) => (/^(5V|3V3|VIN|Ap\d+|Bp\d+)$/.test(m) ? "piu" : /^(GND\d*|Am\d+|Bm\d+)$/.test(m) ? "meno" : "");
  const t = [tipo(da.morsetto), tipo(a.morsetto)];
  if (t.includes("meno")) return "#212121";
  if (t.includes("piu")) return "#d32f2f";
  return "#2e7d32";
}
