// Generatore degli esempi pronti del modulo Elettronica in esempi/ (strumento
// per chi sviluppa, non fa parte dell'app). I file .elab sono la fonte da
// distribuire: si aprono, si modificano e si risalvano con ElettroLab.
// La descrizione e il "Come provarlo" di ogni esempio stanno in esempi/esempi.json.
//
// Uso: npx vite-node strumenti/genera-esempi-elettronica.ts
import { writeFileSync } from "node:fs";
import { libreriaDelModulo } from "../src/editor/caricaLibreria";
import { vocePerTipo } from "../src/editor/libreria";
import { serializzaProgetto } from "../src/progetto/formato";
import type { ComponenteSchema, Filo, Rotazione, Schema } from "../src/editor/schema";

const libreria = libreriaDelModulo("elettronica");

function costruttore() {
  const componenti: ComponenteSchema[] = [];
  const fili: Filo[] = [];
  const conta = new Map<string, number>();
  const api = {
    /** Posa un componente con il suo angolo in alto a sinistra in (x, y) e restituisce la sua sigla. */
    posa(tipo: string, x: number, y: number, parametri?: Record<string, number | string>, rotazione?: Rotazione): string {
      const v = vocePerTipo(libreria, tipo);
      if (!v) throw new Error(`Tipo sconosciuto ${tipo}`);
      if (x % 20 || y % 20) throw new Error(`${tipo} fuori griglia (${x}, ${y})`);
      // Le sigle si numerano per lettera (R1, R2…), come fa l'editor.
      const lettera = v.sigla;
      const n = (conta.get(lettera) ?? 0) + 1;
      conta.set(lettera, n);
      const etichetta = lettera ? `${lettera}${n}` : "";
      const id = etichetta || `${tipo}-${componenti.length + 1}`;
      const c: ComponenteSchema = { id, tipo, etichetta, x, y, larghezza: v.larghezza, altezza: v.altezza };
      if (parametri) c.parametri = parametri;
      if (rotazione) c.rotazione = rotazione;
      componenti.push(c);
      return id;
    },
    /** Filo fra due morsetti scritti "sigla.morsetto" (es. "R1.2"). */
    filo(da: string, a: string) {
      const estremo = (s: string) => {
        const i = s.lastIndexOf(".");
        return { componente: s.slice(0, i), morsetto: s.slice(i + 1) };
      };
      const e1 = estremo(da);
      const e2 = estremo(a);
      for (const e of [e1, e2]) {
        const c = componenti.find((x) => x.id === e.componente);
        if (!c || !vocePerTipo(libreria, c.tipo)?.morsetti.some((m) => m.id === e.morsetto)) throw new Error(`Morsetto inesistente ${e.componente}.${e.morsetto}`);
      }
      fili.push({ id: `filo-${fili.length + 1}`, da: e1, a: e2 });
    },
    schema(): Schema {
      return { componenti, fili };
    },
  };
  return api;
}

function scrivi(file: string, schema: Schema) {
  writeFileSync(new URL(`../esempi/${file}`, import.meta.url), serializzaProgetto({ modulo: "elettronica", schema }, "0.1.0"));
  console.log(`scritto esempi/${file}: ${schema.componenti.length} componenti, ${schema.fili.length} fili`);
}

// 1. Partitore di tensione misurato con il multimetro
{
  const b = costruttore();
  b.posa("generatore-dc", 100, 100, { tensione: 9 });
  b.posa("resistenza", 240, 40, { resistenza: 1000 }, 90);
  b.posa("resistenza", 240, 120, { resistenza: 2000 }, 90);
  const gnd = b.posa("massa", 100, 220);
  b.posa("multimetro", 340, 60, { modalita: "V" });
  b.filo("V1.+", "R1.1");
  b.filo("R1.2", "R2.1");
  b.filo("R2.2", `${gnd}.0`);
  b.filo("V1.-", `${gnd}.0`);
  b.filo("R1.2", "XMM1.+");
  b.filo("XMM1.COM", `${gnd}.0`);
  scrivi("elettronica-partitore.elab", b.schema());
}

// 2. Filtro RC passa-basso con generatore di funzioni e oscilloscopio
{
  const b = costruttore();
  b.posa("generatore-funzioni", 40, 60, { forma: "sinusoide", frequenza: 1000, ampiezza: 2, offset: 0 });
  b.posa("resistenza", 180, 200, { resistenza: 1000 });
  b.posa("condensatore", 280, 220, { capacita: 159e-9 }, 90);
  const gnd = b.posa("massa", 80, 320);
  b.posa("oscilloscopio", 380, 60);
  b.filo("XFG1.+", "R1.1");
  b.filo("R1.2", "C1.1");
  b.filo("C1.2", `${gnd}.0`);
  b.filo("XFG1.COM", `${gnd}.0`);
  b.filo("XSC1.A", "R1.1");
  b.filo("XSC1.B", "C1.1");
  b.filo("XSC1.COM", `${gnd}.0`);
  scrivi("elettronica-filtro-rc.elab", b.schema());
}

// 3. Porte logiche AND, OR, XOR con interruttori logici e sonde
{
  const b = costruttore();
  b.posa("interruttore-logico", 40, 80);
  b.posa("interruttore-logico", 40, 160);
  b.posa("porta-and", 200, 40);
  b.posa("porta-or", 200, 160);
  b.posa("porta-xor", 200, 280);
  b.posa("sonda-logica", 340, 60);
  b.posa("sonda-logica", 340, 180);
  b.posa("sonda-logica", 340, 300);
  for (const [porta, sonda] of [["U1", "X1"], ["U2", "X2"], ["U3", "X3"]]) {
    b.filo("S1.out", `${porta}.A`);
    b.filo("S2.out", `${porta}.B`);
    b.filo(`${porta}.Y`, `${sonda}.in`);
  }
  scrivi("elettronica-porte-logiche.elab", b.schema());
}

// 4. Contatore con display a 7 segmenti e analizzatore logico
{
  const b = costruttore();
  b.posa("generatore-clock", 40, 100, { frequenza: 1 });
  b.posa("interruttore-logico", 40, 200);
  b.posa("contatore", 160, 100);
  b.posa("decodificatore", 320, 100);
  // Il display sta attaccato al decodificatore: uscite a…g e ingressi combaciano.
  b.posa("display-7-segmenti", 400, 100);
  b.posa("analizzatore-logico", 160, 300);
  b.filo("CLK1.out", "U1.CLK");
  b.filo("S1.out", "U1.R");
  for (const [q, ingresso] of [["Q0", "A"], ["Q1", "B"], ["Q2", "C"], ["Q3", "D"]]) b.filo(`U1.${q}`, `U2.${ingresso}`);
  b.filo("CLK1.out", "XLA1.D0");
  b.filo("U1.Q0", "XLA1.D1");
  b.filo("U1.Q1", "XLA1.D2");
  b.filo("U1.Q2", "XLA1.D3");
  scrivi("elettronica-contatore.elab", b.schema());
}
