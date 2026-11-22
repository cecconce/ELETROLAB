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
  tastoNelPunto,
  livelloSensore,
  ALIMENTATORE_TENSIONE_MAX,
  letturaAnalogica,
  risolviBanco,
  tensioneAlimentatore,
  letturaDigitale,
  PIN_PWM,
  TEMPERATURA_PREDEFINITA,
  type AspettoArduino,
  type ComponenteArduino,
  type Interazioni,
  type NodoDi,
  type StatoPin,
  type StatoRegistro,
  USCITE_595,
} from "./componenti";
import { ErroreArduino, preparaSketch, type Esecutore, type Hardware } from "./linguaggio";
import { periodoPwmUs, type CampioneOscilloscopio } from "./oscilloscopio";

/** Distanza iniziale dell'ostacolo davanti al sensore a ultrasuoni (cm). */
export const DISTANZA_PREDEFINITA = 50;

// Zona di rilevamento del sensore a ultrasuoni, disegnata in simulazione sopra
// il sensore (come in Tinkercad): un ventaglio con l'ostacolo da trascinare.
// Coordinate nel disegno del sensore (140 × 80): le capsule sono in alto, al
// centro (x = 70); la zona va da y = 0 verso l'alto per ZONA_ALTEZZA pixel.
/** Distanza minima e massima misurata dall'HC-SR04 (cm). */
export const DISTANZA_MIN = 2;
export const DISTANZA_MAX = 400;
/** Altezza della zona di rilevamento sopra il sensore (pixel del foglio). */
export const ZONA_ALTEZZA = 220;
/** Centro orizzontale del sensore, da dove parte il ventaglio. */
export const ZONA_CENTRO_X = 70;

/**
 * Distanza (cm, intera) corrispondente a un punto della zona di rilevamento.
 * La scala è quadratica: vicino al sensore 1 pixel vale meno di 1 cm (si
 * regolano bene 10, 15, 20 cm), lontano i passi sono più larghi. Un punto
 * sotto il bordo del sensore vale la distanza minima, oltre la zona la massima.
 */
export function distanzaDaPunto(y: number): number {
  const f = Math.min(1, Math.max(0, -y / ZONA_ALTEZZA));
  return Math.round(DISTANZA_MIN + (DISTANZA_MAX - DISTANZA_MIN) * f * f);
}

/** Inversa di `distanzaDaPunto`: quota (y, negativa) dell'ostacolo a quella distanza. */
export function puntoDaDistanza(d: number): number {
  const dd = Math.min(DISTANZA_MAX, Math.max(DISTANZA_MIN, d));
  return -ZONA_ALTEZZA * Math.sqrt((dd - DISTANZA_MIN) / (DISTANZA_MAX - DISTANZA_MIN));
}

// Cursore della temperatura del sensore TMP36, disegnato in simulazione sopra
// il sensore (come in Tinkercad): una barra da −40 a 125 °C con la manopola da
// trascinare. Coordinate nel disegno del sensore (40 × 60): la barra è centrata
// sul sensore (x = 20) e sta CURSORE_Y pixel sopra il suo bordo superiore.
/** Temperature minima e massima misurate dal TMP36 (°C). */
export const TEMPERATURA_MIN = -40;
export const TEMPERATURA_MAX = 125;
/** Larghezza della barra del cursore (pixel del foglio). */
export const CURSORE_LARGHEZZA = 220;
/** Centro orizzontale del sensore di temperatura. */
export const CURSORE_CENTRO_X = 20;
/** Quota della barra del cursore (negativa: sopra il sensore). */
export const CURSORE_Y = -34;
/** Un clic più in alto di questa quota è sul cursore, non sul sensore. */
export const CURSORE_BORDO = -10;

/**
 * Temperatura (°C, intera) corrispondente a un punto orizzontale del cursore.
 * Scala lineare: 220 pixel per 165 gradi, circa 1,3 pixel per grado; fuori
 * dalla barra vale l'estremo più vicino.
 */
export function temperaturaDaPunto(x: number): number {
  const sinistra = CURSORE_CENTRO_X - CURSORE_LARGHEZZA / 2;
  const f = Math.min(1, Math.max(0, (x - sinistra) / CURSORE_LARGHEZZA));
  return Math.round(TEMPERATURA_MIN + (TEMPERATURA_MAX - TEMPERATURA_MIN) * f);
}

/** Inversa di `temperaturaDaPunto`: ascissa della manopola a quella temperatura. */
export function puntoDaTemperatura(gradi: number): number {
  const g = Math.min(TEMPERATURA_MAX, Math.max(TEMPERATURA_MIN, gradi));
  return CURSORE_CENTRO_X - CURSORE_LARGHEZZA / 2 + (CURSORE_LARGHEZZA * (g - TEMPERATURA_MIN)) / (TEMPERATURA_MAX - TEMPERATURA_MIN);
}

// Manopola del potenziometro girata trascinando (come in Tinkercad): l'angolo
// del puntatore attorno al centro della manopola dà la posizione del cursore.
// Coordinate nel disegno del potenziometro: manopola al punto (20, 15).
/** Centro della manopola del potenziometro. */
export const MANOPOLA_X = 20;
export const MANOPOLA_Y = 15;
/** Corsa della manopola: da −135° (tutto a sinistra) a +135° (tutto a destra), 0° in alto. */
export const MANOPOLA_CORSA = 135;
/** Spostamento minimo (pixel del foglio) prima che il trascinamento giri la manopola: un clic fermo resta un clic. */
export const SOGLIA_TRASCINAMENTO = 4;

/**
 * Posizione del potenziometro (0 = tutto a sinistra, 1 = tutto a destra)
 * indicata da un punto attorno alla manopola. L'angolo si misura dall'alto in
 * senso orario. Nella zona morta in basso (oltre ±135°, dove la manopola non
 * arriva) si resta all'estremo più vicino alla posizione attuale, così passando
 * sotto la manopola il valore non salta da 0 a 1.
 */
export function posizioneDaPunto(x: number, y: number, attuale = 0.5): number {
  const dx = x - MANOPOLA_X;
  const dy = y - MANOPOLA_Y;
  if (Math.hypot(dx, dy) < 2) return attuale; // troppo vicino al centro: angolo incerto
  const gradi = (Math.atan2(dx, -dy) * 180) / Math.PI; // 0 in alto, positivo a destra
  if (Math.abs(gradi) > MANOPOLA_CORSA) return attuale >= 0.5 ? 1 : 0;
  return Math.round(((gradi + MANOPOLA_CORSA) / (2 * MANOPOLA_CORSA)) * 1000) / 1000;
}

// Cursori continui degli altri sensori (come in Tinkercad): fotoresistenza,
// sensore di forza, umidità del terreno, gas e PIR. Stessa barra del sensore
// di temperatura (larga CURSORE_LARGHEZZA, alla quota CURSORE_Y sopra il
// sensore), centrata sul disegno di ciascun sensore. Il valore va da 0 a 1 a
// passi dell'1 %, così si regola "al punto" e non più a 5 livelli.
/** Sensori con il cursore continuo e centro orizzontale del loro disegno. */
export const SENSORI_A_CURSORE: Readonly<Record<string, number>> = {
  fotoresistenza: 10,
  "sensore-forza": 20,
  "sensore-umidita": 40,
  "sensore-gas": 40,
  "sensore-pir": 40,
};

/** Centro orizzontale del cursore di un sensore (il TMP36 ha il suo). */
export function centroCursore(tipo: string): number {
  return SENSORI_A_CURSORE[tipo] ?? CURSORE_CENTRO_X;
}

/** Livello (0…1, al centesimo) indicato da un punto orizzontale del cursore centrato in `centro`. */
export function livelloDaPunto(x: number, centro: number): number {
  const sinistra = centro - CURSORE_LARGHEZZA / 2;
  const f = Math.min(1, Math.max(0, (x - sinistra) / CURSORE_LARGHEZZA));
  return Math.round(f * 100) / 100;
}

/** Inversa di `livelloDaPunto`: ascissa della manopola a quel livello. */
export function puntoDaLivello(livello: number, centro: number): number {
  return centro - CURSORE_LARGHEZZA / 2 + CURSORE_LARGHEZZA * Math.min(1, Math.max(0, livello));
}

// Sensore PIR: il cursore sposta una persona che cammina davanti al sensore,
// da 0 (attaccata) a PIR_DISTANZA_MAX cm. Come l'HC-SR501 con il trimmer
// della portata al massimo, «vede» il movimento fino a PIR_PORTATA cm.
/** Distanza massima della persona sul cursore (cm): all'estremo destro non c'è nessuno vicino. */
export const PIR_DISTANZA_MAX = 1000;
/** Portata del sensore PIR (cm): più vicino di così il movimento è rilevato. */
export const PIR_PORTATA = 700;

/** Distanza della persona davanti al PIR (cm, a passi di 10 cm) per un livello del cursore. */
export function distanzaPirDaLivello(livello: number): number {
  return Math.round((Math.min(1, Math.max(0, livello)) * PIR_DISTANZA_MAX) / 10) * 10;
}

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
  /** Oscilloscopi: campioni (tempo in µs, tensione fra + e − in V), i più vecchi in testa. */
  campioni: Record<string, CampioneOscilloscopio[]>;
  /** Colori inviati con show() alle strisce NeoPixel, per pin del dato (0xRRGGBB). */
  neopixel: Record<string, number[]>;
  /** Contenuto dei display creati dal programma, con i pin del costruttore. */
  lcd: Record<string, { righe: string[]; pin: number[]; i2c?: { indirizzo: number; retro: boolean } }>;
  seriale: string;
  ingressoSeriale: number[];
  /** Distanza dell'ostacolo davanti a ogni sensore a ultrasuoni e della persona davanti a ogni PIR (cm). */
  distanze: Record<string, number>;
  /** Sensori con la zona di regolazione aperta (clic sul sensore la apre e la chiude): ostacolo degli ultrasuoni, cursori di temperatura, luce, forza, umidità, gas e PIR. */
  zoneAperte: Set<string>;
  /** Punto in cui è stato premuto ogni componente (per distinguere il clic dal trascinamento della manopola). */
  pressioni: Record<string, { x: number; y: number; girando: boolean }>;
  interazioni: { premuti: Set<string>; posizioni: Record<string, number>; luce: Record<string, number>; temperature: Record<string, number>; registri: Record<string, StatoRegistro> };
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
  const registri = s.componenti.filter((c) => c.tipo === "74hc595");
  if (registri.length) aggiornaRegistri(s, registri);
  const oscilloscopi = s.componenti.filter((c) => c.tipo === "oscilloscopio");
  const { risultato, inCorrenteCostante, releEccitati, statiPonti } = risolviBanco(s.componenti, s.nodoDi, s.pin, interazioni, s.releEccitati);
  s.risultato = risultato;
  s.releEccitati = releEccitati;
  s.aspetto = { ...aspettoComponenti(s.componenti, s.nodoDi, s.risultato, inCorrenteCostante, releEccitati, statiPonti), ...misureMultimetri(s.componenti, s.nodoDi, interazioni, s.risultato) };
  s.sporco = false;
  s.versione++;
  if (oscilloscopi.length) campiona(s, oscilloscopi, true);
}

/** Durata massima della registrazione degli oscilloscopi (µs): 10 divisioni da 1 s. */
const REGISTRAZIONE_US = 10e6;
const CAMPIONI_MASSIMI = 4000;

/**
 * Aggiunge un campione a ogni oscilloscopio. Con `calcolato` le tensioni sono
 * quelle del circuito appena risolto; altrimenti (un pin è appena cambiato) un
 * puntale collegato direttamente a un pin in uscita prende subito il nuovo
 * livello, così i fronti delle onde quadre cadono nel momento giusto.
 */
function campiona(s: SessioneArduino, oscilloscopi: readonly ComponenteArduino[], calcolato: boolean) {
  const t = s.esecutore?.tempoUs ?? 0;
  const tensione = (nodo: string) => {
    if (!calcolato && s.scheda) {
      for (const [p, st] of Object.entries(s.pin)) if (st.modo === "OUTPUT" && s.nodoDi(s.scheda, p) === nodo) return 5 * st.livello;
    }
    return s.risultato.tensioni[nodo] ?? 0;
  };
  for (const c of oscilloscopi) {
    const lista = (s.campioni[c.id] ??= []);
    const piu = s.nodoDi(c.id, "+");
    const vMeno = tensione(s.nodoDi(c.id, "-"));
    const v = tensione(piu) - vMeno;
    // Puntale + su un pin in PWM (analogWrite): si registra anche l'onda quadra
    // (0 V / 5 V rispetto alla massa della scheda), così la traccia la mostra.
    let pwm: CampioneOscilloscopio["pwm"];
    if (s.scheda) {
      for (const [p, st] of Object.entries(s.pin)) {
        if (st.modo === "OUTPUT" && st.livello > 0 && st.livello < 1 && s.nodoDi(s.scheda, p) === piu) {
          pwm = { duty: st.livello, alto: 5 - vMeno, basso: -vMeno, periodoUs: periodoPwmUs(p) };
        }
      }
    }
    const nuovo: CampioneOscilloscopio = pwm ? { t, v, pwm } : { t, v };
    const ultimo = lista[lista.length - 1];
    const stessoPwm = (ultimo?.pwm?.duty ?? -1) === (pwm?.duty ?? -1);
    if (ultimo && ultimo.t === t) lista[lista.length - 1] = nuovo;
    else if (!ultimo || Math.abs(ultimo.v - v) > 1e-3 || !stessoPwm || t - ultimo.t > 5000) lista.push(nuovo);
    while (lista.length > CAMPIONI_MASSIMI || (lista.length > 2 && t - lista[1].t > REGISTRAZIONE_US)) lista.shift();
  }
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
    neopixel: {},
    campioni: {},
    lcd: {},
    distanze: {},
    zoneAperte: new Set(),
    pressioni: {},
    seriale: "",
    ingressoSeriale: [],
    interazioni: { premuti: new Set(), posizioni: {}, luce: {}, temperature: {}, registri: {} },
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
    // I registri a scorrimento reagiscono subito ai fronti (shiftOut ne fa 16 di fila).
    if (registri.length) aggiornaRegistri(s, registri);
    // Gli oscilloscopi registrano il fronte nel momento esatto in cui il pin cambia.
    if (oscilloscopi.length) campiona(s, oscilloscopi, false);
  };
  const oscilloscopi = componenti.filter((c) => c.tipo === "oscilloscopio");
  const registri = componenti.filter((c) => c.tipo === "74hc595");
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
    neopixel(pin, colori) {
      s.neopixel[pin] = colori;
      s.versione++;
    },
    lcd(nome, righe, _colonne, pin, i2c) {
      s.lcd[nome] = { righe, pin, ...(i2c ? { i2c } : {}) };
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
  else {
    // La traccia continua anche quando non cambia niente.
    const oscilloscopi = s.componenti.filter((c) => c.tipo === "oscilloscopio");
    if (oscilloscopi.length) {
      campiona(s, oscilloscopi, true);
      s.versione++;
    }
  }
}

/**
 * Livello logico di un nodo per i circuiti integrati digitali: se il nodo è un
 * pin della scheda in uscita (o 5V, 3,3V, GND) si usa direttamente quello,
 * senza ricalcolare il circuito; altrimenti la tensione dell'ultimo calcolo.
 */
function livelloNodo(s: SessioneArduino, nodo: string): number {
  if (s.scheda) {
    for (const [p, st] of Object.entries(s.pin)) if (st.modo === "OUTPUT" && s.nodoDi(s.scheda, p) === nodo) return st.livello >= 0.5 ? 1 : 0;
    if (s.nodoDi(s.scheda, "5V") === nodo || s.nodoDi(s.scheda, "3V3") === nodo) return 1;
    if (["GND1", "GND2", "GND3"].some((g) => s.nodoDi(s.scheda!, g) === nodo)) return 0;
  }
  return (s.risultato.tensioni[nodo] ?? 0) > 2.5 ? 1 : 0;
}

/**
 * 74HC595: sul fronte di salita di SH_CP il registro scorre (Q0 prende DS),
 * sul fronte di salita di ST_CP il registro di uscita copia quello di
 * scorrimento; MR a LOW lo azzera; OE a LOW abilita le uscite.
 */
function aggiornaRegistri(s: SessioneArduino, registri: readonly ComponenteArduino[]) {
  for (const c of registri) {
    const n = (m: string) => livelloNodo(s, s.nodoDi(c.id, m));
    const st = s.interazioni.registri[c.id] ?? { scorrimento: 0, uscite: 0, abilitato: false, clock: 0, latch: 0 };
    const clock = n("SHCP");
    const latch = n("STCP");
    let scorrimento = st.scorrimento;
    if (n("MR") === 0) scorrimento = 0;
    else if (clock === 1 && st.clock === 0) scorrimento = ((scorrimento << 1) | n("DS")) & 0xff;
    const uscite = latch === 1 && st.latch === 0 ? scorrimento : st.uscite;
    const alimentato = n("VCC") === 1 && n("GND") === 0;
    const nuovo: StatoRegistro = { scorrimento, uscite, abilitato: alimentato && n("OE") === 0, clock, latch };
    const visibile = nuovo.uscite !== st.uscite || nuovo.abilitato !== st.abilitato || (nuovo.scorrimento >> 7) !== (st.scorrimento >> 7);
    s.interazioni.registri[c.id] = nuovo;
    if (visibile) s.sporco = true;
  }
}

/** Uscite del registro come testo di bit (Q7…Q0), per i messaggi e i test. */
export function bitRegistro(s: SessioneArduino, id: string): string {
  const u = s.interazioni.registri[id]?.uscite ?? 0;
  return USCITE_595.map((_, i) => (u >> (7 - i)) & 1).join("");
}

/** Tempo trascorso dall'accensione (secondi). */
export function tempoArduino(s: SessioneArduino): number {
  return (s.esecutore?.tempoUs ?? 0) / 1e6;
}

/** Pressione del mouse su un componente: pulsante premuto, manopola girata, luce cambiata. */
export function clicGiuArduino(s: SessioneArduino, id: string, indietro = false, punto?: { x: number; y: number }): void {
  const c = s.componenti.find((x) => x.id === id);
  if (!c) return;
  if (c.tipo === "pulsante") s.interazioni.premuti.add(id);
  else if (c.tipo === "tastierino") {
    // Il tasto sotto il mouse resta premuto finché non si rilascia.
    const tasto = punto ? tastoNelPunto(punto.x, punto.y) : null;
    if (tasto === null) return;
    s.interazioni.posizioni[id] = tasto;
    s.interazioni.premuti.add(id);
  }
  else if (c.tipo === "potenziometro") {
    // Il clic fa ancora un passo del 10 % (a destra o a sinistra della
    // manopola); se poi il puntatore si muove, la manopola segue il trascinamento.
    if (punto) s.pressioni[id] = { x: punto.x, y: punto.y, girando: false };
    const pos = s.interazioni.posizioni[id] ?? 0.5;
    s.interazioni.posizioni[id] = Math.round(Math.min(1, Math.max(0, pos + (indietro ? -0.1 : 0.1))) * 10) / 10;
  } else if (c.tipo === "ultrasuoni") {
    // Clic nella zona di rilevamento (sopra il sensore): l'ostacolo va lì e
    // si può trascinare; clic sul sensore: la zona si apre o si chiude, come
    // in Tinkercad (chiusa non copre i componenti che stanno sopra).
    if (punto && punto.y < 0) impostaDistanza(s, id, distanzaDaPunto(punto.y));
    else {
      if (s.zoneAperte.has(id)) s.zoneAperte.delete(id);
      else s.zoneAperte.add(id);
      s.versione++;
    }
    return;
  } else if (c.tipo === "tmp36" || c.tipo in SENSORI_A_CURSORE) {
    // Come in Tinkercad: clic sul sensore apre (o chiude) il suo cursore
    // sopra di lui; clic o trascinamento sulla barra regola il valore
    // (temperatura, luce, forza, umidità, gas, distanza della persona).
    if (punto && punto.y < CURSORE_BORDO && s.zoneAperte.has(id)) regolaCursore(s, c, punto.x);
    else {
      if (s.zoneAperte.has(id)) s.zoneAperte.delete(id);
      else s.zoneAperte.add(id);
      s.versione++;
    }
    return;
  } else if (c.tipo === "multimetro") {
    // Il selettore passa alla funzione seguente (o precedente con il clic destro).
    const n = FUNZIONI_MULTIMETRO.length;
    s.interazioni.posizioni[id] = (indiceFunzioneMultimetro(s.interazioni, c) + (indietro ? n - 1 : 1)) % n;
  } else if (c.tipo === "alimentatore") {
    // Manopola della tensione: +0,5 V con il clic, −0,5 V con il clic dalla parte sinistra.
    const ora = tensioneAlimentatore(s.interazioni, c);
    const nuova = Math.round((ora + (indietro ? -ALIMENTATORE_PASSO : ALIMENTATORE_PASSO)) / ALIMENTATORE_PASSO) * ALIMENTATORE_PASSO;
    s.interazioni.posizioni[id] = Math.min(ALIMENTATORE_TENSIONE_MAX, Math.max(0, nuova));
  } else if (c.tipo === "interruttore-slitta" || c.tipo === "sensore-inclinazione") {
    s.interazioni.posizioni[id] = (s.interazioni.posizioni[id] ?? 0) >= 0.5 ? 0 : 1;
  } else return;
  ricalcola(s);
}

/** Nuova distanza dell'ostacolo davanti al sensore (cm, fra 2 e 400). */
function impostaDistanza(s: SessioneArduino, id: string, d: number): void {
  const nuova = Math.min(DISTANZA_MAX, Math.max(DISTANZA_MIN, Math.round(d)));
  if (s.distanze[id] === nuova) return;
  s.distanze[id] = nuova;
  s.versione++;
}

/** Nuova temperatura del sensore (°C, fra −40 e 125): il circuito si ricalcola. */
function impostaTemperatura(s: SessioneArduino, id: string, gradi: number): void {
  const nuova = Math.min(TEMPERATURA_MAX, Math.max(TEMPERATURA_MIN, Math.round(gradi)));
  if ((s.interazioni.temperature[id] ?? TEMPERATURA_PREDEFINITA) === nuova) return;
  s.interazioni.temperature[id] = nuova;
  s.versione++;
  ricalcola(s);
}

/** Punto orizzontale scelto sulla barra del cursore di un sensore: nuovo valore. */
function regolaCursore(s: SessioneArduino, c: ComponenteArduino, x: number): void {
  if (c.tipo === "tmp36") impostaTemperatura(s, c.id, temperaturaDaPunto(x));
  else impostaLivelloSensore(s, c.id, livelloDaPunto(x, centroCursore(c.tipo)));
}

/**
 * Livello attuale del cursore di un sensore (0…1): luce della fotoresistenza,
 * forza, umidità, gas o, per il PIR, distanza della persona sulla scala.
 */
export function livelloCursore(s: SessioneArduino, c: ComponenteArduino): number {
  if (c.tipo === "fotoresistenza") return s.interazioni.luce[c.id] ?? 0.5;
  if (c.tipo === "sensore-pir") return (s.distanze[c.id] ?? PIR_DISTANZA_MAX) / PIR_DISTANZA_MAX;
  return livelloSensore(s.interazioni, c);
}

/**
 * Nuovo livello (0…1) di un sensore con il cursore; il circuito si ricalcola.
 * Usata dal cursore e utile ai test. Per il PIR il livello è la distanza della
 * persona: dentro la portata l'uscita va a HIGH.
 */
export function impostaLivelloSensore(s: SessioneArduino, id: string, livello: number): void {
  const c = s.componenti.find((x) => x.id === id);
  if (!c || !(c.tipo in SENSORI_A_CURSORE)) return;
  const nuovo = Math.round(Math.min(1, Math.max(0, livello)) * 100) / 100;
  if (Math.abs(livelloCursore(s, c) - nuovo) < 1e-9) return;
  if (c.tipo === "fotoresistenza") s.interazioni.luce[id] = nuovo;
  else if (c.tipo === "sensore-pir") {
    const d = distanzaPirDaLivello(nuovo);
    s.distanze[id] = d;
    s.interazioni.posizioni[id] = d <= PIR_PORTATA ? 1 : 0;
  } else s.interazioni.posizioni[id] = nuovo;
  s.versione++;
  ricalcola(s);
}

/**
 * Trascinamento con il tasto premuto su un componente (punto nel suo disegno),
 * come in Tinkercad: sposta l'ostacolo davanti al sensore a ultrasuoni o la
 * manopola del cursore dei sensori (temperatura, luce, forza, umidità, gas,
 * PIR), solo se il cursore è aperto.
 */
export function trascinaArduino(s: SessioneArduino, id: string, punto: { x: number; y: number }): void {
  const c = s.componenti.find((x) => x.id === id);
  if (c?.tipo === "ultrasuoni") impostaDistanza(s, id, distanzaDaPunto(punto.y));
  else if (c && (c.tipo === "tmp36" || c.tipo in SENSORI_A_CURSORE) && s.zoneAperte.has(id)) regolaCursore(s, c, punto.x);
  else if (c?.tipo === "potenziometro") {
    // La manopola gira solo dopo qualche pixel di movimento: il tremolio di un
    // clic (o di un dito sulla LIM) non la sposta.
    const p = s.pressioni[id];
    if (p && !p.girando && Math.hypot(punto.x - p.x, punto.y - p.y) < SOGLIA_TRASCINAMENTO) return;
    if (p) p.girando = true;
    const ora = s.interazioni.posizioni[id] ?? 0.5;
    const nuova = posizioneDaPunto(punto.x, punto.y, ora);
    if (nuova === ora) return;
    s.interazioni.posizioni[id] = nuova;
    s.versione++;
    ricalcola(s);
  }
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
