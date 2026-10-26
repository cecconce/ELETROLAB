// Test del motore elettromeccanico su circuiti semplici.
import { describe, expect, it } from "vitest";
import libreriaImpianti from "../../../libreria/impianti.json";
import { MODELLI_IMPIANTI } from "./modelli";
import { morsettiDelModello, simula, type Circuito, type ComponenteCircuito, type FiloCircuito } from "./simulatore";

/** Aiuto per scrivere i circuiti: filo("S1:14", "K1:A1"). */
function filo(da: string, a: string): FiloCircuito {
  const [c1, m1] = da.split(":");
  const [c2, m2] = a.split(":");
  return { da: { componente: c1, morsetto: m1 }, a: { componente: c2, morsetto: m2 } };
}
const comp = (id: string, tipo: string, etichetta = id): ComponenteCircuito => ({ id, tipo, etichetta });

/** Rete L/N → S1 (NA) → lampada H1 → N. */
const pulsanteLampada: Circuito = {
  componenti: [comp("RETE", "rete-monofase", ""), comp("S1", "pulsante-na"), comp("H1", "lampada")],
  fili: [filo("RETE:L", "S1:13"), filo("S1:14", "H1:X1"), filo("H1:X2", "RETE:N")],
};

/**
 * Marcia/arresto con autoritenuta:
 * L → S0 (NC, arresto) → S1 (NA, marcia) → K1 A1-A2 → N,
 * contatto K1 13-14 in parallelo a S1, lampada H1 comandata da un secondo contatto K1.
 */
const autoritenuta: Circuito = {
  componenti: [
    comp("RETE", "rete-monofase", ""),
    comp("S0", "pulsante-nc"),
    comp("S1", "pulsante-na"),
    comp("K1", "bobina-contattore"),
    comp("K1a", "contatto-na", "K1"),
    comp("K1b", "contatto-na", "K1"),
    comp("H1", "lampada"),
  ],
  fili: [
    filo("RETE:L", "S0:11"),
    filo("S0:12", "S1:13"),
    filo("S1:14", "K1:A1"),
    filo("K1:A2", "RETE:N"),
    // Autoritenuta in parallelo al pulsante di marcia.
    filo("S0:12", "K1a:13"),
    filo("K1a:14", "S1:14"),
    // Lampada di marcia.
    filo("RETE:L", "K1b:13"),
    filo("K1b:14", "H1:X1"),
    filo("H1:X2", "RETE:N"),
  ],
};

describe("pulsante → lampada", () => {
  it("a riposo la lampada è spenta e il pulsante aperto", () => {
    const r = simula(pulsanteLampada);
    expect(r.stabile).toBe(true);
    expect(r.carichiAlimentati).toEqual([]);
    expect(r.contattiChiusi).toEqual([]);
    expect(r.poliDeiMorsetti["S1:13"]).toEqual(["L1"]);
    // I carichi non "trasportano" il polo: dietro la lampada spenta non c'è tensione.
    expect(r.poliDeiMorsetti["S1:14"]).toEqual([]);
  });

  it("tenendo premuto il pulsante la lampada si accende", () => {
    const r = simula(pulsanteLampada, { premuti: ["S1"] });
    expect(r.carichiAlimentati).toEqual(["H1"]);
    expect(r.contattiChiusi).toEqual(["S1"]);
    expect(r.poliDeiMorsetti["H1:X1"]).toEqual(["L1"]);
    expect(r.poliDeiMorsetti["H1:X2"]).toEqual(["N"]);
    expect(r.cortocircuiti).toEqual([]);
  });

  it("con un filo staccato la lampada resta spenta", () => {
    const aperto = { ...pulsanteLampada, fili: pulsanteLampada.fili.slice(0, 2) };
    const r = simula(aperto, { premuti: ["S1"] });
    expect(r.carichiAlimentati).toEqual([]);
    expect(r.poliDeiMorsetti["H1:X2"]).toEqual([]);
  });

  it("con un pulsante NC la lampada è accesa a riposo e si spegne premendo", () => {
    const nc: Circuito = {
      componenti: [comp("RETE", "rete-monofase", ""), comp("S1", "pulsante-nc"), comp("H1", "lampada")],
      fili: [filo("RETE:L", "S1:11"), filo("S1:12", "H1:X1"), filo("H1:X2", "RETE:N")],
    };
    expect(simula(nc).carichiAlimentati).toEqual(["H1"]);
    expect(simula(nc, { premuti: ["S1"] }).carichiAlimentati).toEqual([]);
  });
});

describe("autoritenuta", () => {
  it("a riposo il contattore è diseccitato", () => {
    const r = simula(autoritenuta);
    expect(r.stabile).toBe(true);
    expect(r.bobineEccitate).toEqual([]);
    expect(r.carichiAlimentati).toEqual([]);
    expect(r.contattiChiusi).toEqual(["S0"]);
  });

  it("premendo marcia K1 si eccita e chiude i suoi contatti", () => {
    const r = simula(autoritenuta, { premuti: ["S1"] });
    expect(r.stabile).toBe(true);
    expect(r.bobineEccitate).toEqual(["K1"]);
    expect(r.contattiChiusi.sort()).toEqual(["K1a", "K1b", "S0", "S1"]);
    expect(r.carichiAlimentati.sort()).toEqual(["H1", "K1"]);
  });

  it("rilasciando marcia K1 resta eccitato grazie all'autoritenuta", () => {
    const marcia = simula(autoritenuta, { premuti: ["S1"] });
    const r = simula(autoritenuta, {}, marcia.bobineEccitate);
    expect(r.bobineEccitate).toEqual(["K1"]);
    expect(r.carichiAlimentati).toContain("H1");
    expect(r.passi).toBe(0); // nulla da cambiare
  });

  it("premendo arresto K1 si diseccita e non riparte da solo", () => {
    const marcia = simula(autoritenuta, { premuti: ["S1"] });
    const arresto = simula(autoritenuta, { premuti: ["S0"] }, marcia.bobineEccitate);
    expect(arresto.bobineEccitate).toEqual([]);
    expect(arresto.carichiAlimentati).toEqual([]);
    const dopo = simula(autoritenuta, {}, arresto.bobineEccitate);
    expect(dopo.bobineEccitate).toEqual([]);
  });

  it("senza il contatto di autoritenuta K1 cade al rilascio di marcia", () => {
    const senza = { ...autoritenuta, fili: autoritenuta.fili.filter((f) => f.da.componente !== "K1a" && f.a.componente !== "K1a") };
    const marcia = simula(senza, { premuti: ["S1"] });
    expect(marcia.bobineEccitate).toEqual(["K1"]);
    expect(simula(senza, {}, marcia.bobineEccitate).bobineEccitate).toEqual([]);
  });

  it("un contatto con sigla diversa non segue la bobina", () => {
    const altro: Circuito = {
      ...autoritenuta,
      componenti: autoritenuta.componenti.map((c) => (c.id === "K1b" ? { ...c, etichetta: "K2" } : c)),
    };
    const r = simula(altro, { premuti: ["S1"] });
    expect(r.bobineEccitate).toEqual(["K1"]);
    expect(r.carichiAlimentati).not.toContain("H1");
  });
});

describe("casi particolari", () => {
  it("una bobina che apre il proprio contatto di alimentazione oscilla senza bloccarsi", () => {
    const ronzio: Circuito = {
      componenti: [comp("RETE", "rete-monofase", ""), comp("K1c", "contatto-nc", "K1"), comp("K1", "bobina-contattore")],
      fili: [filo("RETE:L", "K1c:21"), filo("K1c:22", "K1:A1"), filo("K1:A2", "RETE:N")],
    };
    const r = simula(ronzio);
    expect(r.stabile).toBe(false);
    expect(r.oscillazione).toEqual({ bobine: ["K1"] });
    expect(r.passi).toBeLessThan(10);
  });

  it("due bobine in catena si eccitano in cascata", () => {
    // S1 eccita K1; un contatto NA di K1 eccita K2.
    const cascata: Circuito = {
      componenti: [
        comp("RETE", "rete-monofase", ""),
        comp("S1", "pulsante-na"),
        comp("K1", "bobina-contattore"),
        comp("K1a", "contatto-na", "K1"),
        comp("K2", "bobina-contattore"),
      ],
      fili: [
        filo("RETE:L", "S1:13"),
        filo("S1:14", "K1:A1"),
        filo("K1:A2", "RETE:N"),
        filo("RETE:L", "K1a:13"),
        filo("K1a:14", "K2:A1"),
        filo("K2:A2", "RETE:N"),
      ],
    };
    const r = simula(cascata, { premuti: ["S1"] });
    expect(r.bobineEccitate).toEqual(["K1", "K2"]);
    expect(r.passi).toBe(2);
  });

  it("un pulsante che collega direttamente L e N è un cortocircuito", () => {
    const corto: Circuito = {
      componenti: [comp("RETE", "rete-monofase", ""), comp("S1", "pulsante-na")],
      fili: [filo("RETE:L", "S1:13"), filo("S1:14", "RETE:N")],
    };
    expect(simula(corto).cortocircuiti).toEqual([]);
    const r = simula(corto, { premuti: ["S1"] });
    expect(r.cortocircuiti).toHaveLength(1);
    expect(r.cortocircuiti[0].poli).toEqual(["L1", "N"]);
    expect(r.cortocircuiti[0].morsetti).toEqual(expect.arrayContaining(["RETE:L", "RETE:N", "S1:13", "S1:14"]));
  });

  it("i fusibili e i magnetotermici conducono", () => {
    const protetto: Circuito = {
      componenti: [comp("RETE", "rete-monofase", ""), comp("F1", "fusibile"), comp("Q1", "magnetotermico"), comp("H1", "lampada")],
      fili: [filo("RETE:L", "F1:1"), filo("F1:2", "Q1:1"), filo("Q1:2", "H1:X1"), filo("H1:X2", "RETE:N")],
    };
    expect(simula(protetto).carichiAlimentati).toEqual(["H1"]);
  });

  it("una lampada fra due fasi della rete trifase si accende", () => {
    const fra: Circuito = {
      componenti: [comp("RETE", "rete-trifase", ""), comp("H1", "lampada")],
      fili: [filo("RETE:L1", "H1:X1"), filo("H1:X2", "RETE:L2")],
    };
    expect(simula(fra).carichiAlimentati).toEqual(["H1"]);
  });

  it("una lampada con entrambi i capi sulla stessa fase resta spenta", () => {
    const stessa: Circuito = {
      componenti: [comp("R1", "rete-trifase", ""), comp("R2", "rete-monofase", ""), comp("H1", "lampada")],
      fili: [filo("R1:L1", "H1:X1"), filo("H1:X2", "R2:L")],
    };
    expect(simula(stessa).carichiAlimentati).toEqual([]);
  });

  it("il motore trifase gira solo con tutte e tre le fasi", () => {
    const motore: Circuito = {
      componenti: [comp("RETE", "rete-trifase", ""), comp("M1", "motore-trifase")],
      fili: [filo("RETE:L1", "M1:U"), filo("RETE:L2", "M1:V"), filo("RETE:L3", "M1:W")],
    };
    expect(simula(motore).carichiAlimentati).toEqual(["M1"]);
    const dueFasi = { ...motore, fili: motore.fili.slice(0, 2) };
    expect(simula(dueFasi).carichiAlimentati).toEqual([]);
  });

  it("i componenti sconosciuti vengono ignorati senza errori", () => {
    const strano: Circuito = { ...pulsanteLampada, componenti: [...pulsanteLampada.componenti, comp("X1", "teletrasporto")] };
    const r = simula(strano, { premuti: ["S1"] });
    expect(r.ignorati).toEqual(["X1"]);
    expect(r.carichiAlimentati).toEqual(["H1"]);
  });

  it("le bobine precedenti che non esistono più vengono scartate", () => {
    expect(simula(pulsanteLampada, {}, ["K9"]).bobineEccitate).toEqual([]);
  });
});

describe("modelli e libreria", () => {
  const voci = libreriaImpianti.componenti;

  it("ogni componente della libreria Impianti ha un modello elettrico", () => {
    for (const v of voci) expect(MODELLI_IMPIANTI[v.id], v.id).toBeDefined();
  });

  it("i morsetti dei modelli esistono nella libreria", () => {
    for (const v of voci) {
      const m = MODELLI_IMPIANTI[v.id];
      const usati = morsettiDelModello(m);
      const definiti = v.morsetti.map((t) => t.id);
      for (const t of usati) expect(definiti, `${v.id}:${t}`).toContain(t);
    }
  });
});
