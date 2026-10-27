// Generatore dei file di esempio in esempi/ (strumento per chi sviluppa, non
// fa parte dell'app). I file .elab restano la fonte da distribuire: si possono
// anche modificare a mano o ridisegnare con ElettroLab e salvare.
// Questo script serve solo a scriverli con coordinate precise sulla griglia
// e con la numerazione dei contatti calcolata dal programma stesso.
//
// Uso: npx vite-node strumenti/genera-esempi.ts
import { writeFileSync } from "node:fs";
import { libreriaDelModulo } from "../src/editor/caricaLibreria";
import { vocePerTipo } from "../src/editor/libreria";
import { rinumeraContatti } from "../src/editor/associazioni";
import { serializzaProgetto } from "../src/progetto/formato";
import type { ComponenteSchema, Filo, Schema } from "../src/editor/schema";

const libreria = libreriaDelModulo("impianti");

/** Costruisce uno schema con componenti posati per angolo e fili "comp:morsetto". */
function costruttore() {
  const componenti: ComponenteSchema[] = [];
  const fili: Filo[] = [];
  return {
    /** Posa un componente con l'angolo in alto a sinistra in (x, y). */
    posa(id: string, tipo: string, etichetta: string, x: number, y: number, extra: Partial<ComponenteSchema> = {}) {
      const voce = vocePerTipo(libreria, tipo);
      if (!voce) throw new Error(`Tipo sconosciuto: ${tipo}`);
      if (x % 20 || y % 20) throw new Error(`${id} fuori griglia`);
      componenti.push({ id, tipo, etichetta, x, y, larghezza: voce.larghezza, altezza: voce.altezza, ...extra });
    },
    /** Filo fra due morsetti scritti come "S1:13"; `medio` facoltativo. */
    filo(da: string, a: string, medio?: number) {
      const [c1, m1] = da.split(":");
      const [c2, m2] = a.split(":");
      for (const [c, m] of [[c1, m1], [c2, m2]]) {
        const comp = componenti.find((x) => x.id === c);
        const voce = comp && vocePerTipo(libreria, comp.tipo);
        if (!voce?.morsetti.some((x) => x.id === m)) throw new Error(`Morsetto inesistente ${c}:${m}`);
      }
      const f: Filo = { id: `filo-${fili.length + 1}`, da: { componente: c1, morsetto: m1 }, a: { componente: c2, morsetto: m2 } };
      if (medio !== undefined) f.medio = medio;
      fili.push(f);
    },
    schema(): Schema {
      return rinumeraContatti({ componenti, fili }, libreria);
    },
  };
}

/**
 * Circuito di potenza comune (a sinistra): rete trifase → sezionatore Q1 →
 * contatti principali di K1 → relè termico F1 → motore M1.
 */
function potenzaMotore(b: ReturnType<typeof costruttore>) {
  b.posa("rete-3f", "rete-trifase", "", 40, 40);
  b.posa("Q1", "sezionatore", "Q1", 40, 140);
  b.posa("K1-potenza", "contatti-principali", "K1", 40, 280);
  b.posa("F1", "rele-termico", "F1", 40, 420);
  b.posa("M1", "motore-trifase", "M1", 40, 560);
  b.filo("rete-3f:L1", "Q1:1");
  b.filo("rete-3f:L2", "Q1:3");
  b.filo("rete-3f:L3", "Q1:5");
  b.filo("Q1:2", "K1-potenza:1");
  b.filo("Q1:4", "K1-potenza:3");
  b.filo("Q1:6", "K1-potenza:5");
  b.filo("K1-potenza:2", "F1:1");
  b.filo("K1-potenza:4", "F1:3");
  b.filo("K1-potenza:6", "F1:5");
  b.filo("F1:2", "M1:U");
  b.filo("F1:4", "M1:V");
  b.filo("F1:6", "M1:W");
}

/** Esempio 1: marcia/arresto con autoritenuta e spia di marcia. */
function marciaArresto(): Schema {
  const b = costruttore();
  potenzaMotore(b);
  // Comando: L → 95-96 di F1 → S0 (arresto, NC) → S1 (marcia, NA) ∥ 13-14 di K1 → bobina K1 → N.
  b.posa("rete-1f", "rete-monofase", "", 640, 40); // L in x=660, N in x=680 (ritorno del neutro a destra)
  b.posa("F1-95", "contatto-termico-nc", "F1", 300, 140);
  b.posa("S0", "pulsante-nc", "S0", 300, 260);
  b.posa("S1", "pulsante-na", "S1", 300, 380);
  b.posa("K1-autoritenuta", "contatto-na", "K1", 380, 380); // 13-14
  b.posa("K1", "bobina-contattore", "K1", 300, 520);
  b.posa("K1-spia", "contatto-na", "K1", 500, 380); // 23-24
  b.posa("H1", "lampada", "H1", 500, 520);
  b.filo("rete-1f:L", "F1-95:95", 110);
  b.filo("F1-95:96", "S0:11");
  b.filo("S0:12", "S1:13");
  b.filo("S0:12", "K1-autoritenuta:13", 360);
  b.filo("S1:14", "K1:A1");
  b.filo("K1-autoritenuta:14", "K1:A1", 480);
  b.filo("K1:A2", "rete-1f:N", 640);
  b.filo("F1-95:96", "K1-spia:13", 240);
  b.filo("K1-spia:14", "H1:X1");
  b.filo("H1:X2", "rete-1f:N", 640);
  return b.schema();
}

/** Esempio 2: comando da più punti (due arresti in serie, due marce in parallelo). */
function comandoPiuPunti(): Schema {
  const b = costruttore();
  potenzaMotore(b);
  b.posa("rete-1f", "rete-monofase", "", 720, 40); // L in x=740, N in x=760
  b.posa("F1-95", "contatto-termico-nc", "F1", 300, 120);
  b.posa("S0", "pulsante-nc", "S0", 300, 240); // arresto dal punto 1
  b.posa("S2", "pulsante-nc", "S2", 300, 360); // arresto dal punto 2
  b.posa("S1", "pulsante-na", "S1", 300, 480); // marcia dal punto 1
  b.posa("S3", "pulsante-na", "S3", 380, 480); // marcia dal punto 2
  b.posa("K1-autoritenuta", "contatto-na", "K1", 460, 480); // 13-14
  b.posa("K1", "bobina-contattore", "K1", 300, 620);
  b.posa("K1-spia", "contatto-na", "K1", 580, 480); // 23-24
  b.posa("H1", "lampada", "H1", 580, 620);
  b.filo("rete-1f:L", "F1-95:95", 100);
  b.filo("F1-95:96", "S0:11");
  b.filo("S0:12", "S2:11");
  b.filo("S2:12", "S1:13");
  b.filo("S2:12", "S3:13", 460);
  b.filo("S2:12", "K1-autoritenuta:13", 460);
  b.filo("S1:14", "K1:A1");
  b.filo("S3:14", "K1:A1", 580);
  b.filo("K1-autoritenuta:14", "K1:A1", 580);
  b.filo("K1:A2", "rete-1f:N", 740);
  b.filo("F1-95:96", "K1-spia:13", 220);
  b.filo("K1-spia:14", "H1:X1");
  b.filo("H1:X2", "rete-1f:N", 740);
  return b.schema();
}

const ESEMPI: Record<string, () => Schema> = {
  "marcia-arresto.elab": marciaArresto,
  "comando-piu-punti.elab": comandoPiuPunti,
};

// Data fissa: rigenerare gli esempi senza modifiche non deve cambiare i file.
const DATA = new Date("2026-10-27T00:00:00.000Z");
for (const [nome, crea] of Object.entries(ESEMPI)) {
  writeFileSync(`esempi/${nome}`, serializzaProgetto({ modulo: "impianti", schema: crea() }, "0.1.0", DATA));
  console.log(`scritto esempi/${nome}`);
}
