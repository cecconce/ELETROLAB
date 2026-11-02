// Aspetto dello schema durante la simulazione (logica pura, senza Konva).
// Traduce il risultato del motore degli impianti in quello che l'area di
// disegno deve mostrare: colore di ogni filo secondo il polo che lo
// raggiunge, contatti chiusi, bobine eccitate, lampade accese, motori che
// girano con il loro verso, protezioni intervenute, punti in cortocircuito.
import {
  MODELLI_IMPIANTI,
  azioneClic,
  chiaveMorsetto,
  problemiSessione,
  type AzioneClic,
  type Polo,
  type Problema,
  type SessioneImpianto,
  type StatoMotore,
  type Tratto,
} from "../motori/impianti";
import { MODELLI_IMPIANTI_PLC, MODELLI_LADDER, nodiAlimentati, normalizzaOperando, valoreBit, type ProblemaLadder, type SessionePlc } from "../motori/plc";
import { t } from "../testi";
import type { ColoriEditor } from "./colori";
import type { ProblemaMostrato } from "./messaggiProblemi";
import type { Filo, Schema } from "./schema";

/** Stato da disegnare per un componente. */
export interface AspettoComponente {
  /** Che cosa fa un clic (per il cursore a manina e il tooltip). */
  clic: AzioneClic;
  /** Contatto chiuso in questo momento (anche un NC a riposo). */
  chiuso: boolean;
  /** Carico alimentato: bobina eccitata, lampada accesa, motore alimentato. */
  alimentato: boolean;
  /** Pulsante tenuto premuto o comando a posizione mantenuta azionato. */
  azionato: boolean;
  /** Protezione intervenuta (da riarmare con un clic). */
  intervenuta: boolean;
  /** Motore frenato dallo studente. */
  sovraccarico: boolean;
  /** Motore che gira: verso ed eventuale collegamento stella/triangolo. */
  motore?: StatoMotore;
  /** PLC: valore da scrivere sotto il blocco (tempo trascorso, conteggio). */
  valore?: string;
  /** PLC: stato dell'impianto animato da disegnare (nastro, semaforo, cancello…). */
  impianto?: unknown;
  /** Arduino: stato da disegnare sul banco (LED, manopole, servo, buzzer, LED L della scheda). */
  arduino?: {
    luminosita?: number;
    bruciato?: boolean;
    posizione?: number;
    luce?: number;
    angolo?: number;
    frequenza?: number;
    suona?: boolean;
    ledL?: boolean;
    /** Display LCD: righe di testo (vuote se il display non è comandato) e retroilluminazione 0…1. */
    righe?: string[];
    retro?: number;
    /** Sensore a ultrasuoni: distanza dell'ostacolo (cm). */
    distanza?: number;
    /** LED RGB: luminosità di rosso, verde e blu. */
    rgb?: [number, number, number];
    /** Display a 7 segmenti: luminosità di a…g e del punto. */
    segmenti?: number[];
    /** Sensore di temperatura (°C). */
    temperatura?: number;
    /** Motore in continua: velocità −1…1. */
    velocita?: number;
  };
  /** Elettronica: LED e lampadine (0…1), LED bruciato, cursore del potenziometro, display del multimetro. */
  elettronica?: {
    luminosita?: number;
    bruciato?: boolean;
    posizione?: number;
    lettura?: string;
    /** Componenti digitali: livello logico di ingressi e uscite; contatore: conteggio. */
    livelli?: Record<string, 0 | 1>;
    conteggio?: number;
  };
}

export interface VistaSimulazione {
  /** Per ogni filo i poli che lo raggiungono (vuoto = senza tensione). */
  poliDeiFili: Record<string, Polo[]>;
  componenti: Record<string, AspettoComponente>;
  /** Morsetti ("id:morsetto") coinvolti in un cortocircuito non interrotto. */
  morsettiInCorto: ReadonlySet<string>;
  /** Secondi dall'avvio. */
  tempo: number;
  /** Problemi da spiegare allo studente (errori prima degli avvisi). */
  problemi: Problema[];
  /** PLC: problemi già pronti da mostrare (il modulo PLC non usa `problemi`). */
  problemiPlc?: ProblemaMostrato[];
}

/** Calcola l'aspetto di tutto lo schema dallo stato della sessione. */
export function vistaDaSessione(sessione: SessioneImpianto, fili: readonly Filo[]): VistaSimulazione {
  const r = sessione.risultato;
  const chiusi = new Set(r.contattiChiusi);
  const alimentati = new Set(r.carichiAlimentati);
  const azionati = new Set([...sessione.premuti, ...sessione.azionati]);
  const intervenute = new Set(sessione.stato.protezioniIntervenute);
  const sovraccarichi = new Set(sessione.sovraccarichi);

  const poliDeiFili: Record<string, Polo[]> = {};
  for (const f of fili) {
    // I due capi di un filo sono sempre nello stesso nodo: basta uno.
    poliDeiFili[f.id] = r.poliDeiMorsetti[chiaveMorsetto(f.da.componente, f.da.morsetto)] ?? [];
  }

  const componenti: Record<string, AspettoComponente> = {};
  for (const c of sessione.circuito.componenti) {
    componenti[c.id] = {
      clic: azioneClic(c.tipo),
      chiuso: chiusi.has(c.id),
      alimentato: alimentati.has(c.id),
      azionato: azionati.has(c.id),
      intervenuta: intervenute.has(c.id),
      sovraccarico: sovraccarichi.has(c.id),
      ...(r.motori[c.id] ? { motore: r.motori[c.id] } : {}),
    };
  }
  return {
    poliDeiFili,
    componenti,
    morsettiInCorto: new Set(r.cortocircuiti.flatMap((c) => c.morsetti)),
    tempo: sessione.stato.tempo,
    problemi: problemiSessione(sessione),
  };
}

/**
 * Colore di un filo in simulazione: null se è senza tensione (resta del
 * colore normale), il colore del polo se ne porta uno, il colore del
 * cortocircuito se ne porta più di uno.
 */
export function coloreFilo(poli: readonly Polo[], colori: ColoriEditor): string | null {
  if (poli.length === 0) return null;
  if (poli.length > 1) return colori.corto;
  return colori.tensione[poli[0]];
}

/**
 * Coppie di morsetti chiuse da un contatto (o da un organo di manovra):
 * nell'area di disegno diventano un tratto verde fra i due morsetti, così si
 * vede il contatto che commuta. Vuoto per i componenti che non sono contatti.
 */
export function trattiDelContatto(tipo: string): readonly Tratto[] {
  const l = MODELLI_LADDER[tipo];
  if (l?.ruolo === "contatto") return [l.morsetti];
  const m = MODELLI_IMPIANTI[tipo];
  return m?.tipo === "contatto" ? m.tratti : [];
}

/** Tipo di utilizzatore, per scegliere l'animazione. */
export function tipoUtilizzatore(tipo: string): "bobina" | "luce" | "suono" | "motore" | null {
  // Nel Ladder bobine e blocchi alimentati si mostrano come una bobina eccitata;
  // gli attuatori del quadro come lampade, motori e sirene.
  const l = MODELLI_LADDER[tipo];
  if (l?.ruolo === "uscita") return "bobina";
  if (l?.ruolo === "attuatore") return l.attuatore;
  const m = MODELLI_IMPIANTI[tipo];
  if (m?.tipo !== "carico") return null;
  if (m.bobina) return "bobina";
  if (m.motore) return "motore";
  if (tipo === "sirena") return "suono";
  return "luce";
}

/** Formatta i secondi trascorsi per l'orologio della simulazione (es. "12,3 s"). */
export function formattaTempo(secondi: number): string {
  return `${(Math.floor(secondi * 10) / 10).toFixed(1).replace(".", ",")} s`;
}

/**
 * Chiave che cambia solo quando cambia qualcosa di visibile: l'interfaccia
 * ridisegna lo schema solo allora, non a ogni scatto dell'orologio.
 */
export function firmaVista(v: VistaSimulazione): string {
  return JSON.stringify([v.poliDeiFili, v.componenti, [...v.morsettiInCorto], v.problemi, v.problemiPlc]);
}

/** Numero con la virgola e al massimo un decimale ("1,5"). */
const numero = (v: number) => (Math.round(v * 10) / 10).toString().replace(".", ",");

/** Frasi per i problemi trovati nella conversione del Ladder disegnato. */
export function problemiLadder(problemi: readonly ProblemaLadder[], schema: Schema): ProblemaMostrato[] {
  const sigla = (id: string) => {
    const c = schema.componenti.find((x) => x.id === id);
    return c?.etichetta ? c.etichetta : t("plc.senzaOperando");
  };
  return problemi.map((p, i) => ({
    chiave: `${p.codice}-${i}`,
    // La bobina doppia è solo un avviso: il programma funziona, ma vale l'ultima.
    gravita: p.codice === "bobinaDoppia" ? ("avviso" as const) : ("errore" as const),
    testo: t(`plc.problema.${p.codice}`, { operandi: p.componenti.map(sigla).join(", ") }),
    componenti: p.componenti,
    morsetti: [],
  }));
}

/** Aspetto del Ladder durante la simulazione del PLC. */
export function vistaDaSessionePlc(s: SessionePlc, schema: Schema): VistaSimulazione {
  const conv = s.conversione;
  const chiusi = new Set(s.risultato.segmenti.flatMap((seg) => seg.idChiusi));
  const accesi = nodiAlimentati(conv, chiusi);
  const alimentate = new Set<string>();
  s.risultato.segmenti.forEach((seg, i) => {
    if (seg.risultato) for (const id of conv.usciteDeiSegmenti[i] ?? []) alimentate.add(id);
  });
  const premuti = new Set([...s.premuti, ...s.fissi]);

  const poliDeiFili: Record<string, Polo[]> = {};
  for (const f of schema.fili) {
    const nodo = conv.nodi[`${f.da.componente}/${f.da.morsetto}`];
    poliDeiFili[f.id] = nodo !== undefined && accesi.has(nodo) ? ["+"] : [];
  }

  const componenti: Record<string, AspettoComponente> = {};
  for (const c of schema.componenti) {
    const m = MODELLI_LADDER[c.tipo];
    if (!m) continue;
    const operando = normalizzaOperando(c.etichetta);
    let valore: string | undefined;
    const tmp = s.stato.temporizzatori[operando];
    const cnt = s.stato.contatori[operando];
    if (m.ruolo === "uscita" && (m.uscita === "TON" || m.uscita === "TOF" || m.uscita === "TP") && tmp) {
      valore = `${numero(tmp.trascorso)} / ${numero(tmp.preset)} s`;
    }
    if (m.ruolo === "uscita" && (m.uscita === "CTU" || m.uscita === "CTD") && cnt) valore = `${cnt.conteggio} / ${cnt.preset}`;
    if (m.ruolo === "comando") {
      componenti[c.id] = {
        clic: m.modo === "pulsante" ? "pulsante" : "manuale",
        chiuso: false,
        alimentato: false,
        azionato: s.comandiAzionati.includes(c.id),
        intervenuta: false,
        sovraccarico: false,
      };
      continue;
    }
    if (m.ruolo === "impianto") {
      const imp = s.impianti[c.id];
      const modello = imp ? MODELLI_IMPIANTI_PLC[imp.tipo] : undefined;
      componenti[c.id] = {
        clic: modello?.clicGiu ? "pulsante" : null,
        chiuso: false,
        alimentato: false,
        azionato: false,
        intervenuta: false,
        sovraccarico: false,
        ...(imp ? { impianto: imp.stato } : {}),
      };
      continue;
    }
    if (m.ruolo === "attuatore") {
      const acceso = valoreBit(s.stato, operando);
      componenti[c.id] = {
        clic: null,
        chiuso: false,
        alimentato: acceso,
        azionato: false,
        intervenuta: false,
        sovraccarico: false,
        ...(acceso && m.attuatore === "motore" ? { motore: { verso: "orario" as const } } : {}),
      };
      continue;
    }
    componenti[c.id] = {
      clic: s.ingressoDi[c.id] ? "pulsante" : null,
      chiuso: chiusi.has(c.id),
      alimentato: alimentate.has(c.id),
      azionato: s.ingressoDi[c.id] !== undefined && premuti.has(s.ingressoDi[c.id]),
      intervenuta: false,
      sovraccarico: false,
      ...(valore ? { valore } : {}),
    };
  }
  return {
    poliDeiFili,
    componenti,
    morsettiInCorto: new Set(),
    tempo: s.stato.tempo,
    problemi: [],
    problemiPlc: problemiLadder(conv.problemi, schema),
  };
}
