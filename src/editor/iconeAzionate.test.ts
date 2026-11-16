// Icone dei simboli "azionati" (leva spostata) della vista Simboli in simulazione.
import { describe, expect, it } from "vitest";
import { ICONE, iconaAzionata, libreriaDelModulo } from "./caricaLibreria";
import { azioneClic } from "../motori/impianti";

describe("icone dei comandi azionati", () => {
  it("interruttori civili, deviatore e invertitore hanno il disegno azionato", () => {
    for (const icona of ["interruttore-unipolare.svg", "interruttore-bipolare.svg", "deviatore.svg", "invertitore.svg"]) {
      expect(iconaAzionata(icona)).toBe(icona.replace(".svg", "-azionato.svg"));
    }
  });

  it("niente variante per chi non ce l'ha (e niente variante della variante)", () => {
    expect(iconaAzionata("lampada.svg")).toBeNull();
    expect(iconaAzionata("deviatore-azionato.svg")).toBeNull();
  });

  it("ogni icona azionata appartiene a un comando che si aziona con un clic e mantiene la posizione", () => {
    const impianti = libreriaDelModulo("impianti");
    const varianti = [...ICONE.keys()].filter((n) => n.endsWith("-azionato.svg"));
    expect(varianti.length).toBeGreaterThanOrEqual(8);
    for (const variante of varianti) {
      const voce = impianti.componenti.find((v) => iconaAzionata(v.icona) === variante);
      expect(voce, variante).toBeDefined();
      expect(azioneClic(voce!.id), variante).toBe("manuale");
      // Stesse dimensioni del simbolo a riposo: i morsetti restano dove sono.
      const base = ICONE.get(voce!.icona)!;
      expect(ICONE.get(variante)!.match(/viewBox="[^"]+"/)?.[0]).toBe(base.match(/viewBox="[^"]+"/)?.[0]);
    }
  });
});
