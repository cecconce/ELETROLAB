// Test dell'elenco dei componenti (distinta materiali).
import { describe, expect, it } from "vitest";
import { ESEMPI } from "../progetto/caricaEsempi";
import { apriEsempio } from "../progetto/esempi";
import { libreriaDelModulo } from "./caricaLibreria";
import { csvDistinta, distintaComponenti, testoDistinta } from "./distinta";

const schemaEsempio = (file: string) => {
  const r = apriEsempio(ESEMPI.find((e) => e.file === file)!);
  if (!r.ok) throw new Error(r.errore);
  return r.progetto.schema;
};

describe("elenco dei componenti", () => {
  it("Arduino: resistenze raggruppate per valore, sigle in ordine naturale", () => {
    const righe = distintaComponenti(schemaEsempio("arduino-74hc595.elab"), libreriaDelModulo("arduino"));
    const resistenze = righe.find((r) => r.nome === "Resistenza")!;
    expect(resistenze).toMatchObject({ quantita: 8, valore: "220 Ω" });
    expect(resistenze.sigle.slice(0, 3)).toEqual(["R1", "R2", "R3"]);
    expect([...righe.find((r) => r.nome === "LED rosso")!.sigle].pop()).toBe("D8");
    expect(righe.find((r) => r.nome === "Arduino Uno")!.quantita).toBe(1);
  });

  it("Impianti: i contatti con la sigla della bobina contano la sigla una volta sola", () => {
    const righe = distintaComponenti(schemaEsempio("marcia-arresto.elab"), libreriaDelModulo("impianti"));
    for (const r of righe) expect(new Set(r.sigle).size).toBe(r.sigle.length);
    expect(righe.reduce((n, r) => n + r.quantita, 0)).toBe(schemaEsempio("marcia-arresto.elab").componenti.length);
  });

  it("CSV con il punto e virgola e testo da copiare", () => {
    const righe = [{ quantita: 2, nome: "Resistenza", valore: "4,7 kΩ", sigle: ["R1", "R2"] }];
    expect(csvDistinta(righe, ["Quantità", "Componente", "Valore", "Sigle"])).toBe('Quantità;Componente;Valore;Sigle\r\n2;Resistenza;4,7 kΩ;R1, R2\r\n');
    expect(csvDistinta([{ quantita: 1, nome: 'Nome; "strano"', valore: "", sigle: [] }], ["a", "b", "c", "d"])).toContain('1;"Nome; ""strano""";;');
    expect(testoDistinta(righe)).toBe("2 × Resistenza 4,7 kΩ (R1, R2)");
  });
});
