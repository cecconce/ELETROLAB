// Generatore dei disegni "realistici" del modulo Impianti elettrici (strumento
// per chi sviluppa): scrive libreria/icone/realistico/<icona>.svg, uno per ogni
// simbolo della libreria impianti, con lo stesso nome del file del simbolo.
// Nell'editor si sceglie con il pulsante «Simboli / Realistico»: i disegni
// hanno le stesse misure e i morsetti negli stessi punti dei simboli CEI, così
// fili, collegamenti e simulazione funzionano allo stesso modo.
// Sono disegni originali e stilizzati di apparecchi da quadro (moduli su guida
// DIN, pulsanti, spie, motori), senza marchi.
//
// Uso: npx vite-node strumenti/genera-icone-realistiche-impianti.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const FONT = 'font-family="Segoe UI, Arial, sans-serif"';
const svg = (w: number, h: number, corpo: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n${corpo}\n</svg>\n`;
const scritta = (x: number, y: number, t: string, dim = 8, colore = "#263238", extra = "") =>
  `<text x="${x}" y="${y}" font-size="${dim}" text-anchor="middle" fill="${colore}" ${FONT} ${extra}>${t}</text>`;

/** Morsetto a vite con il suo spezzone di filo verso il punto di collegamento (x, y). */
const vite = (x: number, y: number, h: number) => {
  const yv = y === 0 ? 7 : y === h ? h - 7 : y;
  const filo = y === 0 ? `<path d="M${x} 0V${yv}" stroke="#8d6e63" stroke-width="2.4"/>` : y === h ? `<path d="M${x} ${h}V${yv}" stroke="#8d6e63" stroke-width="2.4"/>` : "";
  return `${filo}<circle cx="${x}" cy="${yv}" r="4.2" fill="#cfd8dc" stroke="#546e7a" stroke-width="1"/><path d="M${x - 2.6} ${yv - 2.6}L${x + 2.6} ${yv + 2.6}" stroke="#546e7a" stroke-width="1.2"/>`;
};
/** Corpo di un modulo su guida DIN (grigio chiaro con bordo). */
const modulo = (x: number, y: number, w: number, h: number, colore = "#eceff1") =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${colore}" stroke="#78909c" stroke-width="1.2"/>` +
  `<rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="3" rx="1.5" fill="#ffffff" opacity="0.7"/>`;
/** Apparecchio verticale 40×80 con i morsetti in alto (20,0) e in basso (20,80). */
const verticale = (interno: string, colore?: string) => svg(40, 80, `${modulo(6, 12, 28, 56, colore)}${vite(20, 0, 80)}${vite(20, 80, 80)}${interno}`);
/** Tripolare 80×80 (o più largo) con morsetti in alto e in basso a x = 20, 40, 60. */
const tripolare = (w: number, interno: string) =>
  svg(w, 80, `${modulo(6, 12, w - 12, 56)}${[20, 40, 60].map((x) => vite(x, 0, 80) + vite(x, 80, 80)).join("")}${interno}`);

const icone: Record<string, string> = {};

// --- Alimentazione: morsettiere colorate secondo i colori dei conduttori.
const morsettiera = (w: number, morsetti: [number, string, string][]) =>
  svg(
    w,
    40,
    `<rect x="4" y="4" width="${w - 8}" height="24" rx="3" fill="#455a64" stroke="#263238"/>` +
      morsetti.map(([x, nome, colore]) => `<rect x="${x - 8}" y="7" width="16" height="18" rx="2" fill="${colore}"/>${scritta(x, 19, nome, 7, "#ffffff", 'font-weight="bold"')}<path d="M${x} 25V40" stroke="${colore}" stroke-width="3"/>`).join(""),
  );
icone["rete-trifase.svg"] = morsettiera(80, [[20, "L1", "#6d4c41"], [40, "L2", "#212121"], [60, "L3", "#757575"]]);
icone["rete-monofase.svg"] = morsettiera(60, [[20, "L", "#6d4c41"], [40, "N", "#1e88e5"]]);
icone["alimentatore-cc.svg"] = svg(
  60,
  40,
  `<rect x="3" y="2" width="54" height="26" rx="3" fill="#cfd8dc" stroke="#546e7a"/>${scritta(30, 12, "24 V DC", 7, "#263238", 'font-weight="bold"')}` +
    `<circle cx="20" cy="21" r="4" fill="#e53935"/><circle cx="40" cy="21" r="4" fill="#212121"/><path d="M20 25V40" stroke="#e53935" stroke-width="3"/><path d="M40 25V40" stroke="#212121" stroke-width="3"/>`,
);

// --- Protezioni e manovra.
icone["fusibile.svg"] = verticale(
  `<rect x="11" y="22" width="18" height="36" rx="4" fill="#fafafa" stroke="#90a4ae"/><rect x="15" y="28" width="10" height="24" rx="2" fill="#b3e5fc" opacity="0.8"/>` +
    `<path d="M20 29V51" stroke="#ffb300" stroke-width="1.2"/><circle cx="20" cy="55" r="2" fill="#e53935"/>${scritta(20, 19, "10A", 6)}`,
);
const levaDin = (colore: string, testo: string) =>
  verticale(`<rect x="13" y="30" width="14" height="20" rx="2" fill="#37474f"/><rect x="15" y="32" width="10" height="9" rx="1.5" fill="${colore}"/>${scritta(20, 24, testo, 7, "#263238", 'font-weight="bold"')}${scritta(20, 62, "I-ON", 5, "#e53935")}`);
icone["magnetotermico.svg"] = levaDin("#1e88e5", "C16");
icone["contatto-termico-nc.svg"] = verticale(`<rect x="10" y="30" width="20" height="20" rx="2" fill="#cfd8dc"/>${scritta(20, 38, "95", 7)}${scritta(20, 48, "96", 7)}<circle cx="20" cy="58" r="3" fill="#e53935"/>${scritta(20, 24, "NC", 7, "#e53935", 'font-weight="bold"')}`);
icone["contatto-termico-na.svg"] = verticale(`<rect x="10" y="30" width="20" height="20" rx="2" fill="#cfd8dc"/>${scritta(20, 38, "97", 7)}${scritta(20, 48, "98", 7)}<circle cx="20" cy="58" r="3" fill="#43a047"/>${scritta(20, 24, "NA", 7, "#43a047", 'font-weight="bold"')}`);
icone["sezionatore.svg"] = tripolare(
  80,
  `<rect x="18" y="22" width="44" height="36" rx="3" fill="#fdd835" stroke="#f9a825"/><circle cx="40" cy="40" r="13" fill="#c62828"/><rect x="36" y="25" width="8" height="30" rx="3" fill="#e53935" stroke="#b71c1c"/>${scritta(26, 56, "0", 7)}${scritta(54, 30, "I", 7)}`,
);
icone["salvamotore.svg"] = svg(
  100,
  80,
  `${modulo(6, 12, 88, 56)}${[20, 40, 60].map((x) => vite(x, 0, 80) + vite(x, 80, 80)).join("")}` +
    `<circle cx="34" cy="40" r="10" fill="#cfd8dc" stroke="#78909c"/><path d="M34 32V40L40 44" stroke="#37474f" stroke-width="1.5"/>${scritta(34, 60, "2,5–4 A", 6)}` +
    `<circle cx="70" cy="31" r="7" fill="#43a047" stroke="#2e7d32"/>${scritta(70, 34, "I", 8, "#ffffff", 'font-weight="bold"')}<circle cx="70" cy="50" r="7" fill="#e53935" stroke="#b71c1c"/>${scritta(70, 53, "O", 8, "#ffffff", 'font-weight="bold"')}`,
);
icone["rele-termico.svg"] = tripolare(
  80,
  `<circle cx="30" cy="40" r="10" fill="#cfd8dc" stroke="#78909c"/><path d="M30 32V40L36 43" stroke="#37474f" stroke-width="1.5"/><rect x="48" y="30" width="16" height="12" rx="3" fill="#1e88e5"/>${scritta(56, 38, "R", 7, "#ffffff", 'font-weight="bold"')}${scritta(56, 56, "95 96", 5)}`,
);

// --- Comandi: il tasto (o la leva, la manopola) sta a sinistra, come l'azionatore nel simbolo.
const pulsante = (colore: string, bordo: string, segno: string) =>
  verticale(
    `<circle cx="9" cy="40" r="10" fill="#cfd8dc" stroke="#78909c"/><circle cx="9" cy="40" r="7.5" fill="${colore}" stroke="${bordo}" stroke-width="1.2"/>` +
      `<ellipse cx="7" cy="37" rx="3" ry="2" fill="#ffffff" opacity="0.5"/>${scritta(9, 43, segno, 8, "#ffffff", 'font-weight="bold"')}` +
      `<rect x="22" y="28" width="9" height="24" rx="2" fill="#cfd8dc"/>`,
    "#eceff1",
  );
icone["pulsante-na.svg"] = pulsante("#43a047", "#2e7d32", "I");
icone["pulsante-nc.svg"] = pulsante("#e53935", "#b71c1c", "O");
// Fungo d'emergenza: testa rossa grande su una base gialla, a sinistra come gli altri tasti.
icone["pulsante-emergenza.svg"] = verticale(
  `<circle cx="11" cy="40" r="11" fill="#fdd835" stroke="#f9a825"/><circle cx="11" cy="40" r="8.5" fill="#e53935" stroke="#b71c1c" stroke-width="1.2"/>` +
    `<ellipse cx="8" cy="36" rx="3.5" ry="2.2" fill="#ffffff" opacity="0.45"/><rect x="24" y="28" width="8" height="24" rx="2" fill="#cfd8dc"/>`,
  "#eceff1",
);
// Impianti civili: frutto bianco con il tasto basculante; morsetti a vite anche agli angoli.
const viteAngolo = (x: number, y: number) => {
  const xv = x === 0 ? 6 : 34;
  const yv = y === 0 ? 7 : 73;
  return `<path d="M${x} ${y}L${xv} ${yv}" stroke="#8d6e63" stroke-width="2.4"/><circle cx="${xv}" cy="${yv}" r="4.2" fill="#cfd8dc" stroke="#546e7a" stroke-width="1"/><path d="M${xv - 2.6} ${yv - 2.6}L${xv + 2.6} ${yv + 2.6}" stroke="#546e7a" stroke-width="1.2"/>`;
};
const frutto = (morsetti: string, segno: string) =>
  svg(
    40,
    80,
    `<rect x="5" y="14" width="30" height="52" rx="4" fill="#fafafa" stroke="#90a4ae" stroke-width="1.2"/>` +
      `<rect x="9" y="20" width="22" height="40" rx="3" fill="#ffffff" stroke="#b0bec5"/><path d="M9 40H31" stroke="#cfd8dc"/>` +
      `<rect x="12" y="23" width="16" height="15" rx="2" fill="#eceff1"/>${scritta(20, 54, segno, 7, "#546e7a", 'font-weight="bold"')}${morsetti}`,
  );
icone["deviatore.svg"] = frutto(`${vite(20, 0, 80)}${viteAngolo(0, 80)}${viteAngolo(40, 80)}`, "⇄");
icone["invertitore.svg"] = frutto(`${viteAngolo(0, 0)}${viteAngolo(40, 0)}${viteAngolo(0, 80)}${viteAngolo(40, 80)}`, "✕");
const selettore = (colore: string) =>
  verticale(
    `<circle cx="11" cy="40" r="10" fill="#37474f" stroke="#212121"/><rect x="9" y="31" width="4" height="18" rx="2" fill="#eceff1" transform="rotate(-30 11 40)"/>` +
      `${scritta(26, 30, "0", 7)}${scritta(28, 54, "1", 7)}<circle cx="26" cy="42" r="2.5" fill="${colore}"/>`,
  );
icone["selettore.svg"] = selettore("#43a047");
icone["selettore-nc.svg"] = selettore("#e53935");
const interruttore = (colore: string, testo: string) =>
  verticale(
    `<rect x="4" y="30" width="16" height="22" rx="3" fill="#455a64"/><rect x="8" y="22" width="8" height="18" rx="3" fill="#eceff1" stroke="#90a4ae" transform="rotate(-20 12 40)"/>` +
      `${scritta(27, 36, testo, 6, colore, 'font-weight="bold"')}<circle cx="27" cy="46" r="2.5" fill="${colore}"/>`,
  );
icone["interruttore-na.svg"] = interruttore("#43a047", "NA");
icone["interruttore-nc.svg"] = interruttore("#e53935", "NC");
const finecorsa = (colore: string) =>
  verticale(
    `<rect x="12" y="26" width="18" height="30" rx="2" fill="#b0bec5" stroke="#78909c"/><path d="M12 40L2 30" stroke="#455a64" stroke-width="3" stroke-linecap="round"/>` +
      `<circle cx="3" cy="29" r="4.5" fill="#212121" stroke="#9e9e9e" stroke-width="1.2"/><circle cx="21" cy="50" r="2.5" fill="${colore}"/>`,
  );
icone["finecorsa-na.svg"] = finecorsa("#43a047");
icone["finecorsa-nc.svg"] = finecorsa("#e53935");
icone["sensore-prossimita.svg"] = verticale(
  `<rect x="12" y="20" width="16" height="40" rx="2" fill="#78909c"/>` +
    [24, 29, 34, 39, 44, 49].map((y) => `<path d="M12 ${y}H28" stroke="#546e7a" stroke-width="1"/>`).join("") +
    `<rect x="11" y="56" width="18" height="8" rx="2" fill="#1e88e5"/><circle cx="20" cy="17" r="3" fill="#ffb300"/>`,
);

// --- Contattori e relè.
const contattore = (testo: string, colore = "#eceff1") =>
  verticale(
    `<rect x="9" y="22" width="22" height="36" rx="2" fill="#cfd8dc" stroke="#90a4ae"/><rect x="14" y="30" width="12" height="14" rx="1.5" fill="#455a64"/><rect x="16" y="33" width="8" height="5" fill="#9e9e9e"/>` +
      `${scritta(20, 54, testo, 7, "#263238", 'font-weight="bold"')}${scritta(12, 19, "A1", 5)}${scritta(28, 66, "A2", 5)}`,
    colore,
  );
icone["bobina.svg"] = contattore("K");
const timer = (testo: string) =>
  verticale(`<circle cx="20" cy="38" r="10" fill="#ffffff" stroke="#78909c"/><path d="M20 31V38L25 41" stroke="#e53935" stroke-width="1.6" stroke-linecap="round"/>${scritta(20, 58, testo, 6, "#263238", 'font-weight="bold"')}${scritta(12, 19, "A1", 5)}${scritta(28, 66, "A2", 5)}`);
icone["bobina-ritardata-eccitazione.svg"] = timer("ON-delay");
icone["bobina-ritardata-diseccitazione.svg"] = timer("OFF-delay");
const ausiliario = (colore: string, testo: string, numeri: string) =>
  verticale(`<rect x="11" y="24" width="18" height="32" rx="2" fill="#cfd8dc"/>${scritta(20, 36, testo, 7, colore, 'font-weight="bold"')}${scritta(20, 48, numeri, 5)}<rect x="14" y="51" width="12" height="3" rx="1" fill="${colore}"/>`);
icone["contatto-na.svg"] = ausiliario("#43a047", "NA", "13-14");
icone["contatto-nc.svg"] = ausiliario("#e53935", "NC", "21-22");
const ausiliarioTempo = (colore: string, testo: string) =>
  verticale(`<circle cx="20" cy="34" r="7" fill="#ffffff" stroke="#78909c"/><path d="M20 29V34L23 36" stroke="#37474f" stroke-width="1.2"/>${scritta(20, 52, testo, 7, colore, 'font-weight="bold"')}`);
icone["contatto-temporizzato-na.svg"] = ausiliarioTempo("#43a047", "NA");
icone["contatto-temporizzato-nc.svg"] = ausiliarioTempo("#e53935", "NC");
icone["contatti-principali.svg"] = tripolare(
  80,
  `<rect x="16" y="22" width="48" height="36" rx="3" fill="#cfd8dc" stroke="#90a4ae"/><rect x="28" y="30" width="24" height="14" rx="2" fill="#455a64"/><rect x="32" y="33" width="16" height="5" fill="#9e9e9e"/>${scritta(40, 54, "1-2 3-4 5-6", 6)}`,
);

// --- Utilizzatori.
icone["lampada.svg"] = verticale(
  `<circle cx="20" cy="40" r="13" fill="#90a4ae" stroke="#546e7a"/><circle cx="20" cy="40" r="10" fill="#c8e6c9" stroke="#81c784"/><ellipse cx="17" cy="36" rx="4" ry="3" fill="#ffffff" opacity="0.6"/>`,
  "#eceff1",
);
icone["sirena.svg"] = verticale(
  `<path d="M12 30H18L28 22V58L18 50H12Z" fill="#e53935" stroke="#b71c1c"/><path d="M31 32Q35 40 31 48" fill="none" stroke="#e53935" stroke-width="1.5"/>`,
);
/** Motore visto di fronte: carcassa con alette, copriventola a griglia (centro come il cerchio del simbolo) e scatola morsetti in alto. */
const motore = (cy: number, r: number, morsettiAlti: number[], morsettiBassi: number[], targa: string) =>
  svg(
    80,
    80,
    morsettiAlti.map((x) => vite(x, 0, 80)).join("") +
      morsettiBassi.map((x) => vite(x, 80, 80)).join("") +
      `<rect x="12" y="10" width="56" height="10" rx="2" fill="#546e7a"/>` +
      `<circle cx="40" cy="${cy}" r="${r + 4}" fill="#1565c0" stroke="#0d47a1" stroke-width="1.5"/>` +
      Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        return `<path d="M${40 + Math.cos(a) * (r - 1)} ${cy + Math.sin(a) * (r - 1)}L${40 + Math.cos(a) * (r + 4)} ${cy + Math.sin(a) * (r + 4)}" stroke="#0d47a1" stroke-width="1.2"/>`;
      }).join("") +
      `<circle cx="40" cy="${cy}" r="${r - 2}" fill="#37474f"/>` +
      Array.from({ length: 5 }, (_, i) => `<circle cx="40" cy="${cy}" r="${(r - 4) * (1 - i / 5)}" fill="none" stroke="#78909c" stroke-width="0.8"/>`).join("") +
      `<circle cx="40" cy="${cy}" r="3" fill="#b0bec5"/>${scritta(40, cy + r - 4, targa, 6, "#eceff1", 'font-weight="bold"')}`,
  );
icone["motore-trifase.svg"] = motore(50, 22, [20, 40, 60], [], "3~");
icone["motore-trifase-6.svg"] = motore(40, 20, [20, 40, 60], [20, 40, 60], "3~ Y/Δ");
icone["motore-monofase.svg"] = motore(50, 22, [20, 60], [], "1~");
icone["motore-cc.svg"] = motore(50, 22, [20, 60], [], "DC");

// --- Scrittura (con controllo: un disegno per ogni icona della libreria impianti, stesse misure).
mkdirSync("libreria/icone/realistico", { recursive: true });
const libreria = JSON.parse(readFileSync("libreria/impianti.json", "utf8")) as { componenti: { icona: string; larghezza: number; altezza: number }[] };
for (const v of libreria.componenti) {
  const disegno = icone[v.icona];
  if (!disegno) throw new Error(`Manca il disegno realistico di ${v.icona}`);
  if (!disegno.includes(`viewBox="0 0 ${v.larghezza} ${v.altezza}"`)) throw new Error(`Misure diverse per ${v.icona}`);
}
for (const [nome, contenuto] of Object.entries(icone)) writeFileSync(`libreria/icone/realistico/${nome}`, contenuto);
console.log(`Scritti ${Object.keys(icone).length} disegni realistici.`);
