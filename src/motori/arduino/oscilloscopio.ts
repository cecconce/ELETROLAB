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
 * Un campione della registrazione. Con `pwm` il puntale misura direttamente un
 * pin in PWM (analogWrite): in quel tratto il segnale è un'onda quadra fra
 * `basso` e `alto` volt, con periodo `periodoUs` e alta per la frazione
 * `duty` di ogni periodo (`v` resta la tensione media, usata dal resto del
 * circuito).
 */
export interface CampioneOscilloscopio {
  t: number;
  v: number;
  pwm?: { duty: number; alto: number; basso: number; periodoUs: number };
}

/** Periodo del PWM della Uno: 490 Hz, ma 980 Hz sui pin 5 e 6 (timer 0). */
export function periodoPwmUs(pin: string): number {
  return pin === "D5" || pin === "D6" ? 1024 : 2040;
}

/**
 * Punti [x, y, x, y, …] della traccia in coordinate dello schermo (larghezza ×
 * altezza, origine in alto a sinistra); le tensioni fuori schermo si tagliano
 * al bordo. I tratti in PWM si disegnano come onda quadra; se i periodi sono
 * troppi per la larghezza dello schermo la traccia diventa una banda piena
 * fra basso e alto, come su un oscilloscopio vero con la base dei tempi lenta.
 */
export function tracciaOscilloscopio(
  campioni: readonly CampioneOscilloscopio[],
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
  // Il valore all'inizio della finestra è quello dell'ultimo campione precedente;
  // prima del primo campione non c'è traccia.
  let k = campioni.findIndex((c) => c.t > inizio);
  if (k === -1) k = campioni.length;
  const primo = k > 0 ? k - 1 : 0;
  const punti: number[] = [];
  const vai = (px: number, py: number) => {
    const n = punti.length;
    if (n >= 2 && punti[n - 2] === px && punti[n - 1] === py) return;
    // Fronte verticale: dal livello precedente al nuovo nello stesso x.
    if (n >= 2 && punti[n - 1] !== py) punti.push(px, punti[n - 1]);
    punti.push(px, py);
  };
  for (let i = primo; i < campioni.length; i++) {
    const c = campioni[i];
    const t0 = Math.max(inizio, c.t);
    const t1 = Math.min(oraUs, i + 1 < campioni.length ? campioni[i + 1].t : oraUs);
    if (t1 < t0) continue;
    if (!c.pwm || c.pwm.duty <= 0 || c.pwm.duty >= 1) {
      vai(x(t0), y(c.v));
      vai(x(t1), y(c.v));
      continue;
    }
    const { duty, alto, basso, periodoUs } = c.pwm;
    const periodi = (t1 - t0) / periodoUs;
    if (periodi > larghezza) {
      // Troppi periodi: banda piena (zig-zag ogni mezza unità di schermo).
      for (let px = x(t0); px <= x(t1); px += 0.5) {
        punti.push(px, y(alto), px, y(basso));
      }
      continue;
    }
    // Onda quadra: alta nella prima parte di ogni periodo (fase fissa nel tempo,
    // così la traccia non "balla" mentre scorre).
    let t = t0;
    while (t < t1) {
      const fase = ((t % periodoUs) + periodoUs) % periodoUs;
      const altoOra = fase < duty * periodoUs;
      const fine = Math.min(t1, t - fase + (altoOra ? duty * periodoUs : periodoUs));
      vai(x(t), y(altoOra ? alto : basso));
      vai(x(fine), y(altoOra ? alto : basso));
      t = fine;
    }
  }
  vai(larghezza, punti.length ? punti[punti.length - 1] : y(0));
  return punti;
}

/** Testo di una scala: «200 ms», «1 s», «2 V», «0,5 V». */
export function testoScala(valore: number, unita: "s" | "V"): string {
  if (unita === "s" && valore < 1) return `${Math.round(valore * 1000)} ms`;
  return `${String(valore).replace(".", ",")} ${unita}`;
}
