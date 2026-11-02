// Generatore della libreria del modulo Elettronica (strumento per chi sviluppa):
// scrive libreria/elettronica.json e i simboli SVG in libreria/icone/.
// I simboli seguono la norma CEI/IEC 60617, disegnati da zero; gli strumenti
// virtuali (multimetro, generatore di funzioni, oscilloscopio) sono disegni
// originali stilizzati. Tutto in "currentColor", così i simboli prendono il
// colore del tema. Morsetti su un passo di 20 unità (griglia del foglio).
//
// Uso: npx vite-node strumenti/genera-libreria-elettronica.ts
import { readFileSync, writeFileSync } from "node:fs";

const FONT = 'font-family="Segoe UI, Arial, sans-serif"';
const svg = (w: number, h: number, corpo: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\n${corpo}\n</svg>\n`;
const scritta = (x: number, y: number, t: string, dim = 12, extra = "") =>
  `<text x="${x}" y="${y}" font-size="${dim}" text-anchor="middle" fill="currentColor" stroke="none" ${FONT} ${extra}>${t.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`;

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
const icone: Record<string, string> = {};
const voce = (v: Omit<Voce, "icona">, disegno: string | null) => {
  if (disegno !== null) icone[`${v.id}.svg`] = disegno;
  voci.push({ ...v, icona: `${v.id}.svg` });
};
const m = (id: string, x: number, y: number) => ({ id, x, y });

// ---------------------------------------------------------------- Sorgenti
voce(
  {
    id: "generatore-dc",
    nome: "Generatore di tensione continua",
    categoria: "sorgenti",
    sigla: "V",
    descrizione: "Fornisce una tensione costante fra i morsetti + e −, come una pila o un alimentatore da banco. La tensione si sceglie nelle Proprietà.",
    paroleChiave: ["pila", "batteria", "alimentatore", "DC", "tensione", "continua"],
    larghezza: 40,
    altezza: 80,
    morsetti: [m("+", 20, 0), m("-", 20, 80)],
  },
  // Simbolo della pila: tratto lungo (+) e tratto corto (−).
  svg(40, 80, `<path d="M20 0V34M20 46V80M6 34H34M13 46H27"/>${scritta(33, 26, "+", 12)}${scritta(33, 62, "−", 12)}`),
);
voce(
  {
    id: "generatore-corrente",
    nome: "Generatore di corrente",
    categoria: "sorgenti",
    sigla: "I",
    descrizione: "Fa scorrere sempre la stessa corrente, qualunque sia il circuito collegato. La freccia indica il verso della corrente.",
    paroleChiave: ["corrente", "costante", "ampere"],
    larghezza: 40,
    altezza: 80,
    morsetti: [m("+", 20, 0), m("-", 20, 80)],
  },
  svg(40, 80, `<circle cx="20" cy="40" r="16"/><path d="M20 0V24M20 56V80M20 50V30M14 36L20 29L26 36"/>`),
);
voce(
  {
    id: "generatore-funzioni",
    nome: "Generatore di funzioni",
    categoria: "strumenti",
    sigla: "XFG",
    descrizione: "Strumento che produce un segnale alternato: sinusoide, onda quadra o triangolare. Si scelgono forma, frequenza, ampiezza (di picco) e offset nelle Proprietà.",
    paroleChiave: ["segnale", "sinusoide", "onda quadra", "triangolare", "frequenza", "funzioni", "alternata"],
    larghezza: 80,
    altezza: 80,
    morsetti: [m("+", 20, 80), m("COM", 60, 80)],
  },
  svg(
    80,
    80,
    `<rect x="4" y="4" width="72" height="62" rx="6"/><rect x="12" y="12" width="56" height="28" rx="2"/>` +
      `<path d="M16 26C22 14 26 14 30 26S38 38 44 26S52 14 58 26" stroke-width="1.6"/>` +
      `<path d="M20 66V80M60 66V80"/>${scritta(20, 58, "+", 11)}${scritta(60, 58, "COM", 9)}`,
  ),
);
voce(
  {
    id: "massa",
    nome: "Massa (0 V)",
    categoria: "sorgenti",
    sigla: "",
    descrizione: "Il punto di riferimento a 0 V: tutte le tensioni del circuito si misurano rispetto alla massa. Ogni circuito ne ha bisogno.",
    paroleChiave: ["GND", "terra", "riferimento", "zero"],
    larghezza: 40,
    altezza: 40,
    morsetti: [m("0", 20, 0)],
  },
  svg(40, 40, `<path d="M20 0V18M6 18H34M11 25H29M16 32H24"/>`),
);

// ---------------------------------------------------------------- Passivi
voce(
  {
    id: "resistenza",
    nome: "Resistenza",
    categoria: "passivi",
    sigla: "R",
    descrizione: "Si oppone al passaggio della corrente. Legge di Ohm: V = R · I. Il valore (in ohm, Ω) si sceglie nelle Proprietà.",
    paroleChiave: ["resistore", "ohm"],
    larghezza: 80,
    altezza: 40,
    morsetti: [m("1", 0, 20), m("2", 80, 20)],
  },
  svg(80, 40, `<path d="M0 20H20M60 20H80"/><rect x="20" y="13" width="40" height="14"/>`),
);
voce(
  {
    id: "potenziometro",
    nome: "Potenziometro",
    categoria: "passivi",
    sigla: "P",
    descrizione: "Resistenza con un cursore (morsetto centrale) che si sposta: divide la tensione in parti regolabili. In simulazione: clic a destra aumenta, a sinistra diminuisce.",
    paroleChiave: ["trimmer", "regolabile", "variabile", "partitore", "cursore"],
    larghezza: 80,
    altezza: 60,
    morsetti: [m("1", 0, 40), m("2", 40, 0), m("3", 80, 40)],
  },
  svg(80, 60, `<path d="M0 40H20M60 40H80M40 0V30M35 24L40 31L45 24"/><rect x="20" y="33" width="40" height="14"/>`),
);
voce(
  {
    id: "condensatore",
    nome: "Condensatore",
    categoria: "passivi",
    sigla: "C",
    descrizione: "Accumula carica elettrica fra due armature. Blocca la corrente continua e lascia passare quella alternata. Si misura in farad (F).",
    paroleChiave: ["capacità", "farad", "elettrolitico"],
    larghezza: 80,
    altezza: 40,
    morsetti: [m("1", 0, 20), m("2", 80, 20)],
  },
  svg(80, 40, `<path d="M0 20H35M45 20H80M35 6V34M45 6V34"/>`),
);
voce(
  {
    id: "induttore",
    nome: "Induttore",
    categoria: "passivi",
    sigla: "L",
    descrizione: "Bobina di filo che si oppone alle variazioni di corrente. Si misura in henry (H).",
    paroleChiave: ["bobina", "induttanza", "henry"],
    larghezza: 80,
    altezza: 40,
    morsetti: [m("1", 0, 20), m("2", 80, 20)],
  },
  svg(80, 40, `<path d="M0 20H16M64 20H80M16 20A6 6 0 0 1 28 20A6 6 0 0 1 40 20A6 6 0 0 1 52 20A6 6 0 0 1 64 20"/>`),
);

// ---------------------------------------------------------------- Interruttori e lampadine
voce(
  {
    id: "interruttore",
    nome: "Interruttore",
    categoria: "comandi",
    sigla: "S",
    descrizione: "Apre o chiude il circuito e resta nella posizione scelta. In simulazione si commuta con un clic.",
    paroleChiave: ["deviatore", "switch", "acceso", "spento"],
    larghezza: 80,
    altezza: 40,
    morsetti: [m("1", 0, 20), m("2", 80, 20)],
  },
  svg(80, 40, `<path d="M0 20H24M56 20H80M24 20L54 6"/><circle cx="24" cy="20" r="2" fill="currentColor"/><circle cx="56" cy="20" r="2"/>`),
);
voce(
  {
    id: "pulsante",
    nome: "Pulsante",
    categoria: "comandi",
    sigla: "S",
    descrizione: "Chiude il circuito solo finché lo si tiene premuto (normalmente aperto). In simulazione si preme con il mouse.",
    paroleChiave: ["tasto", "NA", "premere"],
    larghezza: 80,
    altezza: 40,
    morsetti: [m("1", 0, 20), m("2", 80, 20)],
  },
  svg(80, 40, `<path d="M0 20H24M56 20H80M20 12H60M40 12V2M32 2H48"/><circle cx="24" cy="20" r="2"/><circle cx="56" cy="20" r="2"/>`),
);
voce(
  {
    id: "lampadina",
    nome: "Lampadina",
    categoria: "comandi",
    sigla: "H",
    descrizione: "Si accende quando la attraversa corrente: più potenza riceve, più è luminosa. Tensione e potenza nominali si scelgono nelle Proprietà.",
    paroleChiave: ["lampada", "luce", "spia"],
    larghezza: 80,
    altezza: 40,
    morsetti: [m("1", 0, 20), m("2", 80, 20)],
  },
  svg(80, 40, `<path d="M0 20H26M54 20H80"/><circle cx="40" cy="20" r="14"/><path d="M30 10L50 30M50 10L30 30"/>`),
);

// ---------------------------------------------------------------- Semiconduttori
voce(
  {
    id: "diodo",
    nome: "Diodo",
    categoria: "semiconduttori",
    sigla: "D",
    descrizione: "Lascia passare la corrente in un solo verso, dall'anodo (A) al catodo (K, la sbarretta). In conduzione ai suoi capi ci sono circa 0,7 V.",
    paroleChiave: ["raddrizzatore", "1N4007", "giunzione"],
    larghezza: 80,
    altezza: 40,
    morsetti: [m("a", 0, 20), m("k", 80, 20)],
  },
  svg(80, 40, `<path d="M0 20H30M50 20H80M30 8V32L50 20Z M50 8V32"/>`),
);
voce(
  {
    id: "zener",
    nome: "Diodo zener",
    categoria: "semiconduttori",
    sigla: "D",
    descrizione: "Diodo che, collegato al contrario, mantiene ai suoi capi una tensione quasi costante (tensione di zener): serve a stabilizzare.",
    paroleChiave: ["stabilizzatore", "zener", "riferimento"],
    larghezza: 80,
    altezza: 40,
    morsetti: [m("a", 0, 20), m("k", 80, 20)],
  },
  svg(80, 40, `<path d="M0 20H30M50 20H80M30 8V32L50 20Z M44 4L50 8V32L56 36"/>`),
);
voce(
  {
    id: "led",
    nome: "LED",
    categoria: "semiconduttori",
    sigla: "D",
    descrizione: "Diodo che emette luce. Va sempre messo in serie a una resistenza: senza, la corrente è troppa e il LED si brucia. Anodo in alto, catodo in basso.",
    paroleChiave: ["luce", "spia", "diodo luminoso"],
    larghezza: 40,
    altezza: 80,
    morsetti: [m("a", 20, 0), m("k", 20, 80)],
  },
  svg(40, 80, `<path d="M20 0V28M20 52V80M8 28H32L20 52Z M8 52H32"/><path d="M30 36L38 30M34 30H38V34M30 44L38 38M34 38H38V42"/>`),
);
const transistor = (pnp: boolean) =>
  svg(
    60,
    80,
    `<circle cx="32" cy="40" r="22"/><path d="M0 40H24M24 26V54M24 32L40 22V0M24 48L40 58V80"/>` +
      (pnp ? `<path d="M30 44L24 48L31 51"/>` : `<path d="M32 58H40L36 51"/>`),
  );
voce(
  {
    id: "transistor-npn",
    nome: "Transistor NPN",
    categoria: "semiconduttori",
    sigla: "Q",
    descrizione: "Una piccola corrente nella base (B) comanda una corrente molto più grande fra collettore (C) ed emettitore (E): Ic = β · Ib. Si usa come amplificatore o come interruttore.",
    paroleChiave: ["BJT", "BC547", "2N2222", "amplificatore", "bipolare"],
    larghezza: 60,
    altezza: 80,
    morsetti: [m("b", 0, 40), m("c", 40, 0), m("e", 40, 80)],
  },
  transistor(false),
);
voce(
  {
    id: "transistor-pnp",
    nome: "Transistor PNP",
    categoria: "semiconduttori",
    sigla: "Q",
    descrizione: "Come l'NPN ma con le correnti al contrario: l'emettitore va verso il positivo e il transistor conduce quando la base è più bassa dell'emettitore.",
    paroleChiave: ["BJT", "BC557", "bipolare"],
    larghezza: 60,
    altezza: 80,
    morsetti: [m("b", 0, 40), m("c", 40, 80), m("e", 40, 0)],
  },
  // Nel PNP l'emettitore (con la freccia entrante) sta in alto.
  svg(60, 80, `<circle cx="32" cy="40" r="22"/><path d="M0 40H24M24 26V54M24 32L40 22V0M24 48L40 58V80"/><path d="M27 37L24 32L30 30"/>`),
);
const mosfet = (p: boolean) =>
  svg(
    60,
    80,
    `<path d="M0 40H18M18 24V56M26 22V30M26 36V44M26 50V58M26 26H40V0M26 54H40V80M26 40H40V54"/>` +
      (p ? `<path d="M34 36L40 40L34 44"/>` : `<path d="M32 36L26 40L32 44"/>`),
  );
voce(
  {
    id: "mosfet-n",
    nome: "MOSFET a canale N",
    categoria: "semiconduttori",
    sigla: "Q",
    descrizione: "Transistor comandato in tensione: quando il gate (G) supera di qualche volt il source (S), fra drain (D) e source passa corrente. Nel gate non entra corrente.",
    paroleChiave: ["FET", "IRF540", "2N7000", "interruttore", "gate"],
    larghezza: 60,
    altezza: 80,
    morsetti: [m("g", 0, 40), m("d", 40, 0), m("s", 40, 80)],
  },
  mosfet(false),
);
voce(
  {
    id: "mosfet-p",
    nome: "MOSFET a canale P",
    categoria: "semiconduttori",
    sigla: "Q",
    descrizione: "Come il canale N ma al contrario: il source va verso il positivo e il MOSFET conduce quando il gate è qualche volt più basso del source.",
    paroleChiave: ["FET", "IRF9540", "gate"],
    larghezza: 60,
    altezza: 80,
    morsetti: [m("g", 0, 40), m("d", 40, 80), m("s", 40, 0)],
  },
  svg(60, 80, `<path d="M0 40H18M18 24V56M26 22V30M26 36V44M26 50V58M26 26H40V0M26 54H40V80M26 40H40V26"/><path d="M34 36L40 40L34 44"/>`),
);

// ---------------------------------------------------------------- Integrati
voce(
  {
    id: "operazionale",
    nome: "Amplificatore operazionale",
    categoria: "integrati",
    sigla: "U",
    descrizione: "Amplifica moltissimo la differenza fra gli ingressi + e −. Con la retroazione (una resistenza dall'uscita al −) il guadagno lo decidono le resistenze. L'uscita non supera la tensione di saturazione.",
    paroleChiave: ["op-amp", "LM741", "LM358", "amplificatore", "comparatore"],
    larghezza: 80,
    altezza: 80,
    morsetti: [m("-", 0, 20), m("+", 0, 60), m("out", 80, 40)],
  },
  svg(80, 80, `<path d="M10 6V74L70 40Z M0 20H10M0 60H10M70 40H80"/>${scritta(19, 25, "−", 14)}${scritta(19, 65, "+", 14)}`),
);
voce(
  {
    id: "regolatore",
    nome: "Regolatore di tensione (78xx)",
    categoria: "integrati",
    sigla: "U",
    descrizione: "Dà in uscita una tensione fissa (per esempio 5 V con il 7805) anche se l'ingresso cambia, purché l'ingresso sia almeno 2 V più alto dell'uscita.",
    paroleChiave: ["7805", "7812", "stabilizzatore", "alimentatore", "LM7805"],
    larghezza: 80,
    altezza: 60,
    morsetti: [m("in", 0, 20), m("out", 80, 20), m("gnd", 40, 60)],
  },
  svg(80, 60, `<rect x="14" y="4" width="52" height="36"/><path d="M0 20H14M66 20H80M40 40V60"/>${scritta(40, 26, "78xx", 12)}${scritta(22, 16, "in", 7)}${scritta(58, 16, "out", 7)}`),
);
// ---------------------------------------------------------------- Logica digitale
// Simboli rettangolari della norma IEC 60617-12: & (AND), ≥1 (OR), 1 (NOT),
// =1 (XOR); il cerchietto sull'uscita indica la negazione.
const porta = (simbolo: string, negata: boolean, ingressi: 1 | 2) => {
  const h = ingressi === 2 ? 80 : 40;
  const fili = ingressi === 2 ? "M0 20H16M0 60H16" : "M0 20H16";
  const uscita = negata ? `<circle cx="68" cy="${h / 2}" r="4"/><path d="M72 ${h / 2}H80"/>` : `<path d="M64 ${h / 2}H80"/>`;
  return svg(80, h, `<path d="${fili}"/><rect x="16" y="${ingressi === 2 ? 8 : 4}" width="48" height="${ingressi === 2 ? 64 : 32}"/>${uscita}${scritta(40, h / 2 + 6, simbolo, 16)}`);
};
const PORTE: [string, string, string, boolean, 1 | 2, string][] = [
  ["porta-and", "Porta AND", "&", false, 2, "L'uscita Y è 1 solo se A e B sono entrambi 1."],
  ["porta-or", "Porta OR", "≥1", false, 2, "L'uscita Y è 1 se almeno uno degli ingressi è 1."],
  ["porta-not", "Porta NOT (invertitore)", "1", true, 1, "Inverte il segnale: se l'ingresso è 1 l'uscita è 0 e viceversa."],
  ["porta-nand", "Porta NAND", "&", true, 2, "Il contrario della AND: l'uscita è 0 solo se entrambi gli ingressi sono 1."],
  ["porta-nor", "Porta NOR", "≥1", true, 2, "Il contrario della OR: l'uscita è 1 solo se entrambi gli ingressi sono 0."],
  ["porta-xor", "Porta XOR (OR esclusivo)", "=1", false, 2, "L'uscita è 1 se gli ingressi sono diversi fra loro."],
];
for (const [id, nome, simbolo, negata, ingressi, descrizione] of PORTE) {
  voce(
    {
      id,
      nome,
      categoria: "digitale",
      sigla: "U",
      descrizione: `${descrizione} Livello 1 = 5 V, livello 0 = 0 V; un ingresso scollegato vale 0.`,
      paroleChiave: ["logica", "digitale", "porta", "booleana", id.replace("porta-", "")],
      larghezza: 80,
      altezza: ingressi === 2 ? 80 : 40,
      morsetti: ingressi === 2 ? [m("A", 0, 20), m("B", 0, 60), m("Y", 80, 40)] : [m("A", 0, 20), m("Y", 80, 20)],
    },
    porta(simbolo, negata, ingressi),
  );
}
const scatola = (w: number, h: number, titolo: string, sinistra: [string, number][], destra: [string, number][], extra = "") =>
  svg(
    w,
    h,
    `<rect x="16" y="4" width="${w - 32}" height="${h - 8}"/>${scritta(w / 2, 20, titolo, 11, 'font-weight="bold"')}` +
      sinistra.map(([n, y]) => `<path d="M0 ${y}H16"/>${scritta(26, y + 4, n, 9, 'text-anchor="start"').replace('text-anchor="middle" ', "")}`).join("") +
      destra.map(([n, y]) => `<path d="M${w - 16} ${y}H${w}"/>${scritta(w - 26, y + 4, n, 9, 'text-anchor="end"').replace('text-anchor="middle" ', "")}`).join("") +
      extra,
  );
// Triangolino dell'ingresso di clock (attivo sul fronte di salita).
const triangoloClock = (y: number) => `<path d="M16 ${y - 5}L23 ${y}L16 ${y + 5}"/>`;
voce(
  {
    id: "flip-flop-d",
    nome: "Flip-flop D",
    categoria: "digitale",
    sigla: "U",
    descrizione: "Memoria di un bit: sul fronte di salita del clock (quando CLK passa da 0 a 1) l'uscita Q copia l'ingresso D e lo tiene fino al fronte successivo. Q̄ è sempre il contrario di Q.",
    paroleChiave: ["memoria", "latch", "registro", "bistabile", "74HC74"],
    larghezza: 80,
    altezza: 80,
    morsetti: [m("D", 0, 20), m("CLK", 0, 60), m("Q", 80, 20), m("QN", 80, 60)],
  },
  scatola(80, 80, "", [["D", 20], ["C", 60]], [["Q", 20], ["Q̄", 60]], triangoloClock(60)),
);
voce(
  {
    id: "flip-flop-jk",
    nome: "Flip-flop JK",
    categoria: "digitale",
    sigla: "U",
    descrizione: "Sul fronte di salita del clock: J=1 porta Q a 1, K=1 porta Q a 0, J=K=1 inverte Q (si usa per dividere la frequenza e nei contatori), J=K=0 lascia tutto com'è.",
    paroleChiave: ["memoria", "bistabile", "toggle", "divisore", "74HC107"],
    larghezza: 80,
    altezza: 80,
    morsetti: [m("J", 0, 20), m("CLK", 0, 40), m("K", 0, 60), m("Q", 80, 20), m("QN", 80, 60)],
  },
  scatola(80, 80, "", [["J", 20], ["C", 40], ["K", 60]], [["Q", 20], ["Q̄", 60]], triangoloClock(40)),
);
voce(
  {
    id: "contatore",
    nome: "Contatore binario a 4 bit",
    categoria: "digitale",
    sigla: "U",
    descrizione: "Conta i fronti di salita del clock da 0 a 15 e ricomincia; il numero esce in binario su Q0 (vale 1), Q1 (2), Q2 (4), Q3 (8). Con R a 1 torna a 0.",
    paroleChiave: ["conteggio", "binario", "74HC393", "CTR"],
    larghezza: 100,
    altezza: 100,
    morsetti: [m("CLK", 0, 20), m("R", 0, 80), m("Q0", 100, 20), m("Q1", 100, 40), m("Q2", 100, 60), m("Q3", 100, 80)],
  },
  scatola(100, 100, "", [["C", 20], ["R", 80]], [["Q0", 20], ["Q1", 40], ["Q2", 60], ["Q3", 80]], `${triangoloClock(20)}${scritta(50, 40, "CTR4", 10, 'font-weight="bold"')}`),
);
voce(
  {
    id: "decodificatore",
    nome: "Decodificatore BCD → 7 segmenti",
    categoria: "digitale",
    sigla: "U",
    descrizione: "Trasforma un numero binario (A vale 1, B 2, C 4, D 8) nei segmenti a…g da accendere sul display per scrivere la cifra. Mettilo accanto al display: le uscite combaciano con gli ingressi.",
    paroleChiave: ["display", "BCD", "4511", "7447", "cifra"],
    larghezza: 80,
    altezza: 160,
    morsetti: [m("A", 0, 20), m("B", 0, 40), m("C", 0, 60), m("D", 0, 80), ...["a", "b", "c", "d", "e", "f", "g"].map((s, i) => m(s, 80, 20 + 20 * i))],
  },
  scatola(80, 160, "", [["A", 20], ["B", 40], ["C", 60], ["D", 80]], ["a", "b", "c", "d", "e", "f", "g"].map((s, i) => [s, 20 + 20 * i] as [string, number]), scritta(34, 128, "BCD/7", 9, 'font-weight="bold"')),
);
// Cifra "8" stilizzata con i 7 segmenti (le stesse coordinate servono al disegno in simulazione).
const segmentiDisplay = `<path d="M44 34H76M80 38V74M80 86V122M44 126H76M40 86V122M40 38V74M44 80H76" stroke-width="5" opacity="0.18"/>`;
voce(
  {
    id: "display-7-segmenti",
    nome: "Display a 7 segmenti",
    categoria: "digitale",
    sigla: "DS",
    descrizione: "Scrive una cifra accendendo i segmenti a…g: ogni segmento si accende quando il suo ingresso è a 1 (5 V). Di solito si comanda con un decodificatore BCD.",
    paroleChiave: ["cifra", "numero", "visualizzatore", "led"],
    larghezza: 100,
    altezza: 160,
    morsetti: ["a", "b", "c", "d", "e", "f", "g"].map((s, i) => m(s, 0, 20 + 20 * i)),
  },
  svg(
    100,
    160,
    `<rect x="16" y="4" width="80" height="152" rx="4"/>` +
      ["a", "b", "c", "d", "e", "f", "g"].map((s, i) => `<path d="M0 ${20 + 20 * i}H16"/>${scritta(22, 24 + 20 * i, s, 8)}`).join("") +
      segmentiDisplay,
  ),
);
voce(
  {
    id: "interruttore-logico",
    nome: "Interruttore logico (0/1)",
    categoria: "digitale",
    sigla: "S",
    descrizione: "Dà in uscita il livello logico 0 (0 V) o 1 (5 V). In simulazione si cambia con un clic. Serve a comandare gli ingressi delle porte logiche.",
    paroleChiave: ["ingresso", "livello", "switch", "bit"],
    larghezza: 60,
    altezza: 40,
    morsetti: [m("out", 60, 20)],
  },
  svg(60, 40, `<rect x="4" y="6" width="40" height="28" rx="4"/><path d="M44 20H60"/>${scritta(24, 25, "0/1", 11)}`),
);
voce(
  {
    id: "generatore-clock",
    nome: "Generatore di clock",
    categoria: "digitale",
    sigla: "CLK",
    descrizione: "Onda quadra logica fra 0 e 1 (0 V e 5 V) alla frequenza scelta: dà il ritmo a flip-flop e contatori.",
    paroleChiave: ["clock", "orologio", "onda quadra", "impulsi", "frequenza"],
    larghezza: 60,
    altezza: 40,
    morsetti: [m("out", 60, 20)],
  },
  svg(60, 40, `<rect x="4" y="6" width="40" height="28" rx="4"/><path d="M44 20H60M10 26H16V14H24V26H32V14H38" stroke-width="1.6"/>`),
);
voce(
  {
    id: "sonda-logica",
    nome: "Sonda logica",
    categoria: "digitale",
    sigla: "X",
    descrizione: "Indica il livello logico del punto in cui è collegata: rossa = 1, verde = 0. Una sonda scollegata indica 0.",
    paroleChiave: ["indicatore", "livello", "probe", "spia"],
    larghezza: 60,
    altezza: 40,
    morsetti: [m("in", 0, 20)],
  },
  svg(60, 40, `<path d="M0 20H24"/><circle cx="40" cy="20" r="14"/>`),
);

// ---------------------------------------------------------------- Strumenti
voce(
  {
    id: "multimetro",
    nome: "Multimetro",
    categoria: "strumenti",
    sigla: "XMM",
    descrizione: "Misura tensioni (V, in parallelo al componente), correnti (A, in serie: il circuito passa dentro lo strumento) e resistenze (Ω, a circuito spento). La funzione si sceglie nelle Proprietà.",
    paroleChiave: ["tester", "voltmetro", "amperometro", "ohmmetro", "misura"],
    larghezza: 80,
    altezza: 100,
    morsetti: [m("+", 20, 100), m("COM", 60, 100)],
  },
  svg(
    80,
    100,
    `<rect x="4" y="4" width="72" height="82" rx="8"/><rect x="12" y="12" width="56" height="26" rx="2"/>` +
      `<circle cx="40" cy="58" r="11"/><path d="M40 58L46 50"/><path d="M20 86V100M60 86V100"/>` +
      `${scritta(20, 82, "+", 10)}${scritta(60, 82, "COM", 8)}`,
  ),
);
voce(
  {
    id: "oscilloscopio",
    nome: "Oscilloscopio a 2 canali",
    categoria: "strumenti",
    sigla: "XSC",
    descrizione: "Disegna come cambiano nel tempo le tensioni dei canali A e B rispetto al morsetto COM (da collegare alla massa). Durante la simulazione si apre la finestra con lo schermo, base dei tempi e volt/divisione.",
    paroleChiave: ["grafico", "forma d'onda", "segnale", "canale", "traccia"],
    larghezza: 120,
    altezza: 100,
    morsetti: [m("A", 20, 100), m("B", 60, 100), m("COM", 100, 100)],
  },
  svg(
    120,
    100,
    `<rect x="4" y="4" width="112" height="82" rx="6"/><rect x="12" y="12" width="70" height="50" rx="2"/>` +
      `<path d="M12 37H82M47 12V62" stroke-width="0.8" stroke-dasharray="2 3"/>` +
      `<path d="M14 37C20 20 26 20 32 37S44 54 50 37S62 20 68 37S76 50 80 40" stroke-width="1.6"/>` +
      `<circle cx="99" cy="24" r="6"/><circle cx="99" cy="46" r="6"/>` +
      `<path d="M20 86V100M60 86V100M100 86V100"/>${scritta(20, 80, "A", 10)}${scritta(60, 80, "B", 10)}${scritta(100, 80, "COM", 8)}`,
  ),
);

voce(
  {
    id: "analizzatore-logico",
    nome: "Analizzatore logico (4 canali)",
    categoria: "strumenti",
    sigla: "XLA",
    descrizione: "Disegna nel tempo i livelli logici (0 o 1) di quattro punti del circuito, uno sotto l'altro: serve a seguire clock, flip-flop e contatori. Durante la simulazione si apre la sua finestra.",
    paroleChiave: ["diagramma temporale", "cronogramma", "canali", "digitale"],
    larghezza: 100,
    altezza: 100,
    morsetti: [m("D0", 0, 20), m("D1", 0, 40), m("D2", 0, 60), m("D3", 0, 80)],
  },
  svg(
    100,
    100,
    `<rect x="16" y="4" width="80" height="92" rx="6"/>` +
      [0, 1, 2, 3].map((k) => `<path d="M0 ${20 + 20 * k}H16"/>${scritta(26, 24 + 20 * k, `D${k}`, 8)}`).join("") +
      `<path d="M36 24H46V16H56V24H66V16H76V24H88M36 44H56V36H76V44H88M36 64H76V56H88M36 84H88" stroke-width="1.4"/>`,
  ),
);

// ---------------------------------------------------------------- Scrittura
for (const [nome, contenuto] of Object.entries(icone)) writeFileSync(`libreria/icone/${nome}`, contenuto);
for (const v of voci) readFileSync(`libreria/icone/${v.icona}`);
const libreria = {
  versione: 1,
  modulo: "elettronica",
  categorie: [
    { id: "sorgenti", nome: "Sorgenti" },
    { id: "passivi", nome: "Componenti passivi" },
    { id: "comandi", nome: "Interruttori e lampadine" },
    { id: "semiconduttori", nome: "Semiconduttori" },
    { id: "integrati", nome: "Circuiti integrati" },
    { id: "digitale", nome: "Logica digitale" },
    { id: "strumenti", nome: "Strumenti virtuali" },
  ],
  componenti: voci,
};
writeFileSync("libreria/elettronica.json", `${JSON.stringify(libreria, null, 2)}\n`);
console.log(`Scritte ${voci.length} voci e ${Object.keys(icone).length} icone.`);
