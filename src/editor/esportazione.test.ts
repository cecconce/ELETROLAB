// Test delle parti pure dell'esportazione (la tavola si prova con Playwright).
import { describe, expect, it } from "vitest";
import { adattaSchema, dataDiOggi, TAVOLA } from "./esportazione";
import { conEstensione } from "../progetto/archivio";

describe("esportazione", () => {
  it("data all'italiana", () => {
    expect(dataDiOggi(new Date(2026, 10, 2))).toBe("02/11/2026");
  });
  it("lo schema sta nella tavola sopra il cartiglio, senza ingrandire troppo", () => {
    const piccolo = adattaSchema(200, 100);
    expect(piccolo.scala).toBe(1.5);
    const grande = adattaSchema(4000, 1000);
    expect(grande.x).toBeGreaterThan(0);
    expect(grande.x + 4000 * grande.scala).toBeLessThan(TAVOLA.larghezza);
    const alto = adattaSchema(500, 3000);
    expect(alto.y + 3000 * alto.scala).toBeLessThan(TAVOLA.altezza - 210);
  });
  it("nome del file con l'estensione giusta", () => {
    expect(conEstensione("Marcia", "pdf")).toBe("Marcia.pdf");
    expect(conEstensione("schema.elab", "png")).toBe("schema.png");
    expect(conEstensione("tavola.PDF", "pdf")).toBe("tavola.PDF");
  });
});
