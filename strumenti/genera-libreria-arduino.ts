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

// ---------------------------------------------------------------- Sensore di movimento PIR
voce(
  {
    id: "sensore-pir",
    nome: "Sensore di movimento (PIR)",
    categoria: "ingressi",
    sigla: "U",
    descrizione: "Sensore a infrarossi passivi: l'uscita OUT va a HIGH quando vede muoversi una persona davanti, altrimenti resta LOW. Piedini: VCC a 5V, OUT a un pin digitale (lo leggi con digitalRead), GND a GND. In simulazione: clic per simulare il movimento (un altro clic per fermarlo).",
    paroleChiave: ["pir", "movimento", "presenza", "infrarossi", "allarme"],
    larghezza: 80,
    altezza: 80,
    morsetti: [
      { id: "VCC", x: 20, y: 80 },
      { id: "OUT", x: 40, y: 80 },
      { id: "GND", x: 60, y: 80 },
    ],
  },
  svg(
    80,
    80,
    [
      ...[20, 40, 60].map((x) => `<line x1="${x}" y1="80" x2="${x}" y2="58" stroke="${PIEDINO}" stroke-width="2.5"/>`),
      `<rect x="4" y="44" width="72" height="16" rx="2" fill="#2e7d32"/>`,
      `<path d="M18 46 A22 22 0 0 1 62 46 Z" fill="#f5f5f5" stroke="#bdbdbd"/>`,
      `<path d="M24 40 Q40 22 56 40" fill="none" stroke="#e0e0e0" stroke-width="1.5"/><path d="M30 44 Q40 32 50 44" fill="none" stroke="#e0e0e0" stroke-width="1.5"/>`,
      testo(20, 56, "VCC", 5, "#ffffff"),
      testo(40, 56, "OUT", 5, "#ffffff"),
      testo(60, 56, "GND", 5, "#ffffff"),
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

// ---------------------------------------------------------- Sensori comandati con i clic
voce(
  {
    id: "sensore-inclinazione",
    nome: "Sensore di inclinazione",
    categoria: "ingressi",
    sigla: "S",
    descrizione: "Interruttore con una pallina dentro (tilt): dritto la pallina tocca i due contatti e il circuito è chiuso; inclinato la pallina rotola via e il circuito si apre. Si usa come un pulsante (con INPUT_PULLUP). In simulazione: clic per inclinarlo o raddrizzarlo.",
    paroleChiave: ["inclinazione", "tilt", "sfera", "pallina", "vibrazione", "sensore"],
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
      `<line x1="0" y1="40" x2="6" y2="26" stroke="${PIEDINO}" stroke-width="2.5"/><line x1="20" y1="40" x2="14" y2="26" stroke="${PIEDINO}" stroke-width="2.5"/>`,
      `<defs><linearGradient id="tiltCorpo" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#424242"/><stop offset="0.4" stop-color="#757575"/><stop offset="1" stop-color="#212121"/></linearGradient></defs>`,
      `<rect x="3" y="2" width="14" height="26" rx="5" fill="url(#tiltCorpo)" stroke="#111"/>`,
      `<circle cx="10" cy="22" r="3.5" fill="#cfd8dc" opacity="0.5"/>`,
    ].join("\n"),
  ),
);

voce(
  {
    id: "sensore-forza",
    nome: "Sensore di forza (FSR)",
    categoria: "ingressi",
    sigla: "R",
    descrizione: "Resistenza sensibile alla forza: senza pressione è quasi un circuito aperto (oltre 1 MΩ), premendo la sua resistenza scende fino a poche centinaia di ohm. Con una resistenza da 10 kΩ forma un partitore da leggere con analogRead. In simulazione: clic a destra per premere di più, a sinistra per premere di meno.",
    paroleChiave: ["forza", "pressione", "fsr", "peso", "bilancia", "sensore"],
    larghezza: 40,
    altezza: 80,
    morsetti: [
      { id: "1", x: 0, y: 80 },
      { id: "2", x: 40, y: 80 },
    ],
  },
  svg(
    40,
    80,
    [
      `<line x1="0" y1="80" x2="16" y2="58" stroke="${PIEDINO}" stroke-width="2.5"/><line x1="40" y1="80" x2="24" y2="58" stroke="${PIEDINO}" stroke-width="2.5"/>`,
      `<rect x="14" y="30" width="12" height="30" fill="#5d4037" stroke="#3e2723"/>`,
      `<circle cx="20" cy="18" r="17" fill="#6d4c41" stroke="#3e2723"/>`,
      `<circle cx="20" cy="18" r="12" fill="#8d6e63"/>`,
      ...[0, 1, 2, 3].map((k) => `<path d="M${11 + k * 6} 9 V27" stroke="#c9a227" stroke-width="1.2"/>`),
    ].join("\n"),
  ),
);

voce(
  {
    id: "sensore-umidita",
    nome: "Sensore di umidità del terreno",
    categoria: "ingressi",
    sigla: "U",
    descrizione: "Sonda a forchetta da infilare nel terreno: più il terreno è bagnato, più alta è la tensione sull'uscita SIG (da 0 V, terreno secco, a circa 4,5 V, terreno bagnato). VCC a 5 V, GND a GND, SIG a un ingresso analogico. In simulazione: clic a destra per bagnare il terreno, a sinistra per asciugarlo.",
    paroleChiave: ["umidità", "umidita", "terreno", "suolo", "piante", "acqua", "annaffiare", "sensore"],
    larghezza: 80,
    altezza: 120,
    morsetti: [
      { id: "VCC", x: 20, y: 0 },
      { id: "GND", x: 40, y: 0 },
      { id: "SIG", x: 60, y: 0 },
    ],
  },
  svg(
    80,
    120,
    [
      ...[20, 40, 60].map((x) => `<line x1="${x}" y1="0" x2="${x}" y2="12" stroke="${PIEDINO}" stroke-width="2.5"/>`),
      `<rect x="10" y="8" width="60" height="30" rx="3" fill="#1565c0" stroke="#0d47a1"/>`,
      ...[["VCC", 20], ["GND", 40], ["SIG", 60]].map(([t, x]) => testo(Number(x), 22, String(t), 6.5, "#e3f2fd", 'font-weight="bold"')),
      // forchetta con le piste dorate
      `<path d="M14 36 H66 V44 L60 116 Q57 120 54 116 L50 52 H30 L26 116 Q23 120 20 116 L14 44 Z" fill="#1976d2" stroke="#0d47a1"/>`,
      `<path d="M22 50 L24 112 M58 50 L56 112" stroke="#e0b84c" stroke-width="3" stroke-linecap="round"/>`,
    ].join("\n"),
  ),
);

voce(
  {
    id: "sensore-gas",
    nome: "Sensore di gas",
    categoria: "ingressi",
    sigla: "U",
    descrizione: "Modulo con sensore di gas (fumo, GPL, metano): dentro c'è una piccola resistenza che si scalda, quindi consuma circa 150 mA dal 5 V. L'uscita AO dà circa 0,4 V in aria pulita e sale con la concentrazione di gas: si legge con analogRead e si confronta con una soglia. In simulazione: clic a destra per aggiungere gas, a sinistra per toglierlo.",
    paroleChiave: ["gas", "fumo", "gpl", "metano", "mq-2", "mq2", "aria", "allarme", "sensore"],
    larghezza: 80,
    altezza: 80,
    morsetti: [
      { id: "VCC", x: 20, y: 80 },
      { id: "GND", x: 40, y: 80 },
      { id: "AO", x: 60, y: 80 },
    ],
  },
  svg(
    80,
    80,
    [
      `<defs><radialGradient id="gasRete" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="#eceff1"/><stop offset="1" stop-color="#90a4ae"/></radialGradient></defs>`,
      ...[20, 40, 60].map((x) => `<line x1="${x}" y1="68" x2="${x}" y2="80" stroke="${PIEDINO}" stroke-width="2.5"/>`),
      `<rect x="4" y="4" width="72" height="66" rx="4" fill="#1565c0" stroke="#0d47a1"/>`,
      `<circle cx="40" cy="32" r="22" fill="#b0bec5" stroke="#607d8b"/>`,
      `<circle cx="40" cy="32" r="17" fill="url(#gasRete)"/>`,
      ...[-10, -5, 0, 5, 10].map((d) => `<line x1="${40 + d}" y1="17" x2="${40 + d}" y2="47" stroke="#78909c" stroke-width="0.8"/><line x1="25" y1="${32 + d}" x2="55" y2="${32 + d}" stroke="#78909c" stroke-width="0.8"/>`),
      ...[["VCC", 20], ["GND", 40], ["AO", 60]].map(([t, x]) => testo(Number(x), 64, String(t), 6.5, "#e3f2fd", 'font-weight="bold"')),
    ].join("\n"),
  ),
);

// ---------------------------------------------------------- Ponte H L293D
{
  // Piedini: in basso 1…8 da sinistra, in alto 16…9 da sinistra (come guardando
  // l'integrato con la tacca a sinistra). Si infila a cavallo del solco: i
  // piedini in basso cadono nella riga f, quelli in alto nella riga e.
  const basso: [string, string][] = [["EN12", "EN1,2"], ["IN1", "IN1"], ["OUT1", "OUT1"], ["GND1", "GND"], ["GND2", "GND"], ["OUT2", "OUT2"], ["IN2", "IN2"], ["VS", "VS"]];
  const alto: [string, string][] = [["VSS", "VSS"], ["IN4", "IN4"], ["OUT4", "OUT4"], ["GND4", "GND"], ["GND3", "GND"], ["OUT3", "OUT3"], ["IN3", "IN3"], ["EN34", "EN3,4"]];
  voce(
    {
      id: "l293d",
      nome: "Ponte H L293D",
      categoria: "uscite",
      sigla: "U",
      descrizione:
        "Integrato con quattro mezzi ponti per comandare i motori in continua nei due versi. Si infila a cavallo del solco della breadboard. VSS (16) = 5 V della logica, VS (8) = alimentazione dei motori (anche 9–12 V, da un alimentatore o dalle pile), GND (4, 5, 12, 13) in comune con l'Arduino. Motore fra OUT1 e OUT2: IN1 alto e IN2 basso = un verso, il contrario = l'altro verso, uguali = fermo. EN1,2 abilita le uscite 1 e 2: con analogWrite su EN si regola la velocità. Le uscite perdono circa 2,5 V in tutto, come nell'integrato vero.",
      paroleChiave: ["l293d", "ponte h", "h-bridge", "driver", "motore", "verso", "avanti", "indietro"],
      larghezza: 140,
      altezza: 60,
      morsetti: [...basso.map(([id], i) => ({ id, x: i * 20, y: 60 })), ...alto.map(([id], i) => ({ id, x: i * 20, y: 0 }))],
    },
    svg(
      140,
      60,
      [
        ...[0, 1, 2, 3, 4, 5, 6, 7].flatMap((i) => [
          `<rect x="${i * 20 - 3}" y="0" width="6" height="12" fill="#bdbdbd"/>`,
          `<rect x="${i * 20 - 3}" y="48" width="6" height="12" fill="#bdbdbd"/>`,
        ]),
        `<rect x="1" y="10" width="138" height="40" rx="3" fill="#262626" stroke="#000"/>`,
        `<path d="M1 24 A6 6 0 0 1 1 36" fill="#111"/>`,
        `<circle cx="9" cy="42" r="2.5" fill="#3a3a3a"/>`,
        testo(70, 33, "L293D", 10, "#e0e0e0", 'font-weight="bold"'),
        ...basso.map(([, t], i) => testo(Math.min(134, Math.max(6, i * 20)), 47, t, 4.6, "#bdbdbd")),
        ...alto.map(([, t], i) => testo(Math.min(134, Math.max(6, i * 20)), 18, t, 4.6, "#bdbdbd")),
      ].join("\n"),
    ),
  );
}

// ---------------------------------------------------------- Relè e lampadina
voce(
  {
    id: "modulo-rele",
    nome: "Modulo relè 5 V",
    categoria: "uscite",
    sigla: "K",
    descrizione:
      "Scheda con un relè e il suo circuito di comando già montato (transistor e diodo). A sinistra: VCC (5 V), GND e IN (dal pin dell'Arduino). A destra il contatto, isolato dalla scheda: COM è il comune, NO è chiuso col relè eccitato (normalmente aperto), NC è chiuso a riposo (normalmente chiuso). Con il pin a HIGH il relè scatta e il LED verde si accende: così l'Arduino accende una lampada o un motore alimentati a parte, anche a tensione più alta.",
    paroleChiave: ["relè", "rele", "relay", "modulo", "contatto", "NO", "NC", "COM"],
    larghezza: 140,
    altezza: 80,
    morsetti: [
      { id: "VCC", x: 0, y: 20 },
      { id: "GND", x: 0, y: 40 },
      { id: "IN", x: 0, y: 60 },
      { id: "NO", x: 140, y: 20 },
      { id: "COM", x: 140, y: 40 },
      { id: "NC", x: 140, y: 60 },
    ],
  },
  svg(
    140,
    80,
    [
      `<defs><linearGradient id="releCubo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#42a5f5"/><stop offset="1" stop-color="#1565c0"/></linearGradient></defs>`,
      // basetta e piedini a sinistra
      `<rect x="8" y="2" width="124" height="76" rx="5" fill="#1b5e20" stroke="#0d3311" stroke-width="1.5"/>`,
      ...[20, 40, 60].map((y) => `<line x1="0" y1="${y}" x2="14" y2="${y}" stroke="${PIEDINO}" stroke-width="2.5"/><rect x="10" y="${y - 4}" width="8" height="8" fill="#212121"/>`),
      ...[["VCC", 20], ["GND", 40], ["IN", 60]].map(([t, y]) => testo(30, Number(y) + 3, String(t), 7, "#e8f5e9", 'font-weight="bold"')),
      // relè (cubo azzurro) con le scritte
      `<rect x="44" y="10" width="54" height="50" rx="3" fill="url(#releCubo)" stroke="#0d47a1"/>`,
      testo(71, 30, "RELÈ", 9, "#e3f2fd", 'font-weight="bold"'),
      testo(71, 42, "5V DC", 7, "#bbdefb"),
      testo(71, 52, "10A 250V", 6, "#bbdefb"),
      // LED di alimentazione (rosso, sempre acceso se alimentato) e di stato (verde), spenti a riposo
      `<circle cx="26" cy="70" r="3" fill="#5d2b2b"/><circle cx="38" cy="70" r="3" fill="#2b4d2b"/>`,
      // morsettiera a vite a destra (verde)
      `<rect x="104" y="8" width="28" height="64" rx="2" fill="#2e7d32" stroke="#1b5e20"/>`,
      ...[20, 40, 60].map((y) => `<circle cx="118" cy="${y}" r="6" fill="#cfd8dc" stroke="#78909c"/><line x1="114" y1="${y - 4}" x2="122" y2="${y + 4}" stroke="#607d8b" stroke-width="1.5"/><line x1="132" y1="${y}" x2="140" y2="${y}" stroke="${PIEDINO}" stroke-width="2.5"/>`),
      ...[["NO", 20], ["COM", 40], ["NC", 60]].map(([t, y]) => `<text x="102" y="${Number(y) + 3}" font-size="6" text-anchor="end" fill="#e8f5e9" ${FONT}>${t}</text>`),
    ].join("\n"),
  ),
);

voce(
  {
    id: "lampadina",
    nome: "Lampadina 12 V",
    categoria: "uscite",
    sigla: "H",
    descrizione: "Lampadina a filamento da 12 V – 1,2 W (circa 100 mA). Si accende tanto più quanto più tensione riceve; oltre il doppio della potenza si brucia. Consuma troppo per un pin dell'Arduino: si alimenta a parte (alimentatore, pile) e si comanda con un relè o un transistor.",
    paroleChiave: ["lampadina", "lampada", "luce", "bulb", "12 V"],
    larghezza: 60,
    altezza: 80,
    morsetti: [
      { id: "1", x: 20, y: 80 },
      { id: "2", x: 40, y: 80 },
    ],
  },
  svg(
    60,
    80,
    [
      `<defs><radialGradient id="vetro" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#ffffff" stop-opacity="0.95"/><stop offset="1" stop-color="#cfd8dc" stop-opacity="0.6"/></radialGradient></defs>`,
      `<line x1="20" y1="62" x2="20" y2="80" stroke="${PIEDINO}" stroke-width="2.5"/><line x1="40" y1="62" x2="40" y2="80" stroke="${PIEDINO}" stroke-width="2.5"/>`,
      // attacco a vite
      `<rect x="19" y="44" width="22" height="18" rx="2" fill="#b0bec5" stroke="#78909c"/>`,
      ...[48, 53, 58].map((y) => `<line x1="19" y1="${y}" x2="41" y2="${y - 2}" stroke="#78909c" stroke-width="1.2"/>`),
      // bulbo di vetro con il filamento
      `<path d="M21 46 C10 38 6 30 6 24 A24 24 0 0 1 54 24 C54 30 50 38 39 46 Z" fill="url(#vetro)" stroke="#90a4ae"/>`,
      `<path d="M25 44 L25 28 M35 44 L35 28" stroke="#616161" stroke-width="1"/>`,
      `<path d="M25 28 l2.5 -4 l2.5 4 l2.5 -4 l2.5 4" fill="none" stroke="#5d4037" stroke-width="1.3"/>`,
    ].join("\n"),
  ),
);

// ---------------------------------------------------------- Semiconduttori
voce(
  {
    id: "transistor-npn",
    nome: "Transistor NPN",
    categoria: "passivi",
    sigla: "Q",
    descrizione:
      "Transistor bipolare NPN (contenitore TO-92, guadagno β = 100). Piedini da sinistra, con la faccia piatta davanti: E (emettitore), B (base), C (collettore). Una piccola corrente nella base (dal pin dell'Arduino attraverso una resistenza da 1 kΩ) fa passare una corrente 100 volte più grande fra collettore ed emettitore: così un pin comanda un motorino o una lampadina che consumano troppo per il pin. Base spenta: interdizione (interruttore aperto); base ben pilotata: saturazione (interruttore chiuso, 0,2 V fra C ed E).",
    paroleChiave: ["transistor", "transistore", "npn", "bjt", "bc337", "2n2222", "interruttore elettronico"],
    larghezza: 40,
    altezza: 60,
    morsetti: [
      { id: "E", x: 0, y: 60 },
      { id: "B", x: 20, y: 60 },
      { id: "C", x: 40, y: 60 },
    ],
  },
  svg(
    40,
    60,
    [
      `<defs><linearGradient id="to92" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#424242"/><stop offset="0.35" stop-color="#2b2b2b"/><stop offset="1" stop-color="#111"/></linearGradient></defs>`,
      ...[0, 20, 40].map((x) => `<line x1="${x}" y1="60" x2="${Math.min(30, Math.max(10, x))}" y2="34" stroke="${PIEDINO}" stroke-width="2.5"/>`),
      // corpo a mezzaluna: faccia piatta in basso, curva in alto
      `<path d="M6 34 V16 A14 14 0 0 1 34 16 V34 Z" fill="url(#to92)" stroke="#000"/>`,
      testo(20, 24, "NPN", 7, "#bdbdbd"),
      testo(20, 31, "β100", 5.5, "#9e9e9e"),
      ...[["E", 3], ["B", 20], ["C", 37]].map(([t, x]) => testo(Number(x), 47, String(t), 6.5, "#616161", 'font-weight="bold"')),
    ].join("\n"),
  ),
);

voce(
  {
    id: "diodo",
    nome: "Diodo (1N4007)",
    categoria: "passivi",
    sigla: "D",
    descrizione:
      "Diodo raddrizzatore: lascia passare la corrente in un solo verso, dall'anodo al catodo (il lato con la fascia argentata), con una caduta di circa 0,7 V. Montato al contrario accanto a un motorino o a un relè (diodo di ricircolo) protegge il transistor quando la bobina si spegne; in serie a un'alimentazione protegge il circuito se si scambiano + e −.",
    paroleChiave: ["diodo", "1n4007", "1n4148", "raddrizzatore", "ricircolo", "diode"],
    larghezza: 80,
    altezza: 40,
    morsetti: [
      { id: "A", x: 0, y: 20 },
      { id: "K", x: 80, y: 20 },
    ],
  },
  svg(
    80,
    40,
    [
      `<line x1="0" y1="20" x2="80" y2="20" stroke="${PIEDINO}" stroke-width="2.5"/>`,
      `<rect x="22" y="13" width="36" height="14" rx="3" fill="#212121" stroke="#000"/>`,
      `<rect x="49" y="13" width="5" height="14" fill="#cfd8dc"/>`,
      testo(10, 12, "A", 7, "#616161"),
      testo(70, 12, "K", 7, "#616161"),
    ].join("\n"),
  ),
);

// ---------------------------------------------------------- Alimentazione
// Alimentatore da banco (disegno originale): due display a LED per tensione e
// corrente, manopole, spie CV/CC e boccole + (rossa) e − (nera) in basso.
voce(
  {
    id: "alimentatore",
    nome: "Alimentatore da banco",
    categoria: "alimentazione",
    sigla: "PS",
    descrizione:
      "Alimentatore regolabile da laboratorio (0–30 V) con limite di corrente. Il display di sinistra indica la tensione ai morsetti, quello di destra la corrente erogata. Se il circuito chiede più corrente del limite, l'alimentatore passa in CC (corrente costante) e la tensione scende: così protegge LED e componenti. Tensione e limite si impostano nelle Proprietà; in simulazione un clic a destra alza la tensione di 0,5 V, un clic a sinistra la abbassa. Il morsetto − non è collegato al GND dell'Arduino: se l'alimentatore comanda un circuito letto dalla scheda, collega il − al GND.",
    paroleChiave: ["alimentatore", "alimentazione", "generatore", "tensione", "banco", "power supply", "limite di corrente"],
    larghezza: 160,
    altezza: 120,
    morsetti: [
      { id: "+", x: 60, y: 120 },
      { id: "-", x: 100, y: 120 },
    ],
  },
  svg(
    160,
    120,
    [
      `<defs><linearGradient id="psCassa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5c6b73"/><stop offset="1" stop-color="#37444b"/></linearGradient></defs>`,
      `<rect x="1" y="1" width="158" height="104" rx="8" fill="url(#psCassa)" stroke="#263238" stroke-width="2"/>`,
      `<rect x="6" y="6" width="148" height="94" rx="5" fill="#2b3439"/>`,
      // display della tensione e della corrente (le cifre si scrivono sopra, vedi DisegnoArduino)
      `<rect x="12" y="12" width="64" height="28" rx="3" fill="#120808" stroke="#000"/>`,
      `<rect x="84" y="12" width="64" height="28" rx="3" fill="#081208" stroke="#000"/>`,
      testo(44, 50, "TENSIONE", 7, "#cfd8dc"),
      testo(116, 50, "CORRENTE", 7, "#cfd8dc"),
      // manopole
      ...[30, 130].map((x) => `<circle cx="${x}" cy="72" r="12" fill="#1c2226" stroke="#90a4ae" stroke-width="1.5"/><circle cx="${x}" cy="72" r="8" fill="#3a464d"/><line x1="${x}" y1="72" x2="${x}" y2="63" stroke="#eceff1" stroke-width="2.5" stroke-linecap="round"/>`),
      // spie CV e CC (spente; si accendono in simulazione)
      `<circle cx="66" cy="62" r="3.5" fill="#33402e"/><circle cx="94" cy="62" r="3.5" fill="#402e2e"/>`,
      testo(66, 74, "CV", 6.5, "#cfd8dc"),
      testo(94, 74, "CC", 6.5, "#cfd8dc"),
      // boccole e cavetti di uscita
      `<line x1="60" y1="96" x2="60" y2="120" stroke="#e53935" stroke-width="3"/><circle cx="60" cy="90" r="7" fill="#c62828" stroke="#7f0000" stroke-width="1.5"/><circle cx="60" cy="90" r="2.5" fill="#ffcdd2"/>`,
      `<line x1="100" y1="96" x2="100" y2="120" stroke="#212121" stroke-width="3"/><circle cx="100" cy="90" r="7" fill="#212121" stroke="#000" stroke-width="1.5"/><circle cx="100" cy="90" r="2.5" fill="#9e9e9e"/>`,
      testo(48, 93, "+", 10, "#ff8a80", 'font-weight="bold"'),
      testo(113, 93, "−", 10, "#eceff1", 'font-weight="bold"'),
    ].join("\n"),
  ),
);

voce(
  {
    id: "batteria-9v",
    nome: "Pila da 9 V",
    categoria: "alimentazione",
    sigla: "BAT",
    descrizione: "Pila a transistor da 9 V con clip: cavetto rosso il +, nero il −. Ha una piccola resistenza interna (1,5 Ω), quindi sotto carico la tensione scende un po'. Si può usare per alimentare LED e motorini, o la scheda Arduino dal pin Vin.",
    paroleChiave: ["pila", "batteria", "9 V", "9V", "alimentazione"],
    larghezza: 60,
    altezza: 100,
    morsetti: [
      { id: "+", x: 20, y: 100 },
      { id: "-", x: 40, y: 100 },
    ],
  },
  svg(
    60,
    100,
    [
      `<defs><linearGradient id="b9Corpo" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#263238"/><stop offset="0.45" stop-color="#4f5b62"/><stop offset="1" stop-color="#1c2327"/></linearGradient></defs>`,
      // clip con i due cavetti
      `<rect x="10" y="4" width="40" height="12" rx="3" fill="#212121"/>`,
      `<path d="M20 16 V30" stroke="#e53935" stroke-width="3"/><path d="M40 16 V30" stroke="#212121" stroke-width="3"/>`,
      `<rect x="6" y="14" width="48" height="66" rx="4" fill="url(#b9Corpo)" stroke="#111"/>`,
      `<rect x="6" y="14" width="48" height="16" rx="4" fill="#f9a825"/>`,
      testo(30, 52, "9V", 15, "#ffffff", 'font-weight="bold"'),
      testo(30, 66, "ALCALINA", 6.5, "#cfd8dc"),
      testo(17, 26, "+", 10, "#b71c1c", 'font-weight="bold"'),
      testo(43, 26, "−", 10, "#212121", 'font-weight="bold"'),
      `<path d="M20 80 V100" stroke="#e53935" stroke-width="3"/><path d="M40 80 V100" stroke="#212121" stroke-width="3"/>`,
    ].join("\n"),
  ),
);

voce(
  {
    id: "portapile-4aa",
    nome: "Portapile 4 stilo (6 V)",
    categoria: "alimentazione",
    sigla: "BAT",
    descrizione: "Portapile con quattro pile stilo AA da 1,5 V in serie: 4 × 1,5 V = 6 V. Cavetto rosso il +, nero il −. Adatto ai motorini e ai servo, che consumano più corrente di quella che può dare un pin dell'Arduino.",
    paroleChiave: ["portapile", "pile", "stilo", "AA", "batteria", "6 V", "alimentazione"],
    larghezza: 100,
    altezza: 100,
    morsetti: [
      { id: "+", x: 40, y: 100 },
      { id: "-", x: 60, y: 100 },
    ],
  },
  svg(
    100,
    100,
    [
      `<defs><linearGradient id="aaPila" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9e9e9e"/><stop offset="0.4" stop-color="#eeeeee"/><stop offset="1" stop-color="#757575"/></linearGradient></defs>`,
      `<rect x="2" y="2" width="96" height="82" rx="5" fill="#212121" stroke="#000"/>`,
      ...[0, 1, 2, 3].map((k) => {
        const x = 8 + k * 22;
        // pile alternate (in serie): la calotta del + è su in una e giù nella successiva
        const su = k % 2 === 0;
        return `<rect x="${x}" y="10" width="18" height="66" rx="3" fill="url(#aaPila)"/><rect x="${x}" y="${su ? 18 : 48}" width="18" height="18" fill="#2e7d32"/><rect x="${x + 5}" y="${su ? 6 : 74}" width="8" height="5" rx="1" fill="#bdbdbd"/>` + testo(x + 9, su ? 31 : 61, su ? "+" : "−", 9, "#ffffff", 'font-weight="bold"');
      }),
      testo(50, 94, "4 × AA  6V", 7, "#616161"),
      `<path d="M40 84 V100" stroke="#e53935" stroke-width="3"/><path d="M60 84 V100" stroke="#212121" stroke-width="3"/>`,
    ].join("\n"),
  ),
);

// ---------------------------------------------------------------- Multimetro
voce(
  {
    id: "multimetro",
    nome: "Multimetro",
    categoria: "strumenti",
    sigla: "XMM",
    descrizione: "Strumento per misurare tensioni (V), correnti (A) e resistenze (Ω). Tensione: puntale nero da COM, rosso da V, toccando i due punti da confrontare (in parallelo). Corrente: rosso da A, va messo in serie, interrompendo il circuito. Resistenza: si misura con il componente non alimentato. In simulazione: clic sul multimetro per cambiare funzione.",
    paroleChiave: ["multimetro", "tester", "voltmetro", "amperometro", "ohmmetro", "misura"],
    larghezza: 120,
    altezza: 140,
    morsetti: [
      { id: "A", x: 20, y: 140 },
      { id: "COM", x: 60, y: 140 },
      { id: "V", x: 100, y: 140 },
    ],
  },
  svg(
    120,
    140,
    [
      `<rect x="2" y="2" width="116" height="128" rx="12" fill="#f9a825" stroke="#c17900" stroke-width="2"/>`,
      `<rect x="9" y="9" width="102" height="114" rx="8" fill="#37474f"/>`,
      `<rect x="16" y="15" width="88" height="30" rx="3" fill="#b9c7a3" stroke="#263238"/>`,
      `<circle cx="60" cy="78" r="20" fill="#263238" stroke="#90a4ae" stroke-width="2"/>`,
      `<circle cx="60" cy="78" r="5" fill="#90a4ae"/>`,
      testo(36, 66, "V", 9, "#ffffff", 'font-weight="bold"'),
      testo(60, 54, "A", 9, "#ffffff", 'font-weight="bold"'),
      testo(84, 66, "Ω", 9, "#ffffff", 'font-weight="bold"'),
      ...([[20, "A", "#e53935"], [60, "COM", "#212121"], [100, "V Ω", "#e53935"]] as const).map(
        ([x, t, c]) => `<line x1="${x}" y1="118" x2="${x}" y2="140" stroke="${c}" stroke-width="3"/><circle cx="${x}" cy="114" r="6" fill="#111" stroke="${c}" stroke-width="2.5"/>` + testo(x, 104, t, 7, "#eceff1"),
      ),
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
    { id: "alimentazione", nome: "Alimentazione (alimentatore, pile)" },
    { id: "strumenti", nome: "Strumenti di misura" },
  ],
  componenti: voci,
};
writeFileSync(new URL("../libreria/arduino.json", import.meta.url), JSON.stringify(libreria, null, 2) + "\n");
for (const [nome, contenuto] of Object.entries(icone)) writeFileSync(new URL(`../libreria/icone/${nome}`, import.meta.url), contenuto);
console.log(`scritte ${voci.length} voci e ${Object.keys(icone).length} icone`);
