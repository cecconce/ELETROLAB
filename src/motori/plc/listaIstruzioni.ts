// Traduzione del programma Ladder (KOP) in Lista istruzioni (IL/AWL), in sola
// lettura (puro: nessuna interfaccia).
//
// A scuola il Ladder si studia insieme alla lista istruzioni: qui lo studente
// vede lo stesso programma scritto riga per riga. Si usano le istruzioni della
// norma IEC 61131-3 (LD, AND, OR, ST, S, R, parentesi per i rami in serie o in
// parallelo), con queste scelte per restare leggibili:
// - contatti di fronte: LDP/ANDP/ORP (salita) e LDF/ANDF/ORF (discesa);
// - temporizzatori e contatori: il risultato va nell'ingresso del blocco
//   (ST T0.IN, ST C0.CU) e il blocco si richiama con CAL e il suo preset;
// - nello stesso segmento prima tutte le uscite che usano il risultato, poi
//   i richiami dei blocchi (dopo un CAL il risultato non è più quello del segmento).
import { eContatore, eTemporizzatore, type Logica, type ProgrammaLadder, type TipoContatto, type Uscita } from "./programma";

/** Suffisso dell'istruzione secondo il tipo di contatto. */
const SUFFISSO: Record<TipoContatto, string> = { NA: "", NC: "N", P: "P", N: "F" };

/** Una riga di lista istruzioni: istruzione, operando e commento facoltativo. */
const riga = (istruzione: string, operando = "", commento = "") =>
  `${istruzione.padEnd(6)}${operando}`.trimEnd() + (commento ? `${" ".repeat(Math.max(1, 22 - `${istruzione.padEnd(6)}${operando}`.length))}(* ${commento} *)` : "");

/** Elenco piatto: una serie dentro una serie (o un parallelo dentro un parallelo) si scioglie. */
function elementiDi(l: Logica, tipo: "serie" | "parallelo"): Logica[] {
  if (l.tipo !== tipo) return [l];
  const lista = l.tipo === "serie" ? l.elementi : l.tipo === "parallelo" ? l.rami : [];
  return lista.flatMap((e) => elementiDi(e, tipo));
}

/**
 * Righe della logica. `inizio` = è il primo operando (LD); altrimenti `legame`
 * dice come si unisce a quanto già calcolato (AND per la serie, OR per il parallelo).
 */
function righeLogica(l: Logica, inizio: boolean, legame: "AND" | "OR"): string[] {
  if (l.tipo === "contatto") return [riga(`${inizio ? "LD" : legame}${SUFFISSO[l.contatto]}`, l.operando)];
  const tipo = l.tipo;
  const parti = elementiDi(l, tipo);
  if (parti.length === 1) return righeLogica(parti[0], inizio, legame);
  const interno = tipo === "serie" ? "AND" : "OR";
  // Gruppo che si unisce con lo stesso legame (serie in serie): niente parentesi.
  if (inizio || interno === legame) return parti.flatMap((p, i) => righeLogica(p, inizio && i === 0, interno));
  // Gruppo diverso: fra parentesi, con il suo primo operando caricato da capo.
  return [riga(`${legame}(`), ...parti.flatMap((p, i) => righeLogica(p, i === 0, interno)).map((r) => `  ${r}`), riga(")")];
}

/** Durata IEC di un temporizzatore: T#5s, T#1.5s. */
const durata = (secondi: number) => `T#${Number.isFinite(secondi) ? Math.round(secondi * 1000) / 1000 : 0}s`;

const NOMI_BLOCCO: Record<string, string> = {
  TON: "ritardo all'inserzione",
  TOF: "ritardo alla disinserzione",
  TP: "impulso",
  CTU: "contatore in avanti",
  CTD: "contatore all'indietro",
};

function righeUscite(uscite: readonly Uscita[]): string[] {
  const subito: string[] = [];
  const blocchi: string[] = [];
  for (const u of uscite) {
    if (eTemporizzatore(u)) {
      subito.push(riga("ST", `${u.operando}.IN`));
      blocchi.push(riga("CAL", `${u.operando}(PT := ${durata(u.preset)})`, `${u.tipo}: ${NOMI_BLOCCO[u.tipo]}`));
    } else if (eContatore(u)) {
      subito.push(riga("ST", `${u.operando}.${u.tipo === "CTU" ? "CU" : "CD"}`));
      blocchi.push(riga("CAL", `${u.operando}(PV := ${Math.round(u.preset)})`, `${u.tipo}: ${NOMI_BLOCCO[u.tipo]}`));
    } else {
      const istruzione = { bobina: "ST", bobinaNegata: "STN", set: "S", reset: "R" }[u.tipo];
      subito.push(riga(istruzione, u.operando));
    }
  }
  return [...subito, ...blocchi];
}

/** Lista istruzioni dell'intero programma, un blocco di righe per segmento. */
export function listaIstruzioni(programma: ProgrammaLadder): string {
  if (programma.segmenti.length === 0) return "(* Programma vuoto: disegna almeno un segmento nel Ladder. *)\n";
  const blocchi = programma.segmenti.map((s, i) => {
    const titolo = `(* Segmento ${i + 1}${s.commento ? `: ${s.commento.replace(/\*\)/g, "* )")}` : ""} *)`;
    const logica = s.logica ? righeLogica(s.logica, true, "AND") : [riga("LD", "TRUE", "sempre alimentato")];
    return [titolo, ...logica, ...righeUscite(s.uscite)].join("\n");
  });
  return blocchi.join("\n\n") + "\n";
}
