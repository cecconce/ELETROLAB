// Colori dell'area di disegno. Il canvas di Konva non legge le variabili CSS,
// quindi i colori dei due temi sono definiti qui, allineati a stile.css.
import type { Tema } from "../interfaccia/tema";

export interface ColoriEditor {
  foglio: string;
  griglia: string;
  grigliaForte: string;
  componente: string;
  bordoComponente: string;
  testo: string;
  selezione: string;
  rettangoloSelezione: string;
  /** Fili e pallini di giunzione. */
  filo: string;
  /** Morsetto libero (cerchietto vuoto) e morsetto sotto il mouse. */
  morsetto: string;
  morsettoAttivo: string;
}

const CHIARO: ColoriEditor = {
  foglio: "#ffffff",
  griglia: "#e3e8ee",
  grigliaForte: "#c9d1da",
  componente: "#f8fafc",
  bordoComponente: "#1d2733",
  testo: "#1d2733",
  selezione: "#2563eb",
  rettangoloSelezione: "rgba(37, 99, 235, 0.12)",
  filo: "#1d2733",
  morsetto: "#64748b",
  morsettoAttivo: "#dc2626",
};

const SCURO: ColoriEditor = {
  foglio: "#11161c",
  griglia: "#232c36",
  grigliaForte: "#34404c",
  componente: "#1f2730",
  bordoComponente: "#e6ebf0",
  testo: "#e6ebf0",
  selezione: "#60a5fa",
  rettangoloSelezione: "rgba(96, 165, 250, 0.18)",
  filo: "#e6ebf0",
  morsetto: "#94a3b8",
  morsettoAttivo: "#f87171",
};

export function coloriEditor(tema: Tema): ColoriEditor {
  return tema === "scuro" ? SCURO : CHIARO;
}
