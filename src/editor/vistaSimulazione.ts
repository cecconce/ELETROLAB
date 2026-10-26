// Aspetto dello schema durante la simulazione (logica pura, senza Konva).
// Traduce il risultato del motore degli impianti in quello che l'area di
// disegno deve mostrare: colore di ogni filo secondo il polo che lo
// raggiunge, contatti chiusi, bobine eccitate, lampade accese, motori che
// girano con il loro verso, protezioni intervenute, punti in cortocircuito.
import {
  MODELLI_IMPIANTI,
  azioneClic,
  chiaveMorsetto,
  type AzioneClic,
  type Polo,
  type SessioneImpianto,
  type StatoMotore,
  type Tratto,
} from "../motori/impianti";
import type { ColoriEditor } from "./colori";
import type { Filo } from "./schema";

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
}

export interface VistaSimulazione {
  /** Per ogni filo i poli che lo raggiungono (vuoto = senza tensione). */
  poliDeiFili: Record<string, Polo[]>;
  componenti: Record<string, AspettoComponente>;
  /** Morsetti ("id:morsetto") coinvolti in un cortocircuito non interrotto. */
  morsettiInCorto: ReadonlySet<string>;
  /** Secondi dall'avvio. */
  tempo: number;
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
  const m = MODELLI_IMPIANTI[tipo];
  return m?.tipo === "contatto" ? m.tratti : [];
}

/** Tipo di utilizzatore, per scegliere l'animazione. */
export function tipoUtilizzatore(tipo: string): "bobina" | "luce" | "suono" | "motore" | null {
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
  return JSON.stringify([v.poliDeiFili, v.componenti, [...v.morsettiInCorto]]);
}
