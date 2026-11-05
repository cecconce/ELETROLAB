// Test del banco Arduino: nodi dal disegno (fili, piedini nei fori,
// breadboard), resistenze, sessione completa con programma e circuito.
import { describe, expect, it } from "vitest";
import { avviaSessioneArduino, clicGiuArduino, clicSuArduino, inviaSeriale, passoArduino, pinCollegato } from "../motori/arduino";
import { leggiProgetto, serializzaProgetto } from "../progetto/formato";
import { componentiDaSchema, fasceResistenza, leggiOhm, nodiDaSchema, scriviOhm, SKETCH_PREDEFINITO } from "./arduino";
import { libreriaDelModulo } from "./caricaLibreria";
import { collega } from "./fili";
import { vocePerTipo } from "./libreria";
import type { ComponenteSchema, Schema } from "./schema";

const lib = libreriaDelModulo("arduino");
const morsettiDi = (tipo: string) => vocePerTipo(lib, tipo)?.morsetti;

function comp(id: string, tipo: string, x: number, y: number, extra: Partial<ComponenteSchema> = {}): ComponenteSchema {
  const v = vocePerTipo(lib, tipo)!;
  return { id, tipo, etichetta: "", x, y, larghezza: v.larghezza, altezza: v.altezza, ...extra };
}

/** Posizione assoluta di un foro: per infilarci il piedino di un componente. */
function foro(bb: ComponenteSchema, nome: string) {
  const m = vocePerTipo(lib, "breadboard")!.morsetti.find((x) => x.id === nome)!;
  return { x: bb.x + m.x, y: bb.y + m.y };
}

function filo(schema: Schema, da: string, a: string): Schema {
  const [c1, m1] = da.split("/");
  const [c2, m2] = a.split("/");
  const r = collega(schema, { componente: c1, morsetto: m1 }, { componente: c2, morsetto: m2 }, morsettiDi);
  if (!r.ok) throw new Error(r.errore);
  return r.schema;
}

/** Circuito classico sulla breadboard: D13 → resistenza (fori a10…a14) → LED (e14/e16) → linea − → GND. */
function bancoBlink(): Schema {
  const bb = comp("BB", "breadboard", 400, 0);
  const a10 = foro(bb, "a10");
  const e14 = foro(bb, "e14");
  const componenti = [
    comp("U", "arduino-uno", 0, 400),
    bb,
    // resistenza: piedini a 80 unità (fori a10 e a14), morsetti a y=20 dentro il disegno
    comp("R", "resistenza", a10.x, a10.y - 20, { valore: 220 }),
    // LED: anodo in e14, catodo in e16 (piedini in basso, distanti 40)
    comp("L", "led-rosso", e14.x, e14.y - 80),
  ];
  let s: Schema = { componenti, fili: [] };
  s = filo(s, "U/D13", "BB/b10");
  s = filo(s, "BB/c16", "BB/Am16");
  s = filo(s, "BB/Am1", "U/GND1");
  return s;
}

describe("nodi dal disegno", () => {
  it("piedini nei fori, fori della stessa colonna e cavetti formano un unico nodo", () => {
    const s = bancoBlink();
    const nodo = nodiDaSchema(s, morsettiDi);
    expect(nodo("U", "D13")).toBe(nodo("R", "1")); // cavetto in b10, resistenza in a10
    expect(nodo("R", "2")).toBe(nodo("L", "A")); // a14 ed e14: stessa colonna
    expect(nodo("L", "K")).toBe(nodo("U", "GND1")); // e16 → c16 → linea − → GND
    expect(nodo("R", "1")).not.toBe(nodo("R", "2"));
    expect(nodo("BB", "a1")).not.toBe(nodo("BB", "f1")); // il solco separa
  });

  it("i LED portano il colore nel tipo", () => {
    expect(componentiDaSchema(bancoBlink()).find((c) => c.id === "L")).toEqual({ id: "L", tipo: "led", colore: "rosso" });
  });
});

describe("resistenze", () => {
  it("valori scritti come a scuola", () => {
    expect(leggiOhm("220")).toBe(220);
    expect(leggiOhm("1k")).toBe(1000);
    expect(leggiOhm("4,7k")).toBe(4700);
    expect(leggiOhm("4k7")).toBe(4700);
    expect(leggiOhm("10 kΩ")).toBe(10000);
    expect(leggiOhm("1M")).toBe(1e6);
    expect(leggiOhm("abc")).toBeNull();
    expect(leggiOhm("0")).toBeNull();
    expect(scriviOhm(4700)).toBe("4,7 kΩ");
    expect(scriviOhm(220)).toBe("220 Ω");
  });

  it("fasce colorate: 220 Ω rosso rosso marrone, 10 kΩ marrone nero arancione", () => {
    expect(fasceResistenza(220).slice(0, 3)).toEqual(["#e53935", "#e53935", "#795548"]);
    expect(fasceResistenza(10000).slice(0, 3)).toEqual(["#795548", "#000000", "#fb8c00"]);
    expect(fasceResistenza(4700).slice(0, 3)).toEqual(["#fdd835", "#8e24aa", "#e53935"]);
  });
});

describe("simulazione del banco", () => {
  it("Blink sulla breadboard: il LED si accende e si spegne ogni secondo", () => {
    const s = bancoBlink();
    const sess = avviaSessioneArduino(SKETCH_PREDEFINITO, componentiDaSchema(s), nodiDaSchema(s, morsettiDi));
    expect(sess.errore).toBeNull();
    passoArduino(sess, 500);
    expect(sess.aspetto.L.luminosita).toBeGreaterThan(0.5);
    passoArduino(sess, 1000);
    expect(sess.aspetto.L.luminosita).toBe(0);
  });

  it("errore nel programma: la simulazione non parte e spiega la riga", () => {
    const s = bancoBlink();
    const sess = avviaSessioneArduino("void setup() {\n  pinMode(13, OUTPUT)\n}\nvoid loop() {}", componentiDaSchema(s), nodiDaSchema(s, morsettiDi));
    expect(sess.errore?.riga).toBe(2);
    passoArduino(sess, 100);
    expect(sess.aspetto.L.luminosita).toBe(0);
  });

  it("pulsante sulla breadboard con INPUT_PULLUP accende il LED della scheda", () => {
    const bb = comp("BB", "breadboard", 400, 0);
    const e20 = foro(bb, "e20");
    // pulsante a cavallo del solco: 1a=e20, 2a=e22, 1b=f20, 2b=f22
    let s: Schema = { componenti: [comp("U", "arduino-uno", 0, 400), bb, comp("S", "pulsante", e20.x, e20.y)], fili: [] };
    s = filo(s, "U/D2", "BB/a20");
    s = filo(s, "BB/a22", "U/GND2");
    const codice = `void setup(){ pinMode(2, INPUT_PULLUP); pinMode(13, OUTPUT); Serial.begin(9600); }
      void loop(){ digitalWrite(13, digitalRead(2) == LOW); }`;
    const sess = avviaSessioneArduino(codice, componentiDaSchema(s), nodiDaSchema(s, morsettiDi));
    passoArduino(sess, 50);
    expect(sess.pin.D13.livello).toBe(0);
    clicGiuArduino(sess, "S");
    passoArduino(sess, 50);
    expect(sess.pin.D13.livello).toBe(1);
    clicSuArduino(sess, "S");
    passoArduino(sess, 50);
    expect(sess.pin.D13.livello).toBe(0);
  });

  it("potenziometro su A0 letto dal programma e scritto sul monitor seriale", () => {
    let s: Schema = { componenti: [comp("U", "arduino-uno", 0, 0), comp("P", "potenziometro", 600, 0)], fili: [] };
    s = filo(s, "P/1", "U/GND1");
    s = filo(s, "P/2", "U/5V");
    s = filo(s, "P/W", "U/A0");
    const sess = avviaSessioneArduino(
      `void setup(){ Serial.begin(9600); } void loop(){ Serial.println(analogRead(A0)); delay(100); }`,
      componentiDaSchema(s),
      nodiDaSchema(s, morsettiDi),
    );
    passoArduino(sess, 50);
    clicGiuArduino(sess, "P"); // 0,5 → 0,6
    passoArduino(sess, 100);
    const valori = sess.seriale.trim().split("\n").map(Number);
    expect(valori[0]).toBeGreaterThan(500);
    expect(valori[0]).toBeLessThan(520);
    expect(valori[1]).toBeGreaterThan(600);
  });

  it("servo collegato al pin 9 e monitor seriale in ingresso", () => {
    let s: Schema = { componenti: [comp("U", "arduino-uno", 0, 0), comp("M", "servo", 600, 0)], fili: [] };
    s = filo(s, "M/SIG", "U/D9");
    s = filo(s, "M/5V", "U/5V");
    s = filo(s, "M/GND", "U/GND1");
    const sess = avviaSessioneArduino(
      `#include <Servo.h>
       Servo s;
       void setup(){ s.attach(9); Serial.begin(9600); }
       void loop(){ if (Serial.available()) { s.write(Serial.parseInt()); } }`,
      componentiDaSchema(s),
      nodiDaSchema(s, morsettiDi),
    );
    passoArduino(sess, 20);
    inviaSeriale(sess, "120");
    passoArduino(sess, 20);
    expect(pinCollegato(sess, "M", "SIG")).toBe("D9");
    expect(sess.servi.D9).toBe(120);
    expect(sess.aspetto.M.alimentato).toBe(true);
  });

  it("il programma si salva nel file .elab insieme al banco", () => {
    const s = { ...bancoBlink(), codice: SKETCH_PREDEFINITO };
    const riletto = leggiProgetto(serializzaProgetto({ modulo: "arduino", schema: s }, "0.1.0"));
    expect(riletto.ok && riletto.progetto.schema.codice).toBe(SKETCH_PREDEFINITO);
    expect(riletto.ok && riletto.progetto.schema.componenti.find((c) => c.id === "R")?.valore).toBe(220);
  });
});

describe("vista e problemi del banco", () => {
  it("LED acceso nella vista, LED L della scheda col pin 13, problemi spiegati", async () => {
    const { vistaDaSessioneArduino } = await import("./arduino");
    const s = bancoBlink();
    const sess = avviaSessioneArduino(SKETCH_PREDEFINITO, componentiDaSchema(s), nodiDaSchema(s, morsettiDi));
    passoArduino(sess, 200);
    const v = vistaDaSessioneArduino(sess, s, lib);
    expect(v.componenti.L.arduino?.luminosita).toBeGreaterThan(0.5);
    expect(v.componenti.U.arduino?.ledL).toBe(true);
    expect(v.problemiPlc).toEqual([]);
  });

  it("LED senza resistenza: «si è bruciato» con la corrente", async () => {
    const { problemiArduino } = await import("./arduino");
    let s: Schema = { componenti: [comp("U", "arduino-uno", 0, 0), comp("L", "led-verde", 600, 0)], fili: [] };
    s = filo(s, "U/D13", "L/A");
    s = filo(s, "L/K", "U/GND1");
    const sess = avviaSessioneArduino(SKETCH_PREDEFINITO, componentiDaSchema(s), nodiDaSchema(s, morsettiDi));
    passoArduino(sess, 200);
    const p = problemiArduino(sess, s, lib);
    expect(p).toHaveLength(1);
    expect(p[0].testo).toMatch(/LED verde si è bruciato: ci passano \d+ mA/);
    expect(p[0].componenti).toEqual(["L"]);
  });

  it("senza scheda: avviso; errore nel codice: riga e spiegazione", async () => {
    const { problemiArduino } = await import("./arduino");
    const s: Schema = { componenti: [comp("L", "led-blu", 0, 0)], fili: [] };
    const sess = avviaSessioneArduino("void setup() {\n  int x = ;\n}\nvoid loop(){}", componentiDaSchema(s), nodiDaSchema(s, morsettiDi));
    const testi = problemiArduino(sess, s, lib).map((p) => p.testo);
    expect(testi[0]).toMatch(/^Riga 2 del programma/);
    expect(testi[1]).toMatch(/non c'è la scheda/);
  });
});

describe("display LCD e sensore a ultrasuoni", () => {
  /** Display collegato come negli esempi: RS=12, E=11, D4–D7 = 5, 4, 3, 2. */
  function bancoLcd(rs = "D12"): Schema {
    let s: Schema = { componenti: [comp("U", "arduino-uno", 0, 0), comp("D", "lcd", 600, 0), comp("R", "resistenza", 600, 300, { valore: 220 })], fili: [] };
    for (const [da, a] of [
      ["D/VSS", "U/GND1"], ["D/RW", "U/GND2"], ["D/VDD", "U/5V"], ["D/K", "U/GND3"], ["D/A", "R/1"], ["R/2", "U/3V3"],
      ["D/RS", `U/${rs}`], ["D/E", "U/D11"], ["D/D4", "U/D5"], ["D/D5", "U/D4"], ["D/D6", "U/D3"], ["D/D7", "U/D2"],
    ]) s = filo(s, da, a);
    return s;
  }
  const codiceLcd = `#include <LiquidCrystal.h>
    LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
    void setup() { lcd.begin(16, 2); lcd.print("Ciao, mondo!"); }
    void loop() { lcd.setCursor(0, 1); lcd.print(millis() / 1000); }`;

  it("il display collegato bene mostra il testo, con la retroilluminazione", async () => {
    const { vistaDaSessioneArduino, problemiArduino } = await import("./arduino");
    const s = bancoLcd();
    const sess = avviaSessioneArduino(codiceLcd, componentiDaSchema(s), nodiDaSchema(s, morsettiDi));
    // A passi da 50 ms come l'interfaccia (un loop senza delay esegue moltissime istruzioni).
    for (let i = 0; i < 42; i++) passoArduino(sess, 50);
    const v = vistaDaSessioneArduino(sess, s, lib);
    expect(v.componenti.D.arduino?.righe).toEqual(["Ciao, mondo!    ", "2               "]);
    expect(v.componenti.D.arduino?.retro).toBeGreaterThan(0);
    expect(problemiArduino(sess, s, lib)).toEqual([]);
  });

  it("RS collegato al pin sbagliato: display vuoto e spiegazione", async () => {
    const { vistaDaSessioneArduino, problemiArduino } = await import("./arduino");
    const s = bancoLcd("D10");
    const sess = avviaSessioneArduino(codiceLcd, componentiDaSchema(s), nodiDaSchema(s, morsettiDi));
    passoArduino(sess, 100);
    expect(vistaDaSessioneArduino(sess, s, lib).componenti.D.arduino?.righe).toEqual([]);
    expect(problemiArduino(sess, s, lib)[0].testo).toMatch(/RS sul pin 12 ed E sul pin 11/);
  });

  it("ultrasuoni: pulseIn misura la distanza scelta con il clic", () => {
    let s: Schema = { componenti: [comp("U", "arduino-uno", 0, 0), comp("S", "ultrasuoni", 600, 0)], fili: [] };
    s = filo(s, "S/VCC", "U/5V");
    s = filo(s, "S/GND", "U/GND1");
    s = filo(s, "S/TRIG", "U/D9");
    s = filo(s, "S/ECHO", "U/D10");
    const codice = `void setup(){ Serial.begin(9600); pinMode(9, OUTPUT); pinMode(10, INPUT); }
      void loop(){ digitalWrite(9, HIGH); delayMicroseconds(10); digitalWrite(9, LOW);
        long durata = pulseIn(10, HIGH); Serial.println(durata / 58); delay(200); }`;
    const sess = avviaSessioneArduino(codice, componentiDaSchema(s), nodiDaSchema(s, morsettiDi));
    passoArduino(sess, 100);
    clicGiuArduino(sess, "S"); // 50 → 100 cm
    passoArduino(sess, 300);
    const valori = sess.seriale.trim().split("\n").map(Number);
    expect(valori[0]).toBe(50);
    expect(valori[valori.length - 1]).toBe(100);
  });
});

describe("transistor, diodo e alimentatore sul banco", () => {
  const acceso = "void setup() { pinMode(9, OUTPUT); digitalWrite(9, HIGH); }\nvoid loop() {}";

  it("base collegata al pin senza resistenza: avviso in italiano", async () => {
    const { problemiArduino } = await import("./arduino");
    let s: Schema = {
      componenti: [comp("U", "arduino-uno", 0, 0), comp("Q", "transistor-npn", 600, 0, { etichetta: "Q1" })],
      fili: [],
    };
    s = filo(s, "U/D9", "Q/B");
    s = filo(s, "Q/E", "U/GND1");
    const sess = avviaSessioneArduino(acceso, componentiDaSchema(s), nodiDaSchema(s, morsettiDi));
    passoArduino(sess, 100);
    const p = problemiArduino(sess, s, lib);
    expect(p.map((x) => x.chiave)).toContain("base-Q");
    expect(p.find((x) => x.chiave === "base-Q")!.testo).toMatch(/Nella base del transistor Q1 passano \d+ mA/);
  });

  it("collettore in corto sull'alimentatore: il transistor si surriscalda", async () => {
    const { problemiArduino, vistaDaSessioneArduino } = await import("./arduino");
    let s: Schema = {
      componenti: [
        comp("U", "arduino-uno", 0, 0),
        comp("Q", "transistor-npn", 600, 0, { etichetta: "Q1" }),
        comp("R", "resistenza", 600, 200, { valore: 220 }),
        comp("PS", "alimentatore", 800, 0, { etichetta: "PS1", parametri: { tensione: 12, correnteMax: 3 } }),
      ],
      fili: [],
    };
    s = filo(s, "U/D9", "R/1");
    s = filo(s, "R/2", "Q/B");
    s = filo(s, "Q/E", "U/GND1");
    s = filo(s, "PS/+", "Q/C");
    s = filo(s, "PS/-", "U/GND2");
    const sess = avviaSessioneArduino(acceso, componentiDaSchema(s), nodiDaSchema(s, morsettiDi));
    passoArduino(sess, 100);
    // Ib ≈ 17 mA → β·Ib ≈ 1,7 A: oltre gli 800 mA del transistor piccolo.
    const p = problemiArduino(sess, s, lib);
    expect(p.find((x) => x.chiave === "bruciato-Q")!.testo).toMatch(/Il transistor Q1 si surriscalda/);
    expect(vistaDaSessioneArduino(sess, s, lib).componenti.Q.arduino!.bruciato).toBe(true);
  });

  it("il diodo conduce in un solo verso", async () => {
    const { vistaDaSessioneArduino } = await import("./arduino");
    const banco = (inverso: boolean) => {
      let s: Schema = {
        componenti: [comp("PS", "alimentatore", 0, 0), comp("D", "diodo", 300, 0), comp("R", "resistenza", 300, 200, { valore: 1000 })],
        fili: [],
      };
      s = filo(s, "PS/+", inverso ? "D/K" : "D/A");
      s = filo(s, inverso ? "D/A" : "D/K", "R/1");
      s = filo(s, "R/2", "PS/-");
      const sess = avviaSessioneArduino("void setup(){}\nvoid loop(){}", componentiDaSchema(s), nodiDaSchema(s, morsettiDi));
      passoArduino(sess, 50);
      return vistaDaSessioneArduino(sess, s, lib).componenti.PS.arduino!.alimentatore!.ampere;
    };
    // (5 − 0,7) / 1000 ≈ 4,3 mA in diretta, niente al contrario.
    expect(banco(false)).toBeCloseTo(0.0043, 4);
    expect(banco(true)).toBe(0);
  });
});
