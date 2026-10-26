// Colori dell'area di disegno. Il canvas di Konva non legge le variabili CSS,
// quindi i colori dei due temi sono definiti qui, allineati a stile.css.
import type { Tema } from "../interfaccia/tema";
import type { Polo } from "../motori/impianti";

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
  /** Simulazione: fili sotto tensione, un colore per ogni polo della rete. */
  tensione: Record<Polo, string>;
  /** Filo o morsetto in cortocircuito (due poli diversi che si toccano). */
  corto: string;
  /** Contatto chiuso e bobina eccitata. */
  attivo: string;
  /** Lampada accesa (alone) e sirena che suona. */
  luce: string;
  /** Pulsante premuto o comando azionato dallo studente. */
  azionato: string;
  /** Protezione intervenuta o motore in sovraccarico. */
  guasto: string;
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
  // Colori dei conduttori ispirati alla norma (L1 marrone, L2 nero → qui
  // rosso per distinguerlo da un filo senza tensione, L3 grigio → viola,
  // N blu); in continua + rosso e − blu.
  tensione: { L1: "#b45309", L2: "#dc2626", L3: "#7c3aed", N: "#2563eb", "+": "#dc2626", "-": "#2563eb" },
  corto: "#f97316",
  attivo: "#16a34a",
  luce: "#facc15",
  azionato: "#0ea5e9",
  guasto: "#dc2626",
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
  tensione: { L1: "#f59e0b", L2: "#f87171", L3: "#a78bfa", N: "#60a5fa", "+": "#f87171", "-": "#60a5fa" },
  corto: "#fb923c",
  attivo: "#4ade80",
  luce: "#fde047",
  azionato: "#38bdf8",
  guasto: "#f87171",
};

export function coloriEditor(tema: Tema): ColoriEditor {
  return tema === "scuro" ? SCURO : CHIARO;
}
