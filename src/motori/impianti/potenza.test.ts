// Test dell'attività 2.4: verso di rotazione dei motori, stella/triangolo,
// protezioni (fusibile, magnetotermico, salvamotore, relè termico),
// temporizzatori con il tempo che scorre.
import { describe, expect, it } from "vitest";
import { simula, simulaConProtezioni, type Circuito, type ComponenteCircuito, type FiloCircuito } from "./simulatore";
import { avanza, prossimoEvento, riarma, statoIniziale, type AzioniStudente, type StatoImpianto } from "./tempo";
import { TEMPO_INTERVENTO_TERMICO } from "./modelli";

function filo(da: string, a: string): FiloCircuito {
  const [c1, m1] = da.split(":");
  const [c2, m2] = a.split(":");
  return { da: { componente: c1, morsetto: m1 }, a: { componente: c2, morsetto: m2 } };
}
const comp = (id: string, tipo: string, etichetta = id, tempo?: number): ComponenteCircuito =>
  tempo === undefined ? { id, tipo, etichetta } : { id, tipo, etichetta, tempo };

/** Fa avanzare la simulazione a passi di 0,1 s per `secondi`. */
function scorri(c: Circuito, stato: StatoImpianto, azioni: AzioniStudente, secondi: number) {
  let s = stato;
  let r = avanza(c, s, azioni, 0);
  s = r.stato;
  for (let i = 0; i < Math.round(secondi * 10); i++) {
    r = avanza(c, s, azioni, 0.1);
    s = r.stato;
  }
  return r;
}

describe("verso di rotazione dei motori", () => {
  const motore = (u: string, v: string, w: string): Circuito => ({
    componenti: [comp("RETE", "rete-trifase", ""), comp("M1", "motore-trifase")],
    fili: [filo(`RETE:${u}`, "M1:U"), filo(`RETE:${v}`, "M1:V"), filo(`RETE:${w}`, "M1:W")],
  });

  it("terna L1-L2-L3 → orario; scambiando due fasi → antiorario", () => {
    expect(simula(motore("L1", "L2", "L3")).motori).toEqual({ M1: { verso: "orario" } });
    expect(simula(motore("L2", "L3", "L1")).motori).toEqual({ M1: { verso: "orario" } });
    expect(simula(motore("L2", "L1", "L3")).motori).toEqual({ M1: { verso: "antiorario" } });
    expect(simula(motore("L1", "L3", "L2")).motori).toEqual({ M1: { verso: "antiorario" } });
  });

  it("con due morsetti sulla stessa fase o con il neutro il motore non parte", () => {
    expect(simula(motore("L1", "L1", "L3")).motori).toEqual({});
    const conNeutro: Circuito = {
      componenti: [comp("RT", "rete-trifase", ""), comp("RM", "rete-monofase", ""), comp("M1", "motore-trifase")],
      fili: [filo("RT:L1", "M1:U"), filo("RT:L2", "M1:V"), filo("RM:N", "M1:W")],
    };
    expect(simula(conNeutro).carichiAlimentati).toEqual([]);
  });

  it("motore monofase: gira con fase e neutro", () => {
    const c: Circuito = {
      componenti: [comp("RETE", "rete-monofase", ""), comp("M1", "motore-monofase")],
      fili: [filo("RETE:L", "M1:U1"), filo("M1:U2", "RETE:N")],
    };
    expect(simula(c).motori).toEqual({ M1: { verso: "orario" } });
  });

  it("motore in CC: il verso dipende dalla polarità; in alternata non gira", () => {
    const cc = (a1: string, a2: string): Circuito => ({
      componenti: [comp("ALIM", "alimentatore-cc", ""), comp("M1", "motore-cc")],
      fili: [filo(`ALIM:${a1}`, "M1:A1"), filo(`ALIM:${a2}`, "M1:A2")],
    });
    expect(simula(cc("+", "-")).motori).toEqual({ M1: { verso: "orario" } });
    expect(simula(cc("-", "+")).motori).toEqual({ M1: { verso: "antiorario" } });
  });

  it("un carico fra un polo in continua e uno in alternata resta spento", () => {
    const misto: Circuito = {
      componenti: [comp("ALIM", "alimentatore-cc", ""), comp("RM", "rete-monofase", ""), comp("H1", "lampada")],
      fili: [filo("ALIM:+", "H1:X1"), filo("H1:X2", "RM:N")],
    };
    expect(simula(misto).carichiAlimentati).toEqual([]);
    const giusto: Circuito = { ...misto, fili: [filo("ALIM:+", "H1:X1"), filo("H1:X2", "ALIM:-")] };
    expect(simula(giusto).carichiAlimentati).toEqual(["H1"]);
  });

  it("i poli + e - uniti sono un cortocircuito", () => {
    const corto: Circuito = { componenti: [comp("ALIM", "alimentatore-cc", "")], fili: [filo("ALIM:+", "ALIM:-")] };
    expect(simula(corto).cortocircuiti[0].poli).toEqual(["+", "-"]);
  });
});

describe("motore a 6 morsetti: stella e triangolo", () => {
  const linee = [filo("RETE:L1", "M1:U1"), filo("RETE:L2", "M1:V1"), filo("RETE:L3", "M1:W1")];
  const base = [comp("RETE", "rete-trifase", ""), comp("M1", "motore-trifase-6")];

  it("U2, V2, W2 unite fra loro → stella", () => {
    const c: Circuito = { componenti: base, fili: [...linee, filo("M1:U2", "M1:V2"), filo("M1:V2", "M1:W2")] };
    expect(simula(c).motori).toEqual({ M1: { verso: "orario", collegamento: "stella" } });
  });

  it("U1-W2, V1-U2, W1-V2 → triangolo", () => {
    const c: Circuito = {
      componenti: base,
      fili: [...linee, filo("RETE:L1", "M1:W2"), filo("RETE:L2", "M1:U2"), filo("RETE:L3", "M1:V2")],
    };
    expect(simula(c).motori).toEqual({ M1: { verso: "orario", collegamento: "triangolo" } });
  });

  it("avvolgimenti scollegati o triangolo sbagliato → il motore non parte", () => {
    expect(simula({ componenti: base, fili: linee }).motori).toEqual({});
    const sbagliato: Circuito = {
      componenti: base,
      fili: [...linee, filo("RETE:L1", "M1:U2"), filo("RETE:L2", "M1:V2"), filo("RETE:L3", "M1:W2")],
    };
    expect(simula(sbagliato).motori).toEqual({});
  });
});

describe("protezioni contro il cortocircuito", () => {
  /** Rete → fusibile F1 → pulsante S1 che, premuto, mette in corto fase e neutro. */
  const guasto = (protezione: string): Circuito => ({
    componenti: [comp("RETE", "rete-monofase", ""), comp("F1", protezione), comp("S1", "pulsante-na"), comp("H1", "lampada")],
    fili: [
      filo("RETE:L", "F1:1"),
      filo("F1:2", "H1:X1"),
      filo("H1:X2", "RETE:N"),
      filo("F1:2", "S1:13"),
      filo("S1:14", "RETE:N"),
    ],
  });

  for (const protezione of ["fusibile", "magnetotermico"]) {
    it(`il ${protezione} interviene e il cortocircuito si interrompe`, () => {
      expect(simula(guasto(protezione), { premuti: ["S1"] }).cortocircuiti).toHaveLength(1);
      const r = simulaConProtezioni(guasto(protezione), { premuti: ["S1"] });
      expect(r.cortocircuiti).toEqual([]);
      expect(r.interventi).toEqual([{ protezione: "F1", poli: ["L1", "N"] }]);
      expect(r.protezioniIntervenute).toEqual(["F1"]);
      expect(r.carichiAlimentati).toEqual([]);
    });
  }

  it("senza guasto la protezione non interviene", () => {
    const r = simulaConProtezioni(guasto("fusibile"));
    expect(r.interventi).toEqual([]);
    expect(r.carichiAlimentati).toEqual(["H1"]);
  });

  it("senza protezioni il cortocircuito resta segnalato", () => {
    const c: Circuito = {
      componenti: [comp("RETE", "rete-monofase", ""), comp("S1", "pulsante-na")],
      fili: [filo("RETE:L", "S1:13"), filo("S1:14", "RETE:N")],
    };
    const r = simulaConProtezioni(c, { premuti: ["S1"] });
    expect(r.cortocircuiti).toHaveLength(1);
    expect(r.interventi).toEqual([]);
  });

  it("la protezione interrotta resta aperta finché non si riarma", () => {
    const c = guasto("fusibile");
    let { stato } = avanza(c, statoIniziale(), { premuti: ["S1"] }, 0);
    expect(stato.protezioniIntervenute).toEqual(["F1"]);
    // Rilasciato il pulsante il guasto non c'è più, ma il fusibile è ancora interrotto.
    let r = avanza(c, stato, {}, 0.1);
    expect(r.risultato.carichiAlimentati).toEqual([]);
    stato = riarma(r.stato, "F1");
    r = avanza(c, stato, {}, 0.1);
    expect(r.risultato.carichiAlimentati).toEqual(["H1"]);
  });

  it("selettività: interviene il fusibile più vicino al guasto", () => {
    // F1 protegge tutto, F2 solo il ramo con la lampada H2 e il pulsante di guasto S1.
    const c: Circuito = {
      componenti: [
        comp("RETE", "rete-monofase", ""),
        comp("F1", "fusibile"),
        comp("F2", "fusibile"),
        comp("H1", "lampada"),
        comp("H2", "lampada"),
        comp("S1", "pulsante-na"),
      ],
      fili: [
        filo("RETE:L", "F1:1"),
        filo("F1:2", "H1:X1"),
        filo("H1:X2", "RETE:N"),
        filo("F1:2", "F2:1"),
        filo("F2:2", "H2:X1"),
        filo("H2:X2", "RETE:N"),
        filo("F2:2", "S1:13"),
        filo("S1:14", "RETE:N"),
      ],
    };
    const r = simulaConProtezioni(c, { premuti: ["S1"] });
    expect(r.interventi.map((i) => i.protezione)).toEqual(["F2"]);
    expect(r.carichiAlimentati).toEqual(["H1"]);
  });

  it("il salvamotore chiuso interviene in cortocircuito, quello aperto no", () => {
    const c: Circuito = {
      componenti: [comp("RETE", "rete-trifase", ""), comp("Q1", "salvamotore")],
      fili: [filo("RETE:L1", "Q1:1"), filo("RETE:L2", "Q1:3"), filo("RETE:L3", "Q1:5"), filo("Q1:2", "Q1:4")],
    };
    expect(simulaConProtezioni(c).interventi).toEqual([]);
    const r = simulaConProtezioni(c, { azionati: ["Q1"] });
    expect(r.interventi).toEqual([{ protezione: "Q1", poli: ["L1", "L2"] }]);
    // Scattato resta aperto anche se lo studente lo considera ancora chiuso.
    expect(r.contattiChiusi).toEqual([]);
  });
});

/**
 * Teleinvertitore (solo potenza): KA dà la terna diretta, KB scambia L1 e L2.
 * Senza interblocco, chiudendo entrambi si ha un cortocircuito fra le fasi.
 */
describe("teleinvertitore: verso e cortocircuito senza interblocco", () => {
  const c: Circuito = {
    componenti: [
      comp("RT", "rete-trifase", ""),
      comp("FU1", "fusibile"),
      comp("FU2", "fusibile"),
      comp("FU3", "fusibile"),
      comp("RM", "rete-monofase", ""),
      comp("SA", "selettore"),
      comp("SB", "selettore"),
      comp("KA", "bobina-contattore"),
      comp("KB", "bobina-contattore"),
      comp("KAp", "contatti-principali", "KA"),
      comp("KBp", "contatti-principali", "KB"),
      comp("M1", "motore-trifase"),
    ],
    fili: [
      filo("RT:L1", "FU1:1"),
      filo("RT:L2", "FU2:1"),
      filo("RT:L3", "FU3:1"),
      filo("FU1:2", "KAp:1"),
      filo("FU2:2", "KAp:3"),
      filo("FU3:2", "KAp:5"),
      filo("FU1:2", "KBp:3"),
      filo("FU2:2", "KBp:1"),
      filo("FU3:2", "KBp:5"),
      filo("KAp:2", "M1:U"),
      filo("KAp:4", "M1:V"),
      filo("KAp:6", "M1:W"),
      filo("KBp:2", "M1:U"),
      filo("KBp:4", "M1:V"),
      filo("KBp:6", "M1:W"),
      filo("RM:L", "SA:13"),
      filo("SA:14", "KA:A1"),
      filo("KA:A2", "RM:N"),
      filo("RM:L", "SB:13"),
      filo("SB:14", "KB:A1"),
      filo("KB:A2", "RM:N"),
    ],
  };

  it("KA → orario, KB → antiorario", () => {
    expect(simulaConProtezioni(c, { azionati: ["SA"] }).motori).toEqual({ M1: { verso: "orario" } });
    expect(simulaConProtezioni(c, { azionati: ["SB"] }).motori).toEqual({ M1: { verso: "antiorario" } });
  });

  it("KA e KB insieme: cortocircuito fra L1 e L2, interviene un fusibile e il motore si ferma", () => {
    const r = simulaConProtezioni(c, { azionati: ["SA", "SB"] });
    expect(r.cortocircuiti).toEqual([]);
    expect(r.interventi).toHaveLength(1);
    expect(["FU1", "FU2"]).toContain(r.interventi[0].protezione);
    expect(r.interventi[0].poli).toEqual(["L1", "L2"]);
    expect(r.motori).toEqual({});
  });
});

describe("relè termico e sovraccarico", () => {
  /**
   * Avviamento diretto con autoritenuta.
   * Potenza: L1-L2-L3 → K1 (principali) → F1 (relè termico) → M1.
   * Comando: L → F1 95-96 → S0 (NC) → S1 (NA) ∥ K1 13-14 → K1 → N; H1 su F1 97-98.
   */
  const c: Circuito = {
    componenti: [
      comp("RT", "rete-trifase", ""),
      comp("RM", "rete-monofase", ""),
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
      filo("RT:L1", "KP:1"),
      filo("RT:L2", "KP:3"),
      filo("RT:L3", "KP:5"),
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

  it("in sovraccarico il relè interviene dopo il tempo previsto, ferma il motore e accende la spia", () => {
    // Marcia.
    let r = avanza(c, statoIniziale(), { premuti: ["S1"] }, 0);
    r = avanza(c, r.stato, {}, 0.1);
    expect(r.risultato.motori).toEqual({ M1: { verso: "orario" } });
    // Sovraccarico: per un po' il motore continua a girare.
    r = avanza(c, r.stato, { sovraccarichi: ["M1"] }, 0.1);
    expect(r.risultato.protezioniInSovraccarico).toEqual(["F1"]);
    expect(prossimoEvento(c, r.stato)).toBeCloseTo(TEMPO_INTERVENTO_TERMICO);
    r = scorri(c, r.stato, { sovraccarichi: ["M1"] }, TEMPO_INTERVENTO_TERMICO - 0.5);
    expect(r.risultato.motori).toHaveProperty("M1");
    r = scorri(c, r.stato, { sovraccarichi: ["M1"] }, 1);
    expect(r.stato.protezioniIntervenute).toEqual(["F1"]);
    expect(r.risultato.motori).toEqual({});
    expect(r.risultato.carichiAlimentati).toEqual(["H1"]);
    // Premere marcia non serve: il 95-96 è aperto.
    r = avanza(c, r.stato, { premuti: ["S1"] }, 0.1);
    expect(r.risultato.bobineEccitate).toEqual([]);
    // Riarmo: spia spenta, il motore riparte solo con un nuovo comando di marcia.
    let s = riarma(r.stato, "F1");
    r = avanza(c, s, {}, 0.1);
    expect(r.risultato.carichiAlimentati).toEqual([]);
    r = avanza(c, r.stato, { premuti: ["S1"] }, 0.1);
    expect(r.risultato.motori).toHaveProperty("M1");
    s = r.stato;
    expect(s.protezioniIntervenute).toEqual([]);
  });

  it("se il sovraccarico finisce prima del tempo il relè non interviene", () => {
    let r = avanza(c, statoIniziale(), { premuti: ["S1"] }, 0);
    r = scorri(c, r.stato, { sovraccarichi: ["M1"] }, TEMPO_INTERVENTO_TERMICO / 2);
    r = scorri(c, r.stato, {}, 0.5);
    expect(r.stato.sovraccaricoDa).toEqual({});
    r = scorri(c, r.stato, { sovraccarichi: ["M1"] }, TEMPO_INTERVENTO_TERMICO / 2);
    expect(r.stato.protezioniIntervenute).toEqual([]);
  });

  it("un motore fermo in sovraccarico non fa intervenire il relè", () => {
    const r = scorri(c, statoIniziale(), { sovraccarichi: ["M1"] }, TEMPO_INTERVENTO_TERMICO + 1);
    expect(r.stato.protezioniIntervenute).toEqual([]);
  });
});

describe("temporizzatori con il tempo che scorre", () => {
  /** S1 (selettore) → bobina KT1; contatto KT1 17-18 → lampada H1. */
  const circuito = (tipo: string, tempo: number): Circuito => ({
    componenti: [
      comp("RETE", "rete-monofase", ""),
      comp("S1", "selettore"),
      comp("KT1", tipo, "KT1", tempo),
      comp("KTna", "contatto-temporizzato-na", "KT1"),
      comp("H1", "lampada"),
    ],
    fili: [
      filo("RETE:L", "S1:13"),
      filo("S1:14", "KT1:A1"),
      filo("KT1:A2", "RETE:N"),
      filo("RETE:L", "KTna:17"),
      filo("KTna:18", "H1:X1"),
      filo("H1:X2", "RETE:N"),
    ],
  });
  const accesa = (r: ReturnType<typeof avanza>) => r.risultato.carichiAlimentati.includes("H1");

  it("ritardato all'eccitazione: la lampada si accende dopo il tempo impostato", () => {
    const c = circuito("bobina-ritardata-eccitazione", 2);
    let r = avanza(c, statoIniziale(), { azionati: ["S1"] }, 0);
    expect(r.risultato.bobineEccitate).toEqual(["KT1"]);
    expect(accesa(r)).toBe(false);
    expect(prossimoEvento(c, r.stato)).toBeCloseTo(2);
    r = scorri(c, r.stato, { azionati: ["S1"] }, 1.9);
    expect(accesa(r)).toBe(false);
    r = scorri(c, r.stato, { azionati: ["S1"] }, 0.1);
    expect(accesa(r)).toBe(true);
    expect(r.risultato.temporizzatoriCommutati).toEqual(["KT1"]);
    // Tolta tensione si spegne subito.
    r = avanza(c, r.stato, {}, 0.1);
    expect(accesa(r)).toBe(false);
  });

  it("ritardato all'eccitazione: se la tensione manca prima del tempo il conteggio riparte", () => {
    const c = circuito("bobina-ritardata-eccitazione", 2);
    let r = scorri(c, statoIniziale(), { azionati: ["S1"] }, 1.5);
    r = avanza(c, r.stato, {}, 0.1);
    r = scorri(c, r.stato, { azionati: ["S1"] }, 1.5);
    expect(accesa(r)).toBe(false);
    r = scorri(c, r.stato, { azionati: ["S1"] }, 0.5);
    expect(accesa(r)).toBe(true);
  });

  it("ritardato alla diseccitazione: si accende subito e si spegne dopo il tempo", () => {
    const c = circuito("bobina-ritardata-diseccitazione", 3);
    let r = avanza(c, statoIniziale(), { azionati: ["S1"] }, 0);
    expect(accesa(r)).toBe(true);
    r = avanza(c, r.stato, {}, 0.1);
    expect(r.risultato.bobineEccitate).toEqual([]);
    expect(accesa(r)).toBe(true);
    expect(prossimoEvento(c, r.stato)).toBeCloseTo(3);
    r = scorri(c, r.stato, {}, 2.8);
    expect(accesa(r)).toBe(true);
    r = scorri(c, r.stato, {}, 0.2);
    expect(accesa(r)).toBe(false);
    expect(prossimoEvento(c, r.stato)).toBeNull();
  });

  it("il tempo mancante o fuori dai limiti usa i valori ammessi", () => {
    const senza = circuito("bobina-ritardata-eccitazione", 0);
    const c: Circuito = { ...senza, componenti: senza.componenti.map((x) => (x.id === "KT1" ? { ...x, tempo: -5 } : x)) };
    expect(accesa(avanza(c, statoIniziale(), { azionati: ["S1"] }, 0))).toBe(true);
    const predefinito: Circuito = {
      ...senza,
      componenti: senza.componenti.map((x) => (x.id === "KT1" ? { id: x.id, tipo: x.tipo, etichetta: x.etichetta } : x)),
    };
    const r = avanza(predefinito, statoIniziale(), { azionati: ["S1"] }, 0);
    expect(prossimoEvento(predefinito, r.stato)).toBeCloseTo(3);
  });
});

/**
 * Avviamento stella-triangolo completo con temporizzatore.
 * Potenza: L1-L2-L3 → KM → U1, V1, W1; KD collega U2-V2-W2 a L2-L3-L1 (triangolo);
 * KY unisce U2, V2, W2 (stella).
 * Comando: L → S0 → S1 ∥ KM 13-14 → nodo A; A → KM, A → KT, A → KT 15-16 → KD 21-22 → KY,
 * A → KT 17-18 → KY 21-22 → KD.
 */
describe("avviamento stella-triangolo", () => {
  const c: Circuito = {
    componenti: [
      comp("RT", "rete-trifase", ""),
      comp("RM", "rete-monofase", ""),
      comp("KMp", "contatti-principali", "KM"),
      comp("KDp", "contatti-principali", "KD"),
      comp("KYp", "contatti-principali", "KY"),
      comp("M1", "motore-trifase-6"),
      comp("S0", "pulsante-nc"),
      comp("S1", "pulsante-na"),
      comp("KMa", "contatto-na", "KM"),
      comp("KM", "bobina-contattore"),
      comp("KT", "bobina-ritardata-eccitazione", "KT", 4),
      comp("KTnc", "contatto-temporizzato-nc", "KT"),
      comp("KTna", "contatto-temporizzato-na", "KT"),
      comp("KDnc", "contatto-nc", "KD"),
      comp("KYnc", "contatto-nc", "KY"),
      comp("KY", "bobina-contattore"),
      comp("KD", "bobina-contattore"),
    ],
    fili: [
      // Potenza.
      filo("RT:L1", "KMp:1"),
      filo("RT:L2", "KMp:3"),
      filo("RT:L3", "KMp:5"),
      filo("KMp:2", "M1:U1"),
      filo("KMp:4", "M1:V1"),
      filo("KMp:6", "M1:W1"),
      filo("KMp:4", "KDp:1"),
      filo("KMp:6", "KDp:3"),
      filo("KMp:2", "KDp:5"),
      filo("KDp:2", "M1:U2"),
      filo("KDp:4", "M1:V2"),
      filo("KDp:6", "M1:W2"),
      filo("M1:U2", "KYp:1"),
      filo("M1:V2", "KYp:3"),
      filo("M1:W2", "KYp:5"),
      filo("KYp:2", "KYp:4"),
      filo("KYp:4", "KYp:6"),
      // Comando.
      filo("RM:L", "S0:11"),
      filo("S0:12", "S1:13"),
      filo("S1:14", "KM:A1"),
      filo("S0:12", "KMa:13"),
      filo("KMa:14", "KM:A1"),
      filo("KM:A1", "KT:A1"),
      filo("KM:A1", "KTnc:15"),
      filo("KTnc:16", "KDnc:21"),
      filo("KDnc:22", "KY:A1"),
      filo("KM:A1", "KTna:17"),
      filo("KTna:18", "KYnc:21"),
      filo("KYnc:22", "KD:A1"),
      filo("KM:A2", "RM:N"),
      filo("KT:A2", "RM:N"),
      filo("KY:A2", "RM:N"),
      filo("KD:A2", "RM:N"),
    ],
  };

  it("parte a stella e dopo il tempo del temporizzatore passa a triangolo", () => {
    let r = avanza(c, statoIniziale(), { premuti: ["S1"] }, 0);
    r = avanza(c, r.stato, {}, 0.1);
    expect([...r.risultato.bobineEccitate].sort()).toEqual(["KM", "KT", "KY"]);
    expect(r.risultato.motori).toEqual({ M1: { verso: "orario", collegamento: "stella" } });
    r = scorri(c, r.stato, {}, 3.8);
    expect(r.risultato.motori.M1?.collegamento).toBe("stella");
    r = scorri(c, r.stato, {}, 0.2);
    expect([...r.risultato.bobineEccitate].sort()).toEqual(["KD", "KM", "KT"]);
    expect(r.risultato.motori).toEqual({ M1: { verso: "orario", collegamento: "triangolo" } });
    expect(r.risultato.cortocircuiti).toEqual([]);
    // Arresto.
    r = avanza(c, r.stato, { premuti: ["S0"] }, 0.1);
    expect(r.risultato.bobineEccitate).toEqual([]);
    expect(r.risultato.motori).toEqual({});
  });
});
