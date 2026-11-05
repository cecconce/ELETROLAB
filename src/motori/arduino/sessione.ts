// Sessione di simulazione del modulo Arduino (pura: nessuna interfaccia).
//
// Mette insieme il programma (interprete), lo stato dei pin, il circuito sul
// banco (risolutore elettrico) e le azioni dello studente. È un oggetto
// mutabile: l'interfaccia lo tiene in un ref e chiama `passoArduino` a
// intervalli regolari; dopo ogni passo legge `aspetto`, `seriale`, `lcd`…
//
// Il circuito si ricalcola solo quando serve ("sporco"): quando il programma
// cambia un pin o legge un ingresso, o lo studente preme un pulsante.
import { risolviCircuito, type RisultatoCircuito } from "./circuito";
import {
  aspettoComponenti,
  FUNZIONI_MULTIMETRO,
  indiceFunzioneMultimetro,
  misureMultimetri,
  ALIMENTATORE_PASSO,
  LIVELLI_SENSORE,
  SENSORI_A_LIVELLI,
  livelloSensore,
  ALIMENTATORE_TENSIONE_MAX,
  letturaAnalogica,
  risolviBanco,
  tensioneAlimentatore,
  letturaDigitale,
  PIN_PWM,
  TEMPERATURA_PREDEFINITA,
  TEMPERATURE,
  type AspettoArduino,
  type ComponenteArduino,
  type Interazioni,
  type NodoDi,
  type StatoPin,
} from "./componenti";
import { ErroreArduino, preparaSketch, type Esecutore, type Hardware } from "./linguaggio";

/** Distanza iniziale dell'ostacolo davanti al sensore a ultrasuoni (cm). */
export const DISTANZA_PREDEFINITA = 50;
/** Distanze proposte cliccando sul sensore (cm). */
export const DISTANZE = [2, 5, 10, 20, 30, 50, 100, 200, 400];

/** Caratteri massimi tenuti nel monitor seriale. */
export const SERIALE_MASSIMA = 20000;

export interface SessioneArduino {
  esecutore: Esecutore | null;
  /** Errore nel testo del programma (trovato prima di partire) o durante l'esecuzione. */
  errore: ErroreArduino | null;
  componenti: ComponenteArduino[];
  nodoDi: NodoDi;
  /** Id della scheda Uno sul banco (null se manca). */
  scheda: string | null;
  pin: Record<string, StatoPin>;
  toni: Record<string, number>;
  servi: Record<string, number>;
  /** Contenuto dei display creati dal programma, con i pin del costruttore. */
  lcd: Record<string, { righe: string[]; pin: number[] }>;
  /** Distanza dell'ostacolo davanti a ogni sensore a ultrasuoni (cm). */
  seriale: string;
  ingressoSeriale: number[];
  distanze: Record<string, number>;
  interazioni: { premuti: Set<string>; posizioni: Record<string, number>; luce: Record<string, number>; temperature: Record<string, number> };
  risultato: RisultatoCircuito;
  /** Moduli relè con la bobina eccitata (si ricordano fra un calcolo e l'altro: isteresi). */
  releEccitati: Set<string>;
  aspetto: Record<string, AspettoArduino>;
  sporco: boolean;
  /** Numero di modifiche visibili: l'interfaccia ridisegna quando cambia. */
  versione: number;
}

function ricalcola(s: SessioneArduino) {
  const interazioni: Interazioni = s.interazioni;
  const { risultato, inCorrenteCostante, releEccitati } = risolviBanco(s.componenti, s.nodoDi, s.pin, interazioni, s.releEccitati);
  s.risultato = risultato;
  s.releEccitati = releEccitati;
  s.aspetto = { ...aspettoComponenti(s.componenti, s.nodoDi, s.risultato, inCorrenteCostante, releEccitati), ...misureMultimetri(s.componenti, s.nodoDi, interazioni, s.risultato) };
  s.sporco = false;
  s.versione++;
}

function nodoPin(s: SessioneArduino, pin: string): string {
  return s.scheda ? s.nodoDi(s.scheda, pin) : `nessuna-scheda/${pin}`;
}

/** Avvia la simulazione: analizza il programma e accende la scheda. */
export function avviaSessioneArduino(codice: string, componenti: ComponenteArduino[], nodoDi: NodoDi): SessioneArduino {
  const s: SessioneArduino = {
    esecutore: null,
    errore: null,
    componenti,
    nodoDi,
    scheda: componenti.find((c) => c.tipo === "arduino-uno")?.id ?? null,
    pin: {},
    toni: {},
    servi: {},
    lcd: {},
    distanze: {},
    seriale: "",
    ingressoSeriale: [],
    interazioni: { premuti: new Set(), posizioni: {}, luce: {}, temperature: {} },
    risultato: risolviCircuito([]),
    releEccitati: new Set(),
    aspetto: {},
    sporco: true,
    versione: 0,
  };
  const cambia = () => {
    s.sporco = true;
  };
  /** Cambia lo stato di un pin; il circuito si ricalcola solo se è cambiato davvero (loop() riscrive spesso lo stesso valore). */
  const imposta = (pin: string, nuovo: StatoPin) => {
    const prima = s.pin[pin];
    if (prima && prima.modo === nuovo.modo && prima.livello === nuovo.livello) return;
    s.pin[pin] = nuovo;
    cambia();
  };
  const hw: Hardware = {
    pinMode(pin, modo) {
      const prima = s.pin[pin];
      imposta(pin, { modo, livello: modo === "OUTPUT" ? (prima?.livello ?? 0) : 0 });
    },
    digitalWrite(pin, livello) {
      const p = s.pin[pin] ?? { modo: "INPUT", livello: 0 };
      // Come sulla scheda vera: digitalWrite(HIGH) su un ingresso attiva il pull-up.
      if (p.modo === "OUTPUT") imposta(pin, { modo: "OUTPUT", livello });
      else imposta(pin, { modo: livello ? "INPUT_PULLUP" : "INPUT", livello: 0 });
    },
    digitalRead(pin) {
      if (s.sporco) ricalcola(s);
      return letturaDigitale(s.risultato, nodoPin(s, pin));
    },
    analogRead(pin) {
      if (s.sporco) ricalcola(s);
      return letturaAnalogica(s.risultato, nodoPin(s, pin));
    },
    analogWrite(pin, valore) {
      // Sui pin senza PWM analogWrite accende (≥128) o spegne, come sulla scheda.
      const livello = PIN_PWM.has(pin) ? valore / 255 : valore >= 128 ? 1 : 0;
      imposta(pin, { modo: "OUTPUT", livello });
    },
    tone(pin, frequenza) {
      s.toni[pin] = frequenza;
      s.pin[pin] = { modo: "OUTPUT", livello: 0.5 };
      cambia();
    },
    noTone(pin) {
      delete s.toni[pin];
      if (s.pin[pin]) s.pin[pin] = { modo: "OUTPUT", livello: 0 };
      cambia();
    },
    serialScrivi(testo) {
      s.seriale = (s.seriale + testo).slice(-SERIALE_MASSIMA);
      s.versione++;
    },
    serialLeggi: () => s.ingressoSeriale.shift() ?? -1,
    serialDisponibili: () => s.ingressoSeriale.length,
    servo(pin, angolo) {
      s.servi[pin] = angolo;
      s.versione++;
    },
    lcd(nome, righe, _colonne, pin) {
      s.lcd[nome] = { righe, pin };
      s.versione++;
    },
    pulseIn(pin) {
      // Il sensore a ultrasuoni alimentato con ECHO su questo pin risponde con
      // un impulso di 58 µs per ogni centimetro di distanza (andata e ritorno).
      if (s.sporco) ricalcola(s);
      for (const c of s.componenti) {
        if (c.tipo !== "ultrasuoni" || !s.aspetto[c.id]?.alimentato) continue;
        if (pinCollegato(s, c.id, "ECHO") === pin) return Math.round(58 * (s.distanze[c.id] ?? DISTANZA_PREDEFINITA));
      }
      return 0;
    },
  };
  try {
    s.esecutore = preparaSketch(codice, hw);
  } catch (e) {
    s.errore = e instanceof ErroreArduino ? e : new ErroreArduino(0, String(e));
  }
  ricalcola(s);
  return s;
}

/** Fa scorrere `ms` millisecondi di programma e aggiorna il circuito. */
export function passoArduino(s: SessioneArduino, ms: number): void {
  if (s.esecutore && !s.errore) {
    s.esecutore.avanza(ms);
    if (s.esecutore.errore) s.errore = s.esecutore.errore;
  }
  if (s.sporco) ricalcola(s);
}

/** Tempo trascorso dall'accensione (secondi). */
export function tempoArduino(s: SessioneArduino): number {
  return (s.esecutore?.tempoUs ?? 0) / 1e6;
}

/** Pressione del mouse su un componente: pulsante premuto, manopola girata, luce cambiata. */
export function clicGiuArduino(s: SessioneArduino, id: string, indietro = false): void {
  const c = s.componenti.find((x) => x.id === id);
  if (!c) return;
  if (c.tipo === "pulsante") s.interazioni.premuti.add(id);
  else if (c.tipo === "potenziometro") {
    const pos = s.interazioni.posizioni[id] ?? 0.5;
    s.interazioni.posizioni[id] = Math.round(Math.min(1, Math.max(0, pos + (indietro ? -0.1 : 0.1))) * 10) / 10;
  } else if (c.tipo === "ultrasuoni") {
    const ora = s.distanze[id] ?? DISTANZA_PREDEFINITA;
    const i = Math.max(0, DISTANZE.indexOf(ora));
    s.distanze[id] = DISTANZE[Math.min(DISTANZE.length - 1, Math.max(0, i + (indietro ? -1 : 1)))];
    s.versione++;
    return;
  } else if (c.tipo === "tmp36") {
    const ora = s.interazioni.temperature[id] ?? TEMPERATURA_PREDEFINITA;
    const i = Math.max(0, TEMPERATURE.indexOf(ora));
    s.interazioni.temperature[id] = TEMPERATURE[Math.min(TEMPERATURE.length - 1, Math.max(0, i + (indietro ? -1 : 1)))];
  } else if (c.tipo === "multimetro") {
    // Il selettore passa alla funzione seguente (o precedente con il clic destro).
    const n = FUNZIONI_MULTIMETRO.length;
    s.interazioni.posizioni[id] = (indiceFunzioneMultimetro(s.interazioni, c) + (indietro ? n - 1 : 1)) % n;
  } else if (c.tipo === "alimentatore") {
    // Manopola della tensione: +0,5 V con il clic, −0,5 V con il clic dalla parte sinistra.
    const ora = tensioneAlimentatore(s.interazioni, c);
    const nuova = Math.round((ora + (indietro ? -ALIMENTATORE_PASSO : ALIMENTATORE_PASSO)) / ALIMENTATORE_PASSO) * ALIMENTATORE_PASSO;
    s.interazioni.posizioni[id] = Math.min(ALIMENTATORE_TENSIONE_MAX, Math.max(0, nuova));
  } else if (SENSORI_A_LIVELLI.has(c.tipo)) {
    // Livello successivo (o precedente con il clic a sinistra), senza ricominciare dal fondo.
    const ora = livelloSensore(s.interazioni, c);
    const i = LIVELLI_SENSORE.findIndex((l) => Math.abs(l - ora) < 1e-6);
    s.interazioni.posizioni[id] = LIVELLI_SENSORE[Math.min(LIVELLI_SENSORE.length - 1, Math.max(0, (i < 0 ? 0 : i) + (indietro ? -1 : 1)))];
  } else if (c.tipo === "interruttore-slitta" || c.tipo === "sensore-pir" || c.tipo === "sensore-inclinazione") {
    s.interazioni.posizioni[id] = (s.interazioni.posizioni[id] ?? 0) >= 0.5 ? 0 : 1;
  } else if (c.tipo === "fotoresistenza") {
    const livelli = [0, 0.25, 0.5, 0.75, 1];
    const ora = s.interazioni.luce[id] ?? 0.5;
    const i = livelli.findIndex((l) => Math.abs(l - ora) < 1e-6);
    s.interazioni.luce[id] = livelli[(i + (indietro ? livelli.length - 1 : 1)) % livelli.length];
  } else return;
  ricalcola(s);
}

/** Rilascio del mouse: il pulsante torna a riposo. */
export function clicSuArduino(s: SessioneArduino, id: string): void {
  if (s.interazioni.premuti.delete(id)) ricalcola(s);
}

export function rilasciaTuttiArduino(s: SessioneArduino): void {
  if (s.interazioni.premuti.size === 0) return;
  s.interazioni.premuti.clear();
  ricalcola(s);
}

/** Testo inviato dal monitor seriale (con «a capo» finale, come il monitor dell'IDE). */
export function inviaSeriale(s: SessioneArduino, testo: string): void {
  for (const ch of `${testo}\n`) s.ingressoSeriale.push(ch.charCodeAt(0));
}

/** Pin della scheda collegato al morsetto indicato (es. il segnale del servo), se c'è. */
export function pinCollegato(s: SessioneArduino, componente: string, morsetto: string): string | null {
  if (!s.scheda) return null;
  const nodo = s.nodoDi(componente, morsetto);
  for (const p of [...Array.from({ length: 14 }, (_, i) => `D${i}`), ...Array.from({ length: 6 }, (_, i) => `A${i}`)]) {
    if (s.nodoDi(s.scheda, p) === nodo) return p;
  }
  return null;
}
