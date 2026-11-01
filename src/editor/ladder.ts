// Collegamento fra l'editor comune e il motore del PLC (modulo "plc").
//
// Nel modulo PLC la "sigla" di un contatto, di una bobina o di un blocco è il
// suo operando (I0.0, Q0.1, M0.3, T0, C2…): lo studente la cambia nel
// pannello Proprietà come una sigla qualsiasi. Qui:
// - si sceglie l'operando proposto quando si posa un componente;
// - si trasforma lo schema disegnato nell'input del convertitore del motore.
import { convertiLadder, leggiBlocco, leggiOperando, MODELLI_LADDER, type RisultatoConversione } from "../motori/plc";
import type { Schema } from "./schema";

/** Preset proposto per i contatori appena posati (impulsi). */
export const PRESET_CONTATORE_PREDEFINITO = 5;
/** Preset proposto per i temporizzatori appena posati (secondi). */
export const PRESET_TEMPORIZZATORE_PREDEFINITO = 3;

/** Dice se il tipo è un temporizzatore del Ladder (TON, TOF, TP). */
export function eTemporizzatoreLadder(tipo: string): boolean {
  const m = MODELLI_LADDER[tipo];
  return m?.ruolo === "uscita" && (m.uscita === "TON" || m.uscita === "TOF" || m.uscita === "TP");
}

/** Dice se il tipo è un contatore del Ladder (CTU, CTD). */
export function eContatoreLadder(tipo: string): boolean {
  const m = MODELLI_LADDER[tipo];
  return m?.ruolo === "uscita" && (m.uscita === "CTU" || m.uscita === "CTD");
}

/**
 * Primo operando libero per la lettera della libreria:
 * I, Q, M → I0.0, I0.1 … I0.7, I1.0 …; T, C → T0, T1 …
 * "Libero" = non ancora scritto su un componente dello stesso tipo
 * (contatti con contatti, bobine con bobine), così posando tre contatti si
 * ottengono I0.0, I0.1, I0.2 e la prima bobina è comunque Q0.0.
 */
export function prossimoOperando(schema: Schema, lettera: string, tipiSimili: ReadonlySet<string>): string {
  const usati = new Set(schema.componenti.filter((c) => tipiSimili.has(c.tipo)).map((c) => c.etichetta.toUpperCase()));
  if (lettera === "T" || lettera === "C") {
    let n = 0;
    while (usati.has(`${lettera}${n}`)) n++;
    return `${lettera}${n}`;
  }
  if (lettera !== "I" && lettera !== "Q" && lettera !== "M") return "";
  for (let n = 0; ; n++) {
    const operando = `${lettera}${Math.floor(n / 8)}.${n % 8}`;
    if (!usati.has(operando)) return operando;
  }
}

/** Tipi della libreria PLC con lo stesso ruolo (contatti, bobine, temporizzatori, contatori). */
export function tipiSimili(tipo: string): Set<string> {
  const gruppo = (t: string) => {
    const m = MODELLI_LADDER[t];
    if (!m) return "";
    if (m.ruolo !== "uscita") return m.ruolo;
    if (eTemporizzatoreLadder(t)) return "temporizzatore";
    if (eContatoreLadder(t)) return "contatore";
    return "bobina";
  };
  const g = gruppo(tipo);
  return new Set(Object.keys(MODELLI_LADDER).filter((t) => gruppo(t) === g));
}

/** Vero se la sigla scritta è un operando che il PLC capisce. */
export function eOperandoLadder(testo: string): boolean {
  return leggiOperando(testo) !== null || leggiBlocco(testo) !== null;
}

/** Converte lo schema disegnato nel modulo PLC nel programma del motore. */
export function programmaDaSchema(schema: Schema): RisultatoConversione {
  const elementi = schema.componenti
    .filter((c) => MODELLI_LADDER[c.tipo])
    .map((c) => ({
      id: c.id,
      tipo: c.tipo,
      operando: c.etichetta,
      x: c.x,
      y: c.y,
      ...(eTemporizzatoreLadder(c.tipo) ? { preset: c.tempo ?? PRESET_TEMPORIZZATORE_PREDEFINITO } : {}),
      ...(eContatoreLadder(c.tipo) ? { preset: c.preset ?? PRESET_CONTATORE_PREDEFINITO } : {}),
    }));
  return convertiLadder(elementi, schema.fili);
}
