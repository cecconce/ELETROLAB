// Modelli elettrici dei componenti del modulo Arduino (puri: nessuna interfaccia).
//
// Da ogni componente posato, dallo stato dei pin scelto dal programma e dalle
// azioni dello studente (pulsanti premuti, manopole girate, luce) si
// ricavano gli elementi del circuito (vedi circuito.ts); dopo la soluzione si
// leggono le tensioni dei pin e l'aspetto dei componenti (LED accesi e con
// che luminosità, LED bruciati, buzzer che suona, servo alimentato).
import { MASSA, risolviCircuito, type Elemento, type RisultatoCircuito } from "./circuito";

/** Pin della scheda Uno. */
export const PIN_DIGITALI = Array.from({ length: 14 }, (_, i) => `D${i}`);
export const PIN_ANALOGICI = Array.from({ length: 6 }, (_, i) => `A${i}`);
/** Pin che possono fare analogWrite (PWM) sulla Uno. */
export const PIN_PWM = new Set(["D3", "D5", "D6", "D9", "D10", "D11"]);

/** Resistenza d'uscita di un pin (limita la corrente come un pin vero). */
export const R_USCITA_PIN = 25;
/** Resistenza di pull-up interna (INPUT_PULLUP). */
export const R_PULLUP = 20000;
/** Sopra questa corrente un LED si brucia (A). */
export const CORRENTE_LED_BRUCIATO = 0.04;
/** Sotto questa corrente il LED appare spento (A). */
export const CORRENTE_LED_MINIMA = 0.0005;
/** Corrente a cui un LED raggiunge la luminosità piena (A). */
export const CORRENTE_LED_PIENA = 0.015;

/** Tensione di soglia dei LED secondo il colore. */
export const SOGLIA_LED: Record<string, number> = {
  rosso: 1.8,
  giallo: 2.0,
  arancione: 2.0,
  verde: 2.1,
  blu: 3.0,
  bianco: 3.0,
};

export type ModoPin = "INPUT" | "OUTPUT" | "INPUT_PULLUP";

/** Stato di un pin deciso dal programma. */
export interface StatoPin {
  modo: ModoPin;
  /** Uscita: 0 = LOW, 1 = HIGH, valori intermedi = PWM (duty cycle). */
  livello: number;
}

export interface ComponenteArduino {
  id: string;
  tipo: string;
  /** Resistenza: valore in ohm. */
  valore?: number;
  /** LED: colore (rosso, verde…). */
  colore?: string;
}

/** Azioni dello studente durante la simulazione. */
export interface Interazioni {
  /** Pulsanti tenuti premuti. */
  premuti: ReadonlySet<string>;
  /** Potenziometri: posizione del cursore 0…1. */
  posizioni: Readonly<Record<string, number>>;
  /** Fotoresistenze: luce 0 (buio) … 1 (pieno sole). */
  luce: Readonly<Record<string, number>>;
  /** Sensori di temperatura: gradi Celsius (se manca vale TEMPERATURA_PREDEFINITA). */
  temperature?: Readonly<Record<string, number>>;
}

/** Temperatura iniziale dei sensori (°C) e passo del clic. */
export const TEMPERATURA_PREDEFINITA = 20;
export const TEMPERATURE = [-10, -5, 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
/** Resistenza dell'avvolgimento del motorino in continua (Ω). */
export const R_MOTORE_DC = 20;

/** Nodo elettrico di un morsetto (calcolato dall'editor: fili, fori della breadboard, piedini infilati). */
export type NodoDi = (componente: string, morsetto: string) => string;

export const RESISTENZA_PREDEFINITA = 220;
export const POTENZIOMETRO_OHM = 10000;

/** Valori tipici della fotoresistenza: al buio e in piena luce (Ω). */
const LDR_BUIO = 100000;
const LDR_LUCE = 1000;

/** Elementi del circuito per lo stato attuale. */
export function elementiCircuito(
  componenti: readonly ComponenteArduino[],
  nodoDi: NodoDi,
  pin: Readonly<Record<string, StatoPin>>,
  interazioni: Interazioni,
): Elemento[] {
  const el: Elemento[] = [];
  const R = (id: string, a: string, b: string, ohm: number) => el.push({ tipo: "resistenza", id, a, b, ohm });
  for (const c of componenti) {
    const n = (m: string) => nodoDi(c.id, m);
    switch (c.tipo) {
      case "arduino-uno": {
        for (const g of ["GND1", "GND2", "GND3"]) R(`${c.id}:${g}`, n(g), MASSA, 1e-3);
        el.push({ tipo: "generatore", id: `${c.id}:5V`, nodo: n("5V"), volt: 5, ohm: 0.05 });
        el.push({ tipo: "generatore", id: `${c.id}:3V3`, nodo: n("3V3"), volt: 3.3, ohm: 0.2 });
        for (const p of [...PIN_DIGITALI, ...PIN_ANALOGICI]) {
          const s = pin[p];
          if (!s) continue;
          if (s.modo === "OUTPUT") el.push({ tipo: "generatore", id: `${c.id}:${p}`, nodo: n(p), volt: 5 * s.livello, ohm: R_USCITA_PIN });
          else if (s.modo === "INPUT_PULLUP") el.push({ tipo: "generatore", id: `${c.id}:${p}`, nodo: n(p), volt: 5, ohm: R_PULLUP });
        }
        break;
      }
      case "resistenza":
        R(c.id, n("1"), n("2"), c.valore ?? RESISTENZA_PREDEFINITA);
        break;
      case "led":
        el.push({ tipo: "diodo", id: c.id, anodo: n("A"), catodo: n("K"), vf: SOGLIA_LED[c.colore ?? "rosso"] ?? 1.8, ron: 15 });
        break;
      case "led-rgb":
        // Tre LED con il catodo in comune.
        el.push({ tipo: "diodo", id: `${c.id}:R`, anodo: n("R"), catodo: n("K"), vf: SOGLIA_LED.rosso, ron: 15 });
        el.push({ tipo: "diodo", id: `${c.id}:G`, anodo: n("G"), catodo: n("K"), vf: SOGLIA_LED.verde, ron: 15 });
        el.push({ tipo: "diodo", id: `${c.id}:B`, anodo: n("B"), catodo: n("K"), vf: SOGLIA_LED.blu, ron: 15 });
        break;
      case "motore-dc":
        R(c.id, n("+"), n("-"), R_MOTORE_DC);
        break;
      case "tmp36": {
        // Uscita 10 mV/°C con 0,5 V a 0 °C (rispetto a massa) e un piccolo assorbimento dall'alimentazione.
        const gradi = interazioni.temperature?.[c.id] ?? TEMPERATURA_PREDEFINITA;
        R(`${c.id}:alim`, n("VCC"), n("GND"), 20000);
        el.push({ tipo: "generatore", id: `${c.id}:out`, nodo: n("OUT"), volt: 0.5 + 0.01 * gradi, ohm: 100 });
        break;
      }
      case "interruttore-slitta": {
        // Il centrale va a sinistra (1) o a destra (2) secondo la posizione della levetta.
        const destra = (interazioni.posizioni[c.id] ?? 0) >= 0.5;
        R(`${c.id}:chiuso`, n("C"), n(destra ? "2" : "1"), 0.05);
        break;
      }
      case "pulsante": {
        // Due coppie di piedini sempre unite; premendo si uniscono le coppie.
        R(`${c.id}:1`, n("1a"), n("1b"), 1e-3);
        R(`${c.id}:2`, n("2a"), n("2b"), 1e-3);
        if (interazioni.premuti.has(c.id)) R(`${c.id}:premuto`, n("1a"), n("2a"), 0.05);
        break;
      }
      case "potenziometro": {
        const pos = limita01(interazioni.posizioni[c.id] ?? 0.5);
        R(`${c.id}:1W`, n("1"), n("W"), Math.max(1, pos * POTENZIOMETRO_OHM));
        R(`${c.id}:W2`, n("W"), n("2"), Math.max(1, (1 - pos) * POTENZIOMETRO_OHM));
        break;
      }
      case "fotoresistenza": {
        // Andamento logaritmico fra buio e luce, come una LDR vera.
        const luce = limita01(interazioni.luce[c.id] ?? 0.5);
        R(c.id, n("1"), n("2"), LDR_BUIO * Math.pow(LDR_LUCE / LDR_BUIO, luce));
        break;
      }
      case "buzzer":
        R(c.id, n("+"), n("-"), 1000);
        break;
      case "servo":
        R(c.id, n("5V"), n("GND"), 500);
        break;
      case "lcd":
        // Logica del display (carico da 10 kΩ) e retroilluminazione (LED fra A e K).
        R(`${c.id}:logica`, n("VDD"), n("VSS"), 10000);
        el.push({ tipo: "diodo", id: `${c.id}:luce`, anodo: n("A"), catodo: n("K"), vf: 3.0, ron: 60 });
        break;
      case "ultrasuoni":
        R(c.id, n("VCC"), n("GND"), 2000);
        break;
      default:
        break;
    }
  }
  return el;
}

const limita01 = (v: number) => Math.min(1, Math.max(0, v));

/** Aspetto di un componente dopo il calcolo del circuito. */
export interface AspettoArduino {
  /** LED: luminosità 0…1. */
  luminosita?: number;
  /** LED: corrente eccessiva, il LED si è bruciato. */
  bruciato?: boolean;
  /** Buzzer o servo alimentato. */
  alimentato?: boolean;
  /** Corrente nel componente (A), utile per i messaggi. */
  corrente?: number;
  /** LED RGB: luminosità dei tre colori 0…1. */
  rgb?: [number, number, number];
  /** Motore in continua: velocità −1…1 (il segno è il verso). */
  velocita?: number;
}

export function aspettoComponenti(componenti: readonly ComponenteArduino[], nodoDi: NodoDi, r: RisultatoCircuito): Record<string, AspettoArduino> {
  const v = (n: string) => r.tensioni[n] ?? 0;
  const aspetto: Record<string, AspettoArduino> = {};
  for (const c of componenti) {
    if (c.tipo === "led") {
      const i = r.correnti[c.id] ?? 0;
      // Sotto mezzo milliampere un LED vero non si vede acceso (e così si
      // ignorano le correnti minuscole di un circuito lasciato aperto).
      const visibile = i >= CORRENTE_LED_MINIMA;
      aspetto[c.id] = { luminosita: visibile ? Math.min(1, i / CORRENTE_LED_PIENA) : 0, bruciato: i > CORRENTE_LED_BRUCIATO, corrente: i };
    } else if (c.tipo === "led-rgb") {
      const lum = (k: string) => {
        const i = r.correnti[`${c.id}:${k}`] ?? 0;
        return i >= CORRENTE_LED_MINIMA ? Math.min(1, i / CORRENTE_LED_PIENA) : 0;
      };
      const imax = Math.max(...["R", "G", "B"].map((k) => r.correnti[`${c.id}:${k}`] ?? 0));
      aspetto[c.id] = { rgb: [lum("R"), lum("G"), lum("B")], bruciato: imax > CORRENTE_LED_BRUCIATO, corrente: imax };
    } else if (c.tipo === "motore-dc") {
      const volt = v(nodoDi(c.id, "+")) - v(nodoDi(c.id, "-"));
      const velocita = Math.abs(volt) < 0.5 ? 0 : Math.max(-1, Math.min(1, volt / 5));
      aspetto[c.id] = { velocita, alimentato: velocita !== 0, corrente: Math.abs(volt) / R_MOTORE_DC };
    } else if (c.tipo === "buzzer") {
      aspetto[c.id] = { alimentato: v(nodoDi(c.id, "+")) - v(nodoDi(c.id, "-")) > 1 };
    } else if (c.tipo === "servo") {
      aspetto[c.id] = { alimentato: v(nodoDi(c.id, "5V")) - v(nodoDi(c.id, "GND")) > 4 };
    } else if (c.tipo === "lcd") {
      const luce = r.correnti[`${c.id}:luce`] ?? 0;
      aspetto[c.id] = { alimentato: v(nodoDi(c.id, "VDD")) - v(nodoDi(c.id, "VSS")) > 4, luminosita: luce >= CORRENTE_LED_MINIMA ? Math.min(1, luce / 0.01) : 0 };
    } else if (c.tipo === "ultrasuoni") {
      aspetto[c.id] = { alimentato: v(nodoDi(c.id, "VCC")) - v(nodoDi(c.id, "GND")) > 4 };
    }
  }
  return aspetto;
}

/** Valore letto da digitalRead: HIGH sopra 2,5 V; un ingresso flottante legge "a caso". */
export function letturaDigitale(r: RisultatoCircuito, nodo: string, caso: () => number = Math.random): number {
  if (r.flottanti.has(nodo)) return caso() < 0.5 ? 0 : 1;
  return (r.tensioni[nodo] ?? 0) > 2.5 ? 1 : 0;
}

/** Valore letto da analogRead: 0…1023 per 0…5 V. */
export function letturaAnalogica(r: RisultatoCircuito, nodo: string, caso: () => number = Math.random): number {
  if (r.flottanti.has(nodo)) return Math.floor(caso() * 1024);
  const volt = Math.min(5, Math.max(0, r.tensioni[nodo] ?? 0));
  return Math.round((volt / 5) * 1023);
}

export { risolviCircuito };
