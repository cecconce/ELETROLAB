// Sessione di simulazione del modulo Elettronica (pura: nessuna interfaccia).
//
// Traduce i componenti dello schema (con i loro parametri) negli elementi del
// simulatore circuitale e fa scorrere il tempo con l'analisi nel tempo
// (transitorio). Gestisce gli strumenti virtuali:
// - multimetro: voltmetro (10 MΩ), amperometro (0,01 Ω), ohmmetro (misura a
//   circuito spento con una piccola corrente di prova, come quello vero);
// - oscilloscopio a due canali: tiene la storia delle tensioni A e B
//   rispetto al morsetto COM, da mostrare nella finestra del grafico;
// e le azioni dello studente (interruttori, pulsanti, potenziometri).
//
// È un oggetto mutabile: l'interfaccia lo tiene in un ref e chiama
// `passoElettronica` a intervalli regolari.
import {
  analisiDC,
  DIODO_SILICIO,
  LED_ROSSO,
  LED_VERDE,
  MASSA,
  nuovoStatoTransitorio,
  passoTransitorio,
  zener,
  type Elemento,
  type ModelloDiodo,
  type Onda,
  type Soluzione,
  type StatoTransitorio,
} from "./simulatore";
import { analisiAC, frequenzeLogaritmiche } from "./simulatore";
import { aggiornaDigitale, eDigitale, nuovoStatoDigitale, PIEDINI_DIGITALI, R_INGRESSO, R_USCITA, VCC_LOGICA, type StatoDigitale } from "./digitale";

/** Componente dello schema come lo vede il motore. */
export interface ComponenteElettronico {
  id: string;
  tipo: string;
  parametri: Record<string, number | string>;
}

/** Nodo elettrico a cui è collegato un morsetto. */
export type NodoDi = (componente: string, morsetto: string) => string;

/** Modelli dei LED secondo il colore (tensione di soglia crescente: rosso < giallo < verde < blu). */
export const MODELLI_LED: Record<string, ModelloDiodo> = {
  rosso: LED_ROSSO,
  giallo: { is: 3e-20, n: 1.6, rs: 5 },
  verde: LED_VERDE,
  blu: { is: 1.2e-27, n: 2, rs: 8 },
};

/** Corrente oltre la quale un LED si brucia (A). */
export const CORRENTE_LED_MASSIMA = 0.05;
/** Corrente a cui un LED è pienamente acceso (A). */
const CORRENTE_LED_PIENA = 0.015;
/** Corrente erogata da un generatore oltre la quale si segnala un cortocircuito (A). */
export const CORRENTE_CORTO = 5;
/** Campioni tenuti nella storia di ogni oscilloscopio. */
export const CAMPIONI_OSCILLOSCOPIO = 6000;
/** Passi di calcolo al massimo per ogni scatto dell'orologio (il tempo simulato può rallentare). */
const PASSI_MASSIMI = 400;

/** Valore predefinito di ogni parametro, per tipo di componente. */
export const PARAMETRI_PREDEFINITI: Record<string, Record<string, number | string>> = {
  "generatore-dc": { tensione: 5 },
  "generatore-corrente": { corrente: 0.01 },
  "generatore-funzioni": { forma: "sinusoide", frequenza: 1000, ampiezza: 1, offset: 0 },
  resistenza: { resistenza: 1000 },
  potenziometro: { resistenza: 10000 },
  condensatore: { capacita: 1e-6 },
  induttore: { induttanza: 1e-3 },
  lampadina: { tensione: 12, potenza: 1.2 },
  zener: { tensione: 5.1 },
  led: { colore: "rosso" },
  "transistor-npn": { beta: 100 },
  "transistor-pnp": { beta: 100 },
  "mosfet-n": { soglia: 2 },
  "mosfet-p": { soglia: 2 },
  operazionale: { saturazione: 12 },
  regolatore: { tensione: 5 },
  multimetro: { modalita: "V" },
  "generatore-clock": { frequenza: 1 },
};

/** Parametro numerico (con il valore predefinito se manca o non è valido). */
function num(c: ComponenteElettronico, nome: string): number {
  const v = c.parametri[nome];
  const p = PARAMETRI_PREDEFINITI[c.tipo]?.[nome];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  return typeof p === "number" ? p : 0;
}
function testo(c: ComponenteElettronico, nome: string): string {
  const v = c.parametri[nome];
  return typeof v === "string" ? v : String(PARAMETRI_PREDEFINITI[c.tipo]?.[nome] ?? "");
}

export interface SessioneElettronica {
  componenti: ComponenteElettronico[];
  nodoDi: NodoDi;
  /** Tempo simulato (s). */
  tempo: number;
  /** Passo di calcolo (s), scelto secondo la frequenza più alta dei generatori. */
  dt: number;
  transitorio: StatoTransitorio;
  soluzione: Soluzione | null;
  interazioni: {
    /** Interruttori chiusi. */
    chiusi: Set<string>;
    /** Pulsanti tenuti premuti. */
    premuti: Set<string>;
    /** Posizione del cursore dei potenziometri (0…1). */
    posizioni: Record<string, number>;
  };
  /** LED bruciati (restano bruciati fino al riavvio). */
  bruciati: Set<string>;
  /** Storia di ogni oscilloscopio: tempi e tensioni dei canali A e B. */
  oscilloscopi: Record<string, Storia>;
  /** Letture dei multimetri (valore e unità) o null se fuori scala. */
  letture: Record<string, { valore: number | null; unita: string }>;
  /** Stato dei componenti digitali (livelli di ingressi e uscite, memoria). */
  digitali: Record<string, StatoDigitale>;
  /** Storia di ogni analizzatore logico: tempi e livelli dei canali D0…D3. */
  analizzatori: Record<string, Storia>;
  /** Il circuito non ha la massa. */
  senzaMassa: boolean;
  /** Il calcolo non è riuscito a trovare una soluzione all'ultimo passo. */
  nonConverge: boolean;
  /** Generatori in cortocircuito (corrente eccessiva). */
  inCorto: Set<string>;
  /** Cambia a ogni modifica visibile. */
  versione: number;
}

/**
 * Storia dei campioni di uno strumento (oscilloscopio, analizzatore logico).
 * Due registrazioni: quella "fine" con tutti i campioni degli ultimi passi
 * (per i segnali veloci) e quella "lenta" con un campione ogni 2 ms per gli
 * ultimi 12 s (per le basi dei tempi lunghe, come la carica di un condensatore).
 */
export interface Storia {
  t: number[];
  canali: number[][];
  lenta: { t: number[]; canali: number[][] };
}
/** Distanza fra i campioni della registrazione lenta (s). */
export const PASSO_STORIA_LENTA = 2e-3;

function nuovaStoria(canali: number): Storia {
  return { t: [], canali: Array.from({ length: canali }, () => []), lenta: { t: [], canali: Array.from({ length: canali }, () => []) } };
}

function aggiungi(r: { t: number[]; canali: number[][] }, tempo: number, valori: number[]) {
  r.t.push(tempo);
  valori.forEach((v, k) => r.canali[k].push(v));
  // Si accorcia ogni tanto (non a ogni campione) per non spostare migliaia di valori a ogni passo.
  if (r.t.length > CAMPIONI_OSCILLOSCOPIO * 1.25) {
    const via = r.t.length - CAMPIONI_OSCILLOSCOPIO;
    r.t.splice(0, via);
    for (const c of r.canali) c.splice(0, via);
  }
}

function registra(storia: Storia, tempo: number, valori: number[]) {
  aggiungi(storia, tempo, valori);
  const ultimo = storia.lenta.t[storia.lenta.t.length - 1];
  if (ultimo === undefined || tempo - ultimo >= PASSO_STORIA_LENTA - 1e-12) aggiungi(storia.lenta, tempo, valori);
}

/** Registrazione da usare per mostrare `durata` secondi: la fine se basta, altrimenti la lenta. */
export function registrazionePer(storia: Storia, durata: number): { t: number[]; canali: number[][] } {
  const n = storia.t.length;
  return n > 1 && storia.t[n - 1] - storia.t[0] >= durata * 1.5 ? storia : storia.lenta;
}

/** Nodo con la massa unificata: i morsetti del simbolo di massa valgono "0". */
function nodoConMassa(s: Pick<SessioneElettronica, "componenti" | "nodoDi">): NodoDi {
  const masse = new Set(s.componenti.filter((c) => c.tipo === "massa").map((c) => s.nodoDi(c.id, "0")));
  return (comp, morsetto) => {
    const n = s.nodoDi(comp, morsetto);
    return masse.has(n) ? MASSA : n;
  };
}

/** Elementi del simulatore per i componenti dello schema, nello stato attuale delle interazioni. */
export function elementiDaComponenti(s: Pick<SessioneElettronica, "componenti" | "nodoDi" | "interazioni">, perOhmmetro?: string): Elemento[] {
  const n = nodoConMassa(s);
  const el: Elemento[] = [];
  for (const c of s.componenti) {
    const m = (morsetto: string) => n(c.id, morsetto);
    const id = c.id;
    // Per l'ohmmetro i generatori si spengono (misura a circuito spento).
    const spento = perOhmmetro !== undefined;
    switch (c.tipo) {
      case "generatore-dc":
        el.push({ tipo: "V", id, p: m("+"), n: m("-"), onda: { tipo: "continua", valore: spento ? 0 : num(c, "tensione") } });
        break;
      case "generatore-corrente":
        if (!spento) el.push({ tipo: "I", id, p: m("+"), n: m("-"), onda: { tipo: "continua", valore: num(c, "corrente") } });
        break;
      case "generatore-funzioni": {
        const forma = testo(c, "forma");
        const ampiezza = num(c, "ampiezza");
        const frequenza = Math.max(0.01, num(c, "frequenza"));
        const offset = num(c, "offset");
        const onda: Onda = spento
          ? { tipo: "continua", valore: 0 }
          : forma === "quadra"
            ? { tipo: "quadra", ampiezza, frequenza, offset }
            : forma === "triangolare"
              ? { tipo: "triangolare", ampiezza, frequenza, offset }
              : { tipo: "sinusoide", ampiezza, frequenza, offset };
        el.push({ tipo: "V", id, p: m("+"), n: m("COM"), onda });
        break;
      }
      case "resistenza":
        el.push({ tipo: "R", id, a: m("1"), b: m("2"), ohm: Math.max(1e-3, num(c, "resistenza")) });
        break;
      case "potenziometro": {
        // Due resistenze in serie: 1–cursore e cursore–3, secondo la posizione.
        const r = Math.max(1, num(c, "resistenza"));
        const pos = s.interazioni.posizioni[id] ?? 0.5;
        el.push({ tipo: "R", id: `${id}#a`, a: m("1"), b: m("2"), ohm: Math.max(0.5, r * pos) });
        el.push({ tipo: "R", id: `${id}#b`, a: m("2"), b: m("3"), ohm: Math.max(0.5, r * (1 - pos)) });
        break;
      }
      case "condensatore":
        el.push({ tipo: "C", id, a: m("1"), b: m("2"), farad: Math.max(1e-15, num(c, "capacita")) });
        break;
      case "induttore":
        el.push({ tipo: "L", id, a: m("1"), b: m("2"), henry: Math.max(1e-9, num(c, "induttanza")) });
        break;
      case "interruttore":
      case "pulsante": {
        const chiuso = c.tipo === "interruttore" ? s.interazioni.chiusi.has(id) : s.interazioni.premuti.has(id);
        el.push({ tipo: "R", id, a: m("1"), b: m("2"), ohm: chiuso ? 0.01 : 1e10 });
        break;
      }
      case "lampadina": {
        // Lampadina come resistenza R = V² / P (a filamento caldo).
        const v = Math.max(0.1, num(c, "tensione"));
        const p = Math.max(1e-3, num(c, "potenza"));
        el.push({ tipo: "R", id, a: m("1"), b: m("2"), ohm: (v * v) / p });
        break;
      }
      case "diodo":
        el.push({ tipo: "D", id, a: m("a"), k: m("k"), modello: DIODO_SILICIO });
        break;
      case "zener":
        el.push({ tipo: "D", id, a: m("a"), k: m("k"), modello: zener(Math.max(1, num(c, "tensione"))) });
        break;
      case "led":
        // Un LED bruciato non conduce più.
        if (!(s as SessioneElettronica).bruciati?.has(id)) el.push({ tipo: "D", id, a: m("a"), k: m("k"), modello: MODELLI_LED[testo(c, "colore")] ?? LED_ROSSO });
        break;
      case "transistor-npn":
      case "transistor-pnp":
        el.push({ tipo: "Q", id, c: m("c"), b: m("b"), e: m("e"), pnp: c.tipo === "transistor-pnp", beta: Math.max(1, num(c, "beta")) });
        break;
      case "mosfet-n":
      case "mosfet-p":
        el.push({ tipo: "M", id, d: m("d"), g: m("g"), s: m("s"), canaleP: c.tipo === "mosfet-p", vth: num(c, "soglia"), k: 0.5 });
        break;
      case "operazionale":
        el.push({ tipo: "OP", id, piu: m("+"), meno: m("-"), uscita: m("out"), vsat: Math.max(0.5, num(c, "saturazione")) });
        break;
      case "regolatore":
        el.push({ tipo: "REG", id, ingresso: m("in"), massa: m("gnd"), uscita: m("out"), vnom: num(c, "tensione") });
        break;
      case "multimetro": {
        if (id === perOhmmetro) break; // lo strumento stesso inietta la corrente di prova
        const modo = testo(c, "modalita");
        el.push({ tipo: "R", id, a: m("+"), b: m("COM"), ohm: modo === "A" ? 0.01 : 1e7 });
        break;
      }
      case "plotter-bode":
        el.push({ tipo: "R", id: `${id}#IN`, a: m("IN"), b: m("COM"), ohm: 1e9 });
        el.push({ tipo: "R", id: `${id}#OUT`, a: m("OUT"), b: m("COM"), ohm: 1e9 });
        break;
      case "oscilloscopio":
        el.push({ tipo: "R", id: `${id}#A`, a: m("A"), b: m("COM"), ohm: 1e7 });
        el.push({ tipo: "R", id: `${id}#B`, a: m("B"), b: m("COM"), ohm: 1e7 });
        break;
      default:
        if (eDigitale(c.tipo)) {
          // Ingressi ad alta impedenza verso massa; uscite come generatori 0/5 V
          // con resistenza interna (equivalente di Norton: corrente V/R e R verso massa).
          const piedini = PIEDINI_DIGITALI[c.tipo];
          const stato = (s as Partial<SessioneElettronica>).digitali?.[id];
          for (const i of piedini.ingressi) el.push({ tipo: "R", id: `${id}#${i}`, a: m(i), b: MASSA, ohm: R_INGRESSO });
          for (const u of piedini.uscite) {
            el.push({ tipo: "R", id: `${id}#${u}`, a: m(u), b: MASSA, ohm: R_USCITA });
            const alto = !spento && stato?.uscite[u] === 1;
            if (alto) el.push({ tipo: "I", id: `${id}#${u}+`, p: m(u), n: MASSA, onda: { tipo: "continua", valore: VCC_LOGICA / R_USCITA } });
          }
        }
        break;
    }
  }
  return el;
}

/** Passo di calcolo: un centesimo del periodo più breve dei generatori di funzioni (al massimo 0,1 ms), un quarantesimo di quello del clock. */
function passoDiCalcolo(componenti: readonly ComponenteElettronico[]): number {
  // Circuiti solo resistivi e digitali: basta un passo più lungo (1 ms).
  const conMemoria = componenti.some((c) => c.tipo === "condensatore" || c.tipo === "induttore" || c.tipo === "generatore-funzioni");
  let dt = conMemoria ? 1e-4 : 1e-3;
  for (const c of componenti) {
    if (c.tipo === "generatore-funzioni") dt = Math.min(dt, 1 / Math.max(0.01, num(c, "frequenza")) / 100);
    if (c.tipo === "generatore-clock") dt = Math.min(dt, 1 / Math.max(0.01, num(c, "frequenza")) / 40);
  }
  return Math.max(dt, 1e-8);
}

/** Avvia la simulazione: il circuito si accende con i condensatori scarichi. */
export function avviaSessioneElettronica(componenti: ComponenteElettronico[], nodoDi: NodoDi): SessioneElettronica {
  const s: SessioneElettronica = {
    componenti,
    nodoDi,
    tempo: 0,
    dt: passoDiCalcolo(componenti),
    transitorio: nuovoStatoTransitorio(),
    soluzione: null,
    interazioni: { chiusi: new Set(), premuti: new Set(), posizioni: {} },
    bruciati: new Set(),
    oscilloscopi: Object.fromEntries(componenti.filter((c) => c.tipo === "oscilloscopio").map((c) => [c.id, nuovaStoria(2)])),
    digitali: Object.fromEntries(componenti.filter((c) => eDigitale(c.tipo)).map((c) => [c.id, nuovoStatoDigitale(c.tipo)])),
    analizzatori: Object.fromEntries(componenti.filter((c) => c.tipo === "analizzatore-logico").map((c) => [c.id, nuovaStoria(4)])),
    letture: {},
    // La massa serve quando ci sono generatori (i circuiti solo digitali hanno la massa implicita).
    senzaMassa: componenti.some((c) => c.tipo.startsWith("generatore-") && c.tipo !== "generatore-clock") && !componenti.some((c) => c.tipo === "massa"),
    nonConverge: false,
    inCorto: new Set(),
    versione: 0,
  };
  calcolaPasso(s);
  aggiornaStrumenti(s);
  return s;
}

/** Un passo di calcolo all'istante attuale. */
function calcolaPasso(s: SessioneElettronica) {
  const el = elementiDaComponenti(s);
  const sol = passoTransitorio(el, s.tempo, s.dt, s.transitorio);
  s.soluzione = sol;
  s.nonConverge = !sol.converge;
  const n = nodoConMassa(s);
  for (const [id, storia] of Object.entries(s.oscilloscopi)) {
    const com = sol.tensioni[n(id, "COM")] ?? 0;
    const a = (sol.tensioni[n(id, "A")] ?? 0) - com;
    const b = (sol.tensioni[n(id, "B")] ?? 0) - com;
    registra(storia, s.tempo, [a, b]);
  }
  // Componenti digitali: leggono gli ingressi e preparano le uscite del passo successivo.
  for (const c of s.componenti) {
    const stato = s.digitali[c.id];
    if (!stato) continue;
    const tensioni = Object.fromEntries(PIEDINI_DIGITALI[c.tipo].ingressi.map((i) => [i, sol.tensioni[n(c.id, i)] ?? 0]));
    const esterno =
      c.tipo === "interruttore-logico"
        ? s.interazioni.chiusi.has(c.id)
        : c.tipo === "generatore-clock"
          ? // Parte da 0: il primo fronte di salita arriva dopo mezzo periodo.
            (s.tempo * Math.max(0.01, num(c, "frequenza"))) % 1 >= 0.5
          : false;
    if (aggiornaDigitale(c.tipo, stato, tensioni, esterno)) s.versione++;
  }
  for (const [id, storia] of Object.entries(s.analizzatori)) {
    const ingressi = s.digitali[id]?.ingressi ?? {};
    registra(storia, s.tempo, ["D0", "D1", "D2", "D3"].map((d) => ingressi[d] ?? 0));
  }
  // LED che superano la corrente massima: si bruciano.
  for (const c of s.componenti) {
    if (c.tipo === "led" && !s.bruciati.has(c.id) && (sol.correnti[c.id] ?? 0) > CORRENTE_LED_MASSIMA) {
      s.bruciati.add(c.id);
      s.versione++;
    }
  }
}

/** Letture dei multimetri e generatori in cortocircuito, dall'ultima soluzione. */
function aggiornaStrumenti(s: SessioneElettronica) {
  const sol = s.soluzione;
  if (!sol) return;
  const n = nodoConMassa(s);
  for (const c of s.componenti) {
    if (c.tipo !== "multimetro") continue;
    const modo = testo(c, "modalita");
    if (modo === "A") s.letture[c.id] = { valore: sol.correnti[c.id] ?? 0, unita: "A" };
    else if (modo === "Ω") s.letture[c.id] = { valore: misuraResistenza(s, c.id), unita: "Ω" };
    else s.letture[c.id] = { valore: (sol.tensioni[n(c.id, "+")] ?? 0) - (sol.tensioni[n(c.id, "COM")] ?? 0), unita: "V" };
  }
  s.inCorto = new Set(
    s.componenti.filter((c) => (c.tipo === "generatore-dc" || c.tipo === "generatore-funzioni") && Math.abs(sol.correnti[c.id] ?? 0) > CORRENTE_CORTO).map((c) => c.id),
  );
}

/**
 * Ohmmetro: con i generatori spenti inietta 1 mA fra i puntali e misura la
 * tensione. Fuori scala (circuito aperto) → null.
 */
function misuraResistenza(s: SessioneElettronica, id: string): number | null {
  const n = nodoConMassa(s);
  const piu = n(id, "+");
  const com = n(id, "COM");
  if (piu === com) return 0;
  const el = elementiDaComponenti(s, id);
  el.push({ tipo: "I", id: "#prova", p: piu, n: com, onda: { tipo: "continua", valore: 1e-3 } });
  // Riferimento di massa sul COM se il circuito non ne ha una, per non lasciare il sistema "sospeso".
  el.push({ tipo: "R", id: "#rif", a: com, b: MASSA, ohm: 1e9 });
  const sol = analisiDC(el);
  const r = ((sol.tensioni[piu] ?? 0) - (sol.tensioni[com] ?? 0)) / 1e-3;
  return r > 1e8 || !Number.isFinite(r) ? null : Math.max(0, r);
}

/**
 * Fa scorrere il tempo: tanti passi quanti ne stanno in `secondiReali`, ma
 * non più di PASSI_MASSIMI per volta (con segnali veloci il tempo simulato
 * scorre più lentamente di quello reale, come una moviola).
 */
export function passoElettronica(s: SessioneElettronica, secondiReali: number, millisecondiMassimi = Infinity): void {
  const passi = Math.max(1, Math.min(PASSI_MASSIMI, Math.round(secondiReali / s.dt)));
  const inizio = Date.now();
  for (let k = 0; k < passi; k++) {
    s.tempo += s.dt;
    calcolaPasso(s);
    // Su un computer lento ci si ferma prima: il tempo simulato rallenta ma l'interfaccia resta pronta.
    if (Date.now() - inizio > millisecondiMassimi) break;
  }
  aggiornaStrumenti(s);
  s.versione++;
}

/** Clic su un componente: interruttore commuta, pulsante si preme, potenziometro gira (indietro = verso 0). */
export function clicGiuElettronica(s: SessioneElettronica, id: string, indietro = false): void {
  const c = s.componenti.find((x) => x.id === id);
  if (!c) return;
  if (c.tipo === "interruttore" || c.tipo === "interruttore-logico") {
    if (s.interazioni.chiusi.has(id)) s.interazioni.chiusi.delete(id);
    else s.interazioni.chiusi.add(id);
  } else if (c.tipo === "pulsante") s.interazioni.premuti.add(id);
  else if (c.tipo === "potenziometro") {
    const p = s.interazioni.posizioni[id] ?? 0.5;
    s.interazioni.posizioni[id] = Math.round(Math.max(0, Math.min(1, p + (indietro ? -0.1 : 0.1))) * 10) / 10;
  } else return;
  aggiornaStrumenti(s);
  s.versione++;
}

export function clicSuElettronica(s: SessioneElettronica, id: string): void {
  if (s.interazioni.premuti.delete(id)) s.versione++;
}

export function rilasciaTuttiElettronica(s: SessioneElettronica): void {
  if (s.interazioni.premuti.size > 0) {
    s.interazioni.premuti.clear();
    s.versione++;
  }
}

/** Luminosità di LED e lampadine (0…1) dall'ultima soluzione. */
export function luminosita(s: SessioneElettronica, c: ComponenteElettronico): number {
  const sol = s.soluzione;
  if (!sol) return 0;
  if (c.tipo === "led") {
    if (s.bruciati.has(c.id)) return 0;
    const i = sol.correnti[c.id] ?? 0;
    return i < 0.0005 ? 0 : Math.min(1, i / CORRENTE_LED_PIENA);
  }
  if (c.tipo === "lampadina") {
    const i = Math.abs(sol.correnti[c.id] ?? 0);
    const v = Math.max(0.1, num(c, "tensione"));
    const p = Math.max(1e-3, num(c, "potenza"));
    const r = (v * v) / p;
    return Math.min(1, (i * i * r) / p);
  }
  return 0;
}

/** Tensione di un nodo (rispetto a massa) nell'ultima soluzione. */
export function tensioneMorsetto(s: SessioneElettronica, componente: string, morsetto: string): number {
  return s.soluzione?.tensioni[nodoConMassa(s)(componente, morsetto)] ?? 0;
}

/** Risposta in frequenza misurata dal plotter di Bode. */
export interface RispostaBode {
  frequenze: number[];
  /** Guadagno OUT/IN in decibel. */
  db: number[];
  /** Sfasamento OUT rispetto a IN, in gradi (fra −180° e +180°). */
  fase: number[];
  /** Frequenza a cui il guadagno scende di 3 dB sotto il massimo (null se non succede). */
  taglio: number | null;
  /** Generatore usato come segnale d'ingresso. */
  generatore: string;
}

/**
 * Plotter di Bode: analisi in frequenza per piccoli segnali con il generatore
 * di funzioni del circuito come ingresso (ampiezza unitaria), da `fmin` a
 * `fmax`; si misura il rapporto fra le tensioni OUT e IN, entrambe rispetto
 * al morsetto COM. Null se nel circuito non c'è un generatore di funzioni.
 */
export function rispostaBode(s: SessioneElettronica, id: string, fmin = 1, fmax = 1e6): RispostaBode | null {
  const generatore = s.componenti.find((c) => c.tipo === "generatore-funzioni");
  if (!generatore) return null;
  const n = nodoConMassa(s);
  const frequenze = frequenzeLogaritmiche(fmin, fmax, 20);
  const punti = analisiAC(elementiDaComponenti(s), generatore.id, frequenze);
  // Tensione complessa di un nodo dai valori polari dell'analisi.
  const complesso = (p: (typeof punti)[number], nodo: string): [number, number] => {
    if (nodo === MASSA) return [0, 0];
    const r = p.modulo[nodo] ?? 0;
    const a = ((p.fase[nodo] ?? 0) * Math.PI) / 180;
    return [r * Math.cos(a), r * Math.sin(a)];
  };
  const db: number[] = [];
  const fase: number[] = [];
  for (const p of punti) {
    const com = complesso(p, n(id, "COM"));
    const vi = complesso(p, n(id, "IN"));
    const vo = complesso(p, n(id, "OUT"));
    const iRe = vi[0] - com[0];
    const iIm = vi[1] - com[1];
    const oRe = vo[0] - com[0];
    const oIm = vo[1] - com[1];
    const den = iRe * iRe + iIm * iIm;
    if (den < 1e-30) {
      db.push(-200);
      fase.push(0);
      continue;
    }
    const hRe = (oRe * iRe + oIm * iIm) / den;
    const hIm = (oIm * iRe - oRe * iIm) / den;
    db.push(20 * Math.log10(Math.max(Math.hypot(hRe, hIm), 1e-10)));
    fase.push((Math.atan2(hIm, hRe) * 180) / Math.PI);
  }
  const massimo = Math.max(...db);
  let taglio: number | null = null;
  const iMax = db.indexOf(massimo);
  for (let k = iMax + 1; k < db.length; k++) {
    if (db[k] <= massimo - 3) {
      // Interpolazione logaritmica fra i due punti vicini.
      const f1 = Math.log10(frequenze[k - 1]);
      const f2 = Math.log10(frequenze[k]);
      const x = (massimo - 3 - db[k - 1]) / (db[k] - db[k - 1]);
      taglio = 10 ** (f1 + x * (f2 - f1));
      break;
    }
  }
  if (taglio === null) {
    for (let k = iMax - 1; k >= 0; k--) {
      if (db[k] <= massimo - 3) {
        const f1 = Math.log10(frequenze[k]);
        const f2 = Math.log10(frequenze[k + 1]);
        const x = (massimo - 3 - db[k]) / (db[k + 1] - db[k]);
        taglio = 10 ** (f1 + x * (f2 - f1));
        break;
      }
    }
  }
  return { frequenze, db, fase, taglio, generatore: generatore.id };
}
