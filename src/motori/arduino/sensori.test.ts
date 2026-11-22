// Test dei sensori comandati con i clic e con i cursori continui: inclinazione, forza, umidità, gas, luce, PIR.
import { describe, expect, it } from "vitest";
import { letturaAnalogica, letturaDigitale, resistenzaFsr, risolviBanco, type ComponenteArduino, type Interazioni } from "./componenti";
import { avviaSessioneArduino, clicGiuArduino, CURSORE_Y, distanzaPirDaLivello, impostaLivelloSensore, livelloDaPunto, PIR_PORTATA, puntoDaLivello, SENSORI_A_CURSORE, trascinaArduino } from "./sessione";

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

  it("cursore come in Tinkercad: il clic sul sensore lo apre, il clic sulla barra sceglie il livello al centesimo", () => {
    const s = avviaSessioneArduino("void setup(){}\nvoid loop(){}", c, tab);
    const centro = SENSORI_A_CURSORE["sensore-umidita"];
    // Cursore chiuso: un clic sul sensore apre il cursore e non cambia il livello.
    clicGiuArduino(s, "H", false, { x: 40, y: 60 });
    expect(s.zoneAperte.has("H")).toBe(true);
    expect(s.interazioni.posizioni.H).toBeUndefined();
    // Clic sulla barra al 37 %, poi trascinamento al 82 %.
    clicGiuArduino(s, "H", false, { x: puntoDaLivello(0.37, centro), y: CURSORE_Y });
    expect(s.interazioni.posizioni.H).toBe(0.37);
    expect(letturaAnalogica(s.risultato, "a0")).toBe(Math.round(((4.5 * 0.37) / 5) * 1023));
    trascinaArduino(s, "H", { x: puntoDaLivello(0.82, centro), y: CURSORE_Y + 4 });
    expect(s.interazioni.posizioni.H).toBe(0.82);
    // Un nuovo clic sul sensore chiude il cursore: il trascinamento non agisce più.
    clicGiuArduino(s, "H", false, { x: 40, y: 60 });
    trascinaArduino(s, "H", { x: puntoDaLivello(0.1, centro), y: CURSORE_Y });
    expect(s.zoneAperte.has("H")).toBe(false);
    expect(s.interazioni.posizioni.H).toBe(0.82);
  });

  it("scala dei cursori: da 0 a 100 %, ogni centesimo raggiungibile, estremi fuori dalla barra", () => {
    for (const centro of Object.values(SENSORI_A_CURSORE)) {
      expect(livelloDaPunto(-1000, centro)).toBe(0);
      expect(livelloDaPunto(1000, centro)).toBe(1);
      for (let k = 0; k <= 100; k++) expect(livelloDaPunto(puntoDaLivello(k / 100, centro), centro)).toBe(k / 100);
    }
  });
});

describe("fotoresistenza", () => {
  it("il cursore regola la luce con continuità: più luce, resistenza più bassa", () => {
    const s = avviaSessioneArduino("void setup(){}\nvoid loop(){}", [{ id: "L", tipo: "fotoresistenza" }], nodi({}));
    impostaLivelloSensore(s, "L", 0.13);
    expect(s.interazioni.luce.L).toBe(0.13);
    impostaLivelloSensore(s, "L", 2);
    expect(s.interazioni.luce.L).toBe(1);
    impostaLivelloSensore(s, "L", -1);
    expect(s.interazioni.luce.L).toBe(0);
  });
});

describe("sensore PIR con il cursore della distanza", () => {
  const c: ComponenteArduino[] = [{ id: "U", tipo: "arduino-uno" }, { id: "P", tipo: "sensore-pir" }];
  const tab = nodi({ "U.5V": "v", "P.VCC": "v", "U.GND1": "g", "P.GND": "g", "P.OUT": "d2", "U.D2": "d2" });
  it("all'inizio nessuno è vicino; dentro la portata l'uscita va a HIGH, fuori torna LOW", () => {
    const s = avviaSessioneArduino("void setup(){}\nvoid loop(){}", c, tab);
    expect(letturaDigitale(s.risultato, "d2")).toBe(0);
    impostaLivelloSensore(s, "P", 0.35); // persona a 3,5 m
    expect(s.distanze.P).toBe(350);
    expect(letturaDigitale(s.risultato, "d2")).toBe(1);
    impostaLivelloSensore(s, "P", PIR_PORTATA / 1000 + 0.01); // appena fuori portata
    expect(letturaDigitale(s.risultato, "d2")).toBe(0);
    impostaLivelloSensore(s, "P", PIR_PORTATA / 1000); // proprio al limite: la vede
    expect(letturaDigitale(s.risultato, "d2")).toBe(1);
    expect(distanzaPirDaLivello(1)).toBe(1000);
  });
});
