// Geometria del display a 7 segmenti del banco Arduino, condivisa fra il
// disegno fisso della libreria (generatore) e i segmenti accesi in
// simulazione (DisegnoArduino), così le due cose coincidono sempre.

/** Nomi dei segmenti nell'ordine usato dal motore: a…g e il punto decimale. */
export const SEGMENTI = ["a", "b", "c", "d", "e", "f", "g", "dp"] as const;
export type Segmento = (typeof SEGMENTI)[number];

/** Rettangolo di ogni segmento (x, y, larghezza, altezza) nel disegno 80×100. */
export const RETTANGOLI_SEGMENTI: Record<Exclude<Segmento, "dp">, [number, number, number, number]> = {
  a: [27, 18, 26, 6],
  b: [54, 23, 6, 25],
  c: [54, 52, 6, 25],
  d: [27, 76, 26, 6],
  e: [20, 52, 6, 25],
  f: [20, 23, 6, 25],
  g: [27, 47, 26, 6],
};
/** Punto decimale: centro e raggio. */
export const PUNTO_DECIMALE: [number, number, number] = [66, 79, 3.5];
