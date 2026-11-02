// Lettura e scrittura dei valori con i prefissi del Sistema Internazionale,
// come si scrivono sugli schemi: 4,7k  100n  10µ  2m2  1M.

const PREFISSI: Record<string, number> = {
  p: 1e-12,
  n: 1e-9,
  u: 1e-6,
  µ: 1e-6,
  μ: 1e-6,
  m: 1e-3,
  "": 1,
  k: 1e3,
  K: 1e3,
  M: 1e6,
  G: 1e9,
};

/**
 * Legge un valore scritto dallo studente. L'unità di misura in fondo è
 * facoltativa e viene ignorata ("10 kΩ", "100nF", "4k7", "0,5 V", "1e-3").
 * Restituisce null se il testo non è un numero valido.
 */
export function leggiValore(testo: string): number | null {
  let t = testo.trim().replace(/\s/g, "").replace(",", ".");
  // Toglie l'unità di misura (Ω, ohm, F, H, V, A, Hz, W, s).
  t = t.replace(/(ohm|Ω|Hz|F|H|V|A|W|s)$/i, "");
  if (t === "") return null;
  if (/^[+-]?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(t)) return Number(t);
  // Notazione con il prefisso al posto della virgola: 4k7 = 4,7k; 2m2 = 2,2m.
  const m = /^([+-]?\d+(?:\.\d+)?)([pnuµμmkKMG])(\d*)$/.exec(t);
  if (!m) return null;
  let base = m[1];
  if (m[3]) {
    if (base.includes(".")) return null;
    base = `${base}.${m[3]}`;
  }
  const v = Number(base) * PREFISSI[m[2]];
  return Number.isFinite(v) ? v : null;
}

/** Scrive un valore con il prefisso adatto e l'unità: 4700 → "4,7 kΩ", 1e-7 → "100 nF". */
export function scriviValore(v: number, unita = ""): string {
  if (!Number.isFinite(v)) return `— ${unita}`.trim();
  if (v === 0) return `0 ${unita}`.trim();
  const scale: [number, string][] = [
    [1e9, "G"],
    [1e6, "M"],
    [1e3, "k"],
    [1, ""],
    [1e-3, "m"],
    [1e-6, "µ"],
    [1e-9, "n"],
    [1e-12, "p"],
  ];
  const a = Math.abs(v);
  const [f, p] = scale.find(([f]) => a >= f * 0.9995) ?? scale[scale.length - 1];
  const n = v / f;
  // Tre cifre significative, senza zeri inutili.
  const cifre = Math.abs(n) >= 100 ? 0 : Math.abs(n) >= 10 ? 1 : 2;
  const testo = String(Number(n.toFixed(cifre))).replace(".", ",");
  return `${testo} ${p}${unita}`.trim();
}
