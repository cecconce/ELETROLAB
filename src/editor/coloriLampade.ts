// Colori delle lampade di segnalazione (modulo Impianti). Le sigle sono quelle
// della norma CEI EN 60073 / IEC 60757 usate sugli schemi: RD rosso, GN verde,
// YE giallo, WH bianco, BU blu. Il colore si sceglie nelle Proprietà e si salva
// nel file come parametro "colore" del componente.
import type { ComponenteSchema } from "./schema";

export interface ColoreLampada {
  id: string;
  nome: string;
  /** Sigla normativa scritta accanto al simbolo. */
  sigla: string;
  /** Colore della luce in simulazione. */
  luce: string;
}

export const COLORI_LAMPADA: ColoreLampada[] = [
  { id: "giallo", nome: "Gialla (attenzione)", sigla: "YE", luce: "#ffd54f" },
  { id: "verde", nome: "Verde (marcia, tutto regolare)", sigla: "GN", luce: "#4ade80" },
  { id: "rosso", nome: "Rossa (arresto, allarme)", sigla: "RD", luce: "#f87171" },
  { id: "bianco", nome: "Bianca (presenza tensione)", sigla: "WH", luce: "#f8fafc" },
  { id: "blu", nome: "Blu (intervento richiesto)", sigla: "BU", luce: "#60a5fa" },
];

/** Componenti che hanno il colore della luce. */
export const conColoreLampada = (tipo: string) => tipo === "lampada";

/** Colore della lampada (gialla se non scelto, come nelle versioni precedenti). */
export function coloreLampada(c: Pick<ComponenteSchema, "parametri">): ColoreLampada {
  const id = c.parametri?.colore;
  return COLORI_LAMPADA.find((k) => k.id === id) ?? COLORI_LAMPADA[0];
}

/** Schema con il nuovo colore della lampada. */
export function impostaColoreLampada<S extends { componenti: ComponenteSchema[] }>(schema: S, id: string, colore: string): S {
  return { ...schema, componenti: schema.componenti.map((c) => (c.id === id ? { ...c, parametri: { ...c.parametri, colore } } : c)) };
}
