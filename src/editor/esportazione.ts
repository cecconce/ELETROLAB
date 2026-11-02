// Esportazione e stampa dello schema: tavola in formato A4 orizzontale con la
// cornice, lo schema adattato al foglio e il cartiglio in basso a destra
// (titolo, nome, classe, data, modulo), come sulle tavole del disegno tecnico.
// Con il tema scuro lo schema viene "rovesciato" in chiaro: la tavola esce
// sempre su fondo bianco, pronta da stampare.
import { byteDaDataUrl, pdfConImmagine } from "../progetto/pdf";

export interface Cartiglio {
  titolo: string;
  nome: string;
  classe: string;
  data: string;
  modulo: string;
}

/** Misure della tavola in pixel (A4 orizzontale a circa 170 dpi). */
export const TAVOLA = { larghezza: 2000, altezza: 1414 };
const MARGINE = 36;
const ALTEZZA_CARTIGLIO = 210;
const LARGHEZZA_CARTIGLIO = 820;

/** Data di oggi come si scrive in Italia: 02/11/2026. */
export function dataDiOggi(adesso = new Date()): string {
  const d = (n: number) => String(n).padStart(2, "0");
  return `${d(adesso.getDate())}/${d(adesso.getMonth() + 1)}/${adesso.getFullYear()}`;
}

/**
 * Posizione e scala dello schema nella tavola: il più grande possibile nella
 * zona sopra il cartiglio, senza ingrandire oltre 1,5 volte, centrato.
 */
export function adattaSchema(larghezza: number, altezza: number): { x: number; y: number; scala: number } {
  const w = TAVOLA.larghezza - 2 * MARGINE - 40;
  const h = TAVOLA.altezza - 2 * MARGINE - ALTEZZA_CARTIGLIO - 40;
  const scala = Math.min(w / larghezza, h / altezza, 1.5);
  return { x: MARGINE + 20 + (w - larghezza * scala) / 2, y: MARGINE + 20 + (h - altezza * scala) / 2, scala };
}

/** Disegna la tavola completa su un nuovo canvas. */
export function componiTavola(schema: HTMLCanvasElement | null, c: Cartiglio, scuro: boolean): HTMLCanvasElement {
  const tela = document.createElement("canvas");
  tela.width = TAVOLA.larghezza;
  tela.height = TAVOLA.altezza;
  const ctx = tela.getContext("2d");
  if (!ctx) return tela;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, tela.width, tela.height);
  if (schema && schema.width > 0 && schema.height > 0) {
    // Lo schema è a risoluzione doppia: si riporta alle sue misure "vere".
    const { x, y, scala } = adattaSchema(schema.width / 2, schema.height / 2);
    ctx.save();
    if (scuro) ctx.filter = "invert(1) hue-rotate(180deg)";
    ctx.drawImage(schema, x, y, (schema.width / 2) * scala, (schema.height / 2) * scala);
    ctx.restore();
  }
  // Cornice
  ctx.strokeStyle = "#1d2733";
  ctx.lineWidth = 4;
  ctx.strokeRect(MARGINE, MARGINE, tela.width - 2 * MARGINE, tela.height - 2 * MARGINE);
  // Cartiglio
  const x0 = tela.width - MARGINE - LARGHEZZA_CARTIGLIO;
  const y0 = tela.height - MARGINE - ALTEZZA_CARTIGLIO;
  ctx.lineWidth = 3;
  ctx.strokeRect(x0, y0, LARGHEZZA_CARTIGLIO, ALTEZZA_CARTIGLIO);
  const riga = ALTEZZA_CARTIGLIO / 3;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x0, y0 + riga);
  ctx.lineTo(x0 + LARGHEZZA_CARTIGLIO, y0 + riga);
  ctx.moveTo(x0, y0 + 2 * riga);
  ctx.lineTo(x0 + LARGHEZZA_CARTIGLIO, y0 + 2 * riga);
  const colonna = x0 + LARGHEZZA_CARTIGLIO * 0.55;
  ctx.moveTo(colonna, y0 + riga);
  ctx.lineTo(colonna, y0 + ALTEZZA_CARTIGLIO);
  ctx.stroke();
  const campo = (etichetta: string, valore: string, x: number, y: number, larghezza: number, grande = false) => {
    ctx.fillStyle = "#64748b";
    ctx.font = "18px Segoe UI, Arial, sans-serif";
    ctx.fillText(etichetta, x + 12, y + 22);
    ctx.fillStyle = "#1d2733";
    ctx.font = `${grande ? "bold 30px" : "26px"} Segoe UI, Arial, sans-serif`;
    let testo = valore;
    while (testo.length > 1 && ctx.measureText(testo).width > larghezza - 24) testo = testo.slice(0, -2) + "…";
    ctx.fillText(testo, x + 12, y + riga - 12);
  };
  campo("Titolo", c.titolo, x0, y0, LARGHEZZA_CARTIGLIO, true);
  campo("Nome", c.nome, x0, y0 + riga, colonna - x0);
  campo("Classe", c.classe, colonna, y0 + riga, x0 + LARGHEZZA_CARTIGLIO - colonna);
  campo("Data", c.data, x0, y0 + 2 * riga, colonna - x0);
  campo("Modulo", c.modulo, colonna, y0 + 2 * riga, x0 + LARGHEZZA_CARTIGLIO - colonna);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "16px Segoe UI, Arial, sans-serif";
  ctx.fillText("Disegnato con ElettroLab", MARGINE + 12, tela.height - MARGINE - 12);
  return tela;
}

/** Tavola in PNG (byte del file). */
export function tavolaPng(tela: HTMLCanvasElement): Uint8Array {
  return byteDaDataUrl(tela.toDataURL("image/png"));
}

/** Tavola in PDF A4 orizzontale (immagine JPEG di qualità alta). */
export function tavolaPdf(tela: HTMLCanvasElement, titolo: string): Uint8Array {
  return pdfConImmagine(byteDaDataUrl(tela.toDataURL("image/jpeg", 0.92)), tela.width, tela.height, undefined, titolo);
}

/**
 * Stampa: l'immagine della tavola va in un riquadro visibile solo in stampa
 * (vedi @media print in stile.css) e si apre la finestra di stampa di Windows.
 */
export function stampaTavola(tela: HTMLCanvasElement): void {
  document.querySelector(".area-stampa")?.remove();
  const area = document.createElement("div");
  area.className = "area-stampa";
  const img = document.createElement("img");
  img.alt = "";
  img.src = tela.toDataURL("image/png");
  area.appendChild(img);
  document.body.appendChild(area);
  const via = () => area.remove();
  window.addEventListener("afterprint", via, { once: true });
  img.onload = () => window.print();
}
