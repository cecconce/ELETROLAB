// Test dell'attività 5.5: gli esempi pronti del modulo Arduino si aprono senza
// problemi e funzionano come descritto in "Come provarlo".
import { describe, expect, it } from "vitest";
import { ESEMPI } from "./caricaEsempi";
import { apriEsempio } from "./esempi";
import type { Schema } from "../editor/schema";
import { datiPlotter } from "../editor/letturaPlotter";
import { componentiDaSchema, nodiDaSchema, problemiArduino, vistaDaSessioneArduino } from "../editor/arduino";
import { libreriaDelModulo } from "../editor/caricaLibreria";
import { vocePerTipo } from "../editor/libreria";
import { avviaSessioneArduino, clicGiuArduino, clicSuArduino, passoArduino, TASTI_TASTIERINO, TASTIERINO_H, TASTIERINO_L, TASTIERINO_X0, TASTIERINO_Y0, type SessioneArduino } from "../motori/arduino";

const lib = libreriaDelModulo("arduino");
const morsettiDi = (tipo: string) => vocePerTipo(lib, tipo)?.morsetti;

function apri(file: string): { schema: Schema; s: SessioneArduino } {
  const esempio = ESEMPI.find((e) => e.file === file);
  if (!esempio) throw new Error(`manca ${file}`);
  const esito = apriEsempio(esempio);
  if (!esito.ok) throw new Error(esito.errore);
  const schema = esito.progetto.schema;
  const s = avviaSessioneArduino(schema.codice ?? "", componentiDaSchema(schema), nodiDaSchema(schema, morsettiDi));
  return { schema, s };
}
/** Fa scorrere il tempo a passi da 50 ms, come l'interfaccia. */
function aspetta(s: SessioneArduino, ms: number) {
  for (let t = 0; t < ms; t += 50) passoArduino(s, 50);
}
const id = (schema: Schema, tipo: string) => schema.componenti.find((c) => c.tipo === tipo)!.id;
const luminosita = (s: SessioneArduino, schema: Schema, tipo: string) => s.aspetto[id(schema, tipo)]?.luminosita ?? 0;

describe("esempi Arduino", () => {
  it("ci sono gli esempi, tutti senza errori né problemi all'avvio", () => {
    const arduino = ESEMPI.filter((e) => e.modulo === "arduino");
    expect(arduino).toHaveLength(25);
    for (const e of arduino) {
      const { schema, s } = apri(e.file);
      aspetta(s, 300);
      expect(s.errore, e.file).toBeNull();
      expect(problemiArduino(s, schema, lib), e.file).toEqual([]);
    }
  });

  it("Blink: il LED esterno lampeggia ogni mezzo secondo", () => {
    const { schema, s } = apri("arduino-blink.elab");
    aspetta(s, 250);
    expect(luminosita(s, schema, "led-rosso")).toBeGreaterThan(0.5);
    aspetta(s, 500);
    expect(luminosita(s, schema, "led-rosso")).toBe(0);
  });

  it("semaforo: verde, poi giallo, poi rosso", () => {
    const { schema, s } = apri("arduino-semaforo.elab");
    const accesi = () => ["rosso", "giallo", "verde"].filter((c) => luminosita(s, schema, `led-${c}`) > 0);
    aspetta(s, 1000);
    expect(accesi()).toEqual(["verde"]);
    aspetta(s, 5000);
    expect(accesi()).toEqual(["giallo"]);
    aspetta(s, 2000);
    expect(accesi()).toEqual(["rosso"]);
  });

  it("pulsante: il LED si accende solo mentre è premuto", () => {
    const { schema, s } = apri("arduino-pulsante.elab");
    aspetta(s, 100);
    expect(luminosita(s, schema, "led-verde")).toBe(0);
    clicGiuArduino(s, id(schema, "pulsante"));
    aspetta(s, 100);
    expect(luminosita(s, schema, "led-verde")).toBeGreaterThan(0.5);
    clicSuArduino(s, id(schema, "pulsante"));
    aspetta(s, 100);
    expect(luminosita(s, schema, "led-verde")).toBe(0);
  });

  it("potenziometro: girandolo cambia la luminosità e i valori sul monitor seriale", () => {
    const { schema, s } = apri("arduino-potenziometro.elab");
    aspetta(s, 300);
    const meta = luminosita(s, schema, "led-giallo");
    for (let i = 0; i < 5; i++) clicGiuArduino(s, id(schema, "potenziometro"), true); // tutto a sinistra
    aspetta(s, 300);
    expect(luminosita(s, schema, "led-giallo")).toBeLessThan(meta);
    expect(s.seriale).toMatch(/Potenziometro: \d+ {2}luminosita: \d+/);
  });

  it("servo: segue il potenziometro", () => {
    const { schema, s } = apri("arduino-servo.elab");
    aspetta(s, 100);
    const prima = vistaDaSessioneArduino(s, schema, lib).componenti[id(schema, "servo")].arduino?.angolo ?? -1;
    for (let i = 0; i < 5; i++) clicGiuArduino(s, id(schema, "potenziometro"));
    aspetta(s, 100);
    const dopo = vistaDaSessioneArduino(s, schema, lib).componenti[id(schema, "servo")].arduino?.angolo ?? -1;
    expect(prima).toBeGreaterThan(80);
    expect(prima).toBeLessThan(100);
    expect(dopo).toBe(180);
  });

  it("LCD: saluto e secondi sul display", () => {
    const { schema, s } = apri("arduino-lcd.elab");
    aspetta(s, 2100);
    const righe = vistaDaSessioneArduino(s, schema, lib).componenti[id(schema, "lcd")].arduino?.righe;
    expect(righe?.[0].trim()).toBe("Ciao, classe!");
    expect(righe?.[1].trim()).toBe("Secondi: 2");
  });

  it("ultrasuoni: distanza sul monitor e LED sotto i 20 cm", () => {
    const { schema, s } = apri("arduino-ultrasuoni.elab");
    aspetta(s, 400);
    expect(s.seriale).toMatch(/Distanza: 50 cm/);
    expect(luminosita(s, schema, "led-rosso")).toBe(0);
    for (let i = 0; i < 3; i++) clicGiuArduino(s, id(schema, "ultrasuoni"), true); // 50 → 30 → 20 → 10
    aspetta(s, 700);
    expect(s.seriale).toMatch(/Distanza: 10 cm/);
    expect(luminosita(s, schema, "led-rosso")).toBeGreaterThan(0.5);
  });
});

describe("esempio del termometro", () => {
  it("scrive la temperatura e accende il LED L sopra i 30 °C", () => {
    const { schema, s } = apri("arduino-temperatura.elab");
    aspetta(s, 700);
    expect(s.errore).toBeNull();
    expect(s.seriale).toContain("Temperatura: 20 C");
    const sensore = id(schema, "tmp36");
    for (let k = 0; k < 3; k++) clicGiuArduino(s, sensore);
    aspetta(s, 1200);
    expect(s.seriale.trim().split("\n").pop()).toContain("Temperatura: 35 C");
    expect(s.pin.D13?.livello).toBe(1);
  });
});

describe("esempio del display a 7 segmenti", () => {
  it("conta da 0 a 9 accendendo i segmenti giusti", () => {
    const { schema, s } = apri("arduino-7-segmenti.elab");
    const display = id(schema, "display-sette-segmenti");
    const accesi = () => (s.aspetto[display]?.segmenti ?? []).map((l, k) => (l > 0.3 ? "abcdefgP"[k] : "")).join("");
    aspetta(s, 500);
    expect(s.errore).toBeNull();
    expect(accesi()).toBe("abcdef"); // 0
    aspetta(s, 1000);
    expect(accesi()).toBe("bc"); // 1
    aspetta(s, 1000);
    expect(accesi()).toBe("abdeg"); // 2
    aspetta(s, 6000);
    expect(accesi()).toBe("abcdefg"); // 8
    expect(s.seriale).toMatch(/^0\n1\n2\n/);
    expect(s.aspetto[display]?.bruciato).toBe(false);
  });
});

describe("esempio del multimetro", () => {
  it("il voltmetro legge la tensione del LED e l'amperometro la corrente", () => {
    const { schema, s } = apri("arduino-multimetro.elab");
    aspetta(s, 300);
    expect(s.errore).toBeNull();
    const vista = vistaDaSessioneArduino(s, schema, lib).componenti;
    const [m1, m2] = schema.componenti.filter((c) => c.tipo === "multimetro").map((c) => vista[c.id].arduino!);
    expect(m1.funzione).toBe("V");
    expect(m1.lettura).toMatch(/^1,9\d V$/);
    expect(m2.funzione).toBe("A");
    expect(m2.lettura).toMatch(/^1[23],\d mA$/);
    expect(luminosita(s, schema, "led-rosso")).toBeGreaterThan(0.5);
    // Un clic passa il voltmetro all'ohmmetro passando per l'amperometro.
    const id1 = schema.componenti.find((c) => c.tipo === "multimetro")!.id;
    clicGiuArduino(s, id1);
    clicSuArduino(s, id1);
    clicGiuArduino(s, id1);
    clicSuArduino(s, id1);
    aspetta(s, 100);
    expect(vistaDaSessioneArduino(s, schema, lib).componenti[id1].arduino!.funzione).toBe("Ω");
  });
});

describe("esempio del sensore di movimento", () => {
  it("scrive il movimento una volta sola e accende il LED L", () => {
    const { schema, s } = apri("arduino-movimento.elab");
    aspetta(s, 500);
    expect(s.errore).toBeNull();
    expect(s.seriale).toContain("Allarme pronto");
    expect(s.pin.D13?.livello ?? 0).toBe(0);
    const pir = id(schema, "sensore-pir");
    clicGiuArduino(s, pir);
    aspetta(s, 1000);
    expect(s.pin.D13?.livello).toBe(1);
    expect(s.seriale.match(/Movimento rilevato!/g)).toHaveLength(1);
    clicGiuArduino(s, pir);
    aspetta(s, 500);
    expect(s.pin.D13?.livello).toBe(0);
    expect(s.seriale.trim().split("\n").pop()).toContain("Nessun movimento");
  });
});

describe("esempi con l'alimentatore da banco", () => {
  it("alimentatore e LED: 9 V, circa 15 mA, la corrente cresce alzando la tensione", () => {
    const { schema, s } = apri("arduino-alimentatore.elab");
    aspetta(s, 200);
    const ps = id(schema, "alimentatore");
    const vista = () => vistaDaSessioneArduino(s, schema, lib).componenti[ps].arduino!.alimentatore!;
    expect(vista().volt).toBeCloseTo(9, 1);
    expect(vista().ampere).toBeGreaterThan(0.013);
    expect(vista().ampere).toBeLessThan(0.016);
    expect(vista().cc).toBe(false);
    expect(luminosita(s, schema, "led-rosso")).toBeGreaterThan(0.8);
    const prima = vista().ampere;
    clicGiuArduino(s, ps);
    clicSuArduino(s, ps);
    expect(vista().volt).toBeCloseTo(9.5, 1);
    expect(vista().ampere).toBeGreaterThan(prima);
    // Il voltmetro sul LED indica la sua tensione di soglia (circa 2 V).
    const xmm = id(schema, "multimetro");
    expect(vistaDaSessioneArduino(s, schema, lib).componenti[xmm].arduino!.lettura).toMatch(/^[12],\d\d V$/);
  });

  it("voltmetro: il monitor scrive la tensione dell'alimentatore e avvisa oltre 10 V", () => {
    const { schema, s } = apri("arduino-voltmetro.elab");
    aspetta(s, 700);
    expect(s.seriale).toContain("Voltmetro pronto");
    expect(s.seriale).toContain("Tensione: 6.00 V");
    const ps = id(schema, "alimentatore");
    for (let k = 0; k < 4; k++) clicGiuArduino(s, ps); // 6 V → 8 V
    aspetta(s, 600);
    expect(s.seriale.trim().split("\n").pop()).toContain("Tensione: 8.00 V");
    expect(problemiArduino(s, schema, lib)).toEqual([]);
    for (let k = 0; k < 8; k++) clicGiuArduino(s, ps); // 12 V: su A0 arrivano 6 V
    aspetta(s, 600);
    expect(s.seriale).toContain("Fuori scala");
    const problemi = problemiArduino(s, schema, lib);
    expect(problemi.map((p) => p.chiave)).toContain("pin-tensione-A0");
    expect(problemi.find((p) => p.chiave === "pin-tensione-A0")!.testo).toContain("6,0 V");
  });
});

describe("esempio del motorino con il transistor", () => {
  it("il potenziometro regola la velocità, il transistor regge la corrente e il diodo resta spento", () => {
    const { schema, s } = apri("arduino-motore-transistor.elab");
    aspetta(s, 500);
    expect(s.errore).toBeNull();
    const motore = id(schema, "motore-dc");
    const q = id(schema, "transistor-npn");
    const ps = id(schema, "alimentatore");
    const velocita = () => s.aspetto[motore]?.velocita ?? 0;
    const meta = velocita();
    expect(meta).toBeGreaterThan(0.2);
    expect(s.aspetto[q].statoTransistor).toBe("attivo");
    expect(s.aspetto[id(schema, "diodo")].corrente).toBe(0);
    // Il motore assorbe dall'alimentatore, non dal pin: la corrente di base è piccola.
    expect(s.aspetto[q].correnteBase!).toBeLessThan(0.005);
    expect(s.aspetto[ps].corrente!).toBeGreaterThan(0.05);
    const pot = id(schema, "potenziometro");
    for (let k = 0; k < 5; k++) clicGiuArduino(s, pot); // tutto a destra
    aspetta(s, 700);
    expect(velocita()).toBeGreaterThan(meta);
    expect(s.seriale).toContain("Velocita' (0-255): 255");
    for (let k = 0; k < 10; k++) clicGiuArduino(s, pot, true); // tutto a sinistra
    aspetta(s, 700);
    expect(velocita()).toBe(0);
    expect(s.aspetto[q].statoTransistor).toBe("interdizione");
    expect(problemiArduino(s, schema, lib)).toEqual([]);
  });
});

describe("esempio della lampadina comandata dal relè", () => {
  it("ogni pressione del pulsante fa scattare il relè e accende o spegne la lampadina", () => {
    const { schema, s } = apri("arduino-rele-lampadina.elab");
    aspetta(s, 300);
    expect(s.errore).toBeNull();
    const k = id(schema, "modulo-rele");
    const h = id(schema, "lampadina");
    const ps = id(schema, "alimentatore");
    const s1 = id(schema, "pulsante");
    const premiERilascia = () => {
      clicGiuArduino(s, s1);
      aspetta(s, 200);
      clicSuArduino(s, s1);
      aspetta(s, 200);
    };
    expect(s.aspetto[k].eccitato).toBe(false);
    expect(s.aspetto[h].luminosita).toBe(0);
    premiERilascia();
    expect(s.aspetto[k].eccitato).toBe(true);
    expect(s.aspetto[h].luminosita).toBeCloseTo(1, 1);
    expect(s.aspetto[ps].corrente).toBeCloseTo(0.1, 2);
    expect(s.seriale).toContain("Lampadina accesa");
    expect(vistaDaSessioneArduino(s, schema, lib).componenti[k].arduino!.eccitato).toBe(true);
    premiERilascia();
    expect(s.aspetto[k].eccitato).toBe(false);
    expect(s.aspetto[h].luminosita).toBe(0);
    expect(s.seriale.trim().split("\n").pop()).toContain("Lampadina spenta");
    expect(problemiArduino(s, schema, lib)).toEqual([]);
  });
});

describe("esempio del lampione con il plotter seriale", () => {
  it("al buio il LED si accende e il plotter trova le serie Luce e Soglia", () => {
    const { schema, s } = apri("arduino-lampione.elab");
    aspetta(s, 500);
    expect(s.errore).toBeNull();
    const ldr = id(schema, "fotoresistenza");
    // Luce media (0,5): sopra la soglia, LED spento.
    expect(luminosita(s, schema, "led-giallo")).toBe(0);
    clicGiuArduino(s, ldr, true);
    clicGiuArduino(s, ldr, true); // buio
    aspetta(s, 500);
    expect(luminosita(s, schema, "led-giallo")).toBeGreaterThan(0.5);
    const d = datiPlotter(s.seriale);
    expect(d.serie.map((x) => x.nome)).toEqual(["Luce", "Soglia"]);
    expect(d.serie[1].valori.every((v) => v === 500)).toBe(true);
    const luce = d.serie[0].valori.filter((v): v is number => v !== null);
    expect(Math.max(...luce)).toBeGreaterThan(500);
    expect(Math.min(...luce)).toBeLessThan(500);
  });
});

describe("esempi con i sensori nuovi", () => {
  it("antifurto: inclinato suona il buzzer, dritto tace", () => {
    const { schema, s } = apri("arduino-inclinazione.elab");
    aspetta(s, 300);
    const buzzer = id(schema, "buzzer");
    const vista = () => vistaDaSessioneArduino(s, schema, lib).componenti;
    expect(vista()[buzzer].arduino!.suona).toBe(false);
    clicGiuArduino(s, id(schema, "sensore-inclinazione"));
    aspetta(s, 300);
    expect(vista()[buzzer].arduino!.suona).toBe(true);
    expect(s.seriale).toContain("ALLARME");
    clicGiuArduino(s, id(schema, "sensore-inclinazione"));
    aspetta(s, 800);
    expect(vista()[buzzer].arduino!.suona).toBe(false);
  });

  it("sensore di forza: più si preme, più il LED è luminoso", () => {
    const { schema, s } = apri("arduino-forza.elab");
    aspetta(s, 300);
    const fsr = id(schema, "sensore-forza");
    expect(luminosita(s, schema, "led-rosso")).toBe(0);
    const livelli: number[] = [];
    for (let k = 0; k < 4; k++) {
      clicGiuArduino(s, fsr);
      aspetta(s, 300);
      livelli.push(luminosita(s, schema, "led-rosso"));
    }
    for (let k = 1; k < livelli.length; k++) expect(livelli[k]).toBeGreaterThanOrEqual(livelli[k - 1]);
    expect(livelli[3]).toBeGreaterThan(0.5);
    expect(vistaDaSessioneArduino(s, schema, lib).componenti[fsr].arduino!.posizione).toBe(1);
  });

  it("annaffiatoio: secco accende la pompa, con l'isteresi fra 300 e 600", () => {
    const { schema, s } = apri("arduino-annaffiatoio.elab");
    aspetta(s, 500);
    const sonda = id(schema, "sensore-umidita");
    const motore = id(schema, "motore-dc");
    const gira = () => (s.aspetto[motore]?.velocita ?? 0) !== 0;
    expect(gira()).toBe(false);
    clicGiuArduino(s, sonda, true);
    clicGiuArduino(s, sonda, true); // 0 %: secco
    aspetta(s, 500);
    expect(s.aspetto[id(schema, "modulo-rele")].eccitato).toBe(true);
    expect(gira()).toBe(true);
    clicGiuArduino(s, sonda);
    clicGiuArduino(s, sonda); // 50 %: fra le soglie, la pompa continua
    aspetta(s, 500);
    expect(gira()).toBe(true);
    clicGiuArduino(s, sonda); // 75 %: bagnato
    aspetta(s, 500);
    expect(gira()).toBe(false);
    expect(problemiArduino(s, schema, lib)).toEqual([]);
  });

  it("rilevatore di gas: oltre la soglia LED e buzzer", () => {
    const { schema, s } = apri("arduino-gas.elab");
    aspetta(s, 500);
    const gas = id(schema, "sensore-gas");
    const buzzer = id(schema, "buzzer");
    expect(luminosita(s, schema, "led-rosso")).toBe(0);
    clicGiuArduino(s, gas);
    aspetta(s, 400); // 25 %: sotto la soglia
    expect(luminosita(s, schema, "led-rosso")).toBe(0);
    clicGiuArduino(s, gas);
    aspetta(s, 400); // 50 %
    expect(luminosita(s, schema, "led-rosso")).toBeGreaterThan(0.5);
    expect(vistaDaSessioneArduino(s, schema, lib).componenti[buzzer].arduino!.suona).toBe(true);
  });
});

describe("esempio del ponte H L293D", () => {
  it("avanti veloce, avanti piano, fermo, indietro", () => {
    const { schema, s } = apri("arduino-ponte-h.elab");
    const motore = id(schema, "motore-dc");
    const ponte = id(schema, "l293d");
    const velocita = () => s.aspetto[motore]?.velocita ?? 0;
    aspetta(s, 1000);
    expect(s.errore).toBeNull();
    const veloce = velocita();
    expect(veloce).toBeGreaterThan(0.9);
    expect(s.aspetto[ponte].uscite!.slice(0, 2).map((u) => u.stato)).toEqual(["alto", "basso"]);
    expect(vistaDaSessioneArduino(s, schema, lib).componenti[ponte].arduino!.uscitePonte!.slice(0, 2)).toEqual(["alto", "basso"]);
    aspetta(s, 2000); // avanti piano (PWM 120 su EN)
    expect(velocita()).toBeGreaterThan(0.3);
    expect(velocita()).toBeLessThan(veloce);
    aspetta(s, 2000); // fermo
    expect(velocita()).toBe(0);
    aspetta(s, 1000); // indietro
    expect(velocita()).toBeLessThan(-0.9);
    expect(s.seriale).toContain("Indietro");
    expect(problemiArduino(s, schema, lib)).toEqual([]);
  });
});

describe("esempio della serratura con il tastierino", () => {
  it("1234# apre il chiavistello e accende il verde; un codice sbagliato accende il rosso", () => {
    const { schema, s } = apri("arduino-serratura.elab");
    aspetta(s, 300);
    expect(s.errore).toBeNull();
    const tastierino = id(schema, "tastierino");
    const servo = id(schema, "servo");
    const premi = (tasto: string) => {
      const k = TASTI_TASTIERINO.indexOf(tasto);
      const punto = { x: TASTIERINO_X0 + (k % 4) * TASTIERINO_L + 19, y: TASTIERINO_Y0 + Math.floor(k / 4) * TASTIERINO_H + 20 };
      clicGiuArduino(s, tastierino, false, punto);
      aspetta(s, 150);
      clicSuArduino(s, tastierino);
      aspetta(s, 150);
    };
    const angolo = () => vistaDaSessioneArduino(s, schema, lib).componenti[servo].arduino!.angolo;
    expect(angolo()).toBe(0);
    for (const t of "1234#") premi(t);
    expect(s.seriale).toContain("1234");
    expect(s.seriale).toContain("Codice giusto");
    expect(angolo()).toBe(90);
    expect(luminosita(s, schema, "led-verde")).toBeGreaterThan(0.5);
    aspetta(s, 3500);
    expect(angolo()).toBe(0);
    for (const t of "99#") premi(t);
    expect(s.seriale).toContain("Codice sbagliato!");
    expect(luminosita(s, schema, "led-rosso")).toBeGreaterThan(0.5);
    expect(problemiArduino(s, schema, lib)).toEqual([]);
  });
});

describe("esempio del registro a scorrimento 74HC595", () => {
  it("gli 8 LED mostrano il numero in binario", () => {
    const { schema, s } = apri("arduino-74hc595.elab");
    // LED da sinistra (Q7) a destra (Q0): sono posati da Q0 a Q7, quindi in ordine inverso.
    const led = schema.componenti.filter((c) => c.tipo === "led-rosso").map((c) => c.id);
    const bit = () => [...led].reverse().map((l) => ((s.aspetto[l]?.luminosita ?? 0) > 0.5 ? 1 : 0)).join("");
    aspetta(s, 100); // numero 0
    expect(bit()).toBe("00000000");
    aspetta(s, 1500); // 5 passi da 300 ms: numero 5
    expect(s.seriale.trim().split("\n").pop()).toBe("5 = 101");
    expect(bit()).toBe("00000101");
    aspetta(s, 300 * 8); // numero 13
    expect(bit()).toBe("00001101");
    expect(problemiArduino(s, schema, lib)).toEqual([]);
  });
});

describe("esempio della striscia NeoPixel", () => {
  it("8 LED con tinte diverse che scorrono", () => {
    const { schema, s } = apri("arduino-neopixel.elab");
    aspetta(s, 200);
    expect(s.errore).toBeNull();
    const striscia = id(schema, "striscia-neopixel");
    const colori = () => vistaDaSessioneArduino(s, schema, lib).componenti[striscia].arduino!.neopixel!;
    const primi = colori();
    expect(primi).toHaveLength(8);
    expect(new Set(primi).size).toBe(8); // tutte diverse
    expect(primi.every((c) => c > 0)).toBe(true);
    aspetta(s, 300);
    expect(colori()).not.toEqual(primi);
    expect(problemiArduino(s, schema, lib)).toEqual([]);
  });
});

describe("esempio dell'oscilloscopio", () => {
  it("lo schermo mostra l'onda quadra fra 0 V e 5 V", () => {
    const { schema, s } = apri("arduino-oscilloscopio.elab");
    aspetta(s, 1500);
    expect(s.errore).toBeNull();
    const x = id(schema, "oscilloscopio");
    const traccia = vistaDaSessioneArduino(s, schema, lib).componenti[x].arduino!.traccia!;
    const ys = traccia.filter((_, i) => i % 2 === 1);
    // 2 V/div su 80 unità (10 per divisione): 0 V a y = 40, 5 V a y = 15.
    expect(ys.some((y) => Math.abs(y - 40) < 0.5)).toBe(true);
    expect(ys.some((y) => Math.abs(y - 15) < 0.5)).toBe(true);
    expect(problemiArduino(s, schema, lib)).toEqual([]);
  });
});
