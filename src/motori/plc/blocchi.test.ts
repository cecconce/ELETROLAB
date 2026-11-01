// Test dei temporizzatori (TON, TOF, TP), dei contatori (CTU, CTD), del
// reset dei blocchi e dello scorrere del tempo del PLC.
import { describe, expect, it } from "vitest";
import {
  avanzaPlc,
  bobina,
  ctd,
  ctu,
  leggiBlocco,
  limitaTempoCiclo,
  na,
  nc,
  operandoContattoValido,
  reset,
  scansione,
  serie,
  parallelo,
  statoInizialePlc,
  TEMPO_CICLO_MASSIMO,
  TEMPO_CICLO_MINIMO,
  TEMPO_CICLO_PREDEFINITO,
  ton,
  tof,
  tp,
  type ProgrammaLadder,
  type StatoPlc,
} from "./index";

/** Simulatore minimo: tiene lo stato e fa scorrere il tempo a cicli regolari. */
function plc(programma: ProgrammaLadder, tempoCiclo = 0.05) {
  let stato: StatoPlc = statoInizialePlc();
  let ingressi: Record<string, boolean> = {};
  let uscite: string[] = [];
  const api = {
    premi: (...i: string[]) => {
      ingressi = Object.fromEntries(i.map((x) => [x, true]));
      return api.attendi(0);
    },
    attendi: (secondi: number) => {
      // Con 0 secondi: un solo ciclo senza far passare tempo (subito dopo un clic).
      const r = secondi === 0 ? scansione(programma, stato, ingressi, 0) : avanzaPlc(programma, stato, ingressi, secondi, tempoCiclo);
      stato = r.stato;
      uscite = r.usciteAttive;
      return api;
    },
    get uscite() {
      return uscite;
    },
    get stato() {
      return stato;
    },
  };
  return api;
}

describe("operandi di temporizzatori e contatori", () => {
  it("riconosce T0…T63 e C0…C63", () => {
    expect(leggiBlocco("T0")).toEqual({ area: "T", numero: 0 });
    expect(leggiBlocco("c 12")).toEqual({ area: "C", numero: 12 });
    expect(leggiBlocco("T64")).toBeNull();
    expect(leggiBlocco("T0.0")).toBeNull();
    expect(operandoContattoValido("T5")).toBe(true);
    expect(operandoContattoValido("I0.0")).toBe(true);
    expect(operandoContattoValido("X1")).toBe(false);
  });
});

describe("TON – ritardo all'inserzione", () => {
  // I0.0 avvia il temporizzatore T0 da 2 s; il contatto T0 accende Q0.0.
  const programma: ProgrammaLadder = {
    segmenti: [
      { logica: na("I0.0"), uscite: [ton("T0", 2)] },
      { logica: na("T0"), uscite: [bobina("Q0.0")] },
    ],
  };

  it("l'uscita si accende dopo il tempo impostato", () => {
    const p = plc(programma).premi("I0.0");
    p.attendi(1.9);
    expect(p.uscite).toEqual([]);
    expect(p.stato.temporizzatori.T0.trascorso).toBeCloseTo(1.9);
    p.attendi(0.1);
    expect(p.uscite).toEqual(["Q0.0"]);
  });

  it("se l'ingresso si apre prima, riparte da zero", () => {
    const p = plc(programma).premi("I0.0").attendi(1.5).premi().attendi(0.5).premi("I0.0").attendi(1.5);
    expect(p.uscite).toEqual([]);
    p.attendi(0.5);
    expect(p.uscite).toEqual(["Q0.0"]);
  });

  it("si spegne subito quando l'ingresso si apre", () => {
    const p = plc(programma).premi("I0.0").attendi(3);
    expect(p.uscite).toEqual(["Q0.0"]);
    p.premi();
    expect(p.uscite).toEqual([]);
    expect(p.stato.temporizzatori.T0.trascorso).toBe(0);
  });

  it("il tempo trascorso non supera il preset", () => {
    const p = plc(programma).premi("I0.0").attendi(10);
    expect(p.stato.temporizzatori.T0.trascorso).toBe(2);
  });
});

describe("TOF – ritardo alla disinserzione", () => {
  const programma: ProgrammaLadder = {
    segmenti: [
      { logica: na("I0.0"), uscite: [tof("T1", 3)] },
      { logica: na("T1"), uscite: [bobina("Q0.0")] },
    ],
  };

  it("a riposo l'uscita è spenta", () => {
    expect(plc(programma).attendi(1).uscite).toEqual([]);
  });

  it("si accende subito e si spegne 3 s dopo il rilascio (luce scale)", () => {
    const p = plc(programma).premi("I0.0");
    expect(p.uscite).toEqual(["Q0.0"]);
    p.premi().attendi(2.9);
    expect(p.uscite).toEqual(["Q0.0"]);
    p.attendi(0.1);
    expect(p.uscite).toEqual([]);
  });

  it("una nuova pressione durante il ritardo lo fa ripartire", () => {
    const p = plc(programma).premi("I0.0").premi().attendi(2).premi("I0.0").premi().attendi(2);
    expect(p.uscite).toEqual(["Q0.0"]);
    p.attendi(1);
    expect(p.uscite).toEqual([]);
  });
});

describe("TP – impulso", () => {
  const programma: ProgrammaLadder = {
    segmenti: [
      { logica: na("I0.0"), uscite: [tp("T2", 1)] },
      { logica: na("T2"), uscite: [bobina("Q0.0")] },
    ],
  };

  it("un tocco breve dà un impulso di durata fissa", () => {
    const p = plc(programma).premi("I0.0").attendi(0.1).premi();
    expect(p.uscite).toEqual(["Q0.0"]);
    p.attendi(0.85);
    expect(p.uscite).toEqual(["Q0.0"]);
    p.attendi(0.1);
    expect(p.uscite).toEqual([]);
  });

  it("tenendo premuto l'impulso non si allunga e non riparte", () => {
    const p = plc(programma).premi("I0.0").attendi(3);
    expect(p.uscite).toEqual([]);
    expect(p.stato.temporizzatori.T2.trascorso).toBe(1);
    p.premi();
    expect(p.stato.temporizzatori.T2.trascorso).toBe(0);
    p.premi("I0.0");
    expect(p.uscite).toEqual(["Q0.0"]);
  });
});

describe("contatori", () => {
  it("CTU conta i fronti e accende l'uscita al preset; il reset lo azzera", () => {
    const programma: ProgrammaLadder = {
      segmenti: [
        { logica: na("I0.0"), uscite: [ctu("C0", 3)] },
        { logica: na("I0.1"), uscite: [reset("C0")] },
        { logica: na("C0"), uscite: [bobina("Q0.0")] },
      ],
    };
    const p = plc(programma);
    // Tenere premuto non conta più volte: conta solo il fronte.
    p.premi("I0.0").attendi(1).premi().premi("I0.0").premi();
    expect(p.stato.contatori.C0.conteggio).toBe(2);
    expect(p.uscite).toEqual([]);
    p.premi("I0.0").premi();
    expect(p.uscite).toEqual(["Q0.0"]);
    // Oltre il preset continua a contare, l'uscita resta accesa.
    p.premi("I0.0").premi();
    expect(p.stato.contatori.C0.conteggio).toBe(4);
    p.premi("I0.1");
    expect(p.stato.contatori.C0.conteggio).toBe(0);
    expect(p.uscite).toEqual([]);
  });

  it("CTD parte dal preset, scende a ogni fronte e il reset lo ricarica", () => {
    const programma: ProgrammaLadder = {
      segmenti: [
        { logica: na("I0.0"), uscite: [ctd("C1", 2)] },
        { logica: na("I0.1"), uscite: [reset("C1")] },
        { logica: na("C1"), uscite: [bobina("Q0.1")] },
      ],
    };
    const p = plc(programma).attendi(0.1);
    expect(p.stato.contatori.C1.conteggio).toBe(2);
    p.premi("I0.0").premi();
    expect(p.uscite).toEqual([]);
    p.premi("I0.0").premi();
    expect(p.uscite).toEqual(["Q0.1"]);
    p.premi("I0.1");
    expect(p.stato.contatori.C1.conteggio).toBe(2);
    expect(p.uscite).toEqual([]);
  });

  it("parcheggio: entrate in avanti, uscite all'indietro sullo stesso contatore", () => {
    // Due blocchi sullo stesso C0: CTU per le auto che entrano, CTD per quelle che escono.
    const programma: ProgrammaLadder = {
      segmenti: [
        { logica: na("I0.0"), uscite: [ctu("C0", 2)] },
        { logica: na("I0.1"), uscite: [ctd("C0", 2)] },
        { logica: na("C0"), uscite: [bobina("Q0.0")] }, // "COMPLETO"
      ],
    };
    const p = plc(programma);
    p.premi("I0.0").premi();
    expect(p.uscite).toEqual([]);
    p.premi("I0.0").premi();
    expect(p.stato.contatori.C0.conteggio).toBe(2);
    expect(p.uscite).toEqual(["Q0.0"]); // pieno
    p.premi("I0.1").premi();
    expect(p.stato.contatori.C0.conteggio).toBe(1);
    expect(p.uscite).toEqual([]); // c'è di nuovo posto
  });
});

describe("reset dei temporizzatori e combinazioni", () => {
  it("il reset ferma un TON in corso", () => {
    const programma: ProgrammaLadder = {
      segmenti: [
        { logica: na("I0.0"), uscite: [ton("T0", 1)] },
        { logica: na("I0.1"), uscite: [reset("T0")] },
        { logica: na("T0"), uscite: [bobina("Q0.0")] },
      ],
    };
    const p = plc(programma).premi("I0.0").attendi(2);
    expect(p.uscite).toEqual(["Q0.0"]);
    p.premi("I0.0", "I0.1");
    expect(p.uscite).toEqual([]);
  });

  it("lampeggiatore con due TON: 0,5 s acceso e 0,5 s spento", () => {
    const programma: ProgrammaLadder = {
      segmenti: [
        { logica: nc("T1"), uscite: [ton("T0", 0.5)] },
        { logica: na("T0"), uscite: [ton("T1", 0.5)] },
        { logica: serie(na("I0.0"), na("T0")), uscite: [bobina("Q0.0")] },
      ],
    };
    const p = plc(programma).premi("I0.0");
    const campioni: boolean[] = [];
    for (let i = 0; i < 8; i++) {
      p.attendi(0.25);
      campioni.push(p.uscite.includes("Q0.0"));
    }
    // Il lampeggio deve alternarsi: almeno due accensioni e due spegnimenti.
    const cambi = campioni.filter((v, i) => i > 0 && v !== campioni[i - 1]).length;
    expect(cambi).toBeGreaterThanOrEqual(3);
  });

  it("autoritenuta con arresto automatico dopo 5 s (comando temporizzato)", () => {
    const programma: ProgrammaLadder = {
      segmenti: [
        { logica: serie(parallelo(na("I0.0"), na("Q0.0")), nc("T0")), uscite: [bobina("Q0.0")] },
        { logica: na("Q0.0"), uscite: [ton("T0", 5)] },
      ],
    };
    const p = plc(programma).premi("I0.0").premi().attendi(4.9);
    expect(p.uscite).toEqual(["Q0.0"]);
    p.attendi(0.2);
    expect(p.uscite).toEqual([]);
  });

  it("operandi sbagliati nei blocchi vengono ignorati senza errori", () => {
    const programma: ProgrammaLadder = {
      segmenti: [{ logica: null, uscite: [ton("C0", 1), ctu("T0", 1), ton("T99", 1)] }],
    };
    const p = plc(programma).attendi(2);
    expect(p.stato.temporizzatori).toEqual({});
    expect(p.stato.contatori).toEqual({});
  });
});

describe("tempo di ciclo", () => {
  it("il tempo totale è la somma dei cicli", () => {
    const p = plc({ segmenti: [] }).attendi(1);
    expect(p.stato.tempo).toBeCloseTo(1);
    expect(p.stato.cicli).toBe(20);
  });

  it("con un tempo di ciclo lungo i temporizzatori sono meno precisi", () => {
    // Ciclo di 0,3 s: un TON da 1 s si accende solo al quarto ciclo (1,2 s).
    const programma: ProgrammaLadder = { segmenti: [{ logica: na("I0.0"), uscite: [ton("T0", 1)] }] };
    const p = plc(programma, 0.3).premi("I0.0").attendi(0.9);
    expect(p.stato.temporizzatori.T0.uscita).toBe(false);
    p.attendi(0.3);
    expect(p.stato.temporizzatori.T0.uscita).toBe(true);
  });

  it("il tempo di ciclo resta fra i limiti ammessi", () => {
    expect(limitaTempoCiclo(0)).toBe(TEMPO_CICLO_MINIMO);
    expect(limitaTempoCiclo(5)).toBe(TEMPO_CICLO_MASSIMO);
    expect(limitaTempoCiclo(Number.NaN)).toBe(TEMPO_CICLO_PREDEFINITO);
    expect(limitaTempoCiclo(0.1)).toBe(0.1);
  });

  it("un dt negativo o non valido non fa tornare indietro il tempo", () => {
    const r = scansione({ segmenti: [] }, statoInizialePlc(), {}, -1);
    expect(r.stato.tempo).toBe(0);
    expect(scansione({ segmenti: [] }, statoInizialePlc(), {}, Number.NaN).stato.tempo).toBe(0);
  });
});
