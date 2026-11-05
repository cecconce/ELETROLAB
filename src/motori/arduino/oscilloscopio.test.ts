// Test dell'oscilloscopio del modulo Arduino: campioni registrati e traccia.
import { describe, expect, it } from "vitest";
import type { ComponenteArduino } from "./componenti";
import { testoScala, tracciaOscilloscopio } from "./oscilloscopio";
import { avviaSessioneArduino, passoArduino } from "./sessione";

const nodi = (tabella: Record<string, string>) => (c: string, m: string) => tabella[`${c}.${m}`] ?? `${c}.${m}`;

describe("traccia dell'oscilloscopio", () => {
  it("a gradini: fronti verticali nel punto giusto, zero al centro", () => {
    // 0 V fino a 0,5 s, poi 5 V; finestra di 1 s (0,1 s/div), 1 V/div, schermo 100 × 80.
    const p = tracciaOscilloscopio([{ t: 0, v: 0 }, { t: 500000, v: 5 }], 1000000, 0.1, 2, 100, 80);
    expect(p.slice(0, 2)).toEqual([0, 40]); // inizio finestra a 0 V (centro)
    expect(p).toContain(50); // il fronte cade a metà schermo
    expect(p.slice(-2)).toEqual([100, 40 - 2.5 * 10]); // fine a 5 V con 2 V/div: 2,5 divisioni sopra il centro
  });

  it("tensioni fuori schermo tagliate al bordo; nessun campione: nessuna traccia", () => {
    const p = tracciaOscilloscopio([{ t: 0, v: 50 }], 1000, 0.001, 1, 100, 80);
    expect(Math.min(...p.filter((_, i) => i % 2 === 1))).toBe(0);
    expect(tracciaOscilloscopio([], 0, 0.1, 1, 100, 80)).toEqual([]);
    expect(testoScala(0.2, "s")).toBe("200 ms");
    expect(testoScala(0.5, "V")).toBe("0,5 V");
  });
});

describe("campioni registrati dalla sessione", () => {
  it("un pin che cambia ogni 100 ms dà un'onda quadra con i fronti al momento giusto", () => {
    const componenti: ComponenteArduino[] = [{ id: "U", tipo: "arduino-uno" }, { id: "X", tipo: "oscilloscopio" }];
    const s = avviaSessioneArduino(
      "void setup() { pinMode(8, OUTPUT); }\nvoid loop() { digitalWrite(8, HIGH); delay(100); digitalWrite(8, LOW); delay(100); }",
      componenti,
      nodi({ "U.D8": "p", "X.+": "p", "U.GND1": "g", "X.-": "g" }),
    );
    for (let k = 0; k < 20; k++) passoArduino(s, 50); // 1 s a passi da 50 ms (come l'interfaccia)
    const fronti = s.campioni.X.filter((c, i, a) => i > 0 && Math.abs(c.v - a[i - 1].v) > 0.5);
    expect(fronti.length).toBeGreaterThanOrEqual(9);
    // I fronti sono a multipli di 100 ms (entro pochi µs di istruzioni), non ai bordi dei passi da 50 ms.
    for (const f of fronti) expect(Math.abs(f.t / 1000 - Math.round(f.t / 100000) * 100)).toBeLessThan(1);
    expect(new Set(fronti.map((f) => Math.round(f.v)))).toEqual(new Set([0, 5]));
  });
});
