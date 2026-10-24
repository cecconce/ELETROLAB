// Test di prova: verifica il caricamento dei testi e la sostituzione dei segnaposto.
import { describe, expect, it } from "vitest";
import { formatta, t } from "./testi";

describe("testi dell'interfaccia", () => {
  it("legge il titolo dell'app da lingue/it.json", () => {
    expect(t("app.titolo")).toBe("ElettroLab");
  });

  it("sostituisce i segnaposto", () => {
    expect(t("app.versione", { versione: "0.1.0" })).toBe("Versione 0.1.0");
  });

  it("lascia intatti i segnaposto senza valore", () => {
    expect(formatta({ a: "Ciao {nome}" }, "a")).toBe("Ciao {nome}");
  });

  it("restituisce la chiave se il testo manca", () => {
    expect(t("chiave.inesistente")).toBe("chiave.inesistente");
  });
});
