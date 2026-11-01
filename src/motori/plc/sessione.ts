// Sessione di simulazione del PLC guidata dallo studente (puro: nessuna interfaccia).
//
// Tiene insieme il programma convertito dal disegno, la memoria del PLC e
// gli ingressi che lo studente aziona:
// - "premuti": ingressi tenuti a 1 finché si tiene premuto il mouse (clic su
//   un contatto del Ladder che legge un ingresso I, come un pulsante);
// - "fissi": ingressi commutati 0/1 dalla tabella degli ingressi (come un
//   interruttore o un selettore).
// Il tempo scorre a cicli di durata fissa (tempo di ciclo): `passoPlc`
// accumula il tempo reale e esegue tutti i cicli che ci stanno.
import { leggiOperando, normalizzaOperando } from "./operandi";
import type { RisultatoConversione } from "./rete";
import { limitaTempoCiclo, scansione, statoInizialePlc, TEMPO_CICLO_PREDEFINITO, type RisultatoScansione, type StatoPlc } from "./scansione";

/** Oltre questo numero di cicli per passo (computer bloccato a lungo) il tempo non viene recuperato tutto. */
export const CICLI_MASSIMI_PER_PASSO = 2000;

export interface SessionePlc {
  conversione: RisultatoConversione;
  stato: StatoPlc;
  /** Risultato dell'ultimo ciclo (stato di contatti e segmenti). */
  risultato: RisultatoScansione;
  /** Componente disegnato → ingresso I che legge (solo i contatti su ingressi). */
  ingressoDi: Record<string, string>;
  premuti: string[];
  fissi: string[];
  tempoCiclo: number;
  /** Tempo reale accumulato non ancora sufficiente per un ciclo intero. */
  resto: number;
}

/** Ingressi a 1 in questo momento. */
export function ingressiAttivi(s: Pick<SessionePlc, "premuti" | "fissi">): Record<string, boolean> {
  return Object.fromEntries([...s.premuti, ...s.fissi].map((i) => [i, true]));
}

/** Esegue un ciclo subito, senza far passare tempo (dopo un'azione dello studente). */
function cicloImmediato(s: SessionePlc): SessionePlc {
  const risultato = scansione(s.conversione.programma, s.stato, ingressiAttivi(s), 0);
  return { ...s, stato: risultato.stato, risultato };
}

/**
 * Avvia la simulazione: PLC appena acceso, primo ciclo già eseguito.
 * @param operandiContatti componente → operando, per i contatti disegnati
 */
export function avviaSessionePlc(
  conversione: RisultatoConversione,
  operandiContatti: Record<string, string>,
  tempoCiclo = TEMPO_CICLO_PREDEFINITO,
): SessionePlc {
  const ingressoDi: Record<string, string> = {};
  for (const [id, op] of Object.entries(operandiContatti)) {
    if (leggiOperando(op)?.area === "I") ingressoDi[id] = normalizzaOperando(op);
  }
  const stato = statoInizialePlc();
  const vuota: SessionePlc = {
    conversione,
    stato,
    risultato: { stato, usciteAttive: [], segmenti: [] },
    ingressoDi,
    premuti: [],
    fissi: [],
    tempoCiclo: limitaTempoCiclo(tempoCiclo),
    resto: 0,
  };
  return cicloImmediato(vuota);
}

/** Fa scorrere `dt` secondi di tempo reale. */
export function passoPlc(s: SessionePlc, dt: number): SessionePlc {
  let resto = s.resto + Math.max(0, Number.isFinite(dt) ? dt : 0);
  let stato = s.stato;
  let risultato = s.risultato;
  let cicli = 0;
  const ingressi = ingressiAttivi(s);
  while (resto >= s.tempoCiclo - 1e-9 && cicli < CICLI_MASSIMI_PER_PASSO) {
    risultato = scansione(s.conversione.programma, stato, ingressi, s.tempoCiclo);
    stato = risultato.stato;
    resto -= s.tempoCiclo;
    cicli++;
  }
  if (cicli >= CICLI_MASSIMI_PER_PASSO) resto = 0;
  return { ...s, stato, risultato, resto };
}

/** Pressione del mouse su un componente: se è un contatto su un ingresso, l'ingresso va a 1. */
export function clicGiuPlc(s: SessionePlc, id: string): SessionePlc {
  const ingresso = s.ingressoDi[id];
  if (!ingresso || s.premuti.includes(ingresso)) return s;
  return cicloImmediato({ ...s, premuti: [...s.premuti, ingresso] });
}

/** Rilascio del mouse sul componente: l'ingresso tenuto premuto torna a 0. */
export function clicSuPlc(s: SessionePlc, id: string): SessionePlc {
  const ingresso = s.ingressoDi[id];
  if (!ingresso || !s.premuti.includes(ingresso)) return s;
  return cicloImmediato({ ...s, premuti: s.premuti.filter((i) => i !== ingresso) });
}

/** Mouse rilasciato altrove o finestra senza fuoco: tutti i pulsanti tornano a riposo. */
export function rilasciaTuttiPlc(s: SessionePlc): SessionePlc {
  return s.premuti.length === 0 ? s : cicloImmediato({ ...s, premuti: [] });
}

/** Commuta un ingresso "fisso" (interruttore) dalla tabella degli ingressi. */
export function commutaIngresso(s: SessionePlc, operando: string): SessionePlc {
  const op = normalizzaOperando(operando);
  if (leggiOperando(op)?.area !== "I") return s;
  const fissi = s.fissi.includes(op) ? s.fissi.filter((i) => i !== op) : [...s.fissi, op];
  return cicloImmediato({ ...s, fissi });
}
