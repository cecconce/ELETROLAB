// Collegamento fra l'editor comune e il motore del modulo Arduino.
//
// Dallo schema disegnato sul banco si ricavano:
// - i nodi elettrici: due morsetti sono lo stesso nodo se li unisce un
//   cavetto, se stanno nello stesso punto (un piedino infilato in un foro
//   della breadboard) o se sono fori collegati internamente dalla breadboard;
// - i componenti con i loro parametri (colore del LED, valore della resistenza).
import {
  ALIMENTATORE_CORRENTE,
  ALIMENTATORE_CORRENTE_MAX,
  ALIMENTATORE_TENSIONE,
  ALIMENTATORE_TENSIONE_MAX,
  DISTANZA_PREDEFINITA,
  SENSORI_A_LIVELLI,
  livelloSensore,
  R_LAMPADINA,
  TEMPERATURA_PREDEFINITA,
  testoMultimetro,
  gruppoForo,
  nomePin,
  pinCollegato,
  tempoArduino,
  type ComponenteArduino,
  type NodoDi,
  type SessioneArduino,
} from "../motori/arduino";
import { t } from "../testi";
import type { Libreria } from "./libreria";
import type { ProblemaMostrato } from "./messaggiProblemi";
import type { AspettoComponente, VistaSimulazione } from "./vistaSimulazione";
import { morsettiDelComponente, type MorsettiDelTipo } from "./fili";
import type { Schema } from "./schema";
import type { DefinizioneParametro } from "./elettronica";

/** Parametri numerici dei componenti Arduino che si impostano nelle Proprietà. */
export const PARAMETRI_ARDUINO: Record<string, DefinizioneParametro[]> = {
  alimentatore: [
    { id: "tensione", nome: t("proprieta.alimentatoreTensione"), tipo: "numero", unita: "V", minimo: 0, massimo: ALIMENTATORE_TENSIONE_MAX },
    { id: "correnteMax", nome: t("proprieta.alimentatoreLimite"), tipo: "numero", unita: "A", minimo: 0.001, massimo: ALIMENTATORE_CORRENTE_MAX },
  ],
};
const PREDEFINITI_ARDUINO: Record<string, Record<string, number>> = {
  alimentatore: { tensione: ALIMENTATORE_TENSIONE, correnteMax: ALIMENTATORE_CORRENTE },
};

/** Valore di un parametro Arduino (quello scritto nel componente o il predefinito). */
export function valoreParametroArduino(parametri: Record<string, number | string> | undefined, tipo: string, id: string): number {
  const v = parametri?.[id];
  return typeof v === "number" ? v : PREDEFINITI_ARDUINO[tipo]?.[id] ?? 0;
}

/** Cifre dei display dell'alimentatore: tensione con due decimali, corrente con tre (come uno strumento vero). */
export function displayAlimentatore(volt: number, ampere: number): { volt: string; ampere: string } {
  return { volt: Math.max(0, volt).toFixed(2), ampere: Math.max(0, Math.abs(ampere)).toFixed(3) };
}

/** Unione dei morsetti in nodi (union-find). */
export function nodiDaSchema(schema: Schema, morsettiDi: MorsettiDelTipo): NodoDi {
  const padre = new Map<string, string>();
  const radice = (k: string): string => {
    let r = k;
    while (padre.has(r) && padre.get(r) !== r) r = padre.get(r)!;
    // compressione del percorso
    let x = k;
    while (padre.has(x) && padre.get(x) !== r) {
      const p = padre.get(x)!;
      padre.set(x, r);
      x = p;
    }
    return r;
  };
  const unisci = (a: string, b: string) => {
    const ra = radice(a);
    const rb = radice(b);
    if (ra !== rb) padre.set(ra, rb);
  };
  const perPosizione = new Map<string, string>();
  for (const c of schema.componenti) {
    for (const m of morsettiDelComponente(c, morsettiDi)) {
      const chiave = `${c.id}/${m.morsetto}`;
      // Piedino infilato in un foro: stesso punto del foglio = stesso nodo.
      const pos = `${m.posizione.x},${m.posizione.y}`;
      const altro = perPosizione.get(pos);
      if (altro) unisci(chiave, altro);
      else perPosizione.set(pos, chiave);
      // Fori collegati dentro la breadboard.
      if (c.tipo === "breadboard") {
        const g = gruppoForo(m.morsetto);
        if (g) unisci(chiave, `${c.id}#${g}`);
      }
    }
  }
  for (const f of schema.fili) unisci(`${f.da.componente}/${f.da.morsetto}`, `${f.a.componente}/${f.a.morsetto}`);
  return (componente, morsetto) => radice(`${componente}/${morsetto}`);
}

/** Componenti dello schema per il motore (i LED portano il colore nel tipo: led-rosso…). */
export function componentiDaSchema(schema: Schema): ComponenteArduino[] {
  return schema.componenti.map((c) => {
    const led = /^led-(\w+)$/.exec(c.tipo);
    if (led && c.tipo !== "led-rgb") return { id: c.id, tipo: "led", colore: led[1] };
    const funzione = c.tipo === "multimetro" && typeof c.parametri?.funzione === "string" ? { funzione: c.parametri.funzione } : {};
    const alimentatore =
      c.tipo === "alimentatore"
        ? { tensione: valoreParametroArduino(c.parametri, c.tipo, "tensione"), correnteMax: valoreParametroArduino(c.parametri, c.tipo, "correnteMax") }
        : {};
    return { id: c.id, tipo: c.tipo, ...(c.valore !== undefined ? { valore: c.valore } : {}), ...funzione, ...alimentatore };
  });
}

/** Legge un valore di resistenza scritto dallo studente: 220, 1k, 4,7k, 4k7, 10 kΩ, 1M. */
export function leggiOhm(testo: string): number | null {
  const t = testo.trim().replace(/\s|Ω|ohm/gi, "").replace(",", ".");
  const m = /^(\d+(?:\.\d+)?)([kKmM]?)(\d*)$/.exec(t);
  if (!m) return null;
  let base = m[1];
  if (m[3]) {
    // notazione 4k7 = 4,7 k
    if (base.includes(".")) return null;
    base = `${base}.${m[3]}`;
  }
  const mult = m[2] === "" ? 1 : m[2].toLowerCase() === "k" ? 1000 : 1e6;
  const v = Number(base) * mult;
  return Number.isFinite(v) && v > 0 && v <= 10e6 ? Math.round(v * 100) / 100 : null;
}

/** Scrive un valore di resistenza come sui cataloghi: 220 Ω, 4,7 kΩ, 1 MΩ. */
export function scriviOhm(ohm: number): string {
  const fmt = (v: number) => String(Math.round(v * 100) / 100).replace(".", ",");
  if (ohm >= 1e6) return `${fmt(ohm / 1e6)} MΩ`;
  if (ohm >= 1000) return `${fmt(ohm / 1000)} kΩ`;
  return `${fmt(ohm)} Ω`;
}

/** Colori delle fasce (codice colori delle resistenze). */
const COLORI_CIFRE = ["#000000", "#795548", "#e53935", "#fb8c00", "#fdd835", "#43a047", "#1e88e5", "#8e24aa", "#9e9e9e", "#ffffff"];
const ORO = "#c9a227";
const ARGENTO = "#b0bec5";

/**
 * Tre fasce colorate per il valore (due cifre e il moltiplicatore) più la
 * fascia oro della tolleranza 5 %: 220 Ω → rosso rosso marrone oro.
 */
export function fasceResistenza(ohm: number): string[] {
  if (!(ohm > 0)) return [COLORI_CIFRE[0], COLORI_CIFRE[0], COLORI_CIFRE[0], ORO];
  let esponente = Math.floor(Math.log10(ohm)) - 1;
  let cifre = Math.round(ohm / Math.pow(10, esponente));
  if (cifre >= 100) {
    cifre = Math.round(cifre / 10);
    esponente++;
  }
  const d1 = Math.floor(cifre / 10);
  const d2 = cifre % 10;
  const mult = esponente === -1 ? ORO : esponente === -2 ? ARGENTO : COLORI_CIFRE[Math.max(0, Math.min(9, esponente))];
  return [COLORI_CIFRE[d1], COLORI_CIFRE[d2], mult, ORO];
}

/** Programma proposto per un nuovo progetto Arduino (il classico Blink). */
export const SKETCH_PREDEFINITO = `// Il primo programma: fa lampeggiare il LED «L» della scheda (pin 13).
// setup() viene eseguita una volta all'accensione, loop() all'infinito.

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);   // il pin 13 diventa un'uscita
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH); // accende il LED
  delay(1000);                     // aspetta un secondo
  digitalWrite(LED_BUILTIN, LOW);  // spegne il LED
  delay(1000);
}
`;

/** Che cosa fa un clic sui componenti del banco durante la simulazione. */
function clicArduino(tipo: string): AspettoComponente["clic"] {
  if (tipo === "pulsante" || tipo === "tastierino") return "pulsante";
  if (tipo === "potenziometro" || tipo === "fotoresistenza" || tipo === "ultrasuoni" || tipo === "tmp36" || tipo === "interruttore-slitta" || tipo === "multimetro" || tipo === "sensore-pir" || tipo === "alimentatore" || tipo === "sensore-inclinazione" || SENSORI_A_LIVELLI.has(tipo)) return "manuale";
  return null;
}

/** Aspetto del banco durante la simulazione, per l'area di disegno. */
export function vistaDaSessioneArduino(s: SessioneArduino, schema: Schema, libreria: Libreria): VistaSimulazione {
  const componenti: Record<string, AspettoComponente> = {};
  for (const c of schema.componenti) {
    const a = s.aspetto[c.id] ?? {};
    const arduino: NonNullable<AspettoComponente["arduino"]> = {};
    if (c.tipo === "led-rgb") {
      arduino.rgb = a.rgb ?? [0, 0, 0];
      arduino.bruciato = a.bruciato ?? false;
    } else if (c.tipo === "display-sette-segmenti") {
      arduino.segmenti = a.segmenti ?? [];
      arduino.bruciato = a.bruciato ?? false;
    } else if (c.tipo.startsWith("led-")) {
      arduino.luminosita = a.luminosita ?? 0;
      arduino.bruciato = a.bruciato ?? false;
    }
    if (c.tipo === "potenziometro") arduino.posizione = s.interazioni.posizioni[c.id] ?? 0.5;
    if (c.tipo === "sensore-inclinazione" || SENSORI_A_LIVELLI.has(c.tipo)) {
      const comp = s.componenti.find((x) => x.id === c.id);
      arduino.posizione = comp ? livelloSensore(s.interazioni, comp) : 0;
    }
    if (c.tipo === "sensore-pir") arduino.posizione = s.interazioni.posizioni[c.id] ?? 0;
    if (c.tipo === "interruttore-slitta") arduino.posizione = s.interazioni.posizioni[c.id] ?? 0;
    if (c.tipo === "tmp36") arduino.temperatura = s.interazioni.temperature[c.id] ?? TEMPERATURA_PREDEFINITA;
    if (c.tipo === "motore-dc") arduino.velocita = a.velocita ?? 0;
    if (c.tipo === "multimetro" && a.funzione) {
      arduino.funzione = a.funzione;
      arduino.lettura = testoMultimetro(a.funzione, a.misura ?? 0);
    }
    if (c.tipo === "transistor-npn") arduino.bruciato = a.bruciato ?? false;
    if (c.tipo === "lampadina") {
      arduino.luminosita = a.luminosita ?? 0;
      arduino.bruciato = a.bruciato ?? false;
    }
    if (c.tipo === "tastierino") arduino.posizione = s.interazioni.premuti.has(c.id) ? s.interazioni.posizioni[c.id] ?? -1 : -1;
    if (c.tipo === "l293d") arduino.uscitePonte = (a.uscite ?? []).map((u) => u.stato);
    if (c.tipo === "modulo-rele") {
      arduino.eccitato = a.eccitato ?? false;
      arduino.alimentato = a.alimentato ?? false;
    }
    if (c.tipo === "alimentatore" || c.tipo === "batteria-9v" || c.tipo === "portapile-4aa") {
      arduino.alimentatore = { volt: a.tensione ?? 0, ampere: a.corrente ?? 0, cc: a.correnteCostante ?? false };
    }
    if (c.tipo === "fotoresistenza") arduino.luce = s.interazioni.luce[c.id] ?? 0.5;
    if (c.tipo === "servo") {
      const pin = pinCollegato(s, c.id, "SIG");
      arduino.angolo = a.alimentato && pin && s.servi[pin] !== undefined ? s.servi[pin] : undefined;
    }
    if (c.tipo === "buzzer") {
      const pin = pinCollegato(s, c.id, "+");
      arduino.suona = a.alimentato === true;
      if (pin && s.toni[pin]) arduino.frequenza = s.toni[pin];
    }
    if (c.tipo === "lcd") {
      const lcd = lcdDelDisplay(s, c.id);
      arduino.righe = a.alimentato && lcd ? lcd.righe : [];
      arduino.retro = a.luminosita ?? 0;
    }
    if (c.tipo === "ultrasuoni") arduino.distanza = s.distanze[c.id] ?? DISTANZA_PREDEFINITA;
    if (c.tipo === "arduino-uno") arduino.ledL = (s.pin.D13?.modo === "OUTPUT" && s.pin.D13.livello > 0) || false;
    componenti[c.id] = {
      clic: clicArduino(c.tipo),
      chiuso: false,
      alimentato: false,
      azionato: s.interazioni.premuti.has(c.id),
      intervenuta: false,
      sovraccarico: false,
      arduino,
    };
  }
  return {
    poliDeiFili: {},
    componenti,
    morsettiInCorto: new Set(),
    tempo: tempoArduino(s),
    problemi: [],
    problemiPlc: problemiArduino(s, schema, libreria),
  };
}

/**
 * Display LiquidCrystal creato dal programma che corrisponde al display sul
 * banco: i suoi RS ed E devono essere collegati ai primi due pin scritti nel
 * costruttore LiquidCrystal(rs, en, …).
 */
function lcdDelDisplay(s: SessioneArduino, id: string): { righe: string[]; pin: number[] } | null {
  const rs = pinCollegato(s, id, "RS");
  const en = pinCollegato(s, id, "E");
  for (const lcd of Object.values(s.lcd)) {
    if (rs && en && nomePin(lcd.pin[0]) === rs && nomePin(lcd.pin[1]) === en) return lcd;
  }
  return null;
}

/** Problemi del programma e del circuito, spiegati in italiano. */
export function problemiArduino(s: SessioneArduino, schema: Schema, libreria: Libreria): ProblemaMostrato[] {
  const problemi: ProblemaMostrato[] = [];
  if (s.errore) {
    problemi.push({
      chiave: "errore-codice",
      gravita: "errore",
      testo: s.errore.riga > 0 ? t("arduino.problema.codice", { riga: s.errore.riga, messaggio: s.errore.message }) : s.errore.message,
      componenti: [],
      morsetti: [],
    });
  }
  if (!s.scheda) problemi.push({ chiave: "senza-scheda", gravita: "avviso", testo: t("arduino.problema.senzaScheda"), componenti: [], morsetti: [] });
  problemi.push(...pinFuoriTensione(s));
  for (const c of schema.componenti) {
    const a = s.aspetto[c.id];
    if (c.tipo === "lcd" && a?.alimentato && Object.keys(s.lcd).length > 0 && !lcdDelDisplay(s, c.id)) {
      const pin = Object.values(s.lcd)[0].pin;
      problemi.push({
        chiave: `lcd-${c.id}`,
        gravita: "avviso",
        testo: t("arduino.problema.lcdNonCollegato", { rs: pin[0] ?? "?", en: pin[1] ?? "?" }),
        componenti: [c.id],
        morsetti: [],
      });
    }
    if (c.tipo === "transistor-npn" && a && (a.correnteBase ?? 0) > CORRENTE_BASE_MAX) {
      problemi.push({
        chiave: `base-${c.id}`,
        gravita: "errore",
        testo: t("arduino.problema.baseSenzaResistenza", { sigla: c.etichetta, corrente: Math.round((a.correnteBase ?? 0) * 1000) }),
        componenti: [c.id],
        morsetti: [],
      });
    }
    if (a?.bruciato && c.tipo === "lampadina") {
      problemi.push({
        chiave: `bruciato-${c.id}`,
        gravita: "errore",
        testo: t("arduino.problema.lampadinaBruciata", { sigla: c.etichetta, volt: ((a.corrente ?? 0) * R_LAMPADINA).toFixed(1).replace(".", ",") }),
        componenti: [c.id],
        morsetti: [],
      });
    } else if (a?.bruciato && c.tipo === "transistor-npn") {
      problemi.push({
        chiave: `bruciato-${c.id}`,
        gravita: "errore",
        testo: t("arduino.problema.transistorBruciato", { sigla: c.etichetta, corrente: Math.round((a.corrente ?? 0) * 1000) }),
        componenti: [c.id],
        morsetti: [],
      });
    } else if (a?.bruciato) {
      const nome = libreria.componenti.find((v) => v.id === c.tipo)?.nome ?? c.tipo;
      problemi.push({
        chiave: `bruciato-${c.id}`,
        gravita: "errore",
        testo: t("arduino.problema.ledBruciato", { nome, corrente: Math.round((a.corrente ?? 0) * 1000) }),
        componenti: [c.id],
        morsetti: [],
      });
    }
  }
  return problemi;
}

/** Corrente di base oltre la quale manca la resistenza di base (A): un pin ne dà al massimo 20–40 mA. */
const CORRENTE_BASE_MAX = 0.02;

/** Pin digitali e analogici della scheda Uno, con il nome scritto sulla scheda. */
const PIN_SCHEDA = [...Array.from({ length: 14 }, (_, i) => [`D${i}`, String(i)]), ...Array.from({ length: 6 }, (_, i) => [`A${i}`, `A${i}`])];

/**
 * Pin che ricevono una tensione fuori dai limiti (più di 5,5 V o meno di
 * −0,5 V): con l'alimentatore o le pile si può portare su un pin più di quanto
 * sopporta, e la scheda vera si rovinerebbe. La simulazione continua (come in
 * Tinkercad) ma lo studente viene avvisato.
 */
export function pinFuoriTensione(s: SessioneArduino): ProblemaMostrato[] {
  if (!s.scheda) return [];
  const esito: ProblemaMostrato[] = [];
  for (const [pin, nome] of PIN_SCHEDA) {
    const nodo = s.nodoDi(s.scheda, pin);
    if (s.risultato.flottanti.has(nodo)) continue;
    const volt = s.risultato.tensioni[nodo];
    if (volt === undefined || (volt <= 5.5 && volt >= -0.5)) continue;
    esito.push({
      chiave: `pin-tensione-${pin}`,
      gravita: "errore",
      testo: t(volt > 0 ? "arduino.problema.pinSopra5V" : "arduino.problema.pinNegativo", { pin: nome, volt: volt.toFixed(1).replace(".", ",") }),
      componenti: [s.scheda],
      morsetti: [],
    });
  }
  return esito;
}

/** Firma della vista Arduino: cambia solo quando cambia qualcosa di visibile. */
export function firmaArduino(s: SessioneArduino): string {
  return `${s.versione}|${s.seriale.length}|${s.errore?.message ?? ""}`;
}
