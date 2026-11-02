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

// 5. Alimentatore stabilizzato: ponte di Graetz, condensatore di filtro e regolatore 7805
{
  const b = costruttore();
  b.posa("generatore-funzioni", 20, 120, { forma: "sinusoide", frequenza: 50, ampiezza: 15, offset: 0 });
  // Ponte: diodi verticali con l'anodo in basso e il catodo in alto.
  b.posa("diodo", 180, 40, undefined, 270);
  b.posa("diodo", 260, 40, undefined, 270);
  b.posa("diodo", 180, 200, undefined, 270);
  b.posa("diodo", 260, 200, undefined, 270);
  b.posa("condensatore", 340, 80, { capacita: 1000e-6 }, 90);
  b.posa("regolatore", 420, 40, { tensione: 5 });
  b.posa("resistenza", 540, 80, { resistenza: 470 }, 90);
  b.posa("led", 540, 180, { colore: "verde" });
  const gnd = b.posa("massa", 340, 320);
  b.posa("oscilloscopio", 620, 180);
  b.filo("XFG1.+", "D1.a");
  b.filo("D1.a", "D3.k");
  b.filo("XFG1.COM", "D2.a");
  b.filo("D2.a", "D4.k");
  b.filo("D1.k", "D2.k");
  b.filo("D3.a", "D4.a");
  b.filo("D4.a", `${gnd}.0`);
  b.filo("D2.k", "C1.1");
  b.filo("C1.2", `${gnd}.0`);
  b.filo("C1.1", "U1.in");
  b.filo("U1.gnd", `${gnd}.0`);
  b.filo("U1.out", "R1.1");
  b.filo("R1.2", "D5.a");
  b.filo("D5.k", `${gnd}.0`);
  b.filo("XSC1.A", "C1.1");
  b.filo("XSC1.B", "U1.out");
  b.filo("XSC1.COM", `${gnd}.0`);
  scrivi("elettronica-alimentatore.elab", b.schema());
}

// 6. Transistor come interruttore: una piccola corrente di base accende il LED
{
  const b = costruttore();
  b.posa("generatore-dc", 40, 100, { tensione: 9 });
  b.posa("interruttore", 120, 200);
  // RB finisce esattamente sulla base di Q1, il LED sul collettore, R2 sul LED.
  b.posa("resistenza", 220, 200, { resistenza: 10000 });
  b.posa("transistor-npn", 300, 180, { beta: 100 });
  b.posa("led", 320, 100, { colore: "rosso" });
  b.posa("resistenza", 320, 20, { resistenza: 470 }, 90);
  const gnd = b.posa("massa", 40, 300);
  b.posa("multimetro", 420, 160, { modalita: "V" });
  b.filo("V1.+", "R2.1");
  b.filo("V1.+", "S1.1");
  b.filo("S1.2", "R1.1");
  b.filo("Q1.e", `${gnd}.0`);
  b.filo("V1.-", `${gnd}.0`);
  b.filo("XMM1.+", "Q1.c");
  b.filo("XMM1.COM", `${gnd}.0`);
  scrivi("elettronica-transistor.elab", b.schema());
}

// 7. Amplificatore invertente con operazionale
{
  const b = costruttore();
  b.posa("generatore-funzioni", 40, 120, { forma: "sinusoide", frequenza: 1000, ampiezza: 0.5, offset: 0 });
  b.posa("resistenza", 160, 180, { resistenza: 1000 });
  b.posa("operazionale", 240, 180, { saturazione: 12 });
  b.posa("resistenza", 260, 100, { resistenza: 10000 });
  const gnd = b.posa("massa", 220, 300);
  b.posa("oscilloscopio", 400, 40);
  b.filo("XFG1.+", "R1.1");
  b.filo("R1.2", "R2.1");
  b.filo("R2.2", "U1.out");
  b.filo("U1.+", `${gnd}.0`);
  b.filo("XFG1.COM", `${gnd}.0`);
  b.filo("XSC1.A", "XFG1.+");
  b.filo("XSC1.B", "U1.out");
  b.filo("XSC1.COM", `${gnd}.0`);
  scrivi("elettronica-amplificatore.elab", b.schema());
}

// 8. Carica e scarica di un condensatore (τ = R·C = 1 s)
{
  const b = costruttore();
  b.posa("generatore-dc", 40, 100, { tensione: 10 });
  b.posa("interruttore", 100, 80);
  b.posa("resistenza", 200, 80, { resistenza: 10000 });
  b.posa("condensatore", 260, 100, { capacita: 100e-6 }, 90);
  b.posa("resistenza", 340, 100, { resistenza: 1000 }, 90);
  b.posa("pulsante", 340, 180, undefined, 90);
  const gnd = b.posa("massa", 260, 300);
  b.posa("multimetro", 440, 60, { modalita: "V" });
  b.posa("oscilloscopio", 440, 220);
  b.filo("V1.+", "S1.1");
  b.filo("S1.2", "R1.1");
  b.filo("C1.1", "R2.1");
  b.filo("S2.2", `${gnd}.0`);
  b.filo("C1.2", `${gnd}.0`);
  b.filo("V1.-", `${gnd}.0`);
  b.filo("XMM1.+", "C1.1");
  b.filo("XMM1.COM", `${gnd}.0`);
  b.filo("XSC1.A", "C1.1");
  b.filo("XSC1.COM", `${gnd}.0`);
  scrivi("elettronica-condensatore.elab", b.schema());
}

// 9. Multivibratore astabile: due transistor che si accendono a turno (LED lampeggianti)
{
  const b = costruttore();
  b.posa("generatore-dc", 20, 140, { tensione: 9 });
  b.posa("resistenza", 100, 40, { resistenza: 470 }, 90); // R1: LED1
  b.posa("resistenza", 180, 40, { resistenza: 22000 }, 90); // R2: base di Q1
  b.posa("resistenza", 260, 40, { resistenza: 22000 }, 90); // R3: base di Q2
  b.posa("resistenza", 340, 40, { resistenza: 470 }, 90); // R4: LED2
  b.posa("led", 100, 120, { colore: "rosso" });
  b.posa("led", 340, 120, { colore: "verde" });
  b.posa("transistor-npn", 80, 200, { beta: 100 });
  b.posa("transistor-npn", 320, 200, { beta: 100 });
  // Capacità diverse: i due semiperiodi sono diversi (e l'oscillazione parte subito).
  b.posa("condensatore", 160, 160, { capacita: 47e-6 });
  b.posa("condensatore", 160, 240, { capacita: 33e-6 });
  const gnd = b.posa("massa", 220, 340);
  b.filo("V1.+", "R1.1");
  b.filo("R1.1", "R2.1");
  b.filo("R2.1", "R3.1");
  b.filo("R3.1", "R4.1");
  b.filo("R2.2", "Q1.b");
  b.filo("R3.2", "Q2.b");
  b.filo("Q1.c", "C1.1");
  b.filo("C1.2", "Q2.b");
  b.filo("Q2.c", "C2.2");
  b.filo("C2.1", "Q1.b");
  b.filo("Q1.e", `${gnd}.0`);
  b.filo("Q2.e", `${gnd}.0`);
  b.filo("V1.-", `${gnd}.0`);
  scrivi("elettronica-multivibratore.elab", b.schema());
}
