// Risolutore elettrico in corrente continua (puro: nessuna interfaccia).
//
// Calcola le tensioni dei nodi e le correnti di un circuito fatto di:
// - generatori di tensione riferiti a massa con resistenza interna
//   (i pin dell'Arduino, i pin 5V e 3,3V): equivalente di Norton;
// - resistenze (anche i pulsanti chiusi, il potenziometro, la fotoresistenza);
// - generatori "flottanti" fra due nodi qualsiasi (alimentatore da banco,
//   pile): i morsetti + e − non sono legati alla massa dell'Arduino;
// - transistor NPN con un modello semplificato a tre stati: interdizione
//   (giunzione base-emettitore spenta, collettore aperto), zona attiva
//   (Ic = β·Ib: generatore di corrente comandato, lineare) e saturazione
//   (fra collettore ed emettitore restano 0,2 V);
// - diodi e LED con modello a soglia: spento = aperto, acceso = tensione di
//   soglia Vf in serie a una piccola resistenza Ron.
// Metodo: analisi nodale (G · V = I) risolta con l'eliminazione di Gauss; lo
// stato dei diodi si ricava provando e correggendo finché non è coerente.
// Il nodo "massa" vale sempre 0 V. I nodi non collegati a niente vengono
// segnalati come "flottanti" (un ingresso flottante legge valori a caso).

export type Elemento =
  | { tipo: "resistenza"; id: string; a: string; b: string; ohm: number }
  /** Generatore fra il nodo `nodo` e la massa: `volt` con resistenza interna `ohm`. */
  | { tipo: "generatore"; id: string; nodo: string; volt: number; ohm: number }
  /** Generatore fra `piu` e `meno` (nessuno dei due è la massa): `volt` con resistenza interna `ohm`. */
  | { tipo: "alimentatore"; id: string; piu: string; meno: string; volt: number; ohm: number }
  | { tipo: "diodo"; id: string; anodo: string; catodo: string; vf: number; ron: number }
  /** Transistor NPN: collettore, base, emettitore e guadagno di corrente β. */
  | { tipo: "npn"; id: string; c: string; b: string; e: string; beta: number };

export const MASSA = "massa";

export interface RisultatoCircuito {
  /** Tensione di ogni nodo rispetto a massa (V). */
  tensioni: Record<string, number>;
  /**
   * Corrente di ogni resistenza (da a verso b), di ogni diodo (da anodo a
   * catodo) e di ogni alimentatore (uscente dal morsetto +), in A.
   */
  correnti: Record<string, number>;
  /** Diodi in conduzione (anche le giunzioni base-emettitore, con id "<transistor>:BE"). */
  diodiAccesi: Set<string>;
  /** Transistor in saturazione (in conduzione piena, come un interruttore chiuso). */
  saturi: Set<string>;
  /** Nodi senza alcun collegamento a un generatore o alla massa. */
  flottanti: Set<string>;
}

/** Conduttanza di dispersione verso massa: rende il sistema sempre risolvibile. */
const DISPERSIONE = 1e-9;
/** Resistenza minima, per non dividere per zero (pulsanti chiusi, fili). */
const R_MINIMA = 1e-3;
const ITERAZIONI_DIODI = 60;

/** Giunzione base-emettitore: soglia e resistenza in conduzione. */
export const VBE = 0.7;
const R_BE = 10;
/** Tensione collettore-emettitore in saturazione e resistenza in serie. */
export const VCE_SAT = 0.2;
const R_CE_SAT = 0.5;

type Npn = Extract<Elemento, { tipo: "npn" }>;
type Diodo = Extract<Elemento, { tipo: "diodo" }>;
/** Giunzione base-emettitore di un transistor, trattata come un diodo. */
const giunzioneBE = (t: Npn): Diodo => ({ tipo: "diodo", id: `${t.id}:BE`, anodo: t.b, catodo: t.e, vf: VBE, ron: R_BE });

export function risolviCircuito(elementi: readonly Elemento[]): RisultatoCircuito {
  // Elenco dei nodi (la massa è esclusa: è il riferimento).
  const nodi = new Set<string>();
  for (const e of elementi) {
    for (const n of nodiDi(e)) if (n !== MASSA) nodi.add(n);
  }
  const indice = new Map<string, number>();
  [...nodi].forEach((n, i) => indice.set(n, i));
  const transistor = elementi.filter((e): e is Npn => e.tipo === "npn");
  const diodi = [...elementi.filter((e): e is Diodo => e.tipo === "diodo"), ...transistor.map(giunzioneBE)];
  const accesi = new Set<string>();
  const saturi = new Set<string>();

  let v = new Array<number>(nodi.size).fill(0);
  const tensione = (n: string) => (n === MASSA ? 0 : v[indice.get(n)!]);
  const correnteDiodo = (d: Diodo) => (accesi.has(d.id) ? Math.max(0, (tensione(d.anodo) - tensione(d.catodo) - d.vf) / Math.max(d.ron, R_MINIMA)) : 0);

  for (let giro = 0; giro < ITERAZIONI_DIODI; giro++) {
    v = risolviLineare(elementi, indice, accesi, saturi);
    // Correggi lo stato dei diodi: si accende chi ha più di Vf ai capi, si
    // spegne chi conduce "al contrario". Uno alla volta il più sbagliato,
    // così la ricerca non oscilla.
    let peggiore: { id: string; accendi: boolean; errore: number } | null = null;
    for (const d of diodi) {
      const vd = tensione(d.anodo) - tensione(d.catodo);
      if (!accesi.has(d.id) && vd > d.vf + 1e-9) {
        const errore = vd - d.vf;
        if (!peggiore || errore > peggiore.errore) peggiore = { id: d.id, accendi: true, errore };
      } else if (accesi.has(d.id) && (vd - d.vf) / Math.max(d.ron, R_MINIMA) < -1e-9) {
        const errore = d.vf - vd;
        if (!peggiore || errore > peggiore.errore) peggiore = { id: d.id, accendi: false, errore };
      }
    }
    if (peggiore) {
      if (peggiore.accendi) accesi.add(peggiore.id);
      else accesi.delete(peggiore.id);
      continue;
    }
    // Diodi a posto: controlla lo stato dei transistor (uno alla volta).
    let cambiato = false;
    for (const t of transistor) {
      const ib = correnteDiodo(giunzioneBE(t));
      const vce = tensione(t.c) - tensione(t.e);
      if (!saturi.has(t.id)) {
        // In zona attiva il generatore di corrente non può portare Vce sotto
        // la tensione di saturazione: il transistor è saturo.
        if (ib > 0 && vce < VCE_SAT - 1e-6) {
          saturi.add(t.id);
          cambiato = true;
        }
      } else {
        // Saturo: esce dalla saturazione se la base è spenta o se servirebbe
        // più corrente di collettore di quella che la base consente (β·Ib).
        const ic = (vce - VCE_SAT) / R_CE_SAT;
        if (ib <= 0 || ic > t.beta * ib * 1.0001) {
          saturi.delete(t.id);
          cambiato = true;
        }
      }
      if (cambiato) break;
    }
    if (!cambiato) break;
  }

  const tensioni: Record<string, number> = { [MASSA]: 0 };
  for (const [n, i] of indice) tensioni[n] = v[i];
  const correnti: Record<string, number> = {};
  for (const e of elementi) {
    if (e.tipo === "resistenza") correnti[e.id] = (tensione(e.a) - tensione(e.b)) / Math.max(e.ohm, R_MINIMA);
    if (e.tipo === "diodo") correnti[e.id] = correnteDiodo(e);
    if (e.tipo === "alimentatore") correnti[e.id] = (e.volt - (tensione(e.piu) - tensione(e.meno))) / Math.max(e.ohm, R_MINIMA);
    if (e.tipo === "npn") {
      // Corrente di base (giunzione) e di collettore (nel verso C → E).
      const ib = correnteDiodo(giunzioneBE(e));
      correnti[`${e.id}:BE`] = ib;
      correnti[e.id] = ib <= 0 ? 0 : saturi.has(e.id) ? Math.max(0, (tensione(e.c) - tensione(e.e) - VCE_SAT) / R_CE_SAT) : e.beta * ib;
    }
  }
  return { tensioni, correnti, diodiAccesi: accesi, saturi, flottanti: nodiFlottanti(elementi, nodi) };
}

function nodiDi(e: Elemento): string[] {
  if (e.tipo === "resistenza") return [e.a, e.b];
  if (e.tipo === "generatore") return [e.nodo];
  if (e.tipo === "alimentatore") return [e.piu, e.meno];
  if (e.tipo === "npn") return [e.c, e.b, e.e];
  return [e.anodo, e.catodo];
}

/** Costruisce e risolve G · V = I con i diodi nello stato indicato. */
function risolviLineare(elementi: readonly Elemento[], indice: Map<string, number>, accesi: ReadonlySet<string>, saturi: ReadonlySet<string>): number[] {
  const n = indice.size;
  const G = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const I = new Array<number>(n).fill(0);
  const conduttanza = (a: string, b: string, g: number) => {
    const ia = indice.get(a);
    const ib = indice.get(b);
    if (ia !== undefined) G[ia][ia] += g;
    if (ib !== undefined) G[ib][ib] += g;
    if (ia !== undefined && ib !== undefined) {
      G[ia][ib] -= g;
      G[ib][ia] -= g;
    }
  };
  const iniezione = (nodo: string, corrente: number) => {
    const i = indice.get(nodo);
    if (i !== undefined) I[i] += corrente;
  };
  /** Termine della matrice G[riga][colonna] (ignorato se uno dei due nodi è la massa). */
  const termine = (riga: string, colonna: string, g: number) => {
    const r = indice.get(riga);
    const c = indice.get(colonna);
    if (r !== undefined && c !== undefined) G[r][c] += g;
  };
  /** Diodo in conduzione: i = (Va − Vk − Vf) / Ron. */
  const diodoAcceso = (anodo: string, catodo: string, vf: number, ron: number) => {
    // Nella legge dei nodi il termine Vf/Ron passa a destra: entra nell'anodo ed esce dal catodo.
    const g = 1 / Math.max(ron, R_MINIMA);
    conduttanza(anodo, catodo, g);
    iniezione(anodo, vf * g);
    iniezione(catodo, -vf * g);
  };
  for (let i = 0; i < n; i++) G[i][i] += DISPERSIONE;
  for (const e of elementi) {
    if (e.tipo === "resistenza") conduttanza(e.a, e.b, 1 / Math.max(e.ohm, R_MINIMA));
    else if (e.tipo === "generatore") {
      // Norton: conduttanza verso massa e corrente V/R entrante nel nodo.
      const g = 1 / Math.max(e.ohm, R_MINIMA);
      conduttanza(e.nodo, MASSA, g);
      iniezione(e.nodo, e.volt * g);
    } else if (e.tipo === "alimentatore") {
      // Norton fra i due morsetti: conduttanza fra + e − e corrente V/R che
      // entra nel + ed esce dal −.
      const g = 1 / Math.max(e.ohm, R_MINIMA);
      conduttanza(e.piu, e.meno, g);
      iniezione(e.piu, e.volt * g);
      iniezione(e.meno, -e.volt * g);
    } else if (e.tipo === "diodo" && accesi.has(e.id)) {
      diodoAcceso(e.anodo, e.catodo, e.vf, e.ron);
    } else if (e.tipo === "npn" && accesi.has(`${e.id}:BE`)) {
      diodoAcceso(e.b, e.e, VBE, R_BE);
      if (saturi.has(e.id)) {
        // Saturazione: fra collettore ed emettitore una caduta di 0,2 V.
        diodoAcceso(e.c, e.e, VCE_SAT, R_CE_SAT);
      } else {
        // Zona attiva: Ic = β·Ib = gm·(Vb − Ve) − β·Vbe/Rbe, che esce dal
        // collettore ed entra nell'emettitore (generatore comandato in tensione).
        const gm = e.beta / R_BE;
        const i0 = (e.beta * VBE) / R_BE;
        termine(e.c, e.b, gm);
        termine(e.c, e.e, -gm);
        termine(e.e, e.b, -gm);
        termine(e.e, e.e, gm);
        iniezione(e.c, i0);
        iniezione(e.e, -i0);
      }
    }
  }
  return gauss(G, I);
}

/** Eliminazione di Gauss con pivot parziale (le matrici sono piccole). */
export function gauss(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((riga, i) => [...riga, b[i]]);
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[pivot][c])) pivot = r;
    [M[c], M[pivot]] = [M[pivot], M[c]];
    const p = M[c][c];
    if (Math.abs(p) < 1e-300) continue;
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / p;
      if (f === 0) continue;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = Math.abs(M[r][r]) < 1e-300 ? 0 : s / M[r][r];
  }
  return x;
}

/**
 * Nodi flottanti: non raggiungibili da un generatore o dalla massa
 * attraverso resistenze o diodi (i diodi contano in entrambi i versi: un
 * ingresso collegato a un LED verso massa non è considerato flottante).
 */
function nodiFlottanti(elementi: readonly Elemento[], nodi: ReadonlySet<string>): Set<string> {
  const vicini = new Map<string, string[]>();
  const unisci = (a: string, b: string) => {
    vicini.set(a, [...(vicini.get(a) ?? []), b]);
    vicini.set(b, [...(vicini.get(b) ?? []), a]);
  };
  const radici: string[] = [MASSA];
  for (const e of elementi) {
    if (e.tipo === "resistenza" && e.ohm < 1e9) unisci(e.a, e.b);
    if (e.tipo === "diodo") unisci(e.anodo, e.catodo);
    if (e.tipo === "npn") {
      unisci(e.b, e.e);
      unisci(e.c, e.e);
    }
    if (e.tipo === "generatore") radici.push(e.nodo);
    // Un alimentatore unisce i suoi due morsetti ma non è un riferimento: se
    // il suo circuito non tocca il GND della scheda (o un pin), per l'Arduino
    // quei nodi restano flottanti, come nella realtà senza massa comune.
    if (e.tipo === "alimentatore") unisci(e.piu, e.meno);
  }
  const visti = new Set<string>(radici);
  const coda = [...radici];
  while (coda.length) {
    const n = coda.pop()!;
    for (const m of vicini.get(n) ?? []) if (!visti.has(m)) visti.add(m), coda.push(m);
  }
  return new Set([...nodi].filter((n) => !visti.has(n)));
}
