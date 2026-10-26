// Sessione di simulazione degli impianti (pura: nessuna interfaccia).
//
// Raccoglie in un unico oggetto immutabile tutto quello che serve mentre la
// simulazione è avviata: il circuito (bloccato), la memoria del tempo
// (tempo.ts), le azioni dello studente (pulsanti tenuti premuti, comandi a
// posizione mantenuta, sovraccarichi messi ai motori) e l'ultimo risultato.
// L'interfaccia chiama:
// - `avviaSessione` quando si preme ▶ AVVIA;
// - `clicGiu` / `clicSu` quando lo studente preme e rilascia il mouse su un componente;
// - `rilasciaTutti` quando il mouse viene rilasciato fuori dal componente;
// - `passo` a intervalli regolari con il tempo reale trascorso.
import { MODELLI_IMPIANTI, PROTEZIONI } from "./modelli";
import { avanza, prossimoEvento, riarma, statoIniziale, type StatoImpianto } from "./tempo";
import type { Circuito, RisultatoConProtezioni } from "./simulatore";

export interface SessioneImpianto {
  circuito: Circuito;
  stato: StatoImpianto;
  /** Pulsanti tenuti premuti in questo momento. */
  premuti: readonly string[];
  /** Comandi a posizione mantenuta azionati (selettori, finecorsa, sensori, sezionatori, salvamotori). */
  azionati: readonly string[];
  /** Motori frenati dallo studente (sovraccarico simulato). */
  sovraccarichi: readonly string[];
  risultato: RisultatoConProtezioni;
}

/**
 * Che cosa succede cliccando un componente durante la simulazione:
 * - pulsante: azionato finché si tiene premuto il mouse;
 * - manuale: un clic aziona, il clic successivo riporta a riposo;
 * - riarmo: protezione senza manovra (fusibile, magnetotermico, relè termico),
 *   il clic la riarma se è intervenuta;
 * - motore: il clic mette o toglie un sovraccarico (albero frenato);
 * - null: il clic non fa niente (bobine, contatti comandati, lampade…).
 * Il salvamotore è "manuale" ma, se è intervenuto, il primo clic lo riarma.
 */
export type AzioneClic = "pulsante" | "manuale" | "riarmo" | "motore" | null;

export function azioneClic(tipo: string): AzioneClic {
  const m = MODELLI_IMPIANTI[tipo];
  if (!m) return null;
  if (m.tipo === "contatto" && m.comando.tipo === "pulsante") return "pulsante";
  if (m.tipo === "contatto" && m.comando.tipo === "manuale") return "manuale";
  if (PROTEZIONI[tipo]) return "riarmo";
  if (m.tipo === "carico" && m.motore) return "motore";
  return null;
}

/** Ricalcola il circuito nell'istante attuale (dt = 0) dopo un'azione dello studente. */
function ricalcola(s: Omit<SessioneImpianto, "risultato"> & { risultato?: RisultatoConProtezioni }, dt = 0): SessioneImpianto {
  const { stato, risultato } = avanza(
    s.circuito,
    s.stato,
    { premuti: s.premuti, azionati: s.azionati, sovraccarichi: s.sovraccarichi },
    dt,
  );
  return { ...s, stato, risultato };
}

/** Avvio della simulazione: tutto a riposo, tempo zero. */
export function avviaSessione(circuito: Circuito): SessioneImpianto {
  return ricalcola({ circuito, stato: statoIniziale(), premuti: [], azionati: [], sovraccarichi: [] });
}

const senza = (elenco: readonly string[], id: string) => elenco.filter((x) => x !== id);
const tipoDi = (s: SessioneImpianto, id: string) => s.circuito.componenti.find((c) => c.id === id)?.tipo;

/** Pressione del mouse su un componente. */
export function clicGiu(s: SessioneImpianto, id: string): SessioneImpianto {
  const tipo = tipoDi(s, id);
  if (!tipo) return s;
  const intervenuta = s.stato.protezioniIntervenute.includes(id);
  switch (azioneClic(tipo)) {
    case "pulsante":
      return s.premuti.includes(id) ? s : ricalcola({ ...s, premuti: [...s.premuti, id] });
    case "manuale":
      if (intervenuta) {
        // Salvamotore scattato: il clic lo riarma e la leva torna su "0" (aperto).
        return ricalcola({ ...s, stato: riarma(s.stato, id), azionati: senza(s.azionati, id) });
      }
      return ricalcola({ ...s, azionati: s.azionati.includes(id) ? senza(s.azionati, id) : [...s.azionati, id] });
    case "riarmo":
      return intervenuta ? ricalcola({ ...s, stato: riarma(s.stato, id) }) : s;
    case "motore":
      return ricalcola({
        ...s,
        sovraccarichi: s.sovraccarichi.includes(id) ? senza(s.sovraccarichi, id) : [...s.sovraccarichi, id],
      });
    default:
      return s;
  }
}

/** Rilascio del mouse su un componente: solo i pulsanti tornano a riposo. */
export function clicSu(s: SessioneImpianto, id: string): SessioneImpianto {
  return s.premuti.includes(id) ? ricalcola({ ...s, premuti: senza(s.premuti, id) }) : s;
}

/** Rilascio del mouse fuori dai componenti (o finestra che perde il fuoco): tutti i pulsanti tornano a riposo. */
export function rilasciaTutti(s: SessioneImpianto): SessioneImpianto {
  return s.premuti.length === 0 ? s : ricalcola({ ...s, premuti: [] });
}

/** Massimo numero di sotto-passi in un singolo `passo` (protezione da cicli infiniti). */
const MAX_SOTTOPASSI = 200;

/**
 * Fa scorrere il tempo di `dt` secondi. Se nel frattempo scade un ritardo, il
 * passo viene spezzato esattamente in quell'istante: così un temporizzatore
 * da 3 s commuta a 3 s anche se l'interfaccia chiama `passo` ogni 50 ms o
 * dopo una pausa lunga (finestra ridotta a icona).
 */
export function passo(s: SessioneImpianto, dt: number): SessioneImpianto {
  let corrente = s;
  let resto = Math.max(0, dt);
  for (let i = 0; i < MAX_SOTTOPASSI && resto > 0; i++) {
    const evento = prossimoEvento(corrente.circuito, corrente.stato);
    const pezzo = evento !== null && evento < resto ? evento : resto;
    corrente = ricalcola(corrente, pezzo);
    resto -= pezzo;
  }
  return corrente;
}
