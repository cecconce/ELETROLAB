// Test dell'attività 2.5: sessione di simulazione guidata dai clic dello studente.
import { describe, expect, it } from "vitest";
import type { Circuito, ComponenteCircuito, FiloCircuito } from "./simulatore";
import { avviaSessione, azioneClic, clicGiu, clicSu, passo, rilasciaTutti } from "./sessione";
import { TEMPO_INTERVENTO_TERMICO } from "./modelli";

function filo(da: string, a: string): FiloCircuito {
  const [c1, m1] = da.split(":");
  const [c2, m2] = a.split(":");
  return { da: { componente: c1, morsetto: m1 }, a: { componente: c2, morsetto: m2 } };
}
const comp = (id: string, tipo: string, etichetta = id, tempo?: number): ComponenteCircuito =>
  tempo === undefined ? { id, tipo, etichetta } : { id, tipo, etichetta, tempo };

/** Marcia/arresto con autoritenuta e relè termico; H1 spia di intervento. */
const avviamento: Circuito = {
  componenti: [
    comp("RT", "rete-trifase", ""),
    comp("RM", "rete-monofase", ""),
    comp("Q1", "sezionatore"),
    comp("KP", "contatti-principali", "K1"),
    comp("F1", "rele-termico"),
    comp("M1", "motore-trifase"),
    comp("F1nc", "contatto-termico-nc", "F1"),
    comp("F1na", "contatto-termico-na", "F1"),
    comp("S0", "pulsante-nc"),
    comp("S1", "pulsante-na"),
    comp("K1aux", "contatto-na", "K1"),
    comp("K1", "bobina-contattore"),
    comp("H1", "lampada"),
  ],
  fili: [
    filo("RT:L1", "Q1:1"),
    filo("RT:L2", "Q1:3"),
    filo("RT:L3", "Q1:5"),
    filo("Q1:2", "KP:1"),
    filo("Q1:4", "KP:3"),
    filo("Q1:6", "KP:5"),
    filo("KP:2", "F1:1"),
    filo("KP:4", "F1:3"),
    filo("KP:6", "F1:5"),
    filo("F1:2", "M1:U"),
    filo("F1:4", "M1:V"),
    filo("F1:6", "M1:W"),
    filo("RM:L", "F1nc:95"),
    filo("F1nc:96", "S0:11"),
    filo("S0:12", "S1:13"),
    filo("S1:14", "K1:A1"),
    filo("S0:12", "K1aux:13"),
    filo("K1aux:14", "K1:A1"),
    filo("K1:A2", "RM:N"),
    filo("RM:L", "F1na:97"),
    filo("F1na:98", "H1:X1"),
    filo("H1:X2", "RM:N"),
  ],
};

describe("azione del clic sui componenti", () => {
  it("pulsanti, comandi mantenuti, protezioni e motori", () => {
    expect(azioneClic("pulsante-na")).toBe("pulsante");
    expect(azioneClic("pulsante-nc")).toBe("pulsante");
    expect(azioneClic("selettore")).toBe("manuale");
    expect(azioneClic("finecorsa-nc")).toBe("manuale");
    expect(azioneClic("sensore-prossimita")).toBe("manuale");
    expect(azioneClic("sezionatore")).toBe("manuale");
    expect(azioneClic("salvamotore")).toBe("manuale");
    expect(azioneClic("fusibile")).toBe("riarmo");
    expect(azioneClic("rele-termico")).toBe("riarmo");
    expect(azioneClic("motore-trifase")).toBe("motore");
    expect(azioneClic("motore-cc")).toBe("motore");
    expect(azioneClic("bobina-contattore")).toBeNull();
    expect(azioneClic("contatto-na")).toBeNull();
    expect(azioneClic("lampada")).toBeNull();
    expect(azioneClic("sconosciuto")).toBeNull();
  });
});

describe("sessione di simulazione", () => {
  it("all'avvio tutto è a riposo", () => {
    const s = avviaSessione(avviamento);
    expect(s.stato.tempo).toBe(0);
    expect(s.risultato.bobineEccitate).toEqual([]);
    expect(s.risultato.motori).toEqual({});
  });

  it("pulsante tenuto premuto, autoritenuta e arresto", () => {
    let s = avviaSessione(avviamento);
    s = clicGiu(s, "Q1"); // chiude il sezionatore
    s = clicGiu(s, "S1");
    expect(s.risultato.bobineEccitate).toContain("K1");
    expect(s.risultato.motori.M1).toEqual({ verso: "orario" });
    s = clicSu(s, "S1");
    expect(s.premuti).toEqual([]);
    expect(s.risultato.bobineEccitate).toContain("K1"); // autoritenuta
    s = clicGiu(s, "S0");
    expect(s.risultato.bobineEccitate).toEqual([]);
    s = rilasciaTutti(s);
    expect(s.premuti).toEqual([]);
    expect(s.risultato.bobineEccitate).toEqual([]);
  });

  it("i comandi a posizione mantenuta cambiano stato a ogni clic", () => {
    let s = avviaSessione(avviamento);
    s = clicGiu(s, "Q1");
    expect(s.azionati).toEqual(["Q1"]);
    s = clicSu(s, "Q1"); // il rilascio non lo riapre
    expect(s.azionati).toEqual(["Q1"]);
    s = clicGiu(s, "Q1");
    expect(s.azionati).toEqual([]);
  });

  it("senza sezionatore chiuso il contattore si eccita ma il motore resta fermo", () => {
    let s = avviaSessione(avviamento);
    s = clicGiu(s, "S1");
    expect(s.risultato.bobineEccitate).toContain("K1");
    expect(s.risultato.motori).toEqual({});
  });

  it("sovraccarico: il relè termico interviene, la spia si accende, il clic lo riarma", () => {
    let s = avviaSessione(avviamento);
    s = clicSu(clicGiu(clicGiu(s, "Q1"), "S1"), "S1");
    s = clicGiu(s, "M1"); // albero frenato
    expect(s.sovraccarichi).toEqual(["M1"]);
    s = passo(s, TEMPO_INTERVENTO_TERMICO - 0.5);
    expect(s.stato.protezioniIntervenute).toEqual([]);
    s = passo(s, 1);
    expect(s.stato.protezioniIntervenute).toEqual(["F1"]);
    expect(s.risultato.motori).toEqual({});
    expect(s.risultato.carichiAlimentati).toContain("H1");
    // Il clic su un componente che non è una protezione intervenuta non riarma niente.
    expect(clicGiu(s, "K1")).toBe(s);
    s = clicGiu(s, "M1"); // tolto il sovraccarico
    s = clicGiu(s, "F1"); // riarmo
    expect(s.stato.protezioniIntervenute).toEqual([]);
    expect(s.risultato.carichiAlimentati).not.toContain("H1");
    expect(s.risultato.bobineEccitate).toEqual([]); // l'autoritenuta si era persa
  });

  it("il riarmo di una protezione non intervenuta non cambia nulla", () => {
    const s = avviaSessione(avviamento);
    expect(clicGiu(s, "F1")).toBe(s);
  });

  it("salvamotore scattato: il clic lo riarma e lo lascia aperto", () => {
    const c: Circuito = {
      componenti: [comp("RM", "rete-monofase", ""), comp("Q1", "salvamotore")],
      fili: [filo("RM:L", "Q1:1"), filo("Q1:2", "RM:N")], // cortocircuito a valle del salvamotore
    };
    let s = avviaSessione(c);
    s = clicGiu(s, "Q1");
    expect(s.stato.protezioniIntervenute).toEqual(["Q1"]);
    s = clicGiu(s, "Q1");
    expect(s.stato.protezioniIntervenute).toEqual([]);
    expect(s.azionati).toEqual([]);
  });
});

describe("scorrere del tempo", () => {
  /** S1 alimenta KT (ritardo all'eccitazione), il suo contatto 17-18 accende H1. */
  const temporizzato = (tempo: number): Circuito => ({
    componenti: [
      comp("RM", "rete-monofase", ""),
      comp("S1", "selettore"),
      comp("KT1", "bobina-ritardata-eccitazione", "KT1", tempo),
      comp("KTna", "contatto-temporizzato-na", "KT1"),
      comp("H1", "lampada"),
    ],
    fili: [
      filo("RM:L", "S1:13"),
      filo("S1:14", "KT1:A1"),
      filo("KT1:A2", "RM:N"),
      filo("RM:L", "KTna:17"),
      filo("KTna:18", "H1:X1"),
      filo("H1:X2", "RM:N"),
    ],
  });

  it("un passo lungo viene spezzato nell'istante esatto dell'evento", () => {
    let s = clicGiu(avviaSessione(temporizzato(2)), "S1");
    s = passo(s, 1.99);
    expect(s.risultato.carichiAlimentati).not.toContain("H1");
    s = passo(avviaSessione(temporizzato(2)), 0); // dt = 0 non fa avanzare il tempo
    expect(s.stato.tempo).toBe(0);
    s = clicGiu(avviaSessione(temporizzato(2)), "S1");
    s = passo(s, 10); // es. finestra ridotta a icona per 10 s
    expect(s.stato.tempo).toBeCloseTo(10);
    expect(s.risultato.carichiAlimentati).toContain("H1");
  });

  it("a piccoli passi da 50 ms il ritardo scade al momento giusto", () => {
    let s = clicGiu(avviaSessione(temporizzato(1)), "S1");
    let acceso = -1;
    for (let i = 1; i <= 40; i++) {
      s = passo(s, 0.05);
      if (acceso < 0 && s.risultato.carichiAlimentati.includes("H1")) acceso = i * 0.05;
    }
    expect(acceso).toBeCloseTo(1, 5);
  });
});
