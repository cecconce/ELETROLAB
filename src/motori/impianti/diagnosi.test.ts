// Test dell'attività 2.6: diagnosi degli errori dello schema e della simulazione.
import { describe, expect, it } from "vitest";
import type { Circuito, ComponenteCircuito, FiloCircuito } from "./simulatore";
import { simula } from "./simulatore";
import { diagnosiRisultato, diagnosiSchema, ordinaProblemi } from "./diagnosi";
import { avviaSessione, clicGiu, passo, problemiSessione } from "./sessione";
import { TEMPO_INTERVENTO_TERMICO } from "./modelli";

function filo(da: string, a: string): FiloCircuito {
  const [c1, m1] = da.split(":");
  const [c2, m2] = a.split(":");
  return { da: { componente: c1, morsetto: m1 }, a: { componente: c2, morsetto: m2 } };
}
const comp = (id: string, tipo: string, etichetta = id): ComponenteCircuito => ({ id, tipo, etichetta });
const codici = (c: Circuito) => diagnosiSchema(c).map((p) => p.codice);

/** Pulsante → lampada, corretto. */
const lampadaOk: Circuito = {
  componenti: [comp("R", "rete-monofase", ""), comp("S1", "pulsante-na"), comp("H1", "lampada")],
  fili: [filo("R:L", "S1:13"), filo("S1:14", "H1:X1"), filo("H1:X2", "R:N")],
};

/** Marcia/arresto con autoritenuta, corretto. */
const autoritenuta: Circuito = {
  componenti: [
    comp("R", "rete-monofase", ""),
    comp("S0", "pulsante-nc"),
    comp("S1", "pulsante-na"),
    comp("K1a", "contatto-na", "K1"),
    comp("K1", "bobina-contattore"),
  ],
  fili: [
    filo("R:L", "S0:11"),
    filo("S0:12", "S1:13"),
    filo("S1:14", "K1:A1"),
    filo("S0:12", "K1a:13"),
    filo("K1a:14", "K1:A1"),
    filo("K1:A2", "R:N"),
  ],
};

describe("diagnosi dello schema", () => {
  it("schemi corretti: nessun problema", () => {
    expect(diagnosiSchema(lampadaOk)).toEqual([]);
    expect(diagnosiSchema(autoritenuta)).toEqual([]);
    expect(diagnosiSchema({ componenti: [], fili: [] })).toEqual([]);
  });

  it("utilizzatori senza alimentazione nello schema", () => {
    const c: Circuito = { componenti: [comp("H1", "lampada")], fili: [] };
    expect(codici(c)).toEqual(["nessunaAlimentazione"]);
    // Solo comandi, senza utilizzatori: niente da segnalare.
    expect(codici({ componenti: [comp("S1", "pulsante-na")], fili: [] })).toEqual([]);
  });

  it("circuito aperto: indica il morsetto senza tensione e i morsetti senza filo", () => {
    // Manca il filo fra S1:14 e H1:X1.
    const c: Circuito = { ...lampadaOk, fili: [filo("R:L", "S1:13"), filo("H1:X2", "R:N")] };
    const [p] = diagnosiSchema(c);
    expect(p.codice).toBe("circuitoAperto");
    expect(p.gravita).toBe("avviso");
    expect(p.morsettoPrincipale).toBe("H1:X1");
    expect(p.componenti).toEqual(["H1"]);
    expect(p.morsetti).toEqual(["H1:X1"]);
    // Il filo staccato è dall'altra parte (manca R:L → S1:13): il morsetto libero è S1:13.
    const c2: Circuito = { ...lampadaOk, fili: [filo("S1:14", "H1:X1"), filo("H1:X2", "R:N")] };
    const [p2] = diagnosiSchema(c2);
    expect(p2.codice).toBe("circuitoAperto");
    expect(p2.componenti).toEqual(["H1", "S1"]);
    expect(p2.morsetti).toEqual(["S1:13"]);
  });

  it("bobina senza alimentazione (manca il ritorno sul neutro)", () => {
    const c: Circuito = { ...autoritenuta, fili: autoritenuta.fili.filter((f) => f.a.morsetto !== "N") };
    const problemi = diagnosiSchema(c);
    expect(problemi.map((p) => p.codice)).toEqual(["bobinaSenzaAlimentazione"]);
    expect(problemi[0].morsettoPrincipale).toBe("K1:A2");
    expect(problemi[0].morsetti).toEqual(["K1:A2"]);
  });

  it("componente appena posato e non collegato", () => {
    const c: Circuito = { ...lampadaOk, componenti: [...lampadaOk.componenti, comp("H2", "lampada")] };
    const [p] = diagnosiSchema(c);
    expect(p.codice).toBe("circuitoAperto");
    expect(p.componenti).toEqual(["H2"]);
    expect(p.morsetti).toEqual(["H2:X1", "H2:X2"]);
  });

  it("due utilizzatori in serie: segnalati una volta sola", () => {
    const c: Circuito = {
      componenti: [comp("R", "rete-monofase", ""), comp("H1", "lampada"), comp("H2", "lampada")],
      fili: [filo("R:L", "H1:X1"), filo("H1:X2", "H2:X1"), filo("H2:X2", "R:N")],
    };
    const problemi = diagnosiSchema(c);
    expect(problemi.map((p) => p.codice)).toEqual(["inSerie"]);
    expect(problemi[0].componenti).toEqual(["H1", "H2"]);
  });

  it("utilizzatore con entrambi i morsetti sulla stessa fase", () => {
    const c: Circuito = {
      componenti: [comp("R", "rete-monofase", ""), comp("S1", "pulsante-na"), comp("H1", "lampada")],
      fili: [filo("R:L", "S1:13"), filo("S1:14", "H1:X1"), filo("H1:X2", "R:L")],
    };
    const [p] = diagnosiSchema(c);
    expect(p.codice).toBe("stessoPolo");
    expect(p.poli).toEqual(["L1"]);
  });

  it("contatti non associati a nessuna bobina o relè termico", () => {
    const c: Circuito = {
      componenti: [
        ...lampadaOk.componenti,
        comp("Ka", "contatto-na", ""),
        comp("Kb", "contatto-nc", "K7"),
        comp("Fx", "contatto-termico-nc", "F1"),
        comp("Ky", "contatto-na", "K1"),
        comp("K1", "bobina-contattore"),
      ],
      fili: [...lampadaOk.fili, filo("R:L", "K1:A1"), filo("K1:A2", "R:N")],
    };
    const problemi = diagnosiSchema(c);
    expect(problemi.map((p) => [p.codice, p.componenti[0], p.sigla])).toEqual([
      ["contattoSenzaBobina", "Ka", undefined],
      ["contattoBobinaMancante", "Kb", "K7"],
      ["contattoTermicoSenzaRele", "Fx", undefined],
    ]);
  });

  it("il teleinvertitore con interblocco non dà falsi cortocircuiti né circuiti aperti", () => {
    // Con tutti i contatti chiusi le due marce sembrerebbero in corto: il
    // controllo statico non cerca cortocircuiti, solo poli irraggiungibili.
    const c: Circuito = {
      componenti: [
        comp("R", "rete-monofase", ""),
        comp("S1", "pulsante-na"),
        comp("S2", "pulsante-na"),
        comp("K2nc", "contatto-nc", "K2"),
        comp("K1nc", "contatto-nc", "K1"),
        comp("K1", "bobina-contattore"),
        comp("K2", "bobina-contattore"),
      ],
      fili: [
        filo("R:L", "S1:13"),
        filo("S1:14", "K2nc:21"),
        filo("K2nc:22", "K1:A1"),
        filo("R:L", "S2:13"),
        filo("S2:14", "K1nc:21"),
        filo("K1nc:22", "K2:A1"),
        filo("K1:A2", "R:N"),
        filo("K2:A2", "R:N"),
      ],
    };
    expect(diagnosiSchema(c)).toEqual([]);
  });

  it("motore a 6 morsetti: il centro stella senza tensione va bene, una fine scollegata no", () => {
    const stella: Circuito = {
      componenti: [comp("RT", "rete-trifase", ""), comp("M1", "motore-trifase-6")],
      fili: [
        filo("RT:L1", "M1:U1"),
        filo("RT:L2", "M1:V1"),
        filo("RT:L3", "M1:W1"),
        filo("M1:U2", "M1:V2"),
        filo("M1:V2", "M1:W2"),
      ],
    };
    expect(diagnosiSchema(stella)).toEqual([]);
    const [p] = diagnosiSchema({ ...stella, fili: stella.fili.slice(0, 4) });
    expect(p.codice).toBe("circuitoAperto");
    expect(p.morsettoPrincipale).toBe("M1:W2");
  });
});

describe("diagnosi durante la simulazione", () => {
  it("cortocircuito non interrotto: errore con poli, componenti e morsetti", () => {
    const c: Circuito = {
      componenti: [comp("R", "rete-monofase", ""), comp("S1", "pulsante-na")],
      fili: [filo("R:L", "S1:13"), filo("S1:14", "R:N")],
    };
    const r = simula(c, { premuti: ["S1"] });
    const [p] = diagnosiRisultato(r);
    expect(p.codice).toBe("cortocircuito");
    expect(p.gravita).toBe("errore");
    expect(p.poli).toEqual(["L1", "N"]);
    expect(p.componenti.sort()).toEqual(["R", "S1"]);
    expect(p.morsetti).toContain("S1:14");
  });

  it("oscillazione: bobina che apre il proprio contatto", () => {
    const c: Circuito = {
      componenti: [comp("R", "rete-monofase", ""), comp("K1nc", "contatto-nc", "K1"), comp("K1", "bobina-contattore")],
      fili: [filo("R:L", "K1nc:21"), filo("K1nc:22", "K1:A1"), filo("K1:A2", "R:N")],
    };
    const problemi = diagnosiRisultato(simula(c));
    expect(problemi.map((p) => [p.codice, p.componenti])).toEqual([["oscillazione", ["K1"]]]);
  });

  it("la sessione ricorda perché è intervenuta una protezione, fino al riarmo", () => {
    // Fusibile + pulsante che mette in corto fase e neutro.
    const c: Circuito = {
      componenti: [comp("R", "rete-monofase", ""), comp("F1", "fusibile"), comp("S1", "pulsante-na")],
      fili: [filo("R:L", "F1:1"), filo("F1:2", "S1:13"), filo("S1:14", "R:N")],
    };
    let s = avviaSessione(c);
    expect(problemiSessione(s)).toEqual([]);
    s = clicGiu(s, "S1");
    expect(problemiSessione(s).map((p) => [p.codice, p.componenti, p.poli])).toEqual([
      ["interventoCortocircuito", ["F1"], ["L1", "N"]],
    ]);
    // Il motivo resta anche negli istanti successivi.
    s = passo(s, 1);
    expect(problemiSessione(s).map((p) => p.codice)).toEqual(["interventoCortocircuito"]);
    // Riarmo (il pulsante è ancora premuto: interviene di nuovo).
    s = clicGiu(s, "F1");
    expect(problemiSessione(s).map((p) => p.codice)).toEqual(["interventoCortocircuito"]);
  });

  it("intervento del relè termico per sovraccarico", () => {
    const c: Circuito = {
      componenti: [comp("RT", "rete-trifase", ""), comp("F1", "rele-termico"), comp("M1", "motore-trifase")],
      fili: [
        filo("RT:L1", "F1:1"),
        filo("RT:L2", "F1:3"),
        filo("RT:L3", "F1:5"),
        filo("F1:2", "M1:U"),
        filo("F1:4", "M1:V"),
        filo("F1:6", "M1:W"),
      ],
    };
    let s = clicGiu(avviaSessione(c), "M1");
    s = passo(s, TEMPO_INTERVENTO_TERMICO + 0.1);
    expect(problemiSessione(s).map((p) => [p.codice, p.componenti])).toEqual([["interventoSovraccarico", ["F1"]]]);
    s = clicGiu(s, "F1"); // riarmo: il motivo sparisce (il sovraccarico riparte da zero)
    expect(problemiSessione(s)).toEqual([]);
  });

  it("gli errori vengono prima degli avvisi e i problemi dello schema restano visibili", () => {
    const c: Circuito = {
      componenti: [comp("R", "rete-monofase", ""), comp("S1", "pulsante-na"), comp("Kx", "contatto-na", "")],
      fili: [filo("R:L", "S1:13"), filo("S1:14", "R:N")],
    };
    const s = clicGiu(avviaSessione(c), "S1");
    expect(problemiSessione(s).map((p) => p.codice)).toEqual(["cortocircuito", "contattoSenzaBobina"]);
    expect(ordinaProblemi([]).length).toBe(0);
  });
});
