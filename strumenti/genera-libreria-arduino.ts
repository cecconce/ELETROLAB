// Generatore della libreria del modulo Arduino (strumento per chi sviluppa):
// scrive libreria/arduino.json e i disegni SVG in libreria/icone/.
// I disegni sono originali e realistici "a colori", con piedini e fori su un
// passo di 20 unità, così i piedini dei componenti cadono esattamente nei fori
// della breadboard e si collegano da soli.
//
// Uso: npx vite-node strumenti/genera-libreria-arduino.ts
import { writeFileSync } from "node:fs";
import {
  ALTEZZA_BREADBOARD,
  COLONNE_BREADBOARD,
  LARGHEZZA_BREADBOARD,
  RIGHE_ALTE,
  RIGHE_BASSE,
  X_PRIMA_COLONNA,
  Y_LINEE,
  Y_RIGHE,
  foriBreadboard,
} from "../src/motori/arduino/breadboard";
import { PUNTO_DECIMALE, RETTANGOLI_SEGMENTI } from "../src/editor/segmenti7";

const FONT = 'font-family="Segoe UI, Arial, sans-serif"';
const svg = (w: number, h: number, corpo: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n${corpo}\n</svg>\n`;
const testo = (x: number, y: number, t: string, dim = 9, colore = "#ffffff", extra = "") =>
  `<text x="${x}" y="${y}" font-size="${dim}" text-anchor="middle" fill="${colore}" ${FONT} ${extra}>${t}</text>`;
const PIEDINO = "#9e9e9e";

const icone: Record<string, string> = {};
interface Voce {
  id: string;
  nome: string;
  categoria: string;
  sigla: string;
  descrizione: string;
  paroleChiave: string[];
  icona: string;
  larghezza: number;
  altezza: number;
  morsetti: { id: string; x: number; y: number }[];
}
const voci: Voce[] = [];
const voce = (v: Omit<Voce, "icona">, disegno: string) => {
  // Prefisso "ard-": le icone realistiche non si confondono con i simboli
  // normativi delle altre librerie (es. resistenza.svg dell'Elettronica).
  icone[`ard-${v.id}.svg`] = disegno;
  voci.push({ ...v, icona: `ard-${v.id}.svg` });
};

// ---------------------------------------------------------------- Scheda Uno
const PIN_ALTO: [string, number, string][] = [
  ["AREF", 80, "AREF"], ["GND3", 100, "GND"], ["D13", 120, "13"], ["D12", 140, "12"], ["D11", 160, "~11"], ["D10", 180, "~10"],
  ["D9", 200, "~9"], ["D8", 220, "8"], ["D7", 260, "7"], ["D6", 280, "~6"], ["D5", 300, "~5"], ["D4", 320, "4"], ["D3", 340, "~3"],
  ["D2", 360, "2"], ["D1", 380, "TX 1"], ["D0", 400, "RX 0"],
];
const PIN_BASSO: [string, number, string][] = [
  ["3V3", 160, "3.3V"], ["5V", 180, "5V"], ["GND1", 200, "GND"], ["GND2", 220, "GND"], ["VIN", 240, "Vin"],
  ["A0", 280, "A0"], ["A1", 300, "A1"], ["A2", 320, "A2"], ["A3", 340, "A3"], ["A4", 360, "A4"], ["A5", 380, "A5"],
];
{
  const W = 420;
  const H = 300;
  const fori = (pin: [string, number, string][], y: number) => pin.map(([, x]) => `<rect x="${x - 4}" y="${y - 4}" width="8" height="8" fill="#111" stroke="#555" stroke-width="1"/>`).join("");
  const etichette = (pin: [string, number, string][], y: number) =>
    pin.map(([, x, t]) => `<text x="${x}" y="${y}" font-size="7.5" text-anchor="end" fill="#fff" ${FONT} transform="rotate(-90 ${x} ${y})" dominant-baseline="middle">${t}</text>`).join("");
  const corpo = [
    `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="14" fill="#0e7c7b" stroke="#095856" stroke-width="2"/>`,
    ...[[16, 16], [16, H - 16], [W - 16, 30], [W - 16, H - 40]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="7" fill="#f5f5f5" stroke="#095856"/>`),
    // connettore USB e presa di alimentazione
    `<rect x="0" y="44" width="62" height="58" rx="3" fill="#cfd8dc" stroke="#78909c" stroke-width="2"/><rect x="8" y="56" width="40" height="34" fill="#90a4ae"/>`,
    `<rect x="0" y="196" width="58" height="56" rx="4" fill="#212121"/><circle cx="34" cy="224" r="12" fill="#424242"/>`,
    // file di connettori (header) in alto e in basso
    `<rect x="70" y="10" width="160" height="20" fill="#1b1b1b"/><rect x="250" y="10" width="160" height="20" fill="#1b1b1b"/>`,
    `<rect x="150" y="270" width="100" height="20" fill="#1b1b1b"/><rect x="270" y="270" width="120" height="20" fill="#1b1b1b"/>`,
    fori(PIN_ALTO, 20),
    fori(PIN_BASSO, 280),
    etichette(PIN_ALTO, 38),
    `<g transform="translate(0 0)">${PIN_BASSO.map(([, x, t]) => `<text x="${x}" y="262" font-size="7.5" text-anchor="start" fill="#fff" ${FONT} transform="rotate(-90 ${x} 262)" dominant-baseline="middle">${t}</text>`).join("")}</g>`,
    testo(240, 66, "DIGITAL (PWM ~)", 8),
    testo(200, 236, "POWER", 8),
    testo(330, 236, "ANALOG IN", 8),
    // microcontrollore a 28 piedini
    `<rect x="190" y="178" width="200" height="40" rx="3" fill="#1a1a1a"/>`,
    ...Array.from({ length: 14 }, (_, i) => `<rect x="${196 + i * 14}" y="172" width="6" height="6" fill="#bdbdbd"/><rect x="${196 + i * 14}" y="218" width="6" height="6" fill="#bdbdbd"/>`),
    `<circle cx="200" cy="198" r="3" fill="#333"/>`,
    // pulsante di reset e LED di stato
    `<rect x="78" y="60" width="22" height="22" rx="3" fill="#bdbdbd"/><circle cx="89" cy="71" r="7" fill="#c62828"/>`,
    `<rect x="120" y="80" width="10" height="6" fill="#ffe082" stroke="#9e9e9e" stroke-width="0.5"/>${testo(140, 86, "L", 8)}`,
    `<rect x="120" y="96" width="10" height="6" fill="#ffe082" stroke="#9e9e9e" stroke-width="0.5"/>${testo(144, 102, "TX", 7)}`,
    `<rect x="120" y="108" width="10" height="6" fill="#ffe082" stroke="#9e9e9e" stroke-width="0.5"/>${testo(144, 114, "RX", 7)}`,
    `<rect x="370" y="120" width="10" height="6" fill="#a5d6a7" stroke="#9e9e9e" stroke-width="0.5"/>${testo(392, 126, "ON", 7)}`,
    // scritta (nessun marchio: solo il nome generico della scheda)
    `<text x="260" y="140" font-size="44" font-weight="bold" font-style="italic" text-anchor="middle" fill="#ffffff" opacity="0.92" ${FONT}>UNO</text>`,
    testo(260, 158, "SCHEDA DI SVILUPPO COMPATIBILE", 8),
  ].join("\n");
  voce(
    {
      id: "arduino-uno",
      nome: "Arduino Uno",
      categoria: "schede",
      sigla: "U",
      descrizione: "La scheda con il microcontrollore che esegue il tuo programma. Pin digitali 0–13 (quelli con ~ fanno anche PWM), ingressi analogici A0–A5, alimentazioni 5V, 3.3V e GND. Il LED «L» è collegato al pin 13.",
      paroleChiave: ["arduino", "uno", "scheda", "microcontrollore", "board"],
      larghezza: W,
      altezza: H,
      morsetti: [...PIN_ALTO.map(([id, x]) => ({ id, x, y: 20 })), ...PIN_BASSO.map(([id, x]) => ({ id, x, y: 280 }))],
    },
    svg(W, H, corpo),
  );
}

// ---------------------------------------------------------------- Breadboard
{
  const W = LARGHEZZA_BREADBOARD;
  const H = ALTEZZA_BREADBOARD;
  const fori = foriBreadboard();
  const xUltima = X_PRIMA_COLONNA + (COLONNE_BREADBOARD - 1) * 20;
  const corpo = [
    `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="8" fill="#f4f4f2" stroke="#cfcfcb" stroke-width="2"/>`,
    // linee di alimentazione: rossa = +, blu = −
    `<line x1="${X_PRIMA_COLONNA - 10}" y1="8" x2="${xUltima + 10}" y2="8" stroke="#e53935" stroke-width="2"/>`,
    `<line x1="${X_PRIMA_COLONNA - 10}" y1="52" x2="${xUltima + 10}" y2="52" stroke="#1e88e5" stroke-width="2"/>`,
    `<line x1="${X_PRIMA_COLONNA - 10}" y1="328" x2="${xUltima + 10}" y2="328" stroke="#e53935" stroke-width="2"/>`,
    `<line x1="${X_PRIMA_COLONNA - 10}" y1="372" x2="${xUltima + 10}" y2="372" stroke="#1e88e5" stroke-width="2"/>`,
    testo(18, Y_LINEE.Ap + 4, "+", 13, "#e53935", 'font-weight="bold"'),
    testo(18, Y_LINEE.Am + 4, "−", 13, "#1e88e5", 'font-weight="bold"'),
    testo(18, Y_LINEE.Bp + 4, "+", 13, "#e53935", 'font-weight="bold"'),
    testo(18, Y_LINEE.Bm + 4, "−", 13, "#1e88e5", 'font-weight="bold"'),
    testo(W - 18, Y_LINEE.Ap + 4, "+", 13, "#e53935", 'font-weight="bold"'),
    testo(W - 18, Y_LINEE.Am + 4, "−", 13, "#1e88e5", 'font-weight="bold"'),
    testo(W - 18, Y_LINEE.Bp + 4, "+", 13, "#e53935", 'font-weight="bold"'),
    testo(W - 18, Y_LINEE.Bm + 4, "−", 13, "#1e88e5", 'font-weight="bold"'),
    // solco centrale
    `<rect x="${X_PRIMA_COLONNA - 14}" y="183" width="${xUltima - X_PRIMA_COLONNA + 28}" height="14" fill="#e2e2de"/>`,
    ...fori.map((f) => `<rect x="${f.x - 3.5}" y="${f.y - 3.5}" width="7" height="7" rx="1" fill="#3b3b3b"/>`),
    ...[...RIGHE_ALTE, ...RIGHE_BASSE].flatMap((r) => [testo(18, Y_RIGHE[r] + 3, r, 9, "#888"), testo(W - 18, Y_RIGHE[r] + 3, r, 9, "#888")]),
    ...[1, 5, 10, 15, 20, 25, 30].flatMap((c) => {
      const x = X_PRIMA_COLONNA + (c - 1) * 20;
      return [testo(x, 68, String(c), 8, "#888"), testo(x, 320, String(c), 8, "#888")];
    }),
  ].join("\n");
  voce(
    {
      id: "breadboard",
      nome: "Breadboard",
      categoria: "schede",
      sigla: "",
      descrizione: "Basetta per montare i circuiti senza saldare. In ogni colonna i 5 fori a–e sono collegati fra loro (e così f–j); le linee lunghe + e − in alto e in basso portano l'alimentazione. Infila i piedini dei componenti nei fori.",
      paroleChiave: ["breadboard", "basetta", "millefori", "prototipi"],
      larghezza: W,
      altezza: H,
      morsetti: fori,
    },
    svg(W, H, corpo),
  );
}

// ---------------------------------------------------------------- LED
const COLORI_LED: [string, string, string][] = [
  ["rosso", "#e53935", "LED rosso"],
  ["verde", "#43a047", "LED verde"],
  ["giallo", "#fdd835", "LED giallo"],
  ["blu", "#1e88e5", "LED blu"],
];
for (const [nome, colore, titolo] of COLORI_LED) {
  const corpo = [
    // piedini: l'anodo (+, gamba piegata) a sinistra, il catodo (−) a destra
    `<path d="M15 44 V60 L0 72 V80" fill="none" stroke="${PIEDINO}" stroke-width="2.5" stroke-linejoin="round"/>`,
    `<path d="M25 44 V64 L40 72 V80" fill="none" stroke="${PIEDINO}" stroke-width="2.5" stroke-linejoin="round"/>`,
    `<rect x="5" y="40" width="30" height="6" rx="1.5" fill="${colore}" stroke="#00000055"/>`,
    `<path d="M7 42 V22 A13 13 0 0 1 33 22 V42 Z" fill="${colore}" fill-opacity="0.85" stroke="#00000055"/>`,
    `<path d="M12 22 A8 8 0 0 1 20 13" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>`,
    testo(4, 64, "+", 9, "#757575", 'font-weight="bold"'),
  ].join("\n");
  voce(
    {
      id: `led-${nome}`,
      nome: titolo,
      categoria: "uscite",
      sigla: "D",
      descrizione: "Diodo luminoso: si accende quando la corrente va dall'anodo (+, gamba piegata) al catodo (−). Mettilo sempre in serie a una resistenza (220 Ω), altrimenti si brucia!",
      paroleChiave: ["led", "luce", "diodo", nome],
      larghezza: 40,
      altezza: 80,
      morsetti: [
        { id: "A", x: 0, y: 80 },
        { id: "K", x: 40, y: 80 },
      ],
    },
    svg(40, 80, corpo),
  );
}

// ---------------------------------------------------------------- Resistenza
voce(
  {
    id: "resistenza",
    nome: "Resistenza",
    categoria: "passivi",
    sigla: "R",
    descrizione: "Limita la corrente. Il valore si legge dalle fasce colorate e si cambia nelle Proprietà (220 Ω per i LED, 10 kΩ per i pulsanti e i partitori).",
    paroleChiave: ["resistenza", "resistore", "ohm", "resistor"],
    larghezza: 80,
    altezza: 40,
    morsetti: [
      { id: "1", x: 0, y: 20 },
      { id: "2", x: 80, y: 20 },
    ],
  },
  svg(
    80,
    40,
    [
      `<line x1="0" y1="20" x2="80" y2="20" stroke="${PIEDINO}" stroke-width="2.5"/>`,
      `<rect x="18" y="12" width="44" height="16" rx="7" fill="#e4cf9e" stroke="#b39b62"/>`,
      // fasce di 220 Ω (rosso, rosso, marrone, oro): l'editor le ridisegna col valore vero
      `<rect x="25" y="12" width="4" height="16" fill="#d32f2f"/><rect x="33" y="12" width="4" height="16" fill="#d32f2f"/>`,
      `<rect x="41" y="12" width="4" height="16" fill="#6d4c41"/><rect x="53" y="12" width="4" height="16" fill="#c9a227"/>`,
    ].join("\n"),
  ),
);

// ---------------------------------------------------------------- Pulsante
voce(
  {
    id: "pulsante",
    nome: "Pulsante",
    categoria: "ingressi",
    sigla: "S",
    descrizione: "Pulsante a 4 piedini da montare a cavallo del solco della breadboard: i due piedini a sinistra sono sempre collegati fra loro (e così quelli a destra); premendo si collegano i due lati. In simulazione tienilo premuto con il mouse.",
    paroleChiave: ["pulsante", "bottone", "tasto", "button", "switch"],
    larghezza: 40,
    altezza: 60,
    morsetti: [
      { id: "1a", x: 0, y: 0 },
      { id: "2a", x: 40, y: 0 },
      { id: "1b", x: 0, y: 60 },
      { id: "2b", x: 40, y: 60 },
    ],
  },
  svg(
    40,
    60,
    [
      ...[[0, 0], [40, 0], [0, 60], [40, 60]].map(([x, y]) => `<line x1="${x}" y1="${y}" x2="${x === 0 ? 6 : 34}" y2="${y === 0 ? 10 : 50}" stroke="${PIEDINO}" stroke-width="2.5"/>`),
      `<rect x="3" y="9" width="34" height="42" rx="3" fill="#2b2b2b"/>`,
      `<circle cx="20" cy="30" r="11" fill="#5f5f5f" stroke="#1a1a1a"/>`,
      `<circle cx="17" cy="27" r="4" fill="#8a8a8a"/>`,
    ].join("\n"),
  ),
);

// ---------------------------------------------------------------- Potenziometro
voce(
  {
    id: "potenziometro",
    nome: "Potenziometro",
    categoria: "ingressi",
    sigla: "RV",
    descrizione: "Resistenza variabile da 10 kΩ con tre piedini: agli estremi 5V e GND, al centro (cursore) la tensione che leggi con analogRead. In simulazione: clic per girare la manopola (Maiusc + clic per tornare indietro).",
    paroleChiave: ["potenziometro", "manopola", "trimmer", "resistenza variabile"],
    larghezza: 40,
    altezza: 40,
    morsetti: [
      { id: "1", x: 0, y: 40 },
      { id: "W", x: 20, y: 40 },
      { id: "2", x: 40, y: 40 },
    ],
  },
  svg(
    40,
    40,
    [
      ...[0, 20, 40].map((x) => `<line x1="${x}" y1="40" x2="${x === 0 ? 6 : x === 40 ? 34 : 20}" y2="28" stroke="${PIEDINO}" stroke-width="2.5"/>`),
      `<rect x="2" y="0" width="36" height="30" rx="4" fill="#1565c0"/>`,
      `<circle cx="20" cy="15" r="11" fill="#eceff1" stroke="#90a4ae"/>`,
      `<line x1="20" y1="15" x2="20" y2="5" stroke="#455a64" stroke-width="3" stroke-linecap="round"/>`,
    ].join("\n"),
  ),
);

// ---------------------------------------------------------------- Fotoresistenza
voce(
  {
    id: "fotoresistenza",
    nome: "Fotoresistenza",
    categoria: "ingressi",
    sigla: "LDR",
    descrizione: "La sua resistenza diminuisce con la luce (circa 100 kΩ al buio, 1 kΩ al sole). Mettila in partitore con una resistenza da 10 kΩ e leggi la tensione con analogRead. In simulazione: clic per cambiare la luce.",
    paroleChiave: ["fotoresistenza", "ldr", "luce", "sensore di luce", "fotocellula"],
    larghezza: 20,
    altezza: 40,
    morsetti: [
      { id: "1", x: 0, y: 40 },
      { id: "2", x: 20, y: 40 },
    ],
  },
  svg(
    20,
    40,
    [
      `<path d="M5 22 L0 34 V40 M15 22 L20 34 V40" fill="none" stroke="${PIEDINO}" stroke-width="2.5"/>`,
      `<circle cx="10" cy="12" r="10" fill="#f3e2bd" stroke="#bfa66b"/>`,
      `<path d="M4 9 H8 V15 H12 V9 H16" fill="none" stroke="#c62828" stroke-width="1.6"/>`,
    ].join("\n"),
  ),
);

// ---------------------------------------------------------------- Buzzer
voce(
  {
    id: "buzzer",
    nome: "Buzzer piezoelettrico",
    categoria: "uscite",
    sigla: "BZ",
    descrizione: "Emette un suono: con digitalWrite fa un clic, con tone(pin, frequenza) suona la nota scelta. Il piedino + va al pin, il − a GND.",
    paroleChiave: ["buzzer", "cicalino", "piezo", "suono", "tone"],
    larghezza: 40,
    altezza: 40,
    morsetti: [
      { id: "+", x: 0, y: 40 },
      { id: "-", x: 40, y: 40 },
    ],
  },
  svg(
    40,
    40,
    [
      `<path d="M12 30 L0 36 V40 M28 30 L40 36 V40" fill="none" stroke="${PIEDINO}" stroke-width="2.5"/>`,
      `<circle cx="20" cy="17" r="17" fill="#212121"/>`,
      `<circle cx="20" cy="17" r="4" fill="#000"/>`,
      testo(8, 12, "+", 9, "#bdbdbd", 'font-weight="bold"'),
    ].join("\n"),
  ),
);

// ---------------------------------------------------------------- Servo
voce(
  {
    id: "servo",
    nome: "Servomotore",
    categoria: "uscite",
    sigla: "M",
    descrizione: "Motorino che si gira all'angolo che scegli (0–180°) con la libreria Servo: myservo.attach(pin); myservo.write(angolo). Collega GND, 5V e il segnale a un pin.",
    paroleChiave: ["servo", "servomotore", "motore", "angolo"],
    larghezza: 140,
    altezza: 80,
    morsetti: [
      { id: "GND", x: 0, y: 20 },
      { id: "5V", x: 0, y: 40 },
      { id: "SIG", x: 0, y: 60 },
    ],
  },
  svg(
    140,
    80,
    [
      // cavetto a tre fili (marrone = GND, rosso = 5V, arancione = segnale)
      `<path d="M0 20 H14 Q20 20 24 32" fill="none" stroke="#6d4c41" stroke-width="3"/>`,
      `<path d="M0 40 H24" fill="none" stroke="#e53935" stroke-width="3"/>`,
      `<path d="M0 60 H14 Q20 60 24 48" fill="none" stroke="#fb8c00" stroke-width="3"/>`,
      `<rect x="4" y="14" width="10" height="52" rx="2" fill="#212121"/>`,
      `<rect x="24" y="16" width="96" height="48" rx="5" fill="#1e5aa8"/>`,
      `<rect x="20" y="28" width="104" height="8" rx="2" fill="#174a8b"/>`,
      `<circle cx="96" cy="40" r="15" fill="#174a8b"/>`,
      testo(60, 58, "SERVO", 9),
    ].join("\n"),
  ),
);

// ---------------------------------------------------------------- Display LCD 16x2
{
  // Piedini in alto, come sui moduli 1602: i cavetti non passano sopra lo schermo.
  const PIN_LCD = ["VSS", "VDD", "V0", "RS", "RW", "E", "D4", "D5", "D6", "D7", "A", "K"];
  const corpo = [
    ...PIN_LCD.map((id, i) => `<line x1="${20 + i * 20}" y1="0" x2="${20 + i * 20}" y2="26" stroke="${PIEDINO}" stroke-width="2.5"/>`),
    `<rect x="1" y="20" width="338" height="138" rx="6" fill="#1f6f3a" stroke="#14532d" stroke-width="2"/>`,
    ...[[12, 30], [328, 30], [12, 148], [328, 148]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#e8e8e8"/>`),
    ...PIN_LCD.map((id, i) => `<circle cx="${20 + i * 20}" cy="28" r="3" fill="#c9a227"/><text x="${20 + i * 20}" y="42" font-size="6.5" text-anchor="middle" fill="#fff" ${FONT}>${id}</text>`),
    `<rect x="22" y="56" width="296" height="80" rx="4" fill="#202020"/>`,
    `<rect x="32" y="67" width="276" height="58" fill="#5f7f3c"/>`,
    testo(300, 152, "LCD 16x2", 8),
  ].join("\n");
  voce(
    {
      id: "lcd",
      nome: "Display LCD 16x2",
      categoria: "uscite",
      sigla: "LCD",
      descrizione: "Display da 2 righe di 16 caratteri, con la libreria LiquidCrystal. Collega VSS e RW a GND, VDD a 5V, A (retroilluminazione) a 5V con una resistenza da 220 Ω e K a GND; RS, E, D4–D7 ai pin scritti in LiquidCrystal lcd(rs, en, d4, d5, d6, d7).",
      paroleChiave: ["lcd", "display", "schermo", "liquidcrystal", "16x2"],
      larghezza: 340,
      altezza: 160,
      morsetti: PIN_LCD.map((id, i) => ({ id, x: 20 + i * 20, y: 0 })),
    },
    svg(340, 160, corpo),
  );
}

// ---------------------------------------------------------------- Sensore a ultrasuoni
voce(
  {
    id: "ultrasuoni",
    nome: "Sensore a ultrasuoni",
    categoria: "ingressi",
    sigla: "US",
    descrizione: "Misura la distanza di un ostacolo con un impulso di ultrasuoni: VCC a 5V, GND a GND, TRIG ed ECHO a due pin. Con pulseIn(echo, HIGH) leggi la durata dell'eco: distanza in cm = durata / 58. In simulazione: clic a destra allontana l'ostacolo, a sinistra lo avvicina.",
    paroleChiave: ["ultrasuoni", "distanza", "sonar", "hc-sr04", "sensore di distanza"],
    larghezza: 140,
    altezza: 80,
    morsetti: [
      { id: "VCC", x: 40, y: 80 },
      { id: "TRIG", x: 60, y: 80 },
      { id: "ECHO", x: 80, y: 80 },
      { id: "GND", x: 100, y: 80 },
    ],
  },
  svg(
    140,
    80,
    [
      `<rect x="2" y="2" width="136" height="62" rx="5" fill="#1565c0" stroke="#0d47a1" stroke-width="2"/>`,
      ...[38, 102].map((x) => `<circle cx="${x}" cy="32" r="24" fill="#cfd8dc" stroke="#90a4ae" stroke-width="2"/><circle cx="${x}" cy="32" r="17" fill="#37474f"/><circle cx="${x}" cy="32" r="13" fill="none" stroke="#546e7a" stroke-width="1" stroke-dasharray="2 2"/>`),
      ...["VCC", "TRIG", "ECHO", "GND"].map((id, i) => `<line x1="${40 + i * 20}" y1="62" x2="${40 + i * 20}" y2="80" stroke="${PIEDINO}" stroke-width="2.5"/><text x="${40 + i * 20}" y="60" font-size="6" text-anchor="middle" fill="#fff" ${FONT}>${id}</text>`),
    ].join("\n"),
  ),
);

// ---------------------------------------------------------------- LED RGB (catodo comune)
voce(
  {
    id: "led-rgb",
    nome: "LED RGB",
    categoria: "uscite",
    sigla: "D",
    descrizione: "Tre LED (rosso, verde, blu) nello stesso involucro con il catodo in comune (gamba più lunga, al GND). Ogni colore va a un pin attraverso una resistenza da 220 Ω; con analogWrite mescoli i colori.",
    paroleChiave: ["led", "rgb", "colori", "tricolore"],
    larghezza: 60,
    altezza: 80,
    morsetti: [
      { id: "R", x: 0, y: 80 },
      { id: "K", x: 20, y: 80 },
      { id: "G", x: 40, y: 80 },
      { id: "B", x: 60, y: 80 },
    ],
  },
  svg(
    60,
    80,
    [
      `<path d="M22 44 V60 L0 72 V80" fill="none" stroke="${PIEDINO}" stroke-width="2.5"/>`,
      `<path d="M27 44 V66 L20 72 V80" fill="none" stroke="${PIEDINO}" stroke-width="2.5"/>`,
      `<path d="M33 44 V64 L40 72 V80" fill="none" stroke="${PIEDINO}" stroke-width="2.5"/>`,
      `<path d="M38 44 V58 L60 72 V80" fill="none" stroke="${PIEDINO}" stroke-width="2.5"/>`,
      `<rect x="13" y="40" width="34" height="6" rx="1.5" fill="#eceff1" stroke="#00000055"/>`,
      `<path d="M15 42 V22 A15 15 0 0 1 45 22 V42 Z" fill="#f5f5f5" fill-opacity="0.9" stroke="#00000055"/>`,
      `<circle cx="24" cy="28" r="3" fill="#e53935"/><circle cx="30" cy="22" r="3" fill="#43a047"/><circle cx="36" cy="28" r="3" fill="#1e88e5"/>`,
      testo(0, 66, "R", 7, "#757575", 'font-weight="bold"'),
      testo(46, 66, "G", 7, "#757575", 'font-weight="bold"'),
      testo(56, 64, "B", 7, "#757575", 'font-weight="bold"'),
    ].join("\n"),
  ),
);

// ---------------------------------------------------------------- Motore in corrente continua
voce(
  {
    id: "motore-dc",
    nome: "Motore in corrente continua",
    categoria: "uscite",
    sigla: "M",
    descrizione: "Piccolo motore: gira quando fra i due morsetti c'è tensione, più veloce con più tensione; invertendo i fili gira al contrario. Un pin di Arduino non basta a farlo girare forte: di solito si comanda con un transistor.",
    paroleChiave: ["motore", "dc", "cc", "ventola", "ruota"],
    larghezza: 80,
    altezza: 80,
    morsetti: [
      { id: "+", x: 20, y: 80 },
      { id: "-", x: 60, y: 80 },
    ],
  },
  svg(
    80,
    80,
    [
      `<line x1="20" y1="58" x2="20" y2="80" stroke="#e53935" stroke-width="2.5"/><line x1="60" y1="58" x2="60" y2="80" stroke="#212121" stroke-width="2.5"/>`,
      `<rect x="10" y="10" width="60" height="50" rx="10" fill="#b0bec5" stroke="#607d8b" stroke-width="2"/>`,
      `<rect x="16" y="16" width="48" height="38" rx="6" fill="#cfd8dc"/>`,
      `<circle cx="40" cy="35" r="10" fill="#eceff1" stroke="#90a4ae"/>`,
      `<rect x="38" y="0" width="4" height="12" fill="#9e9e9e"/>`,
      testo(40, 39, "M", 9, "#455a64", 'font-weight="bold"'),
      testo(13, 72, "+", 9, "#e53935", 'font-weight="bold"'),
    ].join("\n"),
  ),
);

// ---------------------------------------------------------------- Sensore di temperatura
voce(
  {
    id: "tmp36",
    nome: "Sensore di temperatura",
    categoria: "ingressi",
    sigla: "U",
    descrizione: "Dà una tensione che cresce con la temperatura: 0,5 V a 0 °C e 10 mV in più per ogni grado (0,75 V a 25 °C). Piedini: +5V, uscita (verso un ingresso analogico), GND. In simulazione: clic a destra scalda, a sinistra raffredda.",
    paroleChiave: ["temperatura", "tmp36", "termometro", "sensore"],
    larghezza: 40,
    altezza: 60,
    morsetti: [
      { id: "VCC", x: 0, y: 60 },
      { id: "OUT", x: 20, y: 60 },
      { id: "GND", x: 40, y: 60 },
    ],
  },
  svg(
    40,
    60,
    [
      ...[0, 20, 40].map((x) => `<line x1="${x}" y1="60" x2="${x === 0 ? 12 : x === 40 ? 28 : 20}" y2="34" stroke="${PIEDINO}" stroke-width="2.5"/>`),
      `<path d="M6 34 V14 A14 14 0 0 1 34 14 V34 Z" fill="#212121"/>`,
      testo(20, 24, "TMP", 7, "#e0e0e0", 'font-weight="bold"'),
    ].join("\n"),
  ),
);

// ---------------------------------------------------------------- Interruttore a slitta
voce(
  {
    id: "interruttore-slitta",
    nome: "Interruttore a slitta",
    categoria: "ingressi",
    sigla: "S",
    descrizione: "Deviatore a tre piedini: il piedino centrale è collegato a quello di sinistra o a quello di destra secondo la posizione della levetta, e ci resta. In simulazione: clic per spostare la levetta.",
    paroleChiave: ["interruttore", "deviatore", "slitta", "switch"],
    larghezza: 40,
    altezza: 40,
    morsetti: [
      { id: "1", x: 0, y: 40 },
      { id: "C", x: 20, y: 40 },
      { id: "2", x: 40, y: 40 },
    ],
  },
  svg(
    40,
    40,
    [
      ...[0, 20, 40].map((x) => `<line x1="${x}" y1="40" x2="${x === 0 ? 6 : x === 40 ? 34 : 20}" y2="26" stroke="${PIEDINO}" stroke-width="2.5"/>`),
      `<rect x="2" y="8" width="36" height="20" rx="3" fill="#424242"/>`,
      `<rect x="6" y="13" width="28" height="10" rx="2" fill="#212121"/>`,
      `<rect x="7" y="10" width="12" height="16" rx="2" fill="#bdbdbd" stroke="#757575"/>`,
    ].join("\n"),
  ),
);

// ---------------------------------------------------------------- Display a 7 segmenti
voce(
  {
    id: "display-sette-segmenti",
    nome: "Display a 7 segmenti",
    categoria: "uscite",
    sigla: "DS",
    descrizione: "Otto LED a forma di segmento (a…g e il punto) con il catodo in comune (COM, al GND). Montalo a cavallo del solco della breadboard e collega ogni segmento a un pin con una resistenza da 220 Ω: accendendo i segmenti giusti scrivi le cifre da 0 a 9.",
    paroleChiave: ["display", "7 segmenti", "sette segmenti", "cifre", "numeri"],
    larghezza: 80,
    altezza: 100,
    morsetti: [
      { id: "g", x: 0, y: 0 },
      { id: "f", x: 20, y: 0 },
      { id: "COM1", x: 40, y: 0 },
      { id: "a", x: 60, y: 0 },
      { id: "b", x: 80, y: 0 },
      { id: "e", x: 0, y: 100 },
      { id: "d", x: 20, y: 100 },
      { id: "COM2", x: 40, y: 100 },
      { id: "c", x: 60, y: 100 },
      { id: "dp", x: 80, y: 100 },
    ],
  },
  svg(
    80,
    100,
    [
      ...[0, 20, 40, 60, 80].flatMap((x) => [
        `<line x1="${x}" y1="0" x2="${Math.min(74, Math.max(6, x))}" y2="10" stroke="${PIEDINO}" stroke-width="2.5"/>`,
        `<line x1="${x}" y1="100" x2="${Math.min(74, Math.max(6, x))}" y2="90" stroke="${PIEDINO}" stroke-width="2.5"/>`,
      ]),
      `<rect x="4" y="8" width="72" height="84" rx="3" fill="#2b2b2b" stroke="#111"/>`,
      `<rect x="10" y="13" width="60" height="74" rx="2" fill="#3a3a3a"/>`,
      ...Object.values(RETTANGOLI_SEGMENTI).map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="#5a4646"/>`),
      `<circle cx="${PUNTO_DECIMALE[0]}" cy="${PUNTO_DECIMALE[1]}" r="${PUNTO_DECIMALE[2]}" fill="#5a4646"/>`,
      ...["g", "f", "C", "a", "b"].map((t, i) => testo(Math.min(70, Math.max(10, i * 20)), 17, t, 6, "#9e9e9e")),
      ...["e", "d", "C", "c", "dp"].map((t, i) => testo(Math.min(70, Math.max(10, i * 20)), 88, t, 6, "#9e9e9e")),
    ].join("\n"),
  ),
);

const libreria = {
  versione: 1,
  modulo: "arduino",
  categorie: [
    { id: "schede", nome: "Scheda e breadboard" },
    { id: "uscite", nome: "Uscite (LED, suono, motori)" },
    { id: "ingressi", nome: "Ingressi (pulsanti, sensori)" },
    { id: "passivi", nome: "Componenti passivi" },
  ],
  componenti: voci,
};
writeFileSync(new URL("../libreria/arduino.json", import.meta.url), JSON.stringify(libreria, null, 2) + "\n");
for (const [nome, contenuto] of Object.entries(icone)) writeFileSync(new URL(`../libreria/icone/${nome}`, import.meta.url), contenuto);
console.log(`scritte ${voci.length} voci e ${Object.keys(icone).length} icone`);
