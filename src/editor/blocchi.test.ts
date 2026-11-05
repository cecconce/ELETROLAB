// Test dell'editor a blocchi: il codice generato è corretto e gira nell'interprete.
import { describe, expect, it } from "vitest";
import { analizzaSketch, preparaSketch, type Hardware } from "../motori/arduino";
import { BLOCCHI_INIZIALI, caricaBlockly, CASSETTA, codiceDaBlocchi } from "./blocchi";

/** Genera il codice da un programma a blocchi scritto in JSON. */
async function genera(json: object): Promise<string> {
  const Blockly = await caricaBlockly();
  const ws = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(json, ws);
  return codiceDaBlocchi(Blockly, ws);
}

const num = (n: number) => ({ shadow: { type: "math_number", fields: { NUM: n } } });
const catena = (...blocchi: Record<string, unknown>[]): Record<string, unknown> =>
  blocchi.reduceRight<Record<string, unknown> | null>((dopo, b) => (dopo ? { ...b, next: { block: dopo } } : b), null)!;

function scheda() {
  const pin: Record<string, number> = {};
  const modi: Record<string, string> = {};
  let seriale = "";
  const servo: Record<string, number> = {};
  const hw: Hardware = {
    pinMode: (p, m) => void (modi[p] = m),
    digitalWrite: (p, v) => void (pin[p] = v),
    digitalRead: () => 0,
    analogRead: () => 1023,
    analogWrite: (p, v) => void (pin[p] = v),
    tone: () => {},
    noTone: () => {},
    serialScrivi: (t) => void (seriale += t),
    serialLeggi: () => -1,
    serialDisponibili: () => 0,
    servo: (p, a) => void (servo[p] = a),
    lcd: () => {},
    pulseIn: () => 580,
  };
  return { hw, pin, modi, servo, get seriale() { return seriale; } };
}

describe("editor a blocchi", () => {
  it("la cassetta ha le categorie in italiano", () => {
    expect(CASSETTA.contents.map((c) => c.name)).toEqual(["Uscite", "Ingressi", "Dispositivi", "Tempo", "Controllo", "Logica", "Matematica", "Variabili"]);
  });

  it("il programma iniziale (Blink) diventa codice Arduino che fa lampeggiare il pin 13", async () => {
    const codice = await genera(BLOCCHI_INIZIALI);
    expect(codice).toContain("pinMode(13, OUTPUT);");
    expect(codice).toContain("digitalWrite(13, HIGH);");
    expect(codice).toContain("delay(1000);");
    const s = scheda();
    const e = preparaSketch(codice, s.hw);
    e.avanza(500);
    expect(s.pin.D13).toBe(1);
    e.avanza(1000);
    expect(s.pin.D13).toBe(0);
  });

  it("pulsante, if/altrimenti, variabili, ripeti, seriale, servo e mappa", async () => {
    const json = {
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: "ard_avvio",
            inputs: { CORPO: { block: { type: "variables_set", fields: { VAR: { id: "v1" } }, inputs: { VALUE: { block: { type: "math_number", fields: { NUM: 0 } } } } } } },
          },
          {
            type: "ard_ripeti",
            y: 200,
            inputs: {
              CORPO: {
                block: catena(
                  {
                    type: "controls_if",
                    extraState: { hasElse: true },
                    inputs: {
                      IF0: { block: { type: "ard_pulsante", fields: { PIN: "2" } } },
                      DO0: { block: { type: "ard_scrivi_digitale", fields: { PIN: "13", STATO: "HIGH" } } },
                      ELSE: { block: { type: "ard_scrivi_digitale", fields: { PIN: "13", STATO: "LOW" } } },
                    },
                  },
                  {
                    type: "controls_repeat_ext",
                    inputs: { TIMES: num(3), DO: { block: { type: "math_change", fields: { VAR: { id: "v1" } }, inputs: { DELTA: num(1) } } } },
                  },
                  { type: "ard_seriale", fields: { A_CAPO: "SI" }, inputs: { TESTO: { block: { type: "variables_get", fields: { VAR: { id: "v1" } } } } } },
                  {
                    type: "ard_servo",
                    fields: { PIN: "9" },
                    inputs: {
                      ANGOLO: {
                        block: {
                          type: "ard_mappa",
                          inputs: { VALORE: { block: { type: "ard_leggi_analogico", fields: { PIN: "A0" } } }, DA_MIN: num(0), DA_MAX: num(1023), A_MIN: num(0), A_MAX: num(180) },
                        },
                      },
                    },
                  },
                  { type: "ard_attendi", inputs: { SECONDI: num(0.5) } },
                ),
              },
            },
          },
        ],
      },
      variables: [{ name: "conteggio", id: "v1" }],
    };
    const codice = await genera(json);
    expect(codice).toContain("int conteggio = 0;");
    expect(codice).toContain("pinMode(2, INPUT_PULLUP);");
    expect(codice).toContain("Serial.begin(9600);");
    expect(codice).toContain("servo9.attach(9);");
    expect(codice).toContain("if (digitalRead(2) == LOW) {");
    expect(codice).toContain("delay(500);");
    expect(() => analizzaSketch(codice)).not.toThrow();
    const s = scheda();
    const e = preparaSketch(codice, s.hw);
    e.avanza(1200);
    expect(e.errore).toBeNull();
    // digitalRead finto = 0 → pulsante premuto → LED acceso; il conteggio cresce di 3 a ogni giro.
    expect(s.pin.D13).toBe(1);
    expect(s.seriale.split("\n").slice(0, 3)).toEqual(["3", "6", "9"]);
    expect(s.servo.D9).toBe(180);
  });

  it("display, distanza a ultrasuoni, suono e operazioni matematiche", async () => {
    const json = {
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: "ard_ripeti",
            inputs: {
              CORPO: {
                block: catena(
                  { type: "ard_lcd", fields: { RIGA: "1", COLONNA: 3 }, inputs: { TESTO: { block: { type: "ard_distanza", fields: { TRIG: "7", ECHO: "8" } } } } },
                  { type: "ard_tono", fields: { PIN: "6" }, inputs: { FREQ: { block: { type: "math_arithmetic", fields: { OP: "MULTIPLY" }, inputs: { A: num(220), B: num(2) } } } } },
                  { type: "ard_attendi", inputs: { SECONDI: num(1) } },
                ),
              },
            },
          },
        ],
      },
    };
    const codice = await genera(json);
    expect(codice).toContain("#include <LiquidCrystal.h>");
    expect(codice).toContain("long distanzaCm(int trig, int echo)");
    expect(codice).toContain("lcd.setCursor(2, 1);");
    expect(codice).toContain("tone(6, 220 * 2);");
    expect(() => analizzaSketch(codice)).not.toThrow();
  });

  it("area di lavoro vuota: programma valido che non fa niente", async () => {
    const codice = await genera({ blocks: { languageVersion: 0, blocks: [] } });
    expect(() => analizzaSketch(codice)).not.toThrow();
  });

  it("striscia NeoPixel e registro 74HC595: dichiarazioni, begin e shiftOut scritti da soli", async () => {
    const json = {
      blocks: {
        languageVersion: 0,
        blocks: [
          { type: "ard_avvio" },
          {
            type: "ard_ripeti",
            y: 200,
            inputs: {
              CORPO: {
                block: catena(
                  { type: "ard_neopixel_colore", fields: { PIN: "6" }, inputs: { LED: num(2), R: num(0), G: num(255), B: num(0) } },
                  { type: "ard_neopixel_mostra", fields: { PIN: "6" } },
                  { type: "ard_registro", fields: { DATI: "11", CLOCK: "12", LATCH: "8" }, inputs: { VALORE: num(5) } },
                  { type: "ard_attendi", inputs: { SECONDI: num(1) } },
                ),
              },
            },
          },
        ],
      },
    };
    const codice = await genera(json);
    expect(codice).toContain("#include <Adafruit_NeoPixel.h>");
    expect(codice).toContain("Adafruit_NeoPixel striscia6(8, 6, NEO_GRB + NEO_KHZ800);");
    expect(codice).toContain("striscia6.begin();");
    expect(codice).toContain("striscia6.setPixelColor(1, 0, 255, 0);");
    expect(codice).toContain("shiftOut(11, 12, MSBFIRST, 5);");
    expect(codice).toContain("pinMode(8, OUTPUT);");
    // Il codice generato gira nell'interprete.
    const s = scheda();
    const inviati: number[][] = [];
    s.hw.neopixel = (_pin, colori) => void inviati.push(colori);
    const e = preparaSketch(codice, s.hw);
    e.avanza(100);
    expect(e.errore).toBeNull();
    expect(inviati[0]).toEqual([0, 0x00ff00, 0, 0, 0, 0, 0, 0]);
    expect(s.pin.D8).toBe(1);
  });
});
