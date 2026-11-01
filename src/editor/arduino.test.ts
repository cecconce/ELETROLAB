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
