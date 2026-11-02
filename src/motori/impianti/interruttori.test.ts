// Interruttori a leva NA/NC e selettore NC (aggiunti su richiesta del docente):
// restano nella posizione scelta, come il selettore.
import { describe, expect, it } from "vitest";
import { simula, type Circuito } from "./simulatore";
import { MODELLI_IMPIANTI } from "./modelli";

const lampadaCon = (tipo: string, a: string, b: string): Circuito => ({
  componenti: [
    { id: "RM", tipo: "rete-monofase", etichetta: "" },
    { id: "S1", tipo, etichetta: "S1" },
    { id: "H1", tipo: "lampada", etichetta: "H1" },
  ],
  fili: [
    { da: { componente: "RM", morsetto: "L" }, a: { componente: "S1", morsetto: a } },
    { da: { componente: "S1", morsetto: b }, a: { componente: "H1", morsetto: "X1" } },
    { da: { componente: "H1", morsetto: "X2" }, a: { componente: "RM", morsetto: "N" } },
  ],
});

describe("interruttori a posizione mantenuta", () => {
  it("interruttore NA: lampada accesa solo se azionato", () => {
    const c = lampadaCon("interruttore-na", "13", "14");
    expect(simula(c).carichiAlimentati).not.toContain("H1");
    expect(simula(c, { azionati: ["S1"] }).carichiAlimentati).toContain("H1");
  });
  it("interruttore NC e selettore NC: lampada accesa a riposo, spenta se azionati", () => {
    for (const tipo of ["interruttore-nc", "selettore-nc"]) {
      const c = lampadaCon(tipo, "11", "12");
      expect(simula(c).carichiAlimentati, tipo).toContain("H1");
      expect(simula(c, { azionati: ["S1"] }).carichiAlimentati, tipo).not.toContain("H1");
    }
  });
  it("pulsante d'emergenza: NC e agganciato (resta premuto finché non lo sblocchi)", () => {
    const c = lampadaCon("pulsante-emergenza", "11", "12");
    expect(simula(c).carichiAlimentati).toContain("H1");
    expect(simula(c, { azionati: ["S1"] }).carichiAlimentati).not.toContain("H1");
    const m = MODELLI_IMPIANTI["pulsante-emergenza"];
    expect(m.tipo === "contatto" && m.comando?.tipo).toBe("manuale");
  });
});
