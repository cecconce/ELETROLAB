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
  /** Multimetro: funzione di partenza (V, A o Ω). */
  funzione?: string;
  /** Alimentatore: tensione impostata (V) e limite di corrente (A). */
  tensione?: number;
  correnteMax?: number;
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
/** Funzioni del multimetro, scelte con un clic in simulazione (indice in `interazioni.posizioni`). */
export const FUNZIONI_MULTIMETRO = ["V", "A", "Ω"] as const;
export type FunzioneMultimetro = (typeof FUNZIONI_MULTIMETRO)[number];
/** Indice della funzione del multimetro: quella scelta con i clic o, all'inizio, quella delle Proprietà. */
export function indiceFunzioneMultimetro(interazioni: Interazioni, c: ComponenteArduino): number {
  const scelta = interazioni.posizioni[c.id];
  if (scelta !== undefined) return Math.round(scelta) % FUNZIONI_MULTIMETRO.length;
  return Math.max(0, FUNZIONI_MULTIMETRO.indexOf(c.funzione as FunzioneMultimetro));
}
export function funzioneMultimetro(interazioni: Interazioni, c: ComponenteArduino): FunzioneMultimetro {
  return FUNZIONI_MULTIMETRO[indiceFunzioneMultimetro(interazioni, c)];
}
/** Resistenza interna del voltmetro e dell'amperometro (Ω). */
const R_VOLTMETRO = 10e6;
const R_AMPEROMETRO = 0.05;
/** Sopra questo valore l'ohmmetro indica «OL» (circuito aperto). */
export const OHM_FUORI_SCALA = 20e6;

// --- Sensori comandati con i clic (livello 0…1 in `interazioni.posizioni`) ---

/** Livelli proposti cliccando su forza, umidità del terreno e gas. */
export const LIVELLI_SENSORE = [0, 0.25, 0.5, 0.75, 1];
/** Livello iniziale di ogni sensore. */
export const LIVELLO_INIZIALE: Record<string, number> = {
  "sensore-inclinazione": 0,
  "sensore-forza": 0,
  "sensore-umidita": 0.5,
  "sensore-gas": 0,
};
export const SENSORI_A_LIVELLI = new Set(["sensore-forza", "sensore-umidita", "sensore-gas"]);
/** Livello attuale di un sensore (quello scelto con i clic o quello iniziale). */
export function livelloSensore(interazioni: Interazioni, c: ComponenteArduino): number {
  return limita01(interazioni.posizioni[c.id] ?? LIVELLO_INIZIALE[c.tipo] ?? 0);
}
/** Sensore di forza (FSR): senza pressione è quasi un circuito aperto, premuto a fondo circa 250 Ω. */
const FSR_LIBERO = 10e6;
const FSR_LEGGERO = 100e3;
const FSR_PIENO = 250;
export function resistenzaFsr(forza: number): number {
  if (forza <= 0) return FSR_LIBERO;
  return FSR_LEGGERO * Math.pow(FSR_PIENO / FSR_LEGGERO, forza);
}

// --- Tastierino a matrice 4×4 ---

/** Tasti del tastierino, riga per riga (come stampati sul componente). */
export const TASTI_TASTIERINO = ["1", "2", "3", "A", "4", "5", "6", "B", "7", "8", "9", "C", "*", "0", "#", "D"];
/** Area dei tasti nel disegno (unità del foglio): origine, larghezza e altezza di un tasto. */
export const TASTIERINO_X0 = 14;
export const TASTIERINO_Y0 = 14;
export const TASTIERINO_L = 38;
export const TASTIERINO_H = 43;
/** Indice del tasto (0…15) nel punto indicato, in coordinate del componente; null fuori dai tasti. */
export function tastoNelPunto(x: number, y: number): number | null {
  const c = Math.floor((x - TASTIERINO_X0) / TASTIERINO_L);
  const r = Math.floor((y - TASTIERINO_Y0) / TASTIERINO_H);
  return c >= 0 && c < 4 && r >= 0 && r < 4 ? r * 4 + c : null;
}

// --- Ponte H L293D ---

/** Canali del L293D: ingresso, uscita e abilitazione di ciascuno. */
export const CANALI_L293D = [
  { ingresso: "IN1", uscita: "OUT1", abilita: "EN12" },
  { ingresso: "IN2", uscita: "OUT2", abilita: "EN12" },
  { ingresso: "IN3", uscita: "OUT3", abilita: "EN34" },
  { ingresso: "IN4", uscita: "OUT4", abilita: "EN34" },
] as const;
/**
 * Stato di un'uscita: verso VS (alto), verso GND (basso) o scollegata
 * (aperto). Con il PWM su EN o su IN l'uscita è alta solo per una frazione
 * del tempo (`duty`): si usa la tensione media, come per i LED.
 */
export interface UscitaPonte {
  stato: "alto" | "basso" | "aperto";
  duty: number;
}
const APERTA: UscitaPonte = { stato: "aperto", duty: 0 };
/** Cadute di tensione degli stadi d'uscita (V) e loro resistenza (Ω), come nel componente vero. */
const L293D_CADUTA_ALTO = 1.3;
const L293D_CADUTA_BASSO = 1.2;
const L293D_R_USCITA = 1;

/** Modulo relè: resistenza della bobina (5 V, circa 70 mA) e soglie dell'ingresso IN con isteresi (V). */
export const R_BOBINA_RELE = 70;
export const RELE_SOGLIA_ECCITA = 3;
export const RELE_SOGLIA_RILASCIA = 1.5;
/** Lampadina a filamento: tensione e potenza nominali, resistenza a caldo. */
export const LAMPADINA_VOLT = 12;
export const LAMPADINA_WATT = 1.2;
export const R_LAMPADINA = (LAMPADINA_VOLT * LAMPADINA_VOLT) / LAMPADINA_WATT;

/** Guadagno di corrente del transistor NPN della libreria. */
export const BETA_TRANSISTOR = 100;
/** Oltre questa corrente di collettore il transistor (piccolo, TO-92) si surriscalda (A). */
export const CORRENTE_TRANSISTOR_MAX = 0.8;

/** Resistenza dell'avvolgimento del motorino in continua (Ω). */
export const R_MOTORE_DC = 20;

// --- Alimentazione esterna (come in Tinkercad: alimentatore da banco e pile) ---

/** Alimentatore da banco: valori proposti, campo di regolazione e passo del clic. */
export const ALIMENTATORE_TENSIONE = 5;
export const ALIMENTATORE_CORRENTE = 1;
export const ALIMENTATORE_TENSIONE_MAX = 30;
export const ALIMENTATORE_CORRENTE_MAX = 5;
export const ALIMENTATORE_PASSO = 0.5;
/** Resistenza interna dell'alimentatore in tensione costante (Ω): quasi ideale. */
const R_ALIMENTATORE = 0.01;
/**
 * Resistenza interna "finta" usata in corrente costante: con un generatore di
 * Norton da I·R in serie a R molto grande la corrente resta quasi I qualunque
 * sia il carico (finché il carico è molto più piccolo di R).
 */
const R_CORRENTE_COSTANTE = 1e7;

/** Pile: tensione a vuoto e resistenza interna (valori tipici di pile alcaline nuove). */
export const PILE: Record<string, { volt: number; ohm: number }> = {
  "batteria-9v": { volt: 9, ohm: 1.5 },
  "portapile-4aa": { volt: 6, ohm: 0.6 },
};

/** Tensione impostata sull'alimentatore: quella scelta con i clic o, all'inizio, quella delle Proprietà. */
export function tensioneAlimentatore(interazioni: Interazioni, c: ComponenteArduino): number {
  const v = interazioni.posizioni[c.id] ?? c.tensione ?? ALIMENTATORE_TENSIONE;
  return Math.min(ALIMENTATORE_TENSIONE_MAX, Math.max(0, v));
}
export function limiteAlimentatore(c: ComponenteArduino): number {
  return Math.min(ALIMENTATORE_CORRENTE_MAX, Math.max(0.001, c.correnteMax ?? ALIMENTATORE_CORRENTE));
}

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
  /** Alimentatori che lavorano in corrente costante (limite raggiunto). */
  inCorrenteCostante: ReadonlySet<string> = new Set(),
  /** Moduli relè con la bobina eccitata. */
  releEccitati: ReadonlySet<string> = new Set(),
  /** Ponti H: stato delle quattro uscite di ciascuno. */
  statiPonti: ReadonlyMap<string, readonly UscitaPonte[]> = new Map(),
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
      case "tastierino": {
        // Tasto premuto: unisce la sua riga alla sua colonna (matrice di contatti).
        const tasto = interazioni.premuti.has(c.id) ? interazioni.posizioni[c.id] : undefined;
        if (tasto !== undefined) R(`${c.id}:tasto`, n(`R${Math.floor(tasto / 4) + 1}`), n(`C${(tasto % 4) + 1}`), 0.05);
        break;
      }
      case "sensore-inclinazione":
        // Interruttore a sfera: chiuso dritto, aperto quando è inclinato.
        if (livelloSensore(interazioni, c) < 0.5) R(c.id, n("1"), n("2"), 0.1);
        break;
      case "sensore-forza":
        R(c.id, n("1"), n("2"), resistenzaFsr(livelloSensore(interazioni, c)));
        break;
      case "sensore-umidita":
      case "sensore-gas": {
        // Moduli con uscita analogica: tensione proporzionale al livello (umidità
        // del terreno o concentrazione di gas), riferita a GND; un piccolo
        // assorbimento dall'alimentazione. Il gas parte da 0,4 V (aria pulita).
        const livello = livelloSensore(interazioni, c);
        const volt = c.tipo === "sensore-gas" ? 0.4 + 4.2 * livello : 4.5 * livello;
        R(`${c.id}:alim`, n("VCC"), n("GND"), c.tipo === "sensore-gas" ? 33 : 5000);
        el.push({ tipo: "generatore", id: `${c.id}:out`, nodo: n(c.tipo === "sensore-gas" ? "AO" : "SIG"), volt, ohm: 100 });
        break;
      }
      case "l293d": {
        // I quattro piedini GND sono uniti dentro (e fanno da dissipatore).
        for (const g of ["GND2", "GND3", "GND4"]) R(`${c.id}:${g}`, n("GND1"), n(g), 1e-3);
        // Logica (VSS, 5 V) e ingressi: carichi leggeri.
        R(`${c.id}:vss`, n("VSS"), n("GND1"), 250);
        for (const p of ["IN1", "IN2", "IN3", "IN4", "EN12", "EN34"]) R(`${c.id}:${p}`, n(p), n("GND1"), 100000);
        // Uscite: verso VS o verso GND attraverso uno stadio con la sua caduta.
        // Con il PWM (duty < 1) l'uscita media vale duty · (VS − caduta): si
        // ottiene aumentando la caduta dello stadio alto della parte che manca
        // (VS è quella del calcolo precedente, salvata nello stato).
        const stati = statiPonti.get(c.id);
        const vs = statiPonti.get(`${c.id}:VS`)?.[0]?.duty ?? 0;
        CANALI_L293D.forEach((k, i) => {
          const u = stati?.[i] ?? APERTA;
          if (u.stato === "alto") {
            const vf = L293D_CADUTA_ALTO + (1 - u.duty) * Math.max(0, vs - L293D_CADUTA_ALTO);
            el.push({ tipo: "diodo", id: `${c.id}:${k.uscita}`, anodo: n("VS"), catodo: n(k.uscita), vf, ron: L293D_R_USCITA });
          } else if (u.stato === "basso") {
            el.push({ tipo: "diodo", id: `${c.id}:${k.uscita}`, anodo: n(k.uscita), catodo: n("GND1"), vf: L293D_CADUTA_BASSO, ron: L293D_R_USCITA });
          }
        });
        break;
      }
      case "modulo-rele": {
        // Scheda con relè, transistor e diodo già montati: VCC-GND alimentano la
        // bobina (circa 70 mA quando è eccitata, solo il LED quando è a riposo),
        // IN è l'ingresso di comando (assorbe pochissimo). Contatti: COM-NO
        // chiuso con la bobina eccitata, COM-NC chiuso a riposo.
        const eccitato = releEccitati.has(c.id);
        R(`${c.id}:bobina`, n("VCC"), n("GND"), eccitato ? R_BOBINA_RELE : 5000);
        R(`${c.id}:in`, n("IN"), n("GND"), 10000);
        R(`${c.id}:contatto`, n("COM"), n(eccitato ? "NO" : "NC"), 0.05);
        break;
      }
      case "lampadina":
        // Lampadina a filamento 12 V – 1,2 W: R = V² / P = 120 Ω (resistenza a caldo, costante).
        R(c.id, n("1"), n("2"), R_LAMPADINA);
        break;
      case "transistor-npn":
        el.push({ tipo: "npn", id: c.id, c: n("C"), b: n("B"), e: n("E"), beta: BETA_TRANSISTOR });
        break;
      case "diodo":
        el.push({ tipo: "diodo", id: c.id, anodo: n("A"), catodo: n("K"), vf: 0.7, ron: 0.5 });
        break;
      case "alimentatore":
        // Tensione costante (CV) finché la corrente resta sotto il limite;
        // oltre, corrente costante (CC) pari al limite: vedi risolviBanco.
        if (inCorrenteCostante.has(c.id)) {
          el.push({ tipo: "alimentatore", id: c.id, piu: n("+"), meno: n("-"), volt: limiteAlimentatore(c) * R_CORRENTE_COSTANTE, ohm: R_CORRENTE_COSTANTE });
        } else {
          el.push({ tipo: "alimentatore", id: c.id, piu: n("+"), meno: n("-"), volt: tensioneAlimentatore(interazioni, c), ohm: R_ALIMENTATORE });
        }
        break;
      case "batteria-9v":
      case "portapile-4aa": {
        const p = PILE[c.tipo];
        el.push({ tipo: "alimentatore", id: c.id, piu: n("+"), meno: n("-"), volt: p.volt, ohm: p.ohm });
        break;
      }
      case "led":
        el.push({ tipo: "diodo", id: c.id, anodo: n("A"), catodo: n("K"), vf: SOGLIA_LED[c.colore ?? "rosso"] ?? 1.8, ron: 15 });
        break;
      case "led-rgb":
        // Tre LED con il catodo in comune.
        el.push({ tipo: "diodo", id: `${c.id}:R`, anodo: n("R"), catodo: n("K"), vf: SOGLIA_LED.rosso, ron: 15 });
        el.push({ tipo: "diodo", id: `${c.id}:G`, anodo: n("G"), catodo: n("K"), vf: SOGLIA_LED.verde, ron: 15 });
        el.push({ tipo: "diodo", id: `${c.id}:B`, anodo: n("B"), catodo: n("K"), vf: SOGLIA_LED.blu, ron: 15 });
        break;
      case "display-sette-segmenti":
        // Otto LED rossi con i catodi uniti; i due piedini COM sono collegati dentro.
        R(`${c.id}:COM`, n("COM1"), n("COM2"), 1e-3);
        for (const seg of SEGMENTI_DISPLAY) el.push({ tipo: "diodo", id: `${c.id}:${seg}`, anodo: n(seg), catodo: n("COM1"), vf: SOGLIA_LED.rosso, ron: 15 });
        break;
      case "multimetro": {
        // Voltmetro fra V e COM (resistenza altissima), amperometro fra A e COM (quasi un filo);
        // come ohmmetro non tocca il circuito acceso (la misura si fa a parte, vedi misuraOhm).
        const f = funzioneMultimetro(interazioni, c);
        if (f === "V") R(`${c.id}:V`, n("V"), n("COM"), R_VOLTMETRO);
        else if (f === "A") R(`${c.id}:A`, n("A"), n("COM"), R_AMPEROMETRO);
        break;
      }
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
      case "sensore-pir": {
        // Uscita digitale: 5 V quando «vede» un movimento (scelto con un clic), altrimenti 0 V.
        // Funziona solo se alimentato (VCC a 5 V rispetto a GND): il controllo si fa nell'aspetto.
        const movimento = (interazioni.posizioni[c.id] ?? 0) >= 0.5;
        R(`${c.id}:alim`, n("VCC"), n("GND"), 10000);
        el.push({ tipo: "generatore", id: `${c.id}:out`, nodo: n("OUT"), volt: movimento ? 5 : 0, ohm: 100 });
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

/**
 * Risolve il circuito del banco tenendo conto del limite di corrente degli
 * alimentatori, come un alimentatore da laboratorio: se la corrente supera il
 * limite impostato, l'alimentatore passa in corrente costante (CC) e la
 * tensione ai morsetti scende quanto serve; se in CC la tensione
 * supererebbe quella impostata, torna in tensione costante (CV).
 */
export function risolviBanco(
  componenti: readonly ComponenteArduino[],
  nodoDi: NodoDi,
  pin: Readonly<Record<string, StatoPin>>,
  interazioni: Interazioni,
  /** Relè eccitati al calcolo precedente: con l'isteresi delle soglie non "sfarfallano". */
  releIniziali: ReadonlySet<string> = new Set(),
): { risultato: RisultatoCircuito; inCorrenteCostante: Set<string>; releEccitati: Set<string>; statiPonti: Map<string, UscitaPonte[]> } {
  const alimentatori = componenti.filter((c) => c.tipo === "alimentatore");
  const rele = componenti.filter((c) => c.tipo === "modulo-rele");
  const ponti = componenti.filter((c) => c.tipo === "l293d");
  const cc = new Set<string>();
  const eccitati = new Set([...releIniziali].filter((id) => rele.some((c) => c.id === id)));
  // Per ogni ponte: le quattro uscite e, alla chiave "<id>:VS", la tensione VS
  // del calcolo precedente (serve per il PWM).
  const statiPonti = new Map<string, UscitaPonte[]>(ponti.flatMap((c) => [[c.id, [APERTA, APERTA, APERTA, APERTA]], [`${c.id}:VS`, [{ stato: "aperto", duty: 0 }]]]));
  const calcola = () => risolviCircuito(elementiCircuito(componenti, nodoDi, pin, interazioni, cc, eccitati, statiPonti));
  let r = calcola();
  const volt = (id: string, a: string, b: string) => (r.tensioni[nodoDi(id, a)] ?? 0) - (r.tensioni[nodoDi(id, b)] ?? 0);
  // Pochi giri bastano: ogni giro cambia modo a qualche alimentatore o relè.
  for (let giro = 0; giro < 2 * (alimentatori.length + rele.length + ponti.length) + 2; giro++) {
    let cambiato = false;
    for (const c of alimentatori) {
      const corrente = r.correnti[c.id] ?? 0;
      if (!cc.has(c.id) && Math.abs(corrente) > limiteAlimentatore(c) * 1.0001) {
        cc.add(c.id);
        cambiato = true;
      } else if (cc.has(c.id) && volt(c.id, "+", "-") > tensioneAlimentatore(interazioni, c)) {
        cc.delete(c.id);
        cambiato = true;
      }
    }
    for (const c of rele) {
      // La bobina si eccita se il modulo è alimentato e l'ingresso IN è alto.
      const alimentato = volt(c.id, "VCC", "GND") > 4;
      const ingresso = volt(c.id, "IN", "GND");
      const prima = eccitati.has(c.id);
      const ora = alimentato && (prima ? ingresso > RELE_SOGLIA_RILASCIA : ingresso > RELE_SOGLIA_ECCITA);
      if (ora !== prima) {
        if (ora) eccitati.add(c.id);
        else eccitati.delete(c.id);
        cambiato = true;
      }
    }
    for (const c of ponti) {
      // Uscite del ponte: con la logica alimentata e l'abilitazione alta
      // seguono gli ingressi (alto → verso VS, basso → verso GND); altrimenti
      // sono scollegate. Le tensioni si leggono rispetto al GND del componente.
      const vss = volt(c.id, "VSS", "GND1");
      const logica = vss > 4.5;
      // Frazione di tempo "alta" di un ingresso: 1 o 0 per i livelli fissi, la
      // tensione media rispetto a VSS per il PWM.
      const frazione = (p: string) => {
        const f = Math.min(1, Math.max(0, volt(c.id, p, "GND1") / Math.max(vss, 1e-9)));
        return f >= 0.98 ? 1 : f <= 0.02 ? 0 : f;
      };
      const nuovi = CANALI_L293D.map((k): UscitaPonte => {
        const abilita = frazione(k.abilita);
        if (!logica || abilita === 0) return APERTA;
        const ingresso = frazione(k.ingresso);
        return ingresso === 0 ? { stato: "basso", duty: 1 } : { stato: "alto", duty: abilita * ingresso };
      });
      const vsOra = volt(c.id, "VS", "GND1");
      const vsPrima = statiPonti.get(`${c.id}:VS`)![0].duty;
      const prima = statiPonti.get(c.id)!;
      const diversi = nuovi.some((u, i) => u.stato !== prima[i].stato || Math.abs(u.duty - prima[i].duty) > 1e-3);
      const conPwm = nuovi.some((u) => u.stato === "alto" && u.duty < 1);
      if (diversi || (conPwm && Math.abs(vsOra - vsPrima) > 1e-3)) {
        statiPonti.set(c.id, nuovi);
        statiPonti.set(`${c.id}:VS`, [{ stato: "aperto", duty: vsOra }]);
        cambiato = true;
      }
    }
    if (!cambiato) break;
    r = calcola();
  }
  return { risultato: r, inCorrenteCostante: cc, releEccitati: eccitati, statiPonti };
}

/** Segmenti del display nell'ordine dei valori di `AspettoArduino.segmenti`. */
export const SEGMENTI_DISPLAY = ["a", "b", "c", "d", "e", "f", "g", "dp"] as const;

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
  /** Display a 7 segmenti: luminosità di a, b, c, d, e, f, g, dp (0…1). */
  segmenti?: number[];
  /** Multimetro: funzione scelta e valore misurato (V, A o Ω; Infinity = fuori scala). */
  funzione?: FunzioneMultimetro;
  misura?: number;
  /** Motore in continua: velocità −1…1 (il segno è il verso). */
  velocita?: number;
  /** Ponte H: stato delle quattro uscite. */
  uscite?: UscitaPonte[];
  /** Modulo relè: bobina eccitata (contatto COM-NO chiuso). */
  eccitato?: boolean;
  /** Transistor: stato (interdizione, attivo o saturo) e correnti di base e collettore (A). */
  statoTransistor?: "interdizione" | "attivo" | "saturo";
  correnteBase?: number;
  /** Alimentatore e pile: tensione ai morsetti (V), corrente erogata (A) e, per l'alimentatore, limite raggiunto (CC). */
  tensione?: number;
  correnteCostante?: boolean;
}

export function aspettoComponenti(
  componenti: readonly ComponenteArduino[],
  nodoDi: NodoDi,
  r: RisultatoCircuito,
  inCorrenteCostante: ReadonlySet<string> = new Set(),
  releEccitati: ReadonlySet<string> = new Set(),
  statiPonti: ReadonlyMap<string, readonly UscitaPonte[]> = new Map(),
): Record<string, AspettoArduino> {
  const v = (n: string) => r.tensioni[n] ?? 0;
  const aspetto: Record<string, AspettoArduino> = {};
  for (const c of componenti) {
    if (c.tipo === "l293d") {
      aspetto[c.id] = { uscite: [...(statiPonti.get(c.id) ?? [APERTA, APERTA, APERTA, APERTA])], alimentato: v(nodoDi(c.id, "VSS")) - v(nodoDi(c.id, "GND1")) > 4.5 };
      continue;
    }
    if (c.tipo === "modulo-rele") {
      aspetto[c.id] = { eccitato: releEccitati.has(c.id), alimentato: v(nodoDi(c.id, "VCC")) - v(nodoDi(c.id, "GND")) > 4 };
      continue;
    }
    if (c.tipo === "lampadina") {
      // Luminosità secondo la potenza rispetto a quella nominale; oltre il doppio si brucia.
      const volt = v(nodoDi(c.id, "1")) - v(nodoDi(c.id, "2"));
      const watt = (volt * volt) / R_LAMPADINA;
      aspetto[c.id] = { luminosita: watt < 0.02 ? 0 : Math.min(1, watt / LAMPADINA_WATT), bruciato: watt > 2 * LAMPADINA_WATT, corrente: Math.abs(volt) / R_LAMPADINA };
      continue;
    }
    if (c.tipo === "transistor-npn") {
      const ib = r.correnti[`${c.id}:BE`] ?? 0;
      const ic = r.correnti[c.id] ?? 0;
      aspetto[c.id] = {
        statoTransistor: ib < 1e-6 ? "interdizione" : r.saturi.has(c.id) ? "saturo" : "attivo",
        correnteBase: ib,
        corrente: ic,
        // Corrente di collettore eccessiva: in un transistor vero si brucerebbe.
        bruciato: ic > CORRENTE_TRANSISTOR_MAX,
      };
    } else if (c.tipo === "diodo") {
      const i = r.correnti[c.id] ?? 0;
      aspetto[c.id] = { corrente: i, alimentato: i >= 1e-4 };
    } else if (c.tipo === "alimentatore" || c.tipo in PILE) {
      const corrente = r.correnti[c.id] ?? 0;
      aspetto[c.id] = {
        tensione: v(nodoDi(c.id, "+")) - v(nodoDi(c.id, "-")),
        // Sotto 0,1 mA il display indica zero (e si nascondono le correnti di dispersione).
        corrente: Math.abs(corrente) < 1e-4 ? 0 : corrente,
        correnteCostante: inCorrenteCostante.has(c.id),
        alimentato: Math.abs(corrente) >= 1e-4,
      };
    } else if (c.tipo === "led") {
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
    } else if (c.tipo === "display-sette-segmenti") {
      const correnti = SEGMENTI_DISPLAY.map((k) => r.correnti[`${c.id}:${k}`] ?? 0);
      const imax = Math.max(...correnti);
      aspetto[c.id] = {
        segmenti: correnti.map((i) => (i >= CORRENTE_LED_MINIMA ? Math.min(1, i / CORRENTE_LED_PIENA) : 0)),
        bruciato: imax > CORRENTE_LED_BRUCIATO,
        corrente: imax,
      };
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

/**
 * Misure dei multimetri: tensione e corrente dal circuito appena risolto;
 * la resistenza come fa uno strumento vero, con il circuito senza
 * alimentazione (generatori tolti) e una piccola pila interna fra V e COM.
 */
export function misureMultimetri(
  componenti: readonly ComponenteArduino[],
  nodoDi: NodoDi,
  interazioni: Interazioni,
  r: RisultatoCircuito,
): Record<string, AspettoArduino> {
  const esito: Record<string, AspettoArduino> = {};
  const v = (n: string) => r.tensioni[n] ?? 0;
  for (const c of componenti) {
    if (c.tipo !== "multimetro") continue;
    const funzione = funzioneMultimetro(interazioni, c);
    const misura =
      funzione === "V"
        ? v(nodoDi(c.id, "V")) - v(nodoDi(c.id, "COM"))
        : funzione === "A"
          ? r.correnti[`${c.id}:A`] ?? 0
          : misuraOhm(componenti, nodoDi, interazioni, c.id);
    esito[c.id] = { funzione, misura };
  }
  return esito;
}

function misuraOhm(componenti: readonly ComponenteArduino[], nodoDi: NodoDi, interazioni: Interazioni, id: string): number {
  const nV = nodoDi(id, "V");
  const nCom = nodoDi(id, "COM");
  if (nV === nCom) return 0;
  const altri = componenti.filter((c) => c.id !== id);
  const elementi: Elemento[] = elementiCircuito(altri, nodoDi, {}, interazioni).filter((e) => e.tipo !== "generatore" && e.tipo !== "alimentatore");
  // Pila interna da 1 V con 1 kΩ in serie; il COM è il riferimento.
  const R_INTERNA = 1000;
  elementi.push({ tipo: "generatore", id: `${id}:pila`, nodo: nV, volt: 1, ohm: R_INTERNA });
  elementi.push({ tipo: "resistenza", id: `${id}:rif`, a: nCom, b: MASSA, ohm: 1e-6 });
  const r = risolviCircuito(elementi);
  const vx = (r.tensioni[nV] ?? 0) - (r.tensioni[nCom] ?? 0);
  const i = (1 - (r.tensioni[nV] ?? 0)) / R_INTERNA;
  if (i <= 0) return Infinity;
  const ohm = vx / i;
  return ohm > OHM_FUORI_SCALA ? Infinity : ohm;
}

/** Testo del display del multimetro, con tre cifre significative e l'unità adatta. */
export function testoMultimetro(funzione: FunzioneMultimetro, misura: number): string {
  if (!Number.isFinite(misura)) return "OL";
  const unita = funzione === "Ω" ? "Ω" : funzione;
  const a = Math.abs(misura);
  const [fattore, prefisso] =
    funzione === "Ω"
      ? a >= 1e6 ? [1e-6, "M"] : a >= 1e3 ? [1e-3, "k"] : [1, ""]
      : a >= 1 || a === 0 ? [1, ""] : a >= 1e-3 ? [1e3, "m"] : [1e6, "µ"];
  const x = misura * fattore;
  const ax = Math.abs(x);
  const cifre = ax >= 100 ? 0 : ax >= 10 ? 1 : 2;
  return `${x.toFixed(cifre).replace(".", ",").replace(/^-(0,0+)$/, "$1")} ${prefisso}${unita}`;
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
