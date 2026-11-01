// Generatore degli esempi pronti del modulo PLC in esempi/ (strumento per chi
// sviluppa, non fa parte dell'app). Come per gli impianti, i file .elab sono
// la fonte da distribuire: si possono aprire, modificare e risalvare con
// ElettroLab. Lo script li scrive con coordinate precise sulla griglia.
//
// Ogni segmento si descrive come: commento, contatti in serie, un contatto
// facoltativo in parallelo al PRIMO contatto della serie (autoritenuta,
// "oppure") e una o più uscite in parallelo. Il generatore posa barra di
// alimentazione, simboli e fili.
//
// Uso: npx vite-node strumenti/genera-esempi-plc.ts
import { writeFileSync } from "node:fs";
import { libreriaDelModulo } from "../src/editor/caricaLibreria";
import { vocePerTipo } from "../src/editor/libreria";
import { serializzaProgetto } from "../src/progetto/formato";
import type { ComponenteSchema, Filo, Schema } from "../src/editor/schema";

const libreria = libreriaDelModulo("plc");

/** Elemento del Ladder: tipo della libreria (senza "ladder-"), operando, preset facoltativo. */
interface El {
  tipo: string;
  op: string;
  preset?: number;
}
interface Seg {
  commento: string;
  serie: El[];
  parallelo?: El;
  uscite: El[];
}

const na = (op: string): El => ({ tipo: "contatto-na", op });
const nc = (op: string): El => ({ tipo: "contatto-nc", op });
const fp = (op: string): El => ({ tipo: "contatto-p", op });
const fn = (op: string): El => ({ tipo: "contatto-n", op });
const bob = (op: string): El => ({ tipo: "bobina", op });
const set = (op: string): El => ({ tipo: "bobina-set", op });
const res = (op: string): El => ({ tipo: "bobina-reset", op });
const ton = (op: string, s: number): El => ({ tipo: "ton", op, preset: s });
const ctu = (op: string, n: number): El => ({ tipo: "ctu", op, preset: n });
const ctd = (op: string, n: number): El => ({ tipo: "ctd", op, preset: n });

const X_BARRA = 40;
const X_CONTATTI = 100;
const PASSO_CONTATTI = 120;
const X_USCITE = 600;
const ALTEZZA_BARRA = 400;

interface Extra {
  /** Componenti del quadro o impianti: tipo completo, operando/etichetta, posizione. */
  tipo: string;
  etichetta: string;
  x: number;
  y: number;
}

function costruisci(segmenti: Seg[], extra: Extra[]): Schema {
  const componenti: ComponenteSchema[] = [];
  const fili: Filo[] = [];
  const conta = new Map<string, number>();
  const posa = (tipo: string, etichetta: string, x: number, y: number, preset?: number, larghezza?: number): string => {
    const voce = vocePerTipo(libreria, tipo);
    if (!voce) throw new Error(`Tipo sconosciuto: ${tipo}`);
    if (x % 20 || y % 20) throw new Error(`${tipo} fuori griglia (${x}, ${y})`);
    const n = (conta.get(tipo) ?? 0) + 1;
    conta.set(tipo, n);
    const id = `${tipo}-${n}`;
    const c: ComponenteSchema = { id, tipo, etichetta, x, y, larghezza: larghezza ?? voce.larghezza, altezza: voce.altezza };
    if (preset !== undefined) {
      if (tipo === "ladder-ton" || tipo === "ladder-tof" || tipo === "ladder-tp") c.tempo = preset;
      else c.preset = preset;
    }
    componenti.push(c);
    return id;
  };
  const filo = (c1: string, m1: string, c2: string, m2: string) => {
    fili.push({ id: `filo-${fili.length + 1}`, da: { componente: c1, morsetto: m1 }, a: { componente: c2, morsetto: m2 } });
  };
  const ingresso = (tipo: string) => (tipo === "ton" || tipo === "tof" || tipo === "tp" ? "IN" : tipo === "ctu" ? "CU" : tipo === "ctd" ? "CD" : "in");
  const altezza = (tipo: string) => vocePerTipo(libreria, `ladder-${tipo}`)!.altezza;

  // Barre di sinistra posate quando servono, una sotto l'altra (si uniscono da sole).
  const barre = new Map<number, string>();
  const morsettoBarra = (y: number): [string, string] => {
    const indice = Math.floor(y / ALTEZZA_BARRA);
    if (!barre.has(indice)) barre.set(indice, posa("ladder-barra-sinistra", "", X_BARRA, indice * ALTEZZA_BARRA));
    const k = ((y - 20) % ALTEZZA_BARRA) / 40 + 1;
    return [barre.get(indice)!, `p${k}`];
  };

  let y = 140; // quota della linea del primo segmento (morsetti della barra: 20 + 40k)
  for (const s of segmenti) {
    // Commento largo sopra il segmento, lontano dagli operandi dei contatti.
    posa("ladder-commento", s.commento, X_CONTATTI, y - 100, undefined, 480);
    const ids = s.serie.map((e, i) => posa(`ladder-${e.tipo}`, e.op, X_CONTATTI + i * PASSO_CONTATTI, y - 20));
    const [b, p] = morsettoBarra(y);
    filo(b, p, ids[0], "in");
    for (let i = 1; i < ids.length; i++) filo(ids[i - 1], "out", ids[i], "in");
    let altezzaSeg = 40;
    if (s.parallelo) {
      // Ramo parallelo due passi sotto: il suo operando non copre il filo principale.
      const idPar = posa(`ladder-${s.parallelo.tipo}`, s.parallelo.op, X_CONTATTI, y + 60);
      const [b2, p2] = morsettoBarra(y + 80);
      filo(b2, p2, idPar, "in");
      // Il ramo parallelo si richiude dopo il primo contatto.
      filo(idPar, "out", ids[0], "out");
      altezzaSeg = 120;
    }
    const ultimo = ids[ids.length - 1];
    let yUscita = y - 20;
    for (const u of s.uscite) {
      const id = posa(`ladder-${u.tipo}`, u.op, X_USCITE, yUscita, u.preset);
      filo(ultimo, "out", id, ingresso(u.tipo));
      yUscita += altezza(u.tipo) + 20;
    }
    altezzaSeg = Math.max(altezzaSeg, yUscita - (y - 20));
    // Prossimo segmento: lasciando spazio al commento, su un morsetto della barra.
    y += Math.ceil((altezzaSeg + 120) / 40) * 40;
  }
  for (const e of extra) posa(e.tipo, e.etichetta, e.x, e.y);
  return { componenti, fili };
}

function scrivi(file: string, schema: Schema) {
  writeFileSync(new URL(`../esempi/${file}`, import.meta.url), serializzaProgetto({ modulo: "plc", schema }, "0.1.0"));
  console.log(`scritto esempi/${file}: ${schema.componenti.length} componenti, ${schema.fili.length} fili`);
}

const X_QUADRO = 780;

// 1. Marcia/arresto con autoritenuta
scrivi(
  "plc-marcia-arresto.elab",
  costruisci(
    [{ commento: "Marcia I0.0 con autoritenuta Q0.0, arresto I0.1 (pulsante NC)", serie: [na("I0.0"), na("I0.1")], parallelo: na("Q0.0"), uscite: [bob("Q0.0")] }],
    [
      { tipo: "quadro-pulsante-na", etichetta: "I0.0", x: X_QUADRO, y: 60 },
      { tipo: "quadro-pulsante-nc", etichetta: "I0.1", x: X_QUADRO + 120, y: 60 },
      { tipo: "quadro-lampada", etichetta: "Q0.0", x: X_QUADRO, y: 200 },
      { tipo: "quadro-motore", etichetta: "Q0.0", x: X_QUADRO + 120, y: 200 },
    ],
  ),
);

// 2. Telerruttore: un solo pulsante accende e spegne
scrivi(
  "plc-telerruttore.elab",
  costruisci(
    [
      { commento: "Fronte di salita del pulsante: M0.0 vale 1 per un solo ciclo", serie: [fp("I0.0")], uscite: [bob("M0.0")] },
      { commento: "Lampada spenta: alla pressione si prepara l'accensione (M0.1)", serie: [na("M0.0"), nc("Q0.0")], uscite: [bob("M0.1")] },
      { commento: "Lampada accesa: alla pressione si spegne", serie: [na("M0.0"), na("Q0.0")], uscite: [res("Q0.0")] },
      { commento: "Accensione", serie: [na("M0.1")], uscite: [set("Q0.0")] },
    ],
    [
      { tipo: "quadro-pulsante-na", etichetta: "I0.0", x: X_QUADRO, y: 60 },
      { tipo: "quadro-lampada", etichetta: "Q0.0", x: X_QUADRO + 120, y: 60 },
    ],
  ),
);

// 3. Nastro trasportatore
scrivi(
  "plc-nastro.elab",
  costruisci(
    [
      { commento: "Impianto in funzione (M0.0): marcia I0.0, arresto I0.1 (NC)", serie: [na("I0.0"), na("I0.1")], parallelo: na("M0.0"), uscite: [bob("M0.0")] },
      { commento: "Motore del nastro: gira finché il pacco non arriva in fondo (I0.3)", serie: [na("M0.0"), nc("I0.3")], uscite: [bob("Q0.0")] },
      { commento: "Lampada: pacco in fondo da ritirare", serie: [na("I0.3")], uscite: [bob("Q0.1")] },
    ],
    [
      { tipo: "quadro-pulsante-na", etichetta: "I0.0", x: X_QUADRO, y: 40 },
      { tipo: "quadro-pulsante-nc", etichetta: "I0.1", x: X_QUADRO + 120, y: 40 },
      { tipo: "quadro-lampada", etichetta: "Q0.1", x: X_QUADRO + 240, y: 40 },
      { tipo: "impianto-nastro", etichetta: "", x: X_QUADRO, y: 200 },
    ],
  ),
);

// 4. Semaforo a ciclo continuo
scrivi(
  "plc-semaforo.elab",
  costruisci(
    [
      { commento: "Verde per 5 s (T0 conta finché il ciclo non ricomincia)", serie: [nc("T2")], uscite: [ton("T0", 5)] },
      { commento: "Poi giallo per 2 s", serie: [na("T0")], uscite: [ton("T1", 2)] },
      { commento: "Poi rosso per 5 s; alla fine T2 fa ripartire il ciclo", serie: [na("T1")], uscite: [ton("T2", 5)] },
      { commento: "Luce verde", serie: [nc("T0")], uscite: [bob("Q0.2")] },
      { commento: "Luce gialla", serie: [na("T0"), nc("T1")], uscite: [bob("Q0.1")] },
      { commento: "Luce rossa", serie: [na("T1")], uscite: [bob("Q0.0")] },
    ],
    [{ tipo: "impianto-semaforo", etichetta: "", x: X_QUADRO, y: 60 }],
  ),
);

// 5. Cancello automatico
scrivi(
  "plc-cancello.elab",
  costruisci(
    [
      { commento: "Apertura: pulsante I0.0, si ferma al finecorsa di aperto I0.3", serie: [na("I0.0"), nc("I0.3"), nc("Q0.1")], parallelo: na("Q0.0"), uscite: [bob("Q0.0")] },
      { commento: "Chiusura: pulsante I0.1, si ferma al finecorsa di chiuso I0.2 o se la fotocellula I0.4 vede un'auto", serie: [na("I0.1"), nc("I0.2"), nc("I0.4"), nc("Q0.0")], parallelo: na("Q0.1"), uscite: [bob("Q0.1")] },
      { commento: "Lampeggiante acceso durante il movimento", serie: [na("Q0.0")], parallelo: na("Q0.1"), uscite: [bob("Q0.2")] },
    ],
    [
      { tipo: "quadro-pulsante-na", etichetta: "I0.0", x: X_QUADRO, y: 40 },
      { tipo: "quadro-pulsante-na", etichetta: "I0.1", x: X_QUADRO + 120, y: 40 },
      { tipo: "impianto-cancello", etichetta: "", x: X_QUADRO, y: 180 },
    ],
  ),
);

// 6. Serbatoio con pompa
scrivi(
  "plc-serbatoio.elab",
  costruisci(
    [
      { commento: "Pompa: parte sotto il livello minimo (I0.2), si ferma al massimo (I0.3)", serie: [nc("I0.2"), nc("I0.3")], parallelo: na("Q0.0"), uscite: [bob("Q0.0")] },
      { commento: "Valvola di scarico comandata dal selettore I0.0", serie: [na("I0.0")], uscite: [bob("Q0.1")] },
    ],
    [
      { tipo: "quadro-selettore", etichetta: "I0.0", x: X_QUADRO, y: 40 },
      { tipo: "impianto-serbatoio", etichetta: "", x: X_QUADRO + 140, y: 40 },
    ],
  ),
);

// 7. Ascensore (piano 0 e piano 2)
scrivi(
  "plc-ascensore.elab",
  costruisci(
    [
      { commento: "Salita: chiamata al piano 2 (I0.7), si ferma al finecorsa del piano 2 (I0.4)", serie: [na("I0.7"), nc("I0.4"), nc("Q0.1")], parallelo: na("Q0.0"), uscite: [bob("Q0.0")] },
      { commento: "Discesa: chiamata al piano 0 (I0.5), si ferma al finecorsa del piano 0 (I0.2)", serie: [na("I0.5"), nc("I0.2"), nc("Q0.0")], parallelo: na("Q0.1"), uscite: [bob("Q0.1")] },
    ],
    [{ tipo: "impianto-ascensore", etichetta: "", x: X_QUADRO, y: 40 }],
  ),
);

// 8. Parcheggio con contatore
scrivi(
  "plc-parcheggio.elab",
  costruisci(
    [
      { commento: "Sbarra di ingresso: si alza se c'è un'auto (I0.2) e c'è posto (C0 non raggiunto)", serie: [na("I0.2"), nc("C0")], uscite: [bob("Q0.0")] },
      { commento: "Auto entrata: quando la fotocellula di ingresso si libera, +1", serie: [fn("I0.2")], uscite: [ctu("C0", 5)] },
      { commento: "Sbarra di uscita: si alza se un'auto vuole uscire (I0.3)", serie: [na("I0.3")], uscite: [bob("Q0.1")] },
      { commento: "Auto uscita: quando la fotocellula di uscita si libera, −1", serie: [fn("I0.3")], uscite: [ctd("C0", 5)] },
      { commento: "Scritta COMPLETO quando le auto sono 5", serie: [na("C0")], uscite: [bob("Q0.2")] },
    ],
    [{ tipo: "impianto-parcheggio", etichetta: "", x: X_QUADRO, y: 60 }],
  ),
);
