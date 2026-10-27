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

/**
 * Esempio 3: teleinvertitore con interblocco elettrico.
 * Potenza: K1 (avanti) collega L1-L2-L3 così come sono; K2 (indietro) scambia
 * L1 e L3, quindi il motore riceve la terna inversa e gira al contrario.
 * Comando: ogni bobina passa per il contatto NC (21-22…) dell'altro
 * contattore, così K1 e K2 non possono mai essere eccitati insieme
 * (si eviterebbe un cortocircuito fra le fasi L1 e L3).
 */
function teleinvertitore(): Schema {
  const b = costruttore();
  b.posa("rete-3f", "rete-trifase", "", 40, 40);
  b.posa("Q1", "sezionatore", "Q1", 40, 140);
  b.posa("K1-potenza", "contatti-principali", "K1", 40, 280);
  b.posa("K2-potenza", "contatti-principali", "K2", 160, 280);
  b.posa("F1", "rele-termico", "F1", 40, 420);
  b.posa("M1", "motore-trifase", "M1", 40, 560);
  b.filo("rete-3f:L1", "Q1:1");
  b.filo("rete-3f:L2", "Q1:3");
  b.filo("rete-3f:L3", "Q1:5");
  b.filo("Q1:2", "K1-potenza:1");
  b.filo("Q1:4", "K1-potenza:3");
  b.filo("Q1:6", "K1-potenza:5");
  // K2: L1 e L3 scambiate.
  b.filo("Q1:2", "K2-potenza:5", 240);
  b.filo("Q1:4", "K2-potenza:3", 250);
  b.filo("Q1:6", "K2-potenza:1", 260);
  b.filo("K1-potenza:2", "F1:1");
  b.filo("K1-potenza:4", "F1:3");
  b.filo("K1-potenza:6", "F1:5");
  b.filo("K2-potenza:2", "F1:1", 380);
  b.filo("K2-potenza:4", "F1:3", 390);
  b.filo("K2-potenza:6", "F1:5", 400);
  b.filo("F1:2", "M1:U");
  b.filo("F1:4", "M1:V");
  b.filo("F1:6", "M1:W");

  // Comando: L → 95-96 di F1 → S0 → due rami (avanti / indietro) → N.
  b.posa("rete-1f", "rete-monofase", "", 940, 40); // L in x=960, N in x=980
  b.posa("F1-95", "contatto-termico-nc", "F1", 300, 120);
  b.posa("S0", "pulsante-nc", "S0", 300, 240);
  // Ramo avanti: S1 ∥ K1 13-14 → NC di K2 → bobina K1.
  // Ramo indietro: S2 ∥ K2 13-14 → NC di K1 → bobina K2.
  // (L'ordine di posa decide la numerazione: prima le autoritenute = 13-14.)
  b.posa("S1", "pulsante-na", "S1", 300, 360);
  b.posa("K1-autoritenuta", "contatto-na", "K1", 380, 360);
  b.posa("S2", "pulsante-na", "S2", 540, 360);
  b.posa("K2-autoritenuta", "contatto-na", "K2", 620, 360);
  b.posa("K2-interblocco", "contatto-nc", "K2", 300, 480);
  b.posa("K1-interblocco", "contatto-nc", "K1", 540, 480);
  b.posa("K1", "bobina-contattore", "K1", 300, 600);
  b.posa("K2", "bobina-contattore", "K2", 540, 600);
  // Spie: H1 avanti, H2 indietro.
  b.posa("K1-spia", "contatto-na", "K1", 760, 360);
  b.posa("H1", "lampada", "H1", 760, 600);
  b.posa("K2-spia", "contatto-na", "K2", 860, 360);
  b.posa("H2", "lampada", "H2", 860, 600);

  b.filo("rete-1f:L", "F1-95:95", 100);
  b.filo("F1-95:96", "S0:11");
  b.filo("S0:12", "S1:13");
  b.filo("S0:12", "K1-autoritenuta:13", 340);
  b.filo("S0:12", "S2:13", 340);
  b.filo("S0:12", "K2-autoritenuta:13", 340);
  b.filo("S1:14", "K2-interblocco:21");
  b.filo("K1-autoritenuta:14", "K2-interblocco:21", 460);
  b.filo("K2-interblocco:22", "K1:A1");
  b.filo("S2:14", "K1-interblocco:21");
  b.filo("K2-autoritenuta:14", "K1-interblocco:21", 460);
  b.filo("K1-interblocco:22", "K2:A1");
  b.filo("F1-95:96", "K1-spia:13", 230);
  b.filo("F1-95:96", "K2-spia:13", 230);
  b.filo("K1-spia:14", "H1:X1");
  b.filo("K2-spia:14", "H2:X1");
  b.filo("K1:A2", "rete-1f:N", 720);
  b.filo("K2:A2", "rete-1f:N", 720);
  b.filo("H1:X2", "rete-1f:N", 720);
  b.filo("H2:X2", "rete-1f:N", 720);
  return b.schema();
}

/**
 * Esempio 4: avviamento stella-triangolo con temporizzatore.
 * Potenza: K1 (linea) alimenta U1-V1-W1 attraverso il relè termico F1;
 * K2 (stella) unisce U2-V2-W2; K3 (triangolo) collega U2-V2-W2 a L2-L3-L1.
 * Comando: S1 eccita K1 (autoritenuta 13-14) e il temporizzatore KT1;
 * subito si eccita K2 (stella) tramite il NC temporizzato di KT1; dopo il
 * tempo il NC apre (K2 si diseccita) e il NA chiude (si eccita K3).
 * I NC di K2 e K3 fanno da interblocco fra stella e triangolo.
 */
function stellaTriangolo(): Schema {
  const b = costruttore();
  b.posa("rete-3f", "rete-trifase", "", 40, 40);
  b.posa("Q1", "sezionatore", "Q1", 40, 140);
  b.posa("K1-potenza", "contatti-principali", "K1", 40, 280);
  b.posa("F1", "rele-termico", "F1", 40, 420);
  b.posa("M1", "motore-trifase-6", "M1", 40, 600);
  b.posa("K3-potenza", "contatti-principali", "K3", 160, 440);
  b.posa("K2-potenza", "contatti-principali", "K2", 160, 740);
  b.filo("rete-3f:L1", "Q1:1");
  b.filo("rete-3f:L2", "Q1:3");
  b.filo("rete-3f:L3", "Q1:5");
  b.filo("Q1:2", "K1-potenza:1");
  b.filo("Q1:4", "K1-potenza:3");
  b.filo("Q1:6", "K1-potenza:5");
  b.filo("K1-potenza:2", "F1:1");
  b.filo("K1-potenza:4", "F1:3");
  b.filo("K1-potenza:6", "F1:5");
  b.filo("F1:2", "M1:U1");
  b.filo("F1:4", "M1:V1");
  b.filo("F1:6", "M1:W1");
  // Triangolo: U2 ← L2, V2 ← L3, W2 ← L1 (cioè U1-W2, V1-U2, W1-V2).
  b.filo("F1:4", "K3-potenza:1", 520);
  b.filo("F1:6", "K3-potenza:3", 530);
  b.filo("F1:2", "K3-potenza:5", 540);
  b.filo("K3-potenza:2", "M1:U2", 700);
  b.filo("K3-potenza:4", "M1:V2", 710);
  b.filo("K3-potenza:6", "M1:W2", 720);
  // Stella: K2 unisce le tre fini degli avvolgimenti.
  b.filo("M1:U2", "K2-potenza:1");
  b.filo("M1:V2", "K2-potenza:3");
  b.filo("M1:W2", "K2-potenza:5");
  b.filo("K2-potenza:2", "K2-potenza:4", 840);
  b.filo("K2-potenza:4", "K2-potenza:6", 840);

  // Comando.
  b.posa("rete-1f", "rete-monofase", "", 780, 40); // L in x=800, N in x=820
  b.posa("F1-95", "contatto-termico-nc", "F1", 300, 120);
  b.posa("S0", "pulsante-nc", "S0", 300, 240);
  b.posa("S1", "pulsante-na", "S1", 300, 360);
  b.posa("K1-autoritenuta", "contatto-na", "K1", 380, 360);
  b.posa("KT1-stella", "contatto-temporizzato-nc", "KT1", 540, 500);
  b.posa("K3-interblocco", "contatto-nc", "K3", 540, 620);
  b.posa("KT1-triangolo", "contatto-temporizzato-na", "KT1", 660, 500);
  b.posa("K2-interblocco", "contatto-nc", "K2", 660, 620);
  b.posa("K1", "bobina-contattore", "K1", 300, 740);
  b.posa("KT1", "bobina-ritardata-eccitazione", "KT1", 420, 740, { tempo: 4 });
  b.posa("K2", "bobina-contattore", "K2", 540, 740);
  b.posa("K3", "bobina-contattore", "K3", 660, 740);
  b.filo("rete-1f:L", "F1-95:95", 100);
  b.filo("F1-95:96", "S0:11");
  b.filo("S0:12", "S1:13");
  b.filo("S0:12", "K1-autoritenuta:13", 340);
  b.filo("S1:14", "K1:A1");
  b.filo("K1-autoritenuta:14", "K1:A1", 470);
  b.filo("K1:A1", "KT1:A1", 700);
  b.filo("K1-autoritenuta:14", "KT1-stella:15", 470);
  b.filo("K1-autoritenuta:14", "KT1-triangolo:17", 470);
  b.filo("KT1-stella:16", "K3-interblocco:21");
  b.filo("K3-interblocco:22", "K2:A1");
  b.filo("KT1-triangolo:18", "K2-interblocco:21");
  b.filo("K2-interblocco:22", "K3:A1");
  b.filo("K1:A2", "rete-1f:N", 860);
  b.filo("KT1:A2", "rete-1f:N", 860);
  b.filo("K2:A2", "rete-1f:N", 860);
  b.filo("K3:A2", "rete-1f:N", 860);
  return b.schema();
}

/**
 * Esempio 5: comando temporizzato (marcia a tempo).
 * S1 avvia il motore (autoritenuta di K1) e insieme il temporizzatore KT1
 * al ritardo all'eccitazione; trascorso il tempo il suo contatto NC
 * temporizzato, in serie all'arresto, si apre e ferma il motore da solo.
 */
function comandoTemporizzato(): Schema {
  const b = costruttore();
  potenzaMotore(b);
  b.posa("rete-1f", "rete-monofase", "", 720, 40); // L in x=740, N in x=760
  b.posa("F1-95", "contatto-termico-nc", "F1", 300, 120);
  b.posa("S0", "pulsante-nc", "S0", 300, 240);
  b.posa("KT1-fine", "contatto-temporizzato-nc", "KT1", 300, 360);
  b.posa("S1", "pulsante-na", "S1", 300, 480);
  b.posa("K1-autoritenuta", "contatto-na", "K1", 380, 480);
  b.posa("K1", "bobina-contattore", "K1", 300, 620);
  b.posa("KT1", "bobina-ritardata-eccitazione", "KT1", 440, 620, { tempo: 8 });
  b.posa("K1-spia", "contatto-na", "K1", 580, 480);
  b.posa("H1", "lampada", "H1", 580, 620);
  b.filo("rete-1f:L", "F1-95:95", 100);
  b.filo("F1-95:96", "S0:11");
  b.filo("S0:12", "KT1-fine:15");
  b.filo("KT1-fine:16", "S1:13");
  b.filo("KT1-fine:16", "K1-autoritenuta:13", 460);
  b.filo("S1:14", "K1:A1");
  b.filo("K1-autoritenuta:14", "K1:A1", 590);
  b.filo("K1:A1", "KT1:A1", 590);
  b.filo("F1-95:96", "K1-spia:13", 220);
  b.filo("K1-spia:14", "H1:X1");
  b.filo("K1:A2", "rete-1f:N", 740);
  b.filo("KT1:A2", "rete-1f:N", 740);
  b.filo("H1:X2", "rete-1f:N", 740);
  return b.schema();
}

const ESEMPI: Record<string, () => Schema> = {
  "marcia-arresto.elab": marciaArresto,
  "comando-piu-punti.elab": comandoPiuPunti,
  "teleinvertitore.elab": teleinvertitore,
  "stella-triangolo.elab": stellaTriangolo,
  "comando-temporizzato.elab": comandoTemporizzato,
};

// Data fissa: rigenerare gli esempi senza modifiche non deve cambiare i file.
const DATA = new Date("2026-10-27T00:00:00.000Z");
for (const [nome, crea] of Object.entries(ESEMPI)) {
  writeFileSync(`esempi/${nome}`, serializzaProgetto({ modulo: "impianti", schema: crea() }, "0.1.0", DATA));
  console.log(`scritto esempi/${nome}`);
}
