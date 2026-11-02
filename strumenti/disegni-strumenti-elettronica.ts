// Disegni realistici degli strumenti da banco del modulo Elettronica
// (multimetro, oscilloscopio, generatore di funzioni), usati da
// genera-libreria-elettronica.ts al posto dei simboli a tratto.
// Disegni originali, senza marchi. Le zone che l'editor riempie in
// simulazione hanno posizioni concordate con DisegnoElettronica.tsx:
// - multimetro (80×100): display (13,13)–(67,37), manopola al centro (40,57)
//   con le posizioni V (−50°), A (0°), Ω (+50°);
// - generatore (80×80): display (12,9)–(68,35);
// - oscilloscopio (120×100): schermo (10,9)–(82,61).
// I cavetti dalle boccole ai morsetti sono in currentColor (il colore dei fili del tema).

const FONT = 'font-family="Segoe UI, Arial, sans-serif"';
const testo = (x: number, y: number, t: string, dim: number, colore: string, extra = "") =>
  `<text x="${x}" y="${y}" font-size="${dim}" text-anchor="middle" fill="${colore}" ${FONT} ${extra}>${t}</text>`;
const apri = (w: number, h: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;

const DEFS = `<defs>
<linearGradient id="giallo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd54f"/><stop offset="1" stop-color="#e0a100"/></linearGradient>
<linearGradient id="grigio" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d6dade"/><stop offset="1" stop-color="#9aa2a8"/></linearGradient>
<linearGradient id="scuro" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f474d"/><stop offset="1" stop-color="#22272b"/></linearGradient>
<radialGradient id="manopola" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#6f7a82"/><stop offset="0.6" stop-color="#2e3439"/><stop offset="1" stop-color="#15181b"/></radialGradient>
<radialGradient id="cromo" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#ffffff"/><stop offset="0.5" stop-color="#c3cad0"/><stop offset="1" stop-color="#76808a"/></radialGradient>
<linearGradient id="lcd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c3d3ae"/><stop offset="1" stop-color="#a6b892"/></linearGradient>
</defs>`;

/** Boccola (o connettore BNC) con anello colorato. */
const boccola = (x: number, y: number, colore: string, bnc = false) =>
  bnc
    ? `<circle cx="${x}" cy="${y}" r="6.5" fill="url(#cromo)" stroke="#5f686e" stroke-width="0.8"/><circle cx="${x}" cy="${y}" r="3.6" fill="#1a1d20"/><circle cx="${x}" cy="${y}" r="1.3" fill="#d9a520"/><rect x="${x + 5}" y="${y - 1.5}" width="3" height="3" fill="#9aa2a8"/>` +
      `<circle cx="${x}" cy="${y}" r="8.2" fill="none" stroke="${colore}" stroke-width="1.6"/>`
    : `<circle cx="${x}" cy="${y}" r="5.5" fill="${colore}" stroke="#000" stroke-opacity="0.4"/><circle cx="${x}" cy="${y}" r="2.6" fill="#0d0f11"/>`;
/** Cavetto dalla boccola al morsetto sul bordo (colore del tema). */
const cavetto = (x: number, y1: number, y2: number) => `<path d="M${x} ${y1}V${y2}" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`;
/** Ombra sotto il corpo. */
const ombra = (x: number, y: number, w: number, h: number, rx: number) => `<rect x="${x + 2}" y="${y + 2.5}" width="${w}" height="${h}" rx="${rx}" fill="#000" opacity="0.2"/>`;

/** Multimetro portatile con guscio giallo, display, manopola V/A/Ω e boccole. */
export function disegnoMultimetro(): string {
  const tacca = (gradi: number, t: string) => {
    const a = ((gradi - 90) * Math.PI) / 180;
    return testo(40 + Math.cos(a) * 20, 57 + Math.sin(a) * 20 + 3, t, 7.5, "#eceff1", 'font-weight="bold"');
  };
  return (
    `${apri(80, 100)}\n${DEFS}\n` +
    ombra(3, 2, 74, 86, 10) +
    `<rect x="3" y="2" width="74" height="86" rx="10" fill="url(#giallo)" stroke="#a87800"/>` +
    `<rect x="9" y="7" width="62" height="76" rx="6" fill="url(#scuro)"/>` +
    `<rect x="12" y="12" width="56" height="26" rx="2" fill="#11161a"/><rect x="13" y="13" width="54" height="24" rx="1.5" fill="url(#lcd)"/>` +
    `<circle cx="40" cy="57" r="15" fill="url(#cromo)" stroke="#4c555c"/><circle cx="40" cy="57" r="11" fill="url(#manopola)"/>` +
    tacca(-50, "V") +
    tacca(0, "A") +
    tacca(50, "Ω") +
    boccola(20, 78, "#d32f2f") +
    boccola(60, 78, "#1b1b1b") +
    testo(30, 81, "VΩA", 4.5, "#eceff1") +
    testo(50, 81, "COM", 4.5, "#eceff1") +
    cavetto(20, 84, 100) +
    cavetto(60, 84, 100) +
    `\n</svg>\n`
  );
}

/** Generatore di funzioni da banco: display, tasti delle forme d'onda, manopola e uscite BNC. */
export function disegnoGeneratore(): string {
  const tasto = (x: number, onda: string) =>
    `<rect x="${x}" y="40" width="12" height="9" rx="1.5" fill="url(#grigio)" stroke="#5f686e" stroke-width="0.6"/><path d="${onda}" fill="none" stroke="#263238" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>`;
  return (
    `${apri(80, 80)}\n${DEFS}\n` +
    ombra(3, 2, 74, 64, 5) +
    `<rect x="3" y="2" width="74" height="64" rx="5" fill="url(#grigio)" stroke="#6c757b"/>` +
    `<rect x="6" y="5" width="68" height="58" rx="3" fill="url(#scuro)"/>` +
    `<rect x="11" y="8" width="58" height="28" rx="2" fill="#05080b"/><rect x="12" y="9" width="56" height="26" rx="1.5" fill="#0d1b2a"/>` +
    tasto(10, "M12 44.5Q14 41 16 44.5T20 44.5") +
    tasto(24, "M26 46V42H29V46H32V42") +
    tasto(38, "M40 46L42.5 42L45 46L47.5 42") +
    `<circle cx="64" cy="45" r="7.5" fill="url(#cromo)" stroke="#4c555c"/><circle cx="64" cy="45" r="5.5" fill="url(#manopola)"/><path d="M64 45L66.5 41" stroke="#eceff1" stroke-width="1.3" stroke-linecap="round"/>` +
    boccola(20, 57, "#d32f2f", true) +
    boccola(60, 57, "#1b1b1b") +
    testo(36, 60, "OUT", 5, "#eceff1", 'font-weight="bold"') +
    testo(48, 60, "COM", 4.5, "#eceff1") +
    cavetto(20, 64, 80) +
    cavetto(60, 63, 80) +
    `\n</svg>\n`
  );
}

/** Oscilloscopio da banco a due canali: schermo con reticolo e tracce, manopole e connettori BNC. */
export function disegnoOscilloscopio(): string {
  const reticolo =
    Array.from({ length: 9 }, (_, i) => `<path d="M${10 + i * 9} 9V61" stroke="#3a8f63" stroke-width="0.35" opacity="0.6"/>`).join("") +
    Array.from({ length: 7 }, (_, j) => `<path d="M10 ${9 + j * (52 / 6)}H82" stroke="#3a8f63" stroke-width="0.35" opacity="0.6"/>`).join("");
  const manopola = (x: number, y: number, r: number, anello: string) =>
    `<circle cx="${x}" cy="${y}" r="${r + 1.6}" fill="${anello}"/><circle cx="${x}" cy="${y}" r="${r}" fill="url(#manopola)"/><path d="M${x} ${y}L${x + r * 0.5} ${y - r * 0.8}" stroke="#eceff1" stroke-width="1.1" stroke-linecap="round"/>`;
  return (
    `${apri(120, 100)}\n${DEFS}\n` +
    ombra(3, 2, 114, 84, 5) +
    `<rect x="3" y="2" width="114" height="84" rx="5" fill="url(#grigio)" stroke="#6c757b"/>` +
    `<rect x="6" y="5" width="80" height="60" rx="3" fill="#1b1f22"/>` +
    `<rect x="10" y="9" width="72" height="52" rx="2" fill="#07130d"/>` +
    reticolo +
    `<path d="M10 25C16 13 22 13 28 25S40 37 46 25S58 13 64 25S76 37 82 25" fill="none" stroke="#f5b50b" stroke-width="1.3"/>` +
    `<path d="M10 50H19V42H37V50H55V42H73V50H82" fill="none" stroke="#22d3ee" stroke-width="1.1"/>` +
    `<rect x="88" y="5" width="26" height="78" rx="3" fill="url(#scuro)"/>` +
    manopola(101, 17, 6.5, "#f5b50b") +
    manopola(101, 36, 6.5, "#22d3ee") +
    manopola(101, 56, 7.5, "#9aa2a8") +
    testo(101, 28, "CH1", 4.2, "#eceff1") +
    testo(101, 47, "CH2", 4.2, "#eceff1") +
    testo(101, 70, "TIME", 4.2, "#eceff1") +
    `<rect x="93" y="74" width="16" height="6" rx="1.5" fill="#2e9e44"/>` +
    boccola(20, 75, "#f5b50b", true) +
    boccola(60, 75, "#22d3ee", true) +
    boccola(100, 90, "#1b1b1b") +
    testo(36, 78, "CH1", 5, "#263238", 'font-weight="bold"') +
    testo(76, 78, "CH2", 5, "#263238", 'font-weight="bold"') +
    cavetto(20, 83, 100) +
    cavetto(60, 83, 100) +
    cavetto(100, 95, 100) +
    `\n</svg>\n`
  );
}
