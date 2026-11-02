// Test delle proposte del completamento automatico dell'editor Arduino.
import { describe, expect, it } from "vitest";
import { COMPLETAMENTI_ARDUINO, proponi } from "./completamentiArduino";

describe("completamento del codice Arduino", () => {
  it("propone le funzioni che iniziano con il testo scritto", () => {
    expect(proponi("digi").map((c) => c.label)).toEqual(["digitalWrite", "digitalRead"]);
    expect(proponi("serial.pr").map((c) => c.label)).toEqual(["Serial.print", "Serial.println"]);
    expect(proponi("")).toEqual([]);
  });
  it("ogni proposta ha una spiegazione in italiano e niente doppioni", () => {
    const etichette = COMPLETAMENTI_ARDUINO.map((c) => c.label);
    expect(new Set(etichette).size).toBe(etichette.length);
    for (const c of COMPLETAMENTI_ARDUINO) expect(c.info.length, c.label).toBeGreaterThan(2);
  });
});
