// Operandi del PLC (puro: nessuna interfaccia).
//
// Si usa la notazione a byte e bit diffusa nei laboratori scolastici:
//   I0.0 … I0.7, I1.0 …   ingressi (pulsanti, finecorsa, sensori del quadro)
//   Q0.0 … Q0.7, Q1.0 …   uscite (lampade, motori, attuatori)
//   M0.0 … M0.7, M1.0 …   merker (bit di memoria interni)
//   T0 … T63              temporizzatori (il contatto T0 legge la loro uscita)
//   C0 … C63              contatori (il contatto C0 legge la loro uscita)
// Le lettere minuscole e gli spazi vengono accettati e normalizzati
// ("i 0.1" → "I0.1"), così lo studente non viene punito per la forma.

/** Aree di memoria per gli operandi a bit. */
export type AreaBit = "I" | "Q" | "M";

/** Operando a bit scomposto. */
export interface OperandoBit {
  area: AreaBit;
  byte: number;
  bit: number;
}

/** Numero massimo di byte per area (abbondante per gli esercizi scolastici). */
export const BYTE_MASSIMI = 16;

const SCHEMA = /^([IQM])(\d{1,2})\.([0-7])$/;

/** Forma normalizzata: maiuscole, senza spazi. */
export function normalizzaOperando(testo: string): string {
  return testo.replace(/\s+/g, "").toUpperCase();
}

/** Scompone un operando a bit; restituisce null se non è valido. */
export function leggiOperando(testo: string): OperandoBit | null {
  const m = SCHEMA.exec(normalizzaOperando(testo));
  if (!m) return null;
  const byte = Number(m[2]);
  if (byte >= BYTE_MASSIMI) return null;
  return { area: m[1] as AreaBit, byte, bit: Number(m[3]) };
}

/** Vero se il testo è un operando a bit valido (I, Q o M). */
export function operandoValido(testo: string): boolean {
  return leggiOperando(testo) !== null;
}

/** Vero se l'operando si può scrivere da una bobina (gli ingressi no). */
export function operandoScrivibile(testo: string): boolean {
  const op = leggiOperando(testo);
  return op !== null && op.area !== "I";
}

/** Riscrive un operando scomposto nella forma normalizzata. */
export function scriviOperando(op: OperandoBit): string {
  return `${op.area}${op.byte}.${op.bit}`;
}

// --- Temporizzatori e contatori ---

/** Aree dei blocchi funzionali: temporizzatori (T) e contatori (C). */
export type AreaBlocco = "T" | "C";

export interface OperandoBlocco {
  area: AreaBlocco;
  numero: number;
}

/** Quanti temporizzatori e quanti contatori ci sono (T0…T63, C0…C63). */
export const BLOCCHI_MASSIMI = 64;

const SCHEMA_BLOCCO = /^([TC])(\d{1,2})$/;

/** Scompone un operando di temporizzatore o contatore; null se non è valido. */
export function leggiBlocco(testo: string): OperandoBlocco | null {
  const m = SCHEMA_BLOCCO.exec(normalizzaOperando(testo));
  if (!m) return null;
  const numero = Number(m[2]);
  if (numero >= BLOCCHI_MASSIMI) return null;
  return { area: m[1] as AreaBlocco, numero };
}

/** Vero se l'operando si può usare su un contatto: I, Q, M a bit oppure T, C. */
export function operandoContattoValido(testo: string): boolean {
  return leggiOperando(testo) !== null || leggiBlocco(testo) !== null;
}
