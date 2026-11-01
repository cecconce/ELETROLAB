// Sessione di simulazione del PLC guidata dallo studente (puro: nessuna interfaccia).
//
// Tiene insieme il programma convertito dal disegno, la memoria del PLC e
// gli ingressi che lo studente aziona:
// - "premuti": ingressi tenuti a 1 finché si tiene premuto il mouse (clic su
//   un contatto del Ladder che legge un ingresso I, come un pulsante);
// - "fissi": ingressi commutati 0/1 dalla tabella degli ingressi (come un
//   interruttore o un selettore);
// - i comandi del quadro virtuale (pulsanti tenuti premuti, interruttori,
//   selettori, finecorsa e sensori azionati), ognuno legato a un ingresso;
//   un comando NC dà 1 a riposo e 0 quando è azionato;
// - i sensori degli impianti animati (nastro, semaforo, cancello…), che a
//   loro volta si muovono secondo le uscite del PLC (vedi impianti/).
// Il tempo scorre a cicli di durata fissa (tempo di ciclo): `passoPlc`
// accumula il tempo reale e esegue tutti i cicli che ci stanno.
import { leggiOperando, normalizzaOperando } from "./operandi";
import { MODELLI_LADDER, type RisultatoConversione } from "./rete";
import { MODELLI_IMPIANTI_PLC } from "./impianti";
import {
  limitaTempoCiclo,
  scansione,
  statoInizialePlc,
  TEMPO_CICLO_PREDEFINITO,
  valoreBit,
  type RisultatoScansione,
  type StatoPlc,
} from "./scansione";

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
  /** Comandi del quadro: componente → ingresso, modo e cablaggio NC. */
  comandi: Record<string, { ingresso: string; modo: "pulsante" | "mantenuto"; nc: boolean }>;
  /** Comandi del quadro azionati ora (pulsanti tenuti premuti o comandi commutati). */
  comandiAzionati: string[];
  /** Impianti animati posati: tipo, operandi di ogni segnale e stato attuale. */
  impianti: Record<string, ImpiantoInSessione>;
  tempoCiclo: number;
  /** Tempo reale accumulato non ancora sufficiente per un ciclo intero. */
  resto: number;
}

export interface ImpiantoInSessione {
  tipo: string;
  /** Segnale dell'impianto → operando del PLC. */
  operandi: Record<string, string>;
  stato: unknown;
}

/** Ingressi a 1 in questo momento. */
export function ingressiAttivi(
  s: Pick<SessionePlc, "premuti" | "fissi"> & Partial<Pick<SessionePlc, "comandi" | "comandiAzionati" | "impianti">>,
): Record<string, boolean> {
  const attivi = new Set([...s.premuti, ...s.fissi]);
  // Più comandi sullo stesso ingresso sono "in parallelo": basta uno a 1.
  const azionati = new Set(s.comandiAzionati ?? []);
  for (const [id, c] of Object.entries(s.comandi ?? {})) {
    if (azionati.has(id) !== c.nc) attivi.add(c.ingresso);
  }
  // Sensori degli impianti animati.
  for (const imp of Object.values(s.impianti ?? {})) {
    const modello = MODELLI_IMPIANTI_PLC[imp.tipo];
    if (!modello) continue;
    for (const [segnale, valore] of Object.entries(modello.letturaSensori(imp.stato))) {
      const op = imp.operandi[segnale];
      if (valore && op && leggiOperando(op)?.area === "I") attivi.add(normalizzaOperando(op));
    }
  }
  return Object.fromEntries([...attivi].map((i) => [i, true]));
}

/** Gli impianti avanzano di `dt` con gli attuatori comandati dalle uscite del PLC. */
function avanzaImpianti(impianti: SessionePlc["impianti"], stato: StatoPlc, dt: number): SessionePlc["impianti"] {
  const ids = Object.keys(impianti);
  if (ids.length === 0) return impianti;
  const nuovi: SessionePlc["impianti"] = {};
  for (const id of ids) {
    const imp = impianti[id];
    const modello = MODELLI_IMPIANTI_PLC[imp.tipo];
    if (!modello) {
      nuovi[id] = imp;
      continue;
    }
    const attuatori: Record<string, boolean> = {};
    for (const a of modello.attuatori) attuatori[a.id] = valoreBit(stato, imp.operandi[a.id] ?? "");
    nuovi[id] = { ...imp, stato: modello.avanza(imp.stato, attuatori, dt) };
  }
  return nuovi;
}

/** Esegue un ciclo subito, senza far passare tempo (dopo un'azione dello studente). */
function cicloImmediato(s: SessionePlc): SessionePlc {
  const risultato = scansione(s.conversione.programma, s.stato, ingressiAttivi(s), 0);
  return { ...s, stato: risultato.stato, risultato, impianti: avanzaImpianti(s.impianti, risultato.stato, 0) };
}

/**
 * Avvia la simulazione: PLC appena acceso, primo ciclo già eseguito.
 * @param operandiContatti componente → operando, per i contatti disegnati
 */
export function avviaSessionePlc(
  conversione: RisultatoConversione,
  operandiContatti: Record<string, string>,
  tempoCiclo = TEMPO_CICLO_PREDEFINITO,
  /** Tipo di ogni componente: serve a riconoscere i comandi del quadro. */
  tipiComponenti?: Record<string, string>,
  /** Impianti animati posati: componente → tipo e operandi dei segnali. */
  impiantiPosati?: Record<string, { tipo: string; operandi: Record<string, string> }>,
): SessionePlc {
  const ingressoDi: Record<string, string> = {};
  const comandi: SessionePlc["comandi"] = {};
  const tipoDi = tipiComponenti ?? {};
  for (const [id, op] of Object.entries(operandiContatti)) {
    if (leggiOperando(op)?.area !== "I") continue;
    const m = MODELLI_LADDER[tipoDi[id] ?? ""];
    if (m?.ruolo === "comando") comandi[id] = { ingresso: normalizzaOperando(op), modo: m.modo, nc: m.nc };
    else ingressoDi[id] = normalizzaOperando(op);
  }
  const stato = statoInizialePlc();
  const vuota: SessionePlc = {
    conversione,
    stato,
    risultato: { stato, usciteAttive: [], segmenti: [] },
    ingressoDi,
    premuti: [],
    fissi: [],
    comandi,
    comandiAzionati: [],
    impianti: Object.fromEntries(
      Object.entries(impiantiPosati ?? {})
        .filter(([, i]) => MODELLI_IMPIANTI_PLC[i.tipo])
        .map(([id, i]) => [id, { tipo: i.tipo, operandi: i.operandi, stato: MODELLI_IMPIANTI_PLC[i.tipo].statoIniziale() }]),
    ),
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
  let impianti = s.impianti;
  let cicli = 0;
  while (resto >= s.tempoCiclo - 1e-9 && cicli < CICLI_MASSIMI_PER_PASSO) {
    // Gli ingressi si rileggono a ogni ciclo: i sensori degli impianti cambiano.
    risultato = scansione(s.conversione.programma, stato, ingressiAttivi({ ...s, impianti }), s.tempoCiclo);
    stato = risultato.stato;
    impianti = avanzaImpianti(impianti, stato, s.tempoCiclo);
    resto -= s.tempoCiclo;
    cicli++;
  }
  if (cicli >= CICLI_MASSIMI_PER_PASSO) resto = 0;
  return { ...s, stato, risultato, impianti, resto };
}

/** Pressione del mouse su un componente: se è un contatto su un ingresso, l'ingresso va a 1. */
export function clicGiuPlc(s: SessionePlc, id: string): SessionePlc {
  const imp = s.impianti[id];
  if (imp) return clicImpianto(s, id, "giu");
  const comando = s.comandi[id];
  if (comando) {
    const azionato = s.comandiAzionati.includes(id);
    // Pulsante: azionato finché si tiene premuto. Comando mantenuto: ogni clic lo commuta.
    if (comando.modo === "pulsante" && azionato) return s;
    const comandiAzionati = azionato ? s.comandiAzionati.filter((x) => x !== id) : [...s.comandiAzionati, id];
    return cicloImmediato({ ...s, comandiAzionati });
  }
  const ingresso = s.ingressoDi[id];
  if (!ingresso || s.premuti.includes(ingresso)) return s;
  return cicloImmediato({ ...s, premuti: [...s.premuti, ingresso] });
}

/** Rilascio del mouse sul componente: l'ingresso tenuto premuto torna a 0. */
export function clicSuPlc(s: SessionePlc, id: string): SessionePlc {
  if (s.impianti[id]) return clicImpianto(s, id, "su");
  const comando = s.comandi[id];
  if (comando) {
    if (comando.modo !== "pulsante" || !s.comandiAzionati.includes(id)) return s;
    return cicloImmediato({ ...s, comandiAzionati: s.comandiAzionati.filter((x) => x !== id) });
  }
  const ingresso = s.ingressoDi[id];
  if (!ingresso || !s.premuti.includes(ingresso)) return s;
  return cicloImmediato({ ...s, premuti: s.premuti.filter((i) => i !== ingresso) });
}

/** Mouse rilasciato altrove o finestra senza fuoco: tutti i pulsanti tornano a riposo. */
export function rilasciaTuttiPlc(s: SessionePlc): SessionePlc {
  // I comandi mantenuti restano come sono: si rilasciano solo i pulsanti.
  const comandiAzionati = s.comandiAzionati.filter((id) => s.comandi[id]?.modo !== "pulsante");
  const base = s.premuti.length === 0 && comandiAzionati.length === s.comandiAzionati.length ? s : cicloImmediato({ ...s, premuti: [], comandiAzionati });
  return rilasciaImpianti(base);
}

/** Commuta un ingresso "fisso" (interruttore) dalla tabella degli ingressi. */
export function commutaIngresso(s: SessionePlc, operando: string): SessionePlc {
  const op = normalizzaOperando(operando);
  if (leggiOperando(op)?.area !== "I") return s;
  const fissi = s.fissi.includes(op) ? s.fissi.filter((i) => i !== op) : [...s.fissi, op];
  return cicloImmediato({ ...s, fissi });
}

/** Clic dello studente su un impianto animato (posare un pacco, chiamata pedonale…). */
function clicImpianto(s: SessionePlc, id: string, fase: "giu" | "su"): SessionePlc {
  const imp = s.impianti[id];
  const modello = MODELLI_IMPIANTI_PLC[imp.tipo];
  const azione = fase === "giu" ? modello?.clicGiu : modello?.clicSu;
  if (!azione) return s;
  const stato = azione(imp.stato);
  if (stato === imp.stato) return s;
  return cicloImmediato({ ...s, impianti: { ...s.impianti, [id]: { ...imp, stato } } });
}

/** Rilascio generale anche per gli impianti (es. pulsante pedonale tenuto premuto). */
export function rilasciaImpianti(s: SessionePlc): SessionePlc {
  let r = s;
  for (const id of Object.keys(s.impianti)) r = clicImpianto(r, id, "su");
  return r;
}
