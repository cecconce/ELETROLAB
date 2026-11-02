// Generatore dei disegni "realistici" del modulo Impianti elettrici (strumento
// per chi sviluppa): scrive libreria/icone/realistico/<icona>.svg, uno per ogni
// simbolo della libreria impianti, con lo stesso nome del file del simbolo.
// Nell'editor si sceglie con il pulsante «Simboli / Realistica»: i disegni
// hanno le stesse misure e i morsetti negli stessi punti dei simboli CEI, così
// fili, collegamenti e simulazione funzionano allo stesso modo.
//
// Sono disegni originali di apparecchi da quadro e da impianto civile (moduli su
// guida DIN, pulsanti da 22 mm, frutti da incasso, contattori, motori), senza
// marchi. Per sembrare "veri" usano sfumature (plastica illuminata da sinistra,
// viti metalliche, tasti in rilievo), un'ombra sotto il corpo e i morsetti a
// vite con lo spezzone di filo fino al punto di collegamento.
//
// Alcune parti mobili hanno posizioni fisse concordate con AreaDisegno.tsx
// (ComandoRealisticoAzionato e indicatore del contattore), che le ridisegna
// nella posizione azionata: manopola del selettore (11,40), leva
// dell'interruttore (x 4–20, y 30–52), maniglia del sezionatore (40,40),
// fungo d'emergenza (11,40), tasti basculanti dei frutti (12,23)–(12,42),
// finestrella del contattore (16,33) e dei contatti principali (32,33),
// calotta della lampada (20,40).
//
// Uso: npx vite-node strumenti/genera-icone-realistiche-impianti.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const FONT = 'font-family="Segoe UI, Arial, sans-serif"';

/** Sfumature comuni (ogni file SVG è un'immagine a sé, quindi gli id non si scontrano). */
const DEFS = `<defs>
<linearGradient id="pl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset="0.6" stop-color="#eceff1"/><stop offset="1" stop-color="#c5cbd0"/></linearGradient>
<linearGradient id="pg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d9dde0"/><stop offset="0.6" stop-color="#b9c0c5"/><stop offset="1" stop-color="#8f979d"/></linearGradient>
<linearGradient id="ps" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5d6971"/><stop offset="1" stop-color="#1f2428"/></linearGradient>
<linearGradient id="inc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4248"/><stop offset="1" stop-color="#5f6a72"/></linearGradient>
<radialGradient id="me" cx="0.35" cy="0.3" r="0.75"><stop offset="0" stop-color="#ffffff"/><stop offset="0.45" stop-color="#cfd5da"/><stop offset="1" stop-color="#7a848b"/></radialGradient>
<linearGradient id="cr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f6f7"/><stop offset="0.5" stop-color="#aeb6bc"/><stop offset="1" stop-color="#e3e7ea"/></linearGradient>
<linearGradient id="giallo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe66d"/><stop offset="1" stop-color="#e9b800"/></linearGradient>
<linearGradient id="blu" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3f8fe0"/><stop offset="1" stop-color="#0d47a1"/></linearGradient>
<radialGradient id="vetro" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#ffffff"/><stop offset="0.35" stop-color="#e8eef2"/><stop offset="1" stop-color="#9eacb6"/></radialGradient>
</defs>`;

const svg = (w: number, h: number, corpo: string, extraDefs = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n${DEFS}${extraDefs}\n${corpo}\n</svg>\n`;
const scritta = (x: number, y: number, t: string, dim = 8, colore = "#263238", extra = "") =>
  `<text x="${x}" y="${y}" font-size="${dim}" text-anchor="middle" fill="${colore}" ${FONT} ${extra}>${t}</text>`;

/** Schiarisce (f > 0) o scurisce (f < 0) un colore #rrggbb. */
function tono(colore: string, f: number): string {
  const n = parseInt(colore.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}
/** Sfumatura radiale "in rilievo" di un colore (tasti, calotte). */
const rilievo = (id: string, colore: string) =>
  `<defs><radialGradient id="${id}" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="${tono(colore, 0.55)}"/><stop offset="0.5" stop-color="${colore}"/><stop offset="1" stop-color="${tono(colore, -0.45)}"/></radialGradient></defs>`;

/** Ombra morbida sotto un corpo rettangolare. */
const ombra = (x: number, y: number, w: number, h: number, rx = 3) =>
  `<rect x="${x + 2}" y="${y + 2.5}" width="${w}" height="${h}" rx="${rx}" fill="#000000" opacity="0.18"/>`;

/** Vite di un morsetto con la sua sede scura. */
const testaVite = (x: number, y: number, r = 3.6) =>
  `<circle cx="${x}" cy="${y}" r="${r + 1.4}" fill="#2b3135"/><circle cx="${x}" cy="${y}" r="${r}" fill="url(#me)"/>` +
  `<path d="M${x - r * 0.65} ${y}H${x + r * 0.65}M${x} ${y - r * 0.65}V${y + r * 0.65}" stroke="#5b646a" stroke-width="1.1"/>`;

/** Morsetto a vite collegato al punto (x, y) del bordo con uno spezzone di filo di rame. */
function morsetto(x: number, y: number, h: number): string {
  const yv = y === 0 ? 7.5 : y === h ? h - 7.5 : y;
  const filo = y === 0 || y === h ? `<path d="M${x} ${y}V${yv}" stroke="#b87333" stroke-width="2.6"/>` : "";
  return filo + testaVite(x, yv);
}
/** Morsetto in un angolo (frutti civili): il filo arriva in diagonale. */
function morsettoAngolo(x: number, y: number, w: number, h: number): string {
  const xv = x === 0 ? 6.5 : x === w ? w - 6.5 : x;
  const yv = y === 0 ? 7.5 : y === h ? h - 7.5 : y;
  return `<path d="M${x} ${y}L${xv} ${yv}" stroke="#b87333" stroke-width="2.6"/>${testaVite(xv, yv)}`;
}

/** Corpo di un modulo su guida DIN: plastica chiara, sedi dei morsetti più scure in alto e in basso. */
function corpoDin(x: number, y: number, w: number, h: number, materiale = "url(#pl)"): string {
  return (
    ombra(x, y, w, h) +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${materiale}" stroke="#8a9399" stroke-width="1"/>` +
    `<rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="9" rx="2" fill="url(#inc)" opacity="0.35"/>` +
    `<rect x="${x + 2}" y="${y + h - 11}" width="${w - 4}" height="9" rx="2" fill="url(#inc)" opacity="0.35"/>` +
    `<path d="M${x + 1.5} ${y + 14}H${x + w - 1.5}M${x + 1.5} ${y + h - 14}H${x + w - 1.5}" stroke="#ffffff" stroke-width="0.8" opacity="0.8"/>`
  );
}
/** Apparecchio verticale 40×80 con i morsetti in alto (20,0) e in basso (20,80). */
const verticale = (interno: string, materiale?: string, defsExtra = "") =>
  svg(40, 80, `${corpoDin(6, 9, 28, 62, materiale)}${morsetto(20, 0, 80)}${morsetto(20, 80, 80)}${interno}`, defsExtra);
/** Apparecchio largo con morsetti in alto e in basso nelle posizioni date. */
const largo = (w: number, xs: number[], interno: string, defsExtra = "", materiale?: string) =>
  svg(w, 80, `${corpoDin(5, 9, w - 10, 62, materiale)}${xs.map((x) => morsetto(x, 0, 80) + morsetto(x, 80, 80)).join("")}${interno}`, defsExtra);

/** Leva di un interruttore automatico (in alto = chiuso «I»). */
const levaAutomatico = (x: number, colore = "#263238") =>
  `<rect x="${x - 6}" y="27" width="12" height="26" rx="2" fill="#1d2226"/>` +
  `<rect x="${x - 4.5}" y="29" width="9" height="12" rx="2" fill="${colore}" stroke="#000" stroke-opacity="0.4"/>` +
  `<rect x="${x - 3.5}" y="30" width="3" height="10" rx="1.5" fill="#ffffff" opacity="0.25"/>`;
/** Finestrella con il segno dello stato e la targhetta dei dati. */
const targa = (x: number, y: number, w: number, testo: string) =>
  `<rect x="${x}" y="${y}" width="${w}" height="9" rx="1.5" fill="#ffffff" stroke="#9aa3a9" stroke-width="0.6"/>${scritta(x + w / 2, y + 7, testo, 6.2, "#263238", 'font-weight="bold"')}`;

const icone: Record<string, string> = {};

// ============================================================ Alimentazione
/** Morsettiera su guida: un blocchetto colorato per conduttore, con la vite e il filo verso il basso. */
const morsettiera = (w: number, morsetti: [number, string, string][]) =>
  svg(
    w,
    40,
    ombra(3, 2, w - 6, 26, 2) +
      `<rect x="3" y="2" width="${w - 6}" height="26" rx="2" fill="#9aa3a9"/>` +
      morsetti
        .map(
          ([x, nome, colore]) =>
            `<rect x="${x - 9}" y="3" width="18" height="24" rx="1.5" fill="${colore}" stroke="${tono(colore, -0.4)}"/>` +
            `<rect x="${x - 7.5}" y="4" width="4" height="22" fill="#ffffff" opacity="0.18"/>` +
            testaVite(x, 10, 3.2) +
            scritta(x, 24, nome, 7, "#ffffff", 'font-weight="bold"') +
            `<path d="M${x} 27V40" stroke="${colore}" stroke-width="3.2"/>`,
        )
        .join(""),
  );
icone["rete-trifase.svg"] = morsettiera(80, [[20, "L1", "#7a5230"], [40, "L2", "#2b2b2b"], [60, "L3", "#808890"]]);
icone["rete-monofase.svg"] = morsettiera(60, [[20, "L", "#7a5230"], [40, "N", "#1e6fd0"]]);
icone["alimentatore-cc.svg"] = svg(
  60,
  40,
  ombra(3, 1, 54, 28) +
    `<rect x="3" y="1" width="54" height="28" rx="3" fill="url(#pg)" stroke="#6c757b"/>` +
    [8, 13, 18, 42, 47, 52].map((x) => `<path d="M${x} 4V12" stroke="#6c757b" stroke-width="1.6" stroke-linecap="round"/>`).join("") +
    scritta(30, 11, "24V DC", 6.5, "#1f2428", 'font-weight="bold"') +
    `<circle cx="30" cy="17" r="2" fill="#2ecc40" stroke="#1b7a26" stroke-width="0.6"/>` +
    testaVite(20, 22, 3) +
    testaVite(40, 22, 3) +
    `<path d="M20 26V40" stroke="#d32f2f" stroke-width="3.2"/><path d="M40 26V40" stroke="#212121" stroke-width="3.2"/>` +
    scritta(13, 25, "+", 7, "#d32f2f", 'font-weight="bold"') +
    scritta(47, 25, "−", 7, "#212121", 'font-weight="bold"'),
);

// ============================================================ Protezioni e manovra
icone["fusibile.svg"] = verticale(
  // Sezionatore portafusibili: sportello incernierato con la cartuccia che si vede dalla finestra.
  `<rect x="10" y="20" width="20" height="40" rx="3" fill="url(#pg)" stroke="#6c757b"/>` +
    `<rect x="14" y="25" width="12" height="26" rx="2" fill="#f7f3e8" stroke="#a49a80"/>` +
    `<rect x="14" y="25" width="12" height="4" fill="url(#cr)"/><rect x="14" y="47" width="12" height="4" fill="url(#cr)"/>` +
    `<path d="M20 30V46" stroke="#e0a000" stroke-width="1"/>` +
    scritta(20, 58, "10 A", 5.5, "#263238", 'font-weight="bold"') +
    `<rect x="17" y="17" width="6" height="4" rx="1" fill="#37474f"/>`,
);
icone["magnetotermico.svg"] = verticale(`${targa(10, 17, 20, "C16")}${levaAutomatico(20)}${scritta(20, 59, "I ON", 5, "#c62828", 'font-weight="bold"')}${scritta(20, 66, "6 kA", 4.5, "#455a64")}`);
icone["magnetotermico-2p.svg"] = largo(
  80,
  [20, 60],
  `${targa(14, 17, 52, "C16  2P")}<rect x="12" y="27" width="56" height="26" rx="2" fill="#1d2226"/>` +
    `<rect x="14" y="29" width="52" height="12" rx="2" fill="#263238"/><rect x="15" y="30" width="50" height="3" rx="1.5" fill="#ffffff" opacity="0.2"/>` +
    scritta(40, 61, "I ON", 6, "#c62828", 'font-weight="bold"'),
);
icone["differenziale.svg"] = largo(
  80,
  [20, 60],
  `${targa(10, 17, 38, "C16  30mA")}<rect x="10" y="27" width="40" height="26" rx="2" fill="#1d2226"/>` +
    `<rect x="12" y="29" width="36" height="12" rx="2" fill="#0d47a1"/><rect x="13" y="30" width="34" height="3" rx="1.5" fill="#ffffff" opacity="0.25"/>` +
    // Tasto di prova T giallo e targhetta IΔn.
    `<rect x="55" y="27" width="16" height="16" rx="2" fill="#1d2226"/><rect x="57" y="29" width="12" height="12" rx="2" fill="url(#giallo)" stroke="#a07c00"/>` +
    scritta(63, 38, "T", 8, "#3e2f00", 'font-weight="bold"') +
    scritta(63, 52, "IΔn", 6, "#263238", 'font-weight="bold"') +
    scritta(30, 61, "I ON", 6, "#c62828", 'font-weight="bold"'),
);
icone["sezionatore.svg"] = largo(
  80,
  [20, 40, 60],
  // Interruttore di manovra rotativo: piastra gialla, maniglia rossa (verticale = aperto "0").
  `<rect x="18" y="20" width="44" height="40" rx="3" fill="url(#giallo)" stroke="#b08900"/>` +
    scritta(26, 57, "0", 7, "#3e2f00", 'font-weight="bold"') +
    scritta(55, 28, "I", 7, "#3e2f00", 'font-weight="bold"') +
    `<circle cx="40" cy="40" r="13.5" fill="#000" opacity="0.2"/><circle cx="40" cy="40" r="13" fill="#c62828"/>` +
    `<rect x="36" y="25" width="8" height="30" rx="3.5" fill="#e53935" stroke="#8e1b1b"/><rect x="37.5" y="26.5" width="2.5" height="27" rx="1.2" fill="#ffffff" opacity="0.3"/>`,
  "",
  "url(#pg)",
);
icone["salvamotore.svg"] = largo(
  100,
  [20, 40, 60],
  `<circle cx="32" cy="40" r="11" fill="url(#cr)" stroke="#6c757b"/><circle cx="32" cy="40" r="8" fill="url(#pl)" stroke="#9aa3a9"/>` +
    `<path d="M32 33V40" stroke="#c62828" stroke-width="2" stroke-linecap="round"/>` +
    scritta(32, 60, "2,5–4 A", 5.5, "#263238", 'font-weight="bold"') +
    rilievoTasto(72, 30, "#2e9e44", "I") +
    rilievoTasto(72, 50, "#d32f2f", "O"),
  rilievo("tI", "#2e9e44") + rilievo("tO", "#d32f2f"),
);
/** Tasto rotondo in rilievo con una lettera (usa la sfumatura t<lettera>). */
function rilievoTasto(x: number, y: number, colore: string, lettera: string): string {
  return `<circle cx="${x}" cy="${y}" r="8" fill="#1d2226"/><circle cx="${x}" cy="${y}" r="6.5" fill="url(#t${lettera})" stroke="${tono(colore, -0.5)}" stroke-width="0.6"/>${scritta(x, y + 3, lettera, 7.5, "#ffffff", 'font-weight="bold"')}`;
}
icone["rele-termico.svg"] = largo(
  80,
  [20, 40, 60],
  `<circle cx="28" cy="38" r="10" fill="url(#cr)" stroke="#6c757b"/><circle cx="28" cy="38" r="7" fill="url(#pl)"/><path d="M28 32V38L33 40" stroke="#37474f" stroke-width="1.6" stroke-linecap="round"/>` +
    `<rect x="46" y="28" width="18" height="14" rx="3" fill="url(#blu)" stroke="#0a3070"/>` +
    scritta(55, 38, "R", 8, "#ffffff", 'font-weight="bold"') +
    scritta(55, 54, "95 96 97 98", 4.6, "#263238") +
    scritta(28, 58, "1,6–2,5 A", 5, "#263238"),
  "",
  "url(#pg)",
);
/** Contatto ausiliario del relè termico. */
const contattoTermico = (colore: string, testo: string, numeri: string) =>
  verticale(
    `<rect x="10" y="22" width="20" height="36" rx="2" fill="url(#pg)" stroke="#6c757b"/>` +
      scritta(20, 34, testo, 7.5, colore, 'font-weight="bold"') +
      scritta(20, 45, numeri, 5.5, "#263238") +
      `<rect x="13" y="50" width="14" height="4" rx="1.5" fill="${colore}"/>`,
  );
icone["contatto-termico-nc.svg"] = contattoTermico("#d32f2f", "NC", "95-96");
icone["contatto-termico-na.svg"] = contattoTermico("#2e9e44", "NA", "97-98");

// ============================================================ Comandi (pulsanti da 22 mm, leve, selettori)
/** Pulsante da quadro: ghiera metallica, tasto colorato in rilievo a sinistra, blocchetto contatti a destra. */
const pulsante = (colore: string, segno: string, contatto: string) =>
  verticale(
    `<rect x="22" y="24" width="10" height="32" rx="2" fill="url(#pg)" stroke="#6c757b"/>${scritta(27, 52, contatto, 4.5, "#263238")}` +
      `<circle cx="11" cy="40" r="11" fill="#000" opacity="0.18"/><circle cx="10.5" cy="39.5" r="10.5" fill="url(#cr)" stroke="#5f686e" stroke-width="0.8"/>` +
      `<circle cx="10.5" cy="39.5" r="7.6" fill="url(#tasto)" stroke="${tono(colore, -0.5)}" stroke-width="0.8"/>` +
      scritta(10.5, 42.5, segno, 8, "#ffffff", 'font-weight="bold"'),
    "url(#pl)",
    rilievo("tasto", colore),
  );
icone["pulsante-na.svg"] = pulsante("#2e9e44", "I", "13-14");
icone["pulsante-nc.svg"] = pulsante("#d32f2f", "O", "11-12");
// Fungo d'emergenza: testa rossa grande su una base gialla.
icone["pulsante-emergenza.svg"] = verticale(
  `<rect x="22" y="24" width="10" height="32" rx="2" fill="url(#pg)" stroke="#6c757b"/>` +
    `<circle cx="11" cy="40" r="11" fill="url(#giallo)" stroke="#a07c00"/>` +
    `<circle cx="11.5" cy="40.5" r="9" fill="#000" opacity="0.25"/><circle cx="11" cy="40" r="8.5" fill="url(#fungo)" stroke="#7f0000" stroke-width="0.8"/>`,
  "url(#pl)",
  rilievo("fungo", "#e01b1b"),
);
const selettore = (colore: string, contatto: string) =>
  verticale(
    `<rect x="22" y="24" width="10" height="32" rx="2" fill="url(#pg)" stroke="#6c757b"/>${scritta(27, 52, contatto, 4.5, "#263238")}` +
      `<circle cx="11" cy="40" r="10.5" fill="url(#cr)" stroke="#5f686e" stroke-width="0.8"/><circle cx="11" cy="40" r="8" fill="url(#ps)"/>` +
      `<rect x="9" y="31" width="4" height="18" rx="2" fill="#eceff1" transform="rotate(-30 11 40)"/>` +
      scritta(20, 27, "0", 6, "#263238", 'font-weight="bold"') +
      scritta(21, 58, "1", 6, "#263238", 'font-weight="bold"') +
      `<circle cx="27" cy="30" r="2" fill="${colore}"/>`,
  );
icone["selettore.svg"] = selettore("#2e9e44", "13-14");
icone["selettore-nc.svg"] = selettore("#d32f2f", "11-12");
const interruttoreLeva = (colore: string, testo: string) =>
  verticale(
    `<rect x="4" y="30" width="16" height="22" rx="3" fill="url(#ps)"/>` +
      `<rect x="8" y="22" width="8" height="18" rx="3" fill="url(#cr)" stroke="#6c757b" transform="rotate(-20 12 40)"/>` +
      `<rect x="22" y="24" width="10" height="32" rx="2" fill="url(#pg)" stroke="#6c757b"/>` +
      scritta(27, 35, testo, 5.5, colore, 'font-weight="bold"') +
      `<circle cx="27" cy="46" r="2.2" fill="${colore}"/>`,
  );
icone["interruttore-na.svg"] = interruttoreLeva("#2e9e44", "NA");
icone["interruttore-nc.svg"] = interruttoreLeva("#d32f2f", "NC");
const finecorsa = (colore: string) =>
  verticale(
    `<rect x="12" y="24" width="20" height="34" rx="2" fill="url(#cr)" stroke="#5f686e"/>` +
      `<rect x="15" y="44" width="14" height="10" rx="1.5" fill="url(#pg)"/>` +
      `<path d="M14 38L3 28" stroke="#37474f" stroke-width="3.4" stroke-linecap="round"/>` +
      `<circle cx="3" cy="28" r="5" fill="#1d2226"/><circle cx="3" cy="28" r="3.2" fill="#545e65"/>` +
      `<circle cx="22" cy="31" r="2.4" fill="${colore}"/>`,
  );
icone["finecorsa-na.svg"] = finecorsa("#2e9e44");
icone["finecorsa-nc.svg"] = finecorsa("#d32f2f");
icone["sensore-prossimita.svg"] = verticale(
  // Sensore cilindrico filettato M18 con faccia sensibile blu e LED giallo.
  `<rect x="12" y="18" width="16" height="42" rx="2" fill="url(#cr)" stroke="#5f686e"/>` +
    Array.from({ length: 9 }, (_, i) => `<path d="M12 ${22 + i * 4}H28" stroke="#7a848b" stroke-width="0.9"/>`).join("") +
    `<rect x="10" y="30" width="20" height="5" rx="1" fill="url(#cr)" stroke="#5f686e"/>` +
    `<rect x="11" y="56" width="18" height="8" rx="2" fill="url(#blu)"/>` +
    `<circle cx="20" cy="15.5" r="2.6" fill="#ffc107" stroke="#9a7300" stroke-width="0.6"/>`,
);

// Sensori di processo: corpo metallico con il loro organo di misura.
icone["galleggiante.svg"] = verticale(
  `<rect x="12" y="20" width="16" height="22" rx="2" fill="url(#cr)" stroke="#5f686e"/><path d="M14 40L6 60" stroke="#37474f" stroke-width="2"/>` +
    `<ellipse cx="6" cy="62" rx="5.5" ry="4" fill="#e65100" stroke="#8a3000"/><path d="M2 62H10" stroke="#ffffff" stroke-width="0.8" opacity="0.5"/>` +
    `<path d="M10 56Q14 54 18 56T26 56T34 56" fill="none" stroke="#1e88e5" stroke-width="1.4"/>`,
);
icone["pressostato.svg"] = verticale(
  `<rect x="11" y="18" width="18" height="26" rx="2" fill="url(#pg)" stroke="#6c757b"/>` +
    `<circle cx="20" cy="31" r="7" fill="#ffffff" stroke="#37474f"/><path d="M20 31L24 27" stroke="#c62828" stroke-width="1.4" stroke-linecap="round"/>` +
    `<rect x="17" y="44" width="6" height="10" fill="url(#cr)" stroke="#5f686e"/><rect x="15" y="54" width="10" height="5" rx="1" fill="#b87333"/>` +
    scritta(20, 24, "bar", 3.8, "#37474f"),
);
icone["termostato.svg"] = verticale(
  `<rect x="10" y="18" width="20" height="30" rx="3" fill="#fafafa" stroke="#9aa3a9"/>` +
    `<circle cx="20" cy="31" r="8" fill="url(#cr)" stroke="#5f686e"/><circle cx="20" cy="31" r="5.5" fill="#ffffff"/><path d="M20 31L20 26.5" stroke="#d84315" stroke-width="1.5" stroke-linecap="round"/>` +
    scritta(20, 45, "°C", 5.5, "#d84315", 'font-weight="bold"') +
    `<rect x="18.5" y="48" width="3" height="12" rx="1.5" fill="url(#cr)"/><circle cx="20" cy="61" r="2.6" fill="#d84315"/>`,
);
icone["fotocellula.svg"] = verticale(
  `<rect x="10" y="20" width="20" height="38" rx="3" fill="url(#ps)"/>` +
    `<rect x="12" y="26" width="16" height="12" rx="2" fill="#2b1414"/><circle cx="20" cy="32" r="4" fill="#d32f2f" opacity="0.85"/><circle cx="18.5" cy="30.5" r="1.3" fill="#ffffff" opacity="0.7"/>` +
    `<path d="M2 32H9" stroke="#e53935" stroke-width="1.2" stroke-dasharray="2 1.5"/>` +
    `<circle cx="20" cy="50" r="2" fill="#ffc107"/>`,
);

// ============================================================ Impianti civili (frutti da incasso)
/** Frutto modulare bianco con tasto basculante (o pulsante) e morsetti nelle posizioni date. */
function frutto(morsetti: string, tasto: string, defsExtra = ""): string {
  return svg(
    40,
    80,
    ombra(5, 13, 30, 54, 4) +
      `<rect x="5" y="13" width="30" height="54" rx="4" fill="url(#pl)" stroke="#9aa3a9"/>` +
      `<rect x="9" y="19" width="22" height="42" rx="3" fill="#f7f8f9" stroke="#c5cbd0"/>` +
      tasto +
      morsetti,
    defsExtra,
  );
}
/** Tasto basculante: metà alta in rilievo (posizione di riposo), metà bassa in ombra. */
const basculante = (segno: string) =>
  `<rect x="12" y="23" width="16" height="15" rx="2" fill="#ffffff" stroke="#c9cfd4"/><rect x="12" y="42" width="16" height="15" rx="2" fill="#e3e7ea" stroke="#c9cfd4"/>` +
  `<path d="M12 40H28" stroke="#b9c0c5" stroke-width="1"/>` +
  scritta(20, 53, segno, 7, "#6c757b", 'font-weight="bold"');
icone["interruttore-unipolare.svg"] = frutto(`${morsetto(20, 0, 80)}${morsetto(20, 80, 80)}`, basculante("I"));
icone["interruttore-bipolare.svg"] = frutto(
  `${morsettoAngolo(0, 0, 40, 80)}${morsettoAngolo(40, 0, 40, 80)}${morsettoAngolo(0, 80, 40, 80)}${morsettoAngolo(40, 80, 40, 80)}`,
  basculante("I I"),
);
icone["deviatore.svg"] = frutto(`${morsetto(20, 0, 80)}${morsettoAngolo(0, 80, 40, 80)}${morsettoAngolo(40, 80, 40, 80)}`, basculante("⇅"));
icone["invertitore.svg"] = frutto(
  `${morsettoAngolo(0, 0, 40, 80)}${morsettoAngolo(40, 0, 40, 80)}${morsettoAngolo(0, 80, 40, 80)}${morsettoAngolo(40, 80, 40, 80)}`,
  basculante("✕"),
);
icone["pulsante-civile.svg"] = frutto(
  `${morsetto(20, 0, 80)}${morsetto(20, 80, 80)}`,
  // Tasto pieno con il simbolo del campanello.
  `<rect x="12" y="23" width="16" height="34" rx="2" fill="#ffffff" stroke="#c9cfd4"/>` +
    `<path d="M16 46C16 37 17.5 34 20 34C22.5 34 24 37 24 46Z" fill="none" stroke="#6c757b" stroke-width="1.3"/><path d="M15 46H25" stroke="#6c757b" stroke-width="1.3"/><circle cx="20" cy="48.5" r="1.3" fill="#6c757b"/>`,
);

// ============================================================ Contattori e relè
/** Contattore / relè visto di fronte: corpo grigio, finestrella dell'indicatore e targhetta. */
const contattore = (testo: string) =>
  verticale(
    `<rect x="9" y="20" width="22" height="40" rx="2" fill="url(#pg)" stroke="#6c757b"/>` +
      `<rect x="13" y="29" width="14" height="13" rx="1.5" fill="#1d2226"/><rect x="16" y="33" width="8" height="5" fill="#8d969c"/>` +
      targa(11, 46, 18, testo) +
      scritta(13, 18, "A1", 5, "#37474f", 'font-weight="bold"') +
      scritta(27, 67, "A2", 5, "#37474f", 'font-weight="bold"'),
  );
icone["bobina.svg"] = contattore("K");
icone["rele-passo-passo.svg"] = verticale(
  // Relè a impulsi su guida DIN: leva manuale e il segno del passo-passo.
  `${targa(10, 17, 20, "KA")}<rect x="13" y="28" width="14" height="18" rx="2" fill="#1d2226"/><rect x="15" y="30" width="10" height="8" rx="1.5" fill="url(#cr)"/>` +
    `<path d="M13 58H17V54H21V50H25" stroke="#37474f" stroke-width="1.3" fill="none"/>` +
    "",
);
const timer = (testo: string) =>
  verticale(
    `<circle cx="20" cy="37" r="10.5" fill="url(#cr)" stroke="#5f686e"/><circle cx="20" cy="37" r="8" fill="url(#pl)"/>` +
      Array.from({ length: 8 }, (_, i) => {
        const a = ((i * 36 - 126) * Math.PI) / 180;
        return `<path d="M${20 + Math.cos(a) * 6.5} ${37 + Math.sin(a) * 6.5}L${20 + Math.cos(a) * 8} ${37 + Math.sin(a) * 8}" stroke="#37474f" stroke-width="0.8"/>`;
      }).join("") +
      `<path d="M20 37L25 33" stroke="#c62828" stroke-width="1.8" stroke-linecap="round"/>` +
      `<circle cx="20" cy="37" r="1.6" fill="#37474f"/>` +
      targa(9, 51, 22, testo) +
      `<circle cx="13" cy="20" r="1.8" fill="#2ecc40"/>`,
  );
icone["bobina-ritardata-eccitazione.svg"] = timer("ON-del");
icone["bobina-ritardata-diseccitazione.svg"] = timer("OFF-del");
/** Contatto ausiliario frontale (blocchetto agganciato al contattore). */
const ausiliario = (colore: string, testo: string, numeri: string) =>
  verticale(
    `<rect x="10" y="22" width="20" height="36" rx="2" fill="url(#pg)" stroke="#6c757b"/>` +
      scritta(20, 35, testo, 7.5, colore, 'font-weight="bold"') +
      scritta(20, 46, numeri, 5.5, "#263238") +
      `<rect x="13" y="50" width="14" height="4" rx="1.5" fill="${colore}"/>`,
  );
icone["contatto-na.svg"] = ausiliario("#2e9e44", "NA", "13-14");
icone["contatto-nc.svg"] = ausiliario("#d32f2f", "NC", "21-22");
const ausiliarioTempo = (colore: string, testo: string) =>
  verticale(
    `<rect x="10" y="22" width="20" height="36" rx="2" fill="url(#pg)" stroke="#6c757b"/>` +
      `<circle cx="20" cy="33" r="6" fill="url(#pl)" stroke="#6c757b"/><path d="M20 29V33L23 35" stroke="#37474f" stroke-width="1.1"/>` +
      scritta(20, 50, testo, 7, colore, 'font-weight="bold"'),
  );
icone["contatto-temporizzato-na.svg"] = ausiliarioTempo("#2e9e44", "NA");
icone["contatto-temporizzato-nc.svg"] = ausiliarioTempo("#d32f2f", "NC");
icone["contatti-principali.svg"] = largo(
  80,
  [20, 40, 60],
  `<rect x="14" y="20" width="52" height="40" rx="3" fill="url(#pg)" stroke="#6c757b"/>` +
    `<rect x="28" y="29" width="24" height="13" rx="2" fill="#1d2226"/><rect x="32" y="33" width="16" height="5" fill="#8d969c"/>` +
    targa(20, 46, 40, "1-2  3-4  5-6") +
    scritta(20, 18, "1", 5, "#37474f") +
    scritta(40, 18, "3", 5, "#37474f") +
    scritta(60, 18, "5", 5, "#37474f"),
);

// ============================================================ PLC
// Controllore compatto su guida DIN: morsettiere in alto (alimentazione e
// ingressi) e in basso (comune e uscite a relè), file di LED verdi sopra gli
// ingressi (y = 27) e arancioni sopra le uscite (y = 93) che l'editor accende
// in simulazione, display e tasti al centro.
{
  const xIn = Array.from({ length: 8 }, (_, i) => 80 + 20 * i);
  const xOut = Array.from({ length: 6 }, (_, i) => 60 + 20 * i);
  icone["plc.svg"] = svg(
    240,
    120,
    ombra(4, 8, 232, 104, 4) +
      `<rect x="4" y="8" width="232" height="104" rx="4" fill="url(#pl)" stroke="#7f888e"/>` +
      `<rect x="6" y="10" width="228" height="12" rx="2" fill="url(#inc)" opacity="0.55"/><rect x="6" y="98" width="228" height="12" rx="2" fill="url(#inc)" opacity="0.55"/>` +
      [20, 40, ...xIn].map((x) => morsetto(x, 0, 120)).join("") +
      [20, ...xOut].map((x) => morsetto(x, 120, 120)).join("") +
      [["L", 20], ["N", 40], ...xIn.map((x, i) => [`I0.${i}`, x] as const)].map(([t, x]) => scritta(Number(x), 34, String(t), 5.2, "#37474f", 'font-weight="bold"')).join("") +
      xIn.map((x) => `<circle cx="${x}" cy="27" r="2.6" fill="#1f3a24" stroke="#0f1f12" stroke-width="0.6"/>`).join("") +
      [["1L", 20], ...xOut.map((x, i) => [`Q0.${i}`, x] as const)].map(([t, x]) => scritta(Number(x), 89, String(t), 5.2, "#37474f", 'font-weight="bold"')).join("") +
      xOut.map((x) => `<circle cx="${x}" cy="93" r="2.6" fill="#3d2a12" stroke="#1f1408" stroke-width="0.6"/>`).join("") +
      // Display, tasti e LED RUN.
      `<rect x="62" y="42" width="72" height="30" rx="3" fill="#1d2226"/><rect x="66" y="46" width="64" height="22" rx="2" fill="#a9c7a0"/>` +
      scritta(98, 56, "PLC", 9, "#1b2a12", 'font-weight="bold"') +
      scritta(98, 65, "I 8 · Q 6", 6, "#1b2a12") +
      [150, 166, 182, 198].map((x) => `<rect x="${x}" y="48" width="12" height="9" rx="2" fill="url(#pg)" stroke="#6c757b"/>`).join("") +
      `<circle cx="214" cy="52" r="3" fill="#1f3a24" stroke="#0f1f12" stroke-width="0.6"/>${scritta(214, 63, "RUN", 5, "#37474f", 'font-weight="bold"')}` +
      `<rect x="12" y="44" width="38" height="26" rx="2" fill="url(#pg)" stroke="#6c757b"/>${scritta(31, 55, "230 V~", 6, "#263238", 'font-weight="bold"')}${scritta(31, 64, "relè 8 A", 5, "#263238")}`,
  );
}

// ============================================================ Pneumatica
// Cilindro con elettrovalvola: bobina nera con LED, corpo valvola in alluminio
// azzurro, tubi blu, canna cromata; lo stelo (y 27–33) lo allunga l'editor in simulazione.
icone["cilindro.svg"] = svg(
  200,
  60,
  morsetto(20, 0, 60) +
    morsetto(20, 60, 60) +
    `<rect x="9" y="12" width="22" height="36" rx="3" fill="url(#ps)"/><circle cx="20" cy="40" r="2" fill="#ffc107"/>${scritta(20, 25, "24V", 5, "#eceff1")}` +
    ombra(31, 16, 58, 28, 3) +
    `<rect x="31" y="16" width="58" height="28" rx="3" fill="url(#blu)" stroke="#0a3070"/>` +
    [42, 60, 78].map((x) => `<circle cx="${x}" cy="40" r="2.4" fill="#0a3070"/>`).join("") +
    scritta(60, 30, "5/2", 7, "#eceff1", 'font-weight="bold"') +
    `<path d="M50 16V8H106V16M70 16V4H146V16" fill="none" stroke="#1e6fd0" stroke-width="3" stroke-linecap="round"/>` +
    ombra(96, 16, 56, 28, 4) +
    `<rect x="96" y="16" width="56" height="28" rx="4" fill="url(#cr)" stroke="#5f686e"/>` +
    `<rect x="94" y="14" width="8" height="32" rx="2" fill="url(#pg)" stroke="#5f686e"/><rect x="146" y="14" width="8" height="32" rx="2" fill="url(#pg)" stroke="#5f686e"/>` +
    `<rect x="154" y="27" width="6" height="6" rx="1" fill="url(#cr)" stroke="#5f686e"/>`,
);
const finecorsaCilindro = (testo: string) =>
  verticale(
    `<rect x="11" y="24" width="18" height="30" rx="3" fill="url(#ps)"/><rect x="13" y="28" width="14" height="6" rx="1" fill="#212121"/>` +
      `<circle cx="20" cy="31" r="1.8" fill="#ffc107"/>${scritta(20, 46, testo, 8, "#eceff1", 'font-weight="bold"')}`,
  );
icone["finecorsa-cilindro-fuori.svg"] = finecorsaCilindro("a1");
icone["finecorsa-cilindro-dentro.svg"] = finecorsaCilindro("a0");

// ============================================================ Utilizzatori
// Spia da quadro: ghiera cromata e calotta in vetro (il colore della luce lo disegna l'editor).
icone["lampada.svg"] = svg(
  40,
  80,
  `${morsetto(20, 0, 80)}${morsetto(20, 80, 80)}` +
    `<rect x="14" y="16" width="12" height="48" rx="2" fill="url(#pg)" stroke="#6c757b"/>` +
    `<circle cx="20.8" cy="40.8" r="14" fill="#000" opacity="0.2"/><circle cx="20" cy="40" r="14" fill="url(#cr)" stroke="#5f686e"/>` +
    `<circle cx="20" cy="40" r="10.5" fill="url(#vetro)" stroke="#7a848b" stroke-width="0.8"/>` +
    `<ellipse cx="16.5" cy="35.5" rx="4" ry="2.6" fill="#ffffff" opacity="0.75"/>`,
);
icone["sirena.svg"] = svg(
  40,
  80,
  `${morsetto(20, 0, 80)}${morsetto(20, 80, 80)}` +
    `<rect x="14" y="16" width="12" height="48" rx="2" fill="url(#pg)" stroke="#6c757b"/>` +
    ombra(7, 26, 20, 28, 3) +
    `<path d="M8 32H15L28 22V58L15 48H8Z" fill="url(#rosso)" stroke="#7f0000"/>` +
    `<path d="M31 31Q36 40 31 49M34 28Q41 40 34 52" fill="none" stroke="#d32f2f" stroke-width="1.4" stroke-linecap="round"/>`,
  rilievo("rosso", "#e53935"),
);
icone["suoneria.svg"] = svg(
  40,
  80,
  `${morsetto(20, 0, 80)}${morsetto(20, 80, 80)}` +
    // Campanello a calotta: base scura e coppa metallica lucida.
    `<rect x="9" y="50" width="22" height="8" rx="2" fill="url(#ps)"/>` +
    `<circle cx="20.8" cy="38.8" r="14" fill="#000" opacity="0.18"/><circle cx="20" cy="38" r="14" fill="url(#ottone)" stroke="#7a5a12"/>` +
    `<circle cx="20" cy="38" r="3" fill="#7a5a12"/><ellipse cx="15" cy="32" rx="5" ry="3" fill="#ffffff" opacity="0.5"/>` +
    `<path d="M20 18V24M20 52V62" stroke="#37474f" stroke-width="2"/>`,
  rilievo("ottone", "#d9a520"),
);
/** Motore visto di fronte: carcassa con alette, copriventola a griglia e scatola morsetti. */
const motore = (cy: number, r: number, morsettiAlti: number[], morsettiBassi: number[], marca: string) =>
  svg(
    80,
    80,
    morsettiAlti.map((x) => morsetto(x, 0, 80)).join("") +
      morsettiBassi.map((x) => morsetto(x, 80, 80)).join("") +
      `<rect x="14" y="9" width="52" height="12" rx="2" fill="url(#ps)"/>` +
      `<circle cx="${41.5}" cy="${cy + 2}" r="${r + 5}" fill="#000" opacity="0.2"/>` +
      `<circle cx="40" cy="${cy}" r="${r + 5}" fill="url(#carcassa)" stroke="#0a3070" stroke-width="1.2"/>` +
      Array.from({ length: 16 }, (_, i) => {
        const a = (i * 22.5 * Math.PI) / 180;
        return `<path d="M${40 + Math.cos(a) * (r - 0.5)} ${cy + Math.sin(a) * (r - 0.5)}L${40 + Math.cos(a) * (r + 5)} ${cy + Math.sin(a) * (r + 5)}" stroke="#0a3070" stroke-width="1.3"/>`;
      }).join("") +
      `<circle cx="40" cy="${cy}" r="${r - 1.5}" fill="url(#ps)"/>` +
      Array.from({ length: 6 }, (_, i) => `<circle cx="40" cy="${cy}" r="${(r - 3.5) * (1 - i / 6)}" fill="none" stroke="#8b969d" stroke-width="0.9"/>`).join("") +
      `<path d="M${40 - r + 3} ${cy}H${40 + r - 3}M40 ${cy - r + 3}V${cy + r - 3}" stroke="#8b969d" stroke-width="0.9"/>` +
      `<circle cx="40" cy="${cy}" r="3.2" fill="url(#me)"/>` +
      `<rect x="${40 - 11}" y="${cy + r - 9}" width="22" height="7" rx="1" fill="#eceff1" opacity="0.9"/>${scritta(40, cy + r - 3.6, marca, 5.6, "#0d47a1", 'font-weight="bold"')}`,
    `<defs><radialGradient id="carcassa" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#5aa0ea"/><stop offset="0.6" stop-color="#1565c0"/><stop offset="1" stop-color="#0a3a85"/></radialGradient></defs>`,
  );
icone["motore-trifase.svg"] = motore(50, 21, [20, 40, 60], [], "3~");
icone["motore-trifase-6.svg"] = motore(40, 19, [20, 40, 60], [20, 40, 60], "3~ Y/Δ");
icone["motore-monofase.svg"] = motore(50, 21, [20, 60], [], "1~");
icone["motore-cc.svg"] = motore(50, 21, [20, 60], [], "DC");

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
