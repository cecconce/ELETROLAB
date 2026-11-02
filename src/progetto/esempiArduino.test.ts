// Test dell'attività 5.5: gli esempi pronti del modulo Arduino si aprono senza
// problemi e funzionano come descritto in "Come provarlo".
import { describe, expect, it } from "vitest";
import { ESEMPI } from "./caricaEsempi";
import { apriEsempio } from "./esempi";
import type { Schema } from "../editor/schema";
import { componentiDaSchema, nodiDaSchema, problemiArduino, vistaDaSessioneArduino } from "../editor/arduino";
import { libreriaDelModulo } from "../editor/caricaLibreria";
import { vocePerTipo } from "../editor/libreria";
import { avviaSessioneArduino, clicGiuArduino, clicSuArduino, passoArduino, type SessioneArduino } from "../motori/arduino";

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
  it("ci sono i 7 esempi, tutti senza errori né problemi all'avvio", () => {
    const arduino = ESEMPI.filter((e) => e.modulo === "arduino");
    expect(arduino).toHaveLength(8);
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
