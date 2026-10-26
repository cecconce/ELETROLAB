// Test del motore con i componenti aggiunti nell'attività 2.3: organi di
// manovra a posizione mantenuta, poli multipli, relè termico, temporizzatori
// (per ora senza ritardo), nuovi utilizzatori.
import { describe, expect, it } from "vitest";
import { simula, type Circuito, type ComponenteCircuito, type FiloCircuito } from "./simulatore";

function filo(da: string, a: string): FiloCircuito {
  const [c1, m1] = da.split(":");
  const [c2, m2] = a.split(":");
  return { da: { componente: c1, morsetto: m1 }, a: { componente: c2, morsetto: m2 } };
}
const comp = (id: string, tipo: string, etichetta = id): ComponenteCircuito => ({ id, tipo, etichetta });

/**
 * Avviamento diretto di un motore trifase.
 * Potenza: L1-L2-L3 → Q1 (sezionatore) → K1 (contatti principali) → F1 (relè termico) → M1.
 * Comando: L → F1 95-96 → S1 (selettore) → K1 A1-A2 → N; spia H1 di allarme su F1 97-98.
 */
const avviamentoDiretto: Circuito = {
  componenti: [
    comp("RT", "rete-trifase", ""),
    comp("RM", "rete-monofase", ""),
    comp("Q1", "sezionatore"),
    comp("KP", "contatti-principali", "K1"),
    comp("F1", "rele-termico"),
    comp("M1", "motore-trifase"),
    comp("F1nc", "contatto-termico-nc", "F1"),
    comp("F1na", "contatto-termico-na", "F1"),
    comp("S1", "selettore"),
    comp("K1", "bobina-contattore"),
    comp("H1", "sirena"),
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
    filo("F1nc:96", "S1:13"),
    filo("S1:14", "K1:A1"),
    filo("K1:A2", "RM:N"),
    filo("RM:L", "F1na:97"),
    filo("F1na:98", "H1:X1"),
    filo("H1:X2", "RM:N"),
  ],
};

describe("avviamento diretto con sezionatore, contatti principali e relè termico", () => {
  it("a riposo è tutto fermo e il sezionatore è aperto", () => {
    const r = simula(avviamentoDiretto);
    expect(r.carichiAlimentati).toEqual([]);
    expect(r.contattiChiusi).toEqual(["F1nc"]);
    expect(r.poliDeiMorsetti["Q1:2"]).toEqual([]);
  });

  it("con il selettore girato il contattore si eccita, ma senza sezionatore il motore resta fermo", () => {
    const r = simula(avviamentoDiretto, { azionati: ["S1"] });
    expect(r.bobineEccitate).toEqual(["K1"]);
    expect(r.contattiChiusi).toContain("KP");
    expect(r.carichiAlimentati).not.toContain("M1");
  });

  it("sezionatore chiuso + contattore eccitato: il motore riceve le tre fasi", () => {
    const r = simula(avviamentoDiretto, { azionati: ["S1", "Q1"] });
    expect(r.carichiAlimentati).toEqual(expect.arrayContaining(["K1", "M1"]));
    expect(r.poliDeiMorsetti["M1:U"]).toEqual(["L1"]);
    expect(r.poliDeiMorsetti["M1:V"]).toEqual(["L2"]);
    expect(r.poliDeiMorsetti["M1:W"]).toEqual(["L3"]);
    expect(r.cortocircuiti).toEqual([]);
  });

  it("l'intervento del relè termico apre 95-96 (motore fermo) e chiude 97-98 (sirena)", () => {
    const marcia = simula(avviamentoDiretto, { azionati: ["S1", "Q1"] });
    const r = simula(avviamentoDiretto, { azionati: ["S1", "Q1"], termiciIntervenuti: ["F1"] }, marcia.bobineEccitate);
    expect(r.bobineEccitate).toEqual([]);
    expect(r.carichiAlimentati).toEqual(["H1"]);
    expect(r.contattiChiusi).toEqual(expect.arrayContaining(["Q1", "S1", "F1na"]));
    expect(r.contattiChiusi).not.toContain("F1nc");
  });

  it("un contatto termico senza sigla non commuta", () => {
    const senza: Circuito = {
      ...avviamentoDiretto,
      componenti: avviamentoDiretto.componenti.map((c) => (c.id === "F1nc" ? { ...c, etichetta: "" } : c)),
    };
    expect(simula(senza, { azionati: ["S1"], termiciIntervenuti: ["F1"] }).bobineEccitate).toEqual(["K1"]);
  });
});

describe("comandi a posizione mantenuta e sensori", () => {
  const lampadaCon = (tipo: string, m1: string, m2: string): Circuito => ({
    componenti: [comp("RETE", "rete-monofase", ""), comp("B1", tipo), comp("H1", "lampada")],
    fili: [filo("RETE:L", `B1:${m1}`), filo(`B1:${m2}`, "H1:X1"), filo("H1:X2", "RETE:N")],
  });

  it("finecorsa NA e sensore chiudono solo se azionati", () => {
    for (const tipo of ["finecorsa-na", "sensore-prossimita", "selettore"]) {
      const c = lampadaCon(tipo, "13", "14");
      expect(simula(c).carichiAlimentati, tipo).toEqual([]);
      expect(simula(c, { azionati: ["B1"] }).carichiAlimentati, tipo).toEqual(["H1"]);
      // Premere (pulsante) non conta: questi comandi si azionano con un clic che resta.
      expect(simula(c, { premuti: ["B1"] }).carichiAlimentati, tipo).toEqual([]);
    }
  });

  it("il finecorsa NC si apre quando viene raggiunto", () => {
    const c = lampadaCon("finecorsa-nc", "11", "12");
    expect(simula(c).carichiAlimentati).toEqual(["H1"]);
    expect(simula(c, { azionati: ["B1"] }).carichiAlimentati).toEqual([]);
  });

  it("il salvamotore chiude tutte e tre le fasi insieme", () => {
    const c: Circuito = {
      componenti: [comp("RT", "rete-trifase", ""), comp("Q1", "salvamotore"), comp("M1", "motore-trifase")],
      fili: [
        filo("RT:L1", "Q1:1"),
        filo("RT:L2", "Q1:3"),
        filo("RT:L3", "Q1:5"),
        filo("Q1:2", "M1:U"),
        filo("Q1:4", "M1:V"),
        filo("Q1:6", "M1:W"),
      ],
    };
    expect(simula(c).carichiAlimentati).toEqual([]);
    expect(simula(c, { azionati: ["Q1"] }).carichiAlimentati).toEqual(["M1"]);
  });
});

describe("relè ausiliari, temporizzatori e nuovi utilizzatori", () => {
  /** L → S1 → bobina (tipo) → N; contatto (tipoContatto) della stessa sigla → motore 1~ M1. */
  const comandoCon = (tipoBobina: string, tipoContatto: string, m1: string, m2: string): Circuito => ({
    componenti: [
      comp("RETE", "rete-monofase", ""),
      comp("S1", "pulsante-na"),
      comp("KX", tipoBobina, "K9"),
      comp("C", tipoContatto, "K9"),
      comp("M1", "motore-monofase"),
    ],
    fili: [
      filo("RETE:L", "S1:13"),
      filo("S1:14", "KX:A1"),
      filo("KX:A2", "RETE:N"),
      filo("RETE:L", `C:${m1}`),
      filo(`C:${m2}`, "M1:U1"),
      filo("M1:U2", "RETE:N"),
    ],
  });

  it("il relè ausiliario funziona come una bobina di contattore", () => {
    const c = comandoCon("bobina-rele", "contatto-na", "13", "14");
    expect(simula(c).carichiAlimentati).toEqual([]);
    expect(simula(c, { premuti: ["S1"] }).carichiAlimentati).toEqual(["KX", "M1"]);
  });

  it("i contatti temporizzati seguono il temporizzatore (ritardo dall'attività 2.4)", () => {
    for (const bobina of ["bobina-ritardata-eccitazione", "bobina-ritardata-diseccitazione"]) {
      const na = comandoCon(bobina, "contatto-temporizzato-na", "17", "18");
      expect(simula(na, { premuti: ["S1"] }).carichiAlimentati, bobina).toEqual(["KX", "M1"]);
      const nc = comandoCon(bobina, "contatto-temporizzato-nc", "15", "16");
      expect(simula(nc).carichiAlimentati, bobina).toEqual(["M1"]);
      expect(simula(nc, { premuti: ["S1"] }).carichiAlimentati, bobina).toEqual(["KX"]);
    }
  });

  it("motore in CC e sirena si alimentano con due poli diversi", () => {
    const c: Circuito = {
      componenti: [comp("RETE", "rete-monofase", ""), comp("M1", "motore-cc"), comp("H1", "sirena")],
      fili: [filo("RETE:L", "M1:A1"), filo("M1:A2", "RETE:N"), filo("RETE:L", "H1:X1"), filo("H1:X2", "RETE:N")],
    };
    expect(simula(c).carichiAlimentati).toEqual(["M1", "H1"]);
  });
});
