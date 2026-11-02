// Simulatore circuitale del modulo Elettronica (puro: nessuna interfaccia).
//
// Metodo: analisi nodale modificata (MNA). Le incognite sono le tensioni dei
// nodi (il nodo "0" è la massa) e le correnti dei generatori di tensione.
// - Elementi lineari (resistenze, generatori, condensatori, induttori) si
//   scrivono direttamente nella matrice.
// - Elementi non lineari (diodi, LED, zener, transistor BJT e MOSFET,
//   amplificatori operazionali) dicono quanta corrente entra in ciascun
//   loro terminale per date tensioni; la matrice si ottiene linearizzando
//   attorno al punto attuale (derivate calcolate numericamente) e si ripete
//   (metodo di Newton-Raphson) finché le tensioni non cambiano più.
// - Analisi DC (punto di lavoro): condensatori aperti, induttori in corto.
// - Analisi nel tempo (transitorio): condensatori e induttori diventano
//   resistenze equivalenti con un generatore (metodo di Eulero all'indietro),
//   i generatori possono variare nel tempo (sinusoide, onda quadra…).
//
// È una versione semplificata di un simulatore SPICE: modelli essenziali dei
// componenti, senza capacità interne dei semiconduttori né rumore.

export const MASSA = "0";
/** Tensione termica a 27 °C (V). */
export const VT = 0.02585;

/** Forma d'onda di un generatore. */
export type Onda =
  | { tipo: "continua"; valore: number }
  | { tipo: "sinusoide"; ampiezza: number; frequenza: number; offset?: number; fase?: number }
  | { tipo: "quadra"; ampiezza: number; frequenza: number; offset?: number; duty?: number }
  | { tipo: "triangolare"; ampiezza: number; frequenza: number; offset?: number };

/** Valore della forma d'onda all'istante t (s). */
export function valoreOnda(o: Onda, t: number): number {
  switch (o.tipo) {
    case "continua":
      return o.valore;
    case "sinusoide":
      return (o.offset ?? 0) + o.ampiezza * Math.sin(2 * Math.PI * o.frequenza * t + ((o.fase ?? 0) * Math.PI) / 180);
    case "quadra": {
      const fase = (t * o.frequenza) % 1;
      return (o.offset ?? 0) + (fase < (o.duty ?? 0.5) ? o.ampiezza : -o.ampiezza);
    }
    case "triangolare": {
      const fase = (t * o.frequenza) % 1;
      const v = fase < 0.5 ? -1 + 4 * fase : 3 - 4 * fase;
      return (o.offset ?? 0) + o.ampiezza * v;
    }
  }
}

/** Parametri dei modelli. */
export interface ModelloDiodo {
  /** Corrente di saturazione (A). */
  is: number;
  /** Coefficiente di emissione. */
  n: number;
  /** Tensione di breakdown inversa (zener), se c'è (V, positiva). */
  bv?: number;
  /** Resistenza serie (Ω). */
  rs?: number;
}

export type Elemento =
  | { tipo: "R"; id: string; a: string; b: string; ohm: number }
  | { tipo: "C"; id: string; a: string; b: string; farad: number }
  | { tipo: "L"; id: string; a: string; b: string; henry: number }
  /** Generatore di tensione: +p, −n. */
  | { tipo: "V"; id: string; p: string; n: string; onda: Onda }
  /** Generatore di corrente che spinge la corrente da n a p attraverso il generatore (esce da p). */
  | { tipo: "I"; id: string; p: string; n: string; onda: Onda }
  | { tipo: "D"; id: string; a: string; k: string; modello: ModelloDiodo }
  | { tipo: "Q"; id: string; c: string; b: string; e: string; pnp: boolean; beta: number; is?: number }
  | { tipo: "M"; id: string; d: string; g: string; s: string; canaleP: boolean; vth: number; k: number }
  /** Operazionale ideale con uscita limitata fra le alimentazioni ±vsat. */
  | { tipo: "OP"; id: string; piu: string; meno: string; uscita: string; vsat: number; guadagno?: number }
  /** Regolatore di tensione a tre terminali (ingresso, massa, uscita). */
  | { tipo: "REG"; id: string; ingresso: string; massa: string; uscita: string; vnom: number };

/** Modelli tipici pronti. */
export const DIODO_SILICIO: ModelloDiodo = { is: 1e-14, n: 1, rs: 0.1 };
export const LED_ROSSO: ModelloDiodo = { is: 1e-19, n: 1.6, rs: 5 };
export const LED_VERDE: ModelloDiodo = { is: 1e-21, n: 1.7, rs: 5 };
export const zener = (bv: number): ModelloDiodo => ({ is: 1e-14, n: 1, rs: 0.5, bv });

export interface Soluzione {
  /** Tensione di ogni nodo rispetto a massa (V). */
  tensioni: Record<string, number>;
  /** Corrente di ogni elemento a due terminali (dal primo al secondo terminale, A); generatori: corrente erogata. */
  correnti: Record<string, number>;
  /** Correnti dei transistor (collettore/base/emettitore o drain/gate/source, entranti). */
  terminali: Record<string, Record<string, number>>;
  /** La soluzione è stata trovata (Newton ha converso). */
  converge: boolean;
}

/** Stato dei componenti con memoria (per il transitorio). */
interface Memoria {
  /** Tensione ai capi dei condensatori all'istante precedente. */
  vc: Record<string, number>;
  /** Corrente negli induttori all'istante precedente. */
  il: Record<string, number>;
}

const GMIN = 1e-12;
const ITERAZIONI = 150;
const TOLLERANZA_V = 1e-6;

// ---------------------------------------------------------------- dispositivi non lineari

/** Corrente del diodo (da anodo a catodo) con la tensione vd ai capi (esclusa Rs). */
function correnteDiodo(m: ModelloDiodo, vd: number): number {
  const nvt = m.n * VT;
  // Esponenziale "linearizzato" oltre la tensione a cui la corrente arriverebbe a 10 kA,
  // per non andare all'infinito durante le iterazioni.
  const lim = nvt * Math.log(1e4 / m.is);
  const esp = (x: number) => (x > lim ? Math.exp(lim / nvt) * (1 + (x - lim) / nvt) : Math.exp(x / nvt));
  let i = m.is * (esp(vd) - 1);
  // Breakdown inverso (zener): una seconda giunzione "al contrario" spostata di bv.
  if (m.bv !== undefined) i -= 1e-6 * esp(-vd - m.bv);
  return i;
}

/**
 * Corrente del diodo con la resistenza serie Rs: si cerca la tensione della
 * giunzione vj tale che vj + Rs·i(vj) = v (funzione crescente → bisezione).
 */
function correnteDiodoConRs(m: ModelloDiodo, v: number): number {
  const rs = m.rs ?? 0;
  if (rs <= 0) return correnteDiodo(m, v);
  let basso = Math.min(v, -(m.bv ?? 1000) - 50);
  let alto = Math.max(v, 2);
  // Restringe subito l'intervallo: la giunzione non supera mai v (diretta) né scende sotto v (inversa).
  if (v >= 0) basso = Math.min(0, v);
  else alto = 0;
  for (let k = 0; k < 80; k++) {
    const vj = (basso + alto) / 2;
    if (vj + rs * correnteDiodo(m, vj) > v) alto = vj;
    else basso = vj;
  }
  return (v - (basso + alto) / 2) / rs;
}

/**
 * Correnti che entrano in ogni terminale di un dispositivo non lineare,
 * date le tensioni dei suoi terminali.
 */
function correntiNonLineari(e: Elemento, v: number[]): number[] {
  switch (e.tipo) {
    case "D": {
      const i = correnteDiodoConRs(e.modello, v[0] - v[1]);
      return [i, -i];
    }
    case "Q": {
      // Ebers-Moll (modello di trasporto): terminali c, b, e.
      const s = e.pnp ? -1 : 1;
      const is = e.is ?? 1e-14;
      const br = 1;
      const vbe = s * (v[1] - v[2]);
      const vbc = s * (v[1] - v[0]);
      const m: ModelloDiodo = { is, n: 1 };
      const ibe = correnteDiodo(m, vbe);
      const ibc = correnteDiodo(m, vbc);
      const ic = ibe - ibc - ibc / br;
      const ib = ibe / e.beta + ibc / br;
      return [s * ic, s * ib, -s * (ic + ib)];
    }
    case "M": {
      // Modello quadratico: terminali d, g, s.
      const s = e.canaleP ? -1 : 1;
      let vds = s * (v[0] - v[2]);
      let vgs = s * (v[1] - v[2]);
      let inverso = 1;
      if (vds < 0) {
        // drain e source si scambiano
        vgs = s * (v[1] - v[0]);
        vds = -vds;
        inverso = -1;
      }
      const vov = vgs - e.vth;
      let id = 0;
      if (vov > 0) id = vds < vov ? e.k * (vov * vds - (vds * vds) / 2) : (e.k / 2) * vov * vov * (1 + 0.01 * (vds - vov));
      const i = s * inverso * id;
      return [i, 0, -i];
    }
    case "OP": {
      // Uscita = Vsat·tanh(A·(v+ − v−)/Vsat): lineare per piccoli segnali, poi satura.
      // Modellata come generatore di corrente Norton con resistenza d'uscita di 1 Ω.
      const a = e.guadagno ?? 1e5;
      const vout = e.vsat * Math.tanh((a * (v[0] - v[1])) / e.vsat);
      // Corrente che entra nell'operazionale dall'uscita (negativa quando eroga).
      const iOut = (v[2] - vout) / 1;
      return [0, 0, iOut];
    }
    case "REG": {
      // Regolatore lineare (tipo 78xx): l'uscita insegue vnom sopra la massa, ma
      // non può superare l'ingresso meno la caduta minima (2 V). La corrente
      // erogata viene presa dall'ingresso.
      const [vin, vg, vo] = v;
      const obiettivo = vg + Math.min(e.vnom, Math.max(0, vin - vg - 2));
      const iu = (vo - obiettivo) / 0.05;
      const erogata = Math.max(0, -iu);
      return [erogata, -(erogata + iu), iu];
    }
    default:
      return [];
  }
}

function terminaliDi(e: Elemento): string[] {
  switch (e.tipo) {
    case "D":
      return [e.a, e.k];
    case "Q":
      return [e.c, e.b, e.e];
    case "M":
      return [e.d, e.g, e.s];
    case "OP":
      return [e.piu, e.meno, e.uscita];
    case "REG":
      return [e.ingresso, e.massa, e.uscita];
    default:
      return [];
  }
}

function nodiElemento(e: Elemento): string[] {
  switch (e.tipo) {
    case "R":
    case "C":
    case "L":
      return [e.a, e.b];
    case "V":
    case "I":
      return [e.p, e.n];
    default:
      return terminaliDi(e);
  }
}

// ---------------------------------------------------------------- sistema lineare

function gauss(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-30) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      if (f === 0) continue;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / M[r][r];
  }
  return x;
}

interface Opzioni {
  /** Istante (s) per i generatori variabili. */
  t: number;
  /** Passo del transitorio (s); assente = analisi DC. */
  dt?: number;
  memoria?: Memoria;
  /** Fattore di scala dei generatori (per partire "piano" se Newton non converge). */
  scala?: number;
  /** Tensioni iniziali per Newton. */
  iniziali?: Record<string, number>;
}

/** Risolve il circuito nell'istante indicato (DC se manca `dt`). */
function risolvi(elementi: readonly Elemento[], o: Opzioni): Soluzione & { vettore: Record<string, number> } {
  const nodi = [...new Set(elementi.flatMap(nodiElemento))].filter((n) => n !== MASSA);
  const indice = new Map(nodi.map((n, i) => [n, i]));
  // Correnti incognite: generatori di tensione e (in DC) induttori.
  const conCorrente = elementi.filter((e) => e.tipo === "V" || (e.tipo === "L" && o.dt === undefined));
  const nV = nodi.length;
  const N = nV + conCorrente.length;
  const scala = o.scala ?? 1;
  let v = nodi.map((n) => o.iniziali?.[n] ?? 0);
  const tens = (x: number[], n: string) => (n === MASSA ? 0 : x[indice.get(n)!]);
  let converge = false;
  let x: number[] = new Array<number>(N).fill(0);
  const nonLineari = new Set(elementi.flatMap((e) => terminaliDi(e).map((n) => indice.get(n)).filter((k): k is number => k !== undefined)));

  for (let it = 0; it < ITERAZIONI; it++) {
    const A = Array.from({ length: N }, () => new Array<number>(N).fill(0));
    const b = new Array<number>(N).fill(0);
    const G = (a: string, c: string, g: number) => {
      const ia = indice.get(a);
      const ic = indice.get(c);
      if (ia !== undefined) A[ia][ia] += g;
      if (ic !== undefined) A[ic][ic] += g;
      if (ia !== undefined && ic !== undefined) {
        A[ia][ic] -= g;
        A[ic][ia] -= g;
      }
    };
    const I = (n: string, i: number) => {
      const k = indice.get(n);
      if (k !== undefined) b[k] += i;
    };
    for (let k = 0; k < nV; k++) A[k][k] += GMIN;
    let riga = nV;
    for (const e of elementi) {
      switch (e.tipo) {
        case "R":
          G(e.a, e.b, 1 / Math.max(e.ohm, 1e-6));
          break;
        case "C":
          if (o.dt !== undefined) {
            // Eulero all'indietro: i = C/dt · (v − v_prec)
            const g = e.farad / o.dt;
            G(e.a, e.b, g);
            const vp = o.memoria?.vc[e.id] ?? 0;
            I(e.a, g * vp);
            I(e.b, -g * vp);
          }
          break;
        case "L":
          if (o.dt !== undefined) {
            // i = i_prec + dt/L · v
            const g = o.dt / e.henry;
            G(e.a, e.b, g);
            const ip = o.memoria?.il[e.id] ?? 0;
            I(e.a, -ip);
            I(e.b, ip);
          }
          break;
        case "I": {
          const i = scala * valoreOnda(e.onda, o.t);
          I(e.p, i);
          I(e.n, -i);
          break;
        }
        default:
          break;
      }
    }
    // Generatori di tensione (e induttori in DC come generatori da 0 V).
    for (const e of conCorrente) {
      const [p, n] = e.tipo === "V" ? [e.p, e.n] : [(e as { a: string }).a, (e as { b: string }).b];
      const ip = indice.get(p);
      const iN = indice.get(n);
      if (ip !== undefined) {
        A[ip][riga] += 1;
        A[riga][ip] += 1;
      }
      if (iN !== undefined) {
        A[iN][riga] -= 1;
        A[riga][iN] -= 1;
      }
      b[riga] = e.tipo === "V" ? scala * valoreOnda(e.onda, o.t) : 0;
      riga++;
    }
    // Non lineari: linearizzazione attorno a v (derivate numeriche).
    for (const e of elementi) {
      const term = terminaliDi(e);
      if (term.length === 0) continue;
      const vt = term.map((n) => tens(v, n));
      const i0 = correntiNonLineari(e, vt);
      const h = 1e-7;
      // Jacobiano J[k][j] = ∂i_k/∂v_j (una valutazione per terminale).
      const J = term.map(() => new Array<number>(term.length).fill(0));
      for (let j = 0; j < term.length; j++) {
        const vj = [...vt];
        vj[j] += h;
        const i1 = correntiNonLineari(e, vj);
        for (let k = 0; k < term.length; k++) J[k][j] = (i1[k] - i0[k]) / h;
      }
      // i(v') ≈ i0 + J·(v' − v)  →  nella riga KCL: J·v' a sinistra, J·v − i0 a destra.
      for (let k = 0; k < term.length; k++) {
        const rk = indice.get(term[k]);
        if (rk === undefined) continue;
        let jv = 0;
        for (let j = 0; j < term.length; j++) {
          jv += J[k][j] * vt[j];
          const cj = indice.get(term[j]);
          if (cj !== undefined) A[rk][cj] += J[k][j];
        }
        b[rk] += jv - i0[k];
      }
    }
    const sol = gauss(A, b);
    if (!sol) break;
    x = sol;
    // Limitazione del passo: al massimo 0,5 V per iterazione sui nodi dei dispositivi
    // non lineari (evita che gli esponenziali esplodano); gli altri nodi vanno subito al valore.
    let massimo = 0;
    const nuovo = v.map((vi, k) => {
      const d = nonLineari.has(k) ? Math.max(-0.5, Math.min(0.5, x[k] - vi)) : x[k] - vi;
      massimo = Math.max(massimo, Math.abs(x[k] - vi));
      return vi + d;
    });
    v = nuovo;
    if (massimo < TOLLERANZA_V) {
      converge = true;
      break;
    }
  }

  const tensioni: Record<string, number> = { [MASSA]: 0 };
  nodi.forEach((n, i) => (tensioni[n] = v[i]));
  const correnti: Record<string, number> = {};
  const terminali: Record<string, Record<string, number>> = {};
  conCorrente.forEach((e, k) => {
    // La corrente MNA scorre da p a n dentro il generatore: quella erogata è l'opposta.
    correnti[e.id] = e.tipo === "V" ? -x[nV + k] : x[nV + k];
  });
  for (const e of elementi) {
    if (e.tipo === "R") correnti[e.id] = (tensioni[e.a] - tensioni[e.b]) / Math.max(e.ohm, 1e-6);
    if (e.tipo === "C") correnti[e.id] = o.dt !== undefined ? (e.farad / o.dt) * (tensioni[e.a] - tensioni[e.b] - (o.memoria?.vc[e.id] ?? 0)) : 0;
    if (e.tipo === "L" && o.dt !== undefined) correnti[e.id] = (o.memoria?.il[e.id] ?? 0) + (o.dt / e.henry) * (tensioni[e.a] - tensioni[e.b]);
    if (e.tipo === "I") correnti[e.id] = scala * valoreOnda(e.onda, o.t);
    const term = terminaliDi(e);
    if (term.length) {
      const i = correntiNonLineari(e, term.map((n) => tensioni[n]));
      if (e.tipo === "D") correnti[e.id] = i[0];
      const nomi = e.tipo === "Q" ? ["c", "b", "e"] : e.tipo === "M" ? ["d", "g", "s"] : e.tipo === "OP" ? ["piu", "meno", "uscita"] : e.tipo === "REG" ? ["ingresso", "massa", "uscita"] : ["a", "k"];
      terminali[e.id] = Object.fromEntries(nomi.map((nome, j) => [nome, i[j]]));
    }
  }
  return { tensioni, correnti, terminali, converge, vettore: tensioni };
}

/**
 * Punto di lavoro in continua. Se Newton non converge subito si alzano i
 * generatori a poco a poco (da 10 % a 100 %), partendo ogni volta dalla
 * soluzione precedente: così anche i circuiti con molti transistor partono.
 */
export function analisiDC(elementi: readonly Elemento[]): Soluzione {
  let s = risolvi(elementi, { t: 0 });
  if (s.converge) return s;
  let iniziali: Record<string, number> | undefined;
  for (let k = 1; k <= 10; k++) {
    s = risolvi(elementi, { t: 0, scala: k / 10, iniziali });
    iniziali = s.vettore;
  }
  return s;
}

/** Un campione dell'analisi nel tempo. */
export interface Campione {
  t: number;
  tensioni: Record<string, number>;
  correnti: Record<string, number>;
}

/**
 * Analisi nel tempo (transitorio) da 0 a `durata` secondi con passo `passo`.
 * Si parte dal punto di lavoro con i condensatori scarichi (come quando si
 * accende il circuito); `registra` sceglie quali nodi e correnti tenere.
 */
export function analisiTransitorio(
  elementi: readonly Elemento[],
  durata: number,
  passo: number,
  registra?: { nodi?: string[]; correnti?: string[] },
): Campione[] {
  const stato = nuovoStatoTransitorio();
  const campioni: Campione[] = [];
  const passi = Math.max(1, Math.round(durata / passo));
  for (let k = 0; k <= passi; k++) {
    const t = k * passo;
    const s = passoTransitorio(elementi, t, passo, stato);
    const filtra = <T>(r: Record<string, T>, chiavi?: string[]) => (chiavi ? Object.fromEntries(chiavi.map((c) => [c, r[c]])) : r);
    campioni.push({ t, tensioni: filtra(s.tensioni, registra?.nodi), correnti: filtra(s.correnti, registra?.correnti) });
  }
  return campioni;
}

/** Memoria del transitorio fra un passo e l'altro (cariche, correnti, ultima soluzione). */
export interface StatoTransitorio {
  memoria: Memoria;
  iniziali?: Record<string, number>;
}

export function nuovoStatoTransitorio(): StatoTransitorio {
  return { memoria: { vc: {}, il: {} } };
}

/** Calcola il circuito all'istante t (passo dt) e aggiorna la memoria di condensatori e induttori. */
export function passoTransitorio(elementi: readonly Elemento[], t: number, dt: number, stato: StatoTransitorio): Soluzione {
  const s = risolvi(elementi, { t, dt, memoria: stato.memoria, iniziali: stato.iniziali });
  stato.iniziali = s.vettore;
  for (const e of elementi) {
    if (e.tipo === "C") stato.memoria.vc[e.id] = s.tensioni[e.a] - s.tensioni[e.b];
    if (e.tipo === "L") stato.memoria.il[e.id] = s.correnti[e.id];
  }
  return s;
}

// ---------------------------------------------------------------- analisi in frequenza (AC)

/** Numero complesso [parte reale, parte immaginaria]. */
type Complesso = [number, number];

function gaussComplesso(A: Complesso[][], b: Complesso[]): Complesso[] | null {
  const n = b.length;
  const M = A.map((r, i) => [...r.map((c) => [...c] as Complesso), [...b[i]] as Complesso]);
  const mod = (c: Complesso) => Math.hypot(c[0], c[1]);
  const div = (a: Complesso, d: Complesso): Complesso => {
    const q = d[0] * d[0] + d[1] * d[1];
    return [(a[0] * d[0] + a[1] * d[1]) / q, (a[1] * d[0] - a[0] * d[1]) / q];
  };
  const mul = (a: Complesso, c: Complesso): Complesso => [a[0] * c[0] - a[1] * c[1], a[0] * c[1] + a[1] * c[0]];
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (mod(M[r][c]) > mod(M[p][c])) p = r;
    if (mod(M[p][c]) < 1e-30) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = div(M[r][c], M[c][c]);
      if (f[0] === 0 && f[1] === 0) continue;
      for (let k = c; k <= n; k++) {
        const m = mul(f, M[c][k]);
        M[r][k] = [M[r][k][0] - m[0], M[r][k][1] - m[1]];
      }
    }
  }
  const x: Complesso[] = Array.from({ length: n }, () => [0, 0]);
  for (let r = n - 1; r >= 0; r--) {
    let s: Complesso = [...M[r][n]] as Complesso;
    for (let k = r + 1; k < n; k++) {
      const m = mul(M[r][k], x[k]);
      s = [s[0] - m[0], s[1] - m[1]];
    }
    x[r] = div(s, M[r][r]);
  }
  return x;
}

/** Risposta di un nodo a una frequenza. */
export interface PuntoAC {
  frequenza: number;
  /** Ampiezza della tensione del nodo rispetto al segnale d'ingresso (1 V). */
  modulo: Record<string, number>;
  /** Guadagno in decibel: 20·log10(modulo). */
  db: Record<string, number>;
  /** Fase in gradi. */
  fase: Record<string, number>;
}

/** Frequenze distribuite in modo logaritmico (come sull'asse di un diagramma di Bode). */
export function frequenzeLogaritmiche(da: number, a: number, perDecade = 20): number[] {
  const decadi = Math.log10(a / da);
  const n = Math.max(1, Math.round(decadi * perDecade));
  return Array.from({ length: n + 1 }, (_, k) => da * 10 ** ((decadi * k) / n));
}

/**
 * Analisi in frequenza per piccoli segnali: il generatore `ingresso` diventa
 * un segnale sinusoidale di 1 V (o 1 A), gli altri generatori si spengono
 * (tensione → corto, corrente → aperto). I dispositivi non lineari sono
 * sostituiti dalla loro linearizzazione nel punto di lavoro DC.
 */
export function analisiAC(elementi: readonly Elemento[], ingresso: string, frequenze: readonly number[]): PuntoAC[] {
  const dc = analisiDC(elementi);
  const nodi = [...new Set(elementi.flatMap(nodiElemento))].filter((n) => n !== MASSA);
  const indice = new Map(nodi.map((n, i) => [n, i]));
  const generatori = elementi.filter((e) => e.tipo === "V");
  const nV = nodi.length;
  const N = nV + generatori.length;
  // Jacobiani dei dispositivi non lineari nel punto di lavoro.
  const jacobiani = elementi
    .filter((e) => terminaliDi(e).length > 0)
    .map((e) => {
      const term = terminaliDi(e);
      const vt = term.map((n) => dc.tensioni[n]);
      const i0 = correntiNonLineari(e, vt);
      const J = term.map(() => new Array<number>(term.length).fill(0));
      for (let j = 0; j < term.length; j++) {
        const vj = [...vt];
        vj[j] += 1e-7;
        const i1 = correntiNonLineari(e, vj);
        for (let k = 0; k < term.length; k++) J[k][j] = (i1[k] - i0[k]) / 1e-7;
      }
      return { term, J };
    });

  return frequenze.map((f) => {
    const w = 2 * Math.PI * f;
    const A: Complesso[][] = Array.from({ length: N }, () => Array.from({ length: N }, () => [0, 0] as Complesso));
    const b: Complesso[] = Array.from({ length: N }, () => [0, 0] as Complesso);
    const Y = (a: string, c: string, y: Complesso) => {
      const ia = indice.get(a);
      const ic = indice.get(c);
      const add = (r: number, k: number, s: number) => {
        A[r][k] = [A[r][k][0] + s * y[0], A[r][k][1] + s * y[1]];
      };
      if (ia !== undefined) add(ia, ia, 1);
      if (ic !== undefined) add(ic, ic, 1);
      if (ia !== undefined && ic !== undefined) {
        add(ia, ic, -1);
        add(ic, ia, -1);
      }
    };
    for (let k = 0; k < nV; k++) A[k][k][0] += GMIN;
    for (const e of elementi) {
      if (e.tipo === "R") Y(e.a, e.b, [1 / Math.max(e.ohm, 1e-6), 0]);
      if (e.tipo === "C") Y(e.a, e.b, [0, w * e.farad]);
      if (e.tipo === "L") Y(e.a, e.b, [1e-9, -1 / Math.max(w * e.henry, 1e-12)]);
      if (e.tipo === "I" && e.id === ingresso) {
        const ip = indice.get(e.p);
        const iN = indice.get(e.n);
        if (ip !== undefined) b[ip][0] += 1;
        if (iN !== undefined) b[iN][0] -= 1;
      }
    }
    for (const { term, J } of jacobiani)
      for (let k = 0; k < term.length; k++)
        for (let j = 0; j < term.length; j++) {
          const rk = indice.get(term[k]);
          const cj = indice.get(term[j]);
          if (rk !== undefined && cj !== undefined) A[rk][cj][0] += J[k][j];
        }
    generatori.forEach((e, k) => {
      if (e.tipo !== "V") return;
      const riga = nV + k;
      const ip = indice.get(e.p);
      const iN = indice.get(e.n);
      if (ip !== undefined) {
        A[ip][riga][0] += 1;
        A[riga][ip][0] += 1;
      }
      if (iN !== undefined) {
        A[iN][riga][0] -= 1;
        A[riga][iN][0] -= 1;
      }
      b[riga] = [e.id === ingresso ? 1 : 0, 0];
    });
    const x = gaussComplesso(A, b) ?? Array.from({ length: N }, () => [0, 0] as Complesso);
    const modulo: Record<string, number> = { [MASSA]: 0 };
    const db: Record<string, number> = { [MASSA]: -Infinity };
    const fase: Record<string, number> = { [MASSA]: 0 };
    nodi.forEach((n, i) => {
      const [re, im] = x[i];
      modulo[n] = Math.hypot(re, im);
      db[n] = 20 * Math.log10(Math.max(modulo[n], 1e-15));
      fase[n] = (Math.atan2(im, re) * 180) / Math.PI;
    });
    return { frequenza: f, modulo, db, fase };
  });
}
