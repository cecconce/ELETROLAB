// Collegamento fra l'editor comune e il motore del modulo Arduino.
//
// Dallo schema disegnato sul banco si ricavano:
// - i nodi elettrici: due morsetti sono lo stesso nodo se li unisce un
//   cavetto, se stanno nello stesso punto (un piedino infilato in un foro
//   della breadboard) o se sono fori collegati internamente dalla breadboard;
// - i componenti con i loro parametri (colore del LED, valore della resistenza).
import { gruppoForo, type ComponenteArduino, type NodoDi } from "../motori/arduino";
import { morsettiDelComponente, type MorsettiDelTipo } from "./fili";
import type { Schema } from "./schema";

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
    if (led) return { id: c.id, tipo: "led", colore: led[1] };
    return { id: c.id, tipo: c.tipo, ...(c.valore !== undefined ? { valore: c.valore } : {}) };
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
