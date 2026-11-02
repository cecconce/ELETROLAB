// Componenti digitali del modulo Elettronica (logica pura).
//
// Simulazione "mista": i componenti digitali leggono la tensione dei loro
// ingressi (1 se supera la soglia, con una piccola isteresi) e comandano le
// uscite come generatori da 0 V o 5 V con una resistenza interna. La logica
// si ricalcola dopo ogni passo dell'analisi nel tempo: le uscite cambiano al
// passo successivo (è il ritardo di propagazione della porta).

/** Tensione di alimentazione della logica (V). */
export const VCC_LOGICA = 5;
/** Sopra questa tensione un ingresso a 0 diventa 1 (V). */
export const SOGLIA_ALTA = 2.7;
/** Sotto questa tensione un ingresso a 1 diventa 0 (V). */
export const SOGLIA_BASSA = 2.3;
/** Resistenza interna delle uscite logiche (Ω). */
export const R_USCITA = 50;
/** Resistenza d'ingresso verso massa (Ω): un ingresso scollegato vale 0. */
export const R_INGRESSO = 1e6;

export type Bit = 0 | 1;

/** Ingressi e uscite (in ordine) dei componenti digitali. */
export const PIEDINI_DIGITALI: Record<string, { ingressi: string[]; uscite: string[] }> = {
  "porta-and": { ingressi: ["A", "B"], uscite: ["Y"] },
  "porta-or": { ingressi: ["A", "B"], uscite: ["Y"] },
  "porta-not": { ingressi: ["A"], uscite: ["Y"] },
  "porta-nand": { ingressi: ["A", "B"], uscite: ["Y"] },
  "porta-nor": { ingressi: ["A", "B"], uscite: ["Y"] },
  "porta-xor": { ingressi: ["A", "B"], uscite: ["Y"] },
  "flip-flop-d": { ingressi: ["D", "CLK"], uscite: ["Q", "QN"] },
  "flip-flop-jk": { ingressi: ["J", "CLK", "K"], uscite: ["Q", "QN"] },
  contatore: { ingressi: ["CLK", "R"], uscite: ["Q0", "Q1", "Q2", "Q3"] },
  decodificatore: { ingressi: ["A", "B", "C", "D"], uscite: ["a", "b", "c", "d", "e", "f", "g"] },
  "interruttore-logico": { ingressi: [], uscite: ["out"] },
  "generatore-clock": { ingressi: [], uscite: ["out"] },
  "sonda-logica": { ingressi: ["in"], uscite: [] },
  "display-7-segmenti": { ingressi: ["a", "b", "c", "d", "e", "f", "g"], uscite: [] },
  "analizzatore-logico": { ingressi: ["D0", "D1", "D2", "D3"], uscite: [] },
};

export const eDigitale = (tipo: string) => tipo in PIEDINI_DIGITALI;

/** Stato interno di un componente digitale. */
export interface StatoDigitale {
  /** Livello logico letto su ogni ingresso (con isteresi). */
  ingressi: Record<string, Bit>;
  /** Livello di ogni uscita. */
  uscite: Record<string, Bit>;
  /** Flip-flop: uscita Q memorizzata; contatore: conteggio. */
  memoria: number;
}

export function nuovoStatoDigitale(tipo: string): StatoDigitale {
  const p = PIEDINI_DIGITALI[tipo] ?? { ingressi: [], uscite: [] };
  const s: StatoDigitale = { ingressi: Object.fromEntries(p.ingressi.map((i) => [i, 0 as Bit])), uscite: {}, memoria: 0 };
  s.uscite = calcolaUscite(tipo, s, false);
  return s;
}

/** Livello logico di una tensione, con isteresi rispetto al livello precedente. */
export function livello(v: number, prima: Bit): Bit {
  if (prima === 0) return v > SOGLIA_ALTA ? 1 : 0;
  return v < SOGLIA_BASSA ? 0 : 1;
}

/** Segmenti a…g accesi per ogni cifra (0–9) e lettera (A–F) del decodificatore. */
export const SEGMENTI: Record<number, string> = {
  0: "abcdef",
  1: "bc",
  2: "abdeg",
  3: "abcdg",
  4: "bcfg",
  5: "acdfg",
  6: "acdefg",
  7: "abc",
  8: "abcdefg",
  9: "abcdfg",
  10: "abcefg",
  11: "cdefg",
  12: "adef",
  13: "bcdeg",
  14: "adefg",
  15: "aefg",
};

const b = (x: boolean): Bit => (x ? 1 : 0);

/** Uscite di un componente dallo stato (ingressi già letti, memoria aggiornata). */
function calcolaUscite(tipo: string, s: StatoDigitale, livelloEsterno: boolean): Record<string, Bit> {
  const i = s.ingressi;
  switch (tipo) {
    case "porta-and":
      return { Y: b(i.A === 1 && i.B === 1) };
    case "porta-or":
      return { Y: b(i.A === 1 || i.B === 1) };
    case "porta-not":
      return { Y: b(i.A === 0) };
    case "porta-nand":
      return { Y: b(!(i.A === 1 && i.B === 1)) };
    case "porta-nor":
      return { Y: b(!(i.A === 1 || i.B === 1)) };
    case "porta-xor":
      return { Y: b(i.A !== i.B) };
    case "flip-flop-d":
    case "flip-flop-jk":
      return { Q: b(s.memoria === 1), QN: b(s.memoria !== 1) };
    case "contatore":
      return { Q0: b((s.memoria & 1) !== 0), Q1: b((s.memoria & 2) !== 0), Q2: b((s.memoria & 4) !== 0), Q3: b((s.memoria & 8) !== 0) };
    case "decodificatore": {
      const n = i.A + 2 * i.B + 4 * i.C + 8 * i.D;
      const accesi = SEGMENTI[n] ?? "";
      return Object.fromEntries("abcdefg".split("").map((seg) => [seg, b(accesi.includes(seg))]));
    }
    case "interruttore-logico":
    case "generatore-clock":
      return { out: b(livelloEsterno) };
    default:
      return {};
  }
}

/**
 * Aggiorna un componente digitale con le nuove tensioni degli ingressi.
 * `esterno` è il livello scelto dallo studente (interruttore logico) o dato
 * dall'orologio (generatore di clock). Restituisce true se cambia un ingresso o un'uscita
 * (qualcosa da ridisegnare).
 */
export function aggiornaDigitale(tipo: string, s: StatoDigitale, tensioni: Record<string, number>, esterno = false): boolean {
  const prima = s.ingressi;
  const nuovi: Record<string, Bit> = {};
  for (const nome of PIEDINI_DIGITALI[tipo]?.ingressi ?? []) nuovi[nome] = livello(tensioni[nome] ?? 0, prima[nome] ?? 0);
  const salita = (nome: string) => prima[nome] === 0 && nuovi[nome] === 1;
  // Memoria: i flip-flop e il contatore cambiano sul fronte di salita del clock.
  if (tipo === "flip-flop-d" && salita("CLK")) s.memoria = nuovi.D;
  if (tipo === "flip-flop-jk" && salita("CLK")) {
    const { J, K } = nuovi;
    if (J === 1 && K === 1) s.memoria = s.memoria === 1 ? 0 : 1;
    else if (J === 1) s.memoria = 1;
    else if (K === 1) s.memoria = 0;
  }
  if (tipo === "contatore") {
    if (nuovi.R === 1) s.memoria = 0;
    else if (salita("CLK")) s.memoria = (s.memoria + 1) % 16;
  }
  const ingressiCambiati = Object.keys(nuovi).some((k) => nuovi[k] !== prima[k]);
  s.ingressi = nuovi;
  const uscite = calcolaUscite(tipo, s, esterno);
  const cambiate = Object.keys(uscite).some((k) => uscite[k] !== s.uscite[k]);
  s.uscite = uscite;
  return cambiate || ingressiCambiati;
}
