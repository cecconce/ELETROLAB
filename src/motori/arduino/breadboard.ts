// Breadboard (puro): quali fori sono collegati fra loro internamente.
//
// Breadboard da 30 colonne, come quelle dei laboratori:
// - parte alta: righe a…e; parte bassa: righe f…j. In ogni colonna i 5 fori
//   a…e sono collegati fra loro, e così i 5 fori f…j (separati dal solco);
// - quattro linee di alimentazione lungo tutta la lunghezza: in alto "+" e
//   "−", in basso "+" e "−"; ogni linea collega tutti i suoi fori.
// Nomi dei morsetti: "a1"…"j30" per i fori centrali, "Ap1"…"Ap30" e
// "Am1"…"Am30" per le linee in alto (più/meno), "Bp1"… e "Bm1"… in basso.

export const COLONNE_BREADBOARD = 30;
export const RIGHE_ALTE = ["a", "b", "c", "d", "e"];
export const RIGHE_BASSE = ["f", "g", "h", "i", "j"];
export const LINEE = ["Ap", "Am", "Bp", "Bm"];

/** Passo dei fori in unità del foglio (uguale al passo della griglia). */
export const PASSO_FORI = 20;
/** Misure del disegno della breadboard. */
export const LARGHEZZA_BREADBOARD = 660;
export const ALTEZZA_BREADBOARD = 380;
/** Quote dei fori. */
export const X_PRIMA_COLONNA = 40;
export const Y_LINEE: Record<string, number> = { Ap: 20, Am: 40, Bp: 340, Bm: 360 };
export const Y_RIGHE: Record<string, number> = { a: 80, b: 100, c: 120, d: 140, e: 160, f: 220, g: 240, h: 260, i: 280, j: 300 };

/** Morsetti della breadboard con la loro posizione nel disegno. */
export function foriBreadboard(): { id: string; x: number; y: number }[] {
  const fori: { id: string; x: number; y: number }[] = [];
  for (let c = 1; c <= COLONNE_BREADBOARD; c++) {
    const x = X_PRIMA_COLONNA + (c - 1) * PASSO_FORI;
    for (const l of LINEE) fori.push({ id: `${l}${c}`, x, y: Y_LINEE[l] });
    for (const r of [...RIGHE_ALTE, ...RIGHE_BASSE]) fori.push({ id: `${r}${c}`, x, y: Y_RIGHE[r] });
  }
  return fori;
}

/** Gruppo interno di un foro: fori dello stesso gruppo sono lo stesso conduttore. */
export function gruppoForo(foro: string): string | null {
  const linea = /^(Ap|Am|Bp|Bm)(\d+)$/.exec(foro);
  if (linea) return linea[1];
  const centrale = /^([a-j])(\d+)$/.exec(foro);
  if (!centrale) return null;
  const col = Number(centrale[2]);
  if (col < 1 || col > COLONNE_BREADBOARD) return null;
  return `${RIGHE_ALTE.includes(centrale[1]) ? "alto" : "basso"}${col}`;
}
