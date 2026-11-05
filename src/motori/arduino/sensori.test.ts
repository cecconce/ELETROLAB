// Test dei sensori comandati con i clic: inclinazione, forza, umidità, gas.
import { describe, expect, it } from "vitest";
import { letturaAnalogica, letturaDigitale, resistenzaFsr, risolviBanco, type ComponenteArduino, type Interazioni } from "./componenti";
import { avviaSessioneArduino, clicGiuArduino } from "./sessione";

const nodi = (tabella: Record<string, string>) => (c: string, m: string) => tabella[`${c}.${m}`] ?? `${c}.${m}`;
const interazioni = (posizioni: Record<string, number> = {}): Interazioni => ({ premuti: new Set(), posizioni, luce: {} });

describe("sensore di inclinazione", () => {
  const c: ComponenteArduino[] = [{ id: "U", tipo: "arduino-uno" }, { id: "S", tipo: "sensore-inclinazione" }];
  const tab = nodi({ "U.D2": "in", "S.1": "in", "S.2": "g", "U.GND1": "g" });
  const pin = { D2: { modo: "INPUT_PULLUP" as const, livello: 0 } };
  it("dritto è chiuso (LOW con il pull-up), inclinato è aperto (HIGH)", () => {
    expect(letturaDigitale(risolviBanco(c, tab, pin, interazioni()).risultato, "in")).toBe(0);
    expect(letturaDigitale(risolviBanco(c, tab, pin, interazioni({ S: 1 })).risultato, "in")).toBe(1);
  });
});

describe("sensore di forza", () => {
  it("senza pressione quasi aperto, premuto a fondo 250 Ω, in mezzo sempre meno", () => {
    expect(resistenzaFsr(0)).toBeGreaterThan(1e6);
    expect(resistenzaFsr(1)).toBeCloseTo(250, 6);
    expect(resistenzaFsr(0.25)).toBeGreaterThan(resistenzaFsr(0.5));
    expect(resistenzaFsr(0.5)).toBeGreaterThan(resistenzaFsr(0.75));
  });
});

describe("moduli con uscita analogica", () => {
  const c: ComponenteArduino[] = [{ id: "U", tipo: "arduino-uno" }, { id: "H", tipo: "sensore-umidita" }, { id: "G", tipo: "sensore-gas" }];
  const tab = nodi({ "U.5V": "v", "H.VCC": "v", "G.VCC": "v", "U.GND1": "g", "H.GND": "g", "G.GND": "g", "H.SIG": "a0", "U.A0": "a0", "G.AO": "a1", "U.A1": "a1" });
  it("umidità: 0 V secco, 4,5 V bagnato; gas: 0,4 V in aria pulita", () => {
    const secco = risolviBanco(c, tab, {}, interazioni({ H: 0 })).risultato;
    expect(letturaAnalogica(secco, "a0")).toBe(0);
    expect(letturaAnalogica(secco, "a1")).toBe(Math.round((0.4 / 5) * 1023));
    const bagnato = risolviBanco(c, tab, {}, interazioni({ H: 1, G: 1 })).risultato;
    expect(letturaAnalogica(bagnato, "a0")).toBe(Math.round((4.5 / 5) * 1023));
    expect(letturaAnalogica(bagnato, "a1")).toBe(Math.round((4.6 / 5) * 1023));
  });

  it("i clic cambiano il livello a passi del 25 %, senza ricominciare dal fondo", () => {
    const s = avviaSessioneArduino("void setup(){}\nvoid loop(){}", c, tab);
    clicGiuArduino(s, "H"); // 50 % → 75 %
    expect(s.interazioni.posizioni.H).toBe(0.75);
    clicGiuArduino(s, "H");
    clicGiuArduino(s, "H"); // resta al 100 %
    expect(s.interazioni.posizioni.H).toBe(1);
    for (let k = 0; k < 6; k++) clicGiuArduino(s, "G", true); // resta a 0
    expect(s.interazioni.posizioni.G).toBe(0);
  });
});

describe("fotoresistenza", () => {
  it("i clic si fermano al buio e al pieno sole, senza ricominciare dall'altra parte", () => {
    const s = avviaSessioneArduino("void setup(){}\nvoid loop(){}", [{ id: "L", tipo: "fotoresistenza" }], nodi({}));
    for (let k = 0; k < 5; k++) clicGiuArduino(s, "L", true);
    expect(s.interazioni.luce.L).toBe(0);
    for (let k = 0; k < 6; k++) clicGiuArduino(s, "L");
    expect(s.interazioni.luce.L).toBe(1);
  });
});
