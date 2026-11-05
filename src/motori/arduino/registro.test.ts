// Test del registro a scorrimento 74HC595 e di shiftOut.
import { describe, expect, it } from "vitest";
import type { ComponenteArduino } from "./componenti";
import { avviaSessioneArduino, bitRegistro, passoArduino } from "./sessione";

const nodi = (tabella: Record<string, string>) => (c: string, m: string) => tabella[`${c}.${m}`] ?? `${c}.${m}`;
const componenti: ComponenteArduino[] = [
  { id: "U", tipo: "arduino-uno" },
  { id: "R", tipo: "74hc595" },
];
/** DS = 11, SH_CP = 12, ST_CP = 8; MR e OE ai pin 7 e 6 (per provarli), oppure fissi. */
const collegamenti = (fissi = true): Record<string, string> => ({
  "U.5V": "v5",
  "R.VCC": "v5",
  "U.GND1": "g",
  "R.GND": "g",
  "U.D11": "ds",
  "R.DS": "ds",
  "U.D12": "sh",
  "R.SHCP": "sh",
  "U.D8": "st",
  "R.STCP": "st",
  ...(fissi ? { "R.MR": "v5", "R.OE": "g" } : { "U.D7": "mr", "R.MR": "mr", "U.D6": "oe", "R.OE": "oe" }),
});
const sketch = (setup: string) => `void setup() { pinMode(11, OUTPUT); pinMode(12, OUTPUT); pinMode(8, OUTPUT); pinMode(7, OUTPUT); pinMode(6, OUTPUT); ${setup} }\nvoid loop() {}`;

describe("74HC595", () => {
  it("shiftOut con MSBFIRST e un impulso sul latch: le uscite mostrano il valore", () => {
    const s = avviaSessioneArduino(sketch("shiftOut(11, 12, MSBFIRST, 0b10110001); digitalWrite(8, HIGH);"), componenti, nodi(collegamenti()));
    passoArduino(s, 10);
    expect(s.errore).toBeNull();
    expect(bitRegistro(s, "R")).toBe("10110001");
    // Q0 a 5 V, Q1 a 0 V.
    expect(s.risultato.tensioni[s.nodoDi("R", "Q0")]).toBeCloseTo(5, 1);
    expect(s.risultato.tensioni[s.nodoDi("R", "Q1")] ?? 0).toBeCloseTo(0, 1);
  });

  it("senza il fronte del latch le uscite non cambiano; LSBFIRST rovescia l'ordine", () => {
    const s = avviaSessioneArduino(sketch("shiftOut(11, 12, LSBFIRST, 0b00000011);"), componenti, nodi(collegamenti()));
    passoArduino(s, 10);
    expect(bitRegistro(s, "R")).toBe("00000000");
    const t = avviaSessioneArduino(sketch("shiftOut(11, 12, LSBFIRST, 0b00000011); digitalWrite(8, HIGH);"), componenti, nodi(collegamenti()));
    passoArduino(t, 10);
    expect(bitRegistro(t, "R")).toBe("11000000");
  });

  it("MR a LOW azzera il registro; OE a HIGH scollega le uscite", () => {
    const s = avviaSessioneArduino(
      sketch("digitalWrite(7, HIGH); shiftOut(11, 12, MSBFIRST, 255); digitalWrite(7, LOW); digitalWrite(7, HIGH); digitalWrite(8, HIGH);"),
      componenti,
      nodi(collegamenti(false)),
    );
    passoArduino(s, 10);
    expect(bitRegistro(s, "R")).toBe("00000000");
    const t = avviaSessioneArduino(sketch("digitalWrite(7, HIGH); digitalWrite(6, HIGH); shiftOut(11, 12, MSBFIRST, 255); digitalWrite(8, HIGH);"), componenti, nodi(collegamenti(false)));
    passoArduino(t, 10);
    expect(bitRegistro(t, "R")).toBe("11111111");
    expect(t.interazioni.registri.R.abilitato).toBe(false);
    expect(t.risultato.tensioni[t.nodoDi("R", "Q0")] ?? 0).toBeLessThan(0.1);
  });
});
