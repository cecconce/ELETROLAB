// Traccia dell'oscilloscopio del modulo Arduino (pura: nessuna interfaccia).
//
// Dai campioni registrati dalla sessione (tempo, tensione) si ricava la
// spezzata da disegnare sullo schermo: 10 divisioni in orizzontale (le più
// recenti a destra, come uno schermo che scorre) e 8 in verticale, con lo
// zero al centro. Fra due campioni la tensione resta quella del primo, quindi
// la traccia è a gradini (i fronti delle onde quadre sono verticali).

/** Divisioni dello schermo. */
export const DIVISIONI_X = 10;
export const DIVISIONI_Y = 8;

/** Tempi per divisione proposti (s) e tensioni per divisione (V). */
export const TEMPI_DIVISIONE = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1];
export const VOLT_DIVISIONE = [0.5, 1, 2, 5];
export const TEMPO_DIVISIONE_PREDEFINITO = 0.2;
export const VOLT_DIVISIONE_PREDEFINITO = 2;

/**
 * Punti [x, y, x, y, …] della traccia in coordinate dello schermo (larghezza ×
 * altezza, origine in alto a sinistra); le tensioni fuori schermo si tagliano
 * al bordo.
 */
export function tracciaOscilloscopio(
  campioni: readonly { t: number; v: number }[],
  oraUs: number,
  tempoDivisione: number,
  voltDivisione: number,
  larghezza: number,
  altezza: number,
): number[] {
  if (campioni.length === 0) return [];
  const finestra = tempoDivisione * DIVISIONI_X * 1e6;
  const inizio = oraUs - finestra;
  const x = (t: number) => Math.min(larghezza, Math.max(0, ((t - inizio) / finestra) * larghezza));
  const y = (v: number) => Math.min(altezza, Math.max(0, altezza / 2 - (v / voltDivisione) * (altezza / DIVISIONI_Y)));
  // Il valore all'inizio della finestra è quello dell'ultimo campione precedente.
  let k = campioni.findIndex((c) => c.t > inizio);
  if (k === -1) k = campioni.length;
  if (k === 0 && campioni[0].t > inizio) {
    // Prima del primo campione non c'è traccia: si parte dal primo.
    const punti = [x(campioni[0].t), y(campioni[0].v)];
    return aggiungiGradini(punti, campioni, 1, x, y, larghezza);
  }
  const punti = [0, y(campioni[k - 1].v)];
  return aggiungiGradini(punti, campioni, k, x, y, larghezza);
}

function aggiungiGradini(punti: number[], campioni: readonly { t: number; v: number }[], da: number, x: (t: number) => number, y: (v: number) => number, larghezza: number): number[] {
  for (let i = da; i < campioni.length; i++) {
    const xi = x(campioni[i].t);
    punti.push(xi, punti[punti.length - 1], xi, y(campioni[i].v));
  }
  punti.push(larghezza, punti[punti.length - 1]);
  return punti;
}

/** Testo di una scala: «200 ms», «1 s», «2 V», «0,5 V». */
export function testoScala(valore: number, unita: "s" | "V"): string {
  if (unita === "s" && valore < 1) return `${Math.round(valore * 1000)} ms`;
  return `${String(valore).replace(".", ",")} ${unita}`;
}
