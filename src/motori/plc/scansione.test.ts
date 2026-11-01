// Test del motore Ladder: operandi, contatti, bobine, set/reset, fronti,
// merker e ciclo di scansione.
import { describe, expect, it } from "vitest";
import {
  bobina,
  bobinaNegata,
  fronteDiscesa,
  fronteSalita,
  leggiOperando,
  na,
  nc,
  normalizzaOperando,
  operandoScrivibile,
  operandoValido,
  parallelo,
  reset,
  scansione,
  serie,
  set,
  statoInizialePlc,
  valoreBit,
  type ProgrammaLadder,
  type StatoPlc,
} from "./index";

/** Esegue una sequenza di cicli, uno per ogni insieme di ingressi premuti. */
function esegui(programma: ProgrammaLadder, sequenza: string[][], stato: StatoPlc = statoInizialePlc()) {
  const uscite: string[][] = [];
  for (const premuti of sequenza) {
    const ingressi = Object.fromEntries(premuti.map((i) => [i, true]));
    const r = scansione(programma, stato, ingressi);
    stato = r.stato;
    uscite.push(r.usciteAttive);
  }
  return { stato, uscite };
}

describe("operandi", () => {
  it("riconosce ingressi, uscite e merker a bit", () => {
    expect(leggiOperando("I0.0")).toEqual({ area: "I", byte: 0, bit: 0 });
    expect(leggiOperando("Q1.7")).toEqual({ area: "Q", byte: 1, bit: 7 });
    expect(leggiOperando("M10.3")).toEqual({ area: "M", byte: 10, bit: 3 });
  });

  it("accetta minuscole e spazi", () => {
    expect(normalizzaOperando(" i 0.1 ")).toBe("I0.1");
    expect(operandoValido("q0.0")).toBe(true);
  });

  it("rifiuta operandi non validi", () => {
    for (const t of ["", "X0.0", "I0.8", "I0", "Q.1", "I99.0", "I0.0.0"]) {
      expect(operandoValido(t)).toBe(false);
    }
  });

  it("gli ingressi non si possono scrivere", () => {
    expect(operandoScrivibile("I0.0")).toBe(false);
    expect(operandoScrivibile("Q0.0")).toBe(true);
    expect(operandoScrivibile("M0.0")).toBe(true);
    expect(operandoScrivibile("boh")).toBe(false);
  });
});

describe("contatti e bobine", () => {
  it("contatto NA: la lampada segue il pulsante", () => {
    const p: ProgrammaLadder = { segmenti: [{ logica: na("I0.0"), uscite: [bobina("Q0.0")] }] };
    expect(esegui(p, [[], ["I0.0"], []]).uscite).toEqual([[], ["Q0.0"], []]);
  });

  it("contatto NC: conduce a riposo", () => {
    const p: ProgrammaLadder = { segmenti: [{ logica: nc("I0.0"), uscite: [bobina("Q0.0")] }] };
    expect(esegui(p, [[], ["I0.0"]]).uscite).toEqual([["Q0.0"], []]);
  });

  it("serie = AND, parallelo = OR", () => {
    const p: ProgrammaLadder = {
      segmenti: [
        { logica: serie(na("I0.0"), na("I0.1")), uscite: [bobina("Q0.0")] },
        { logica: parallelo(na("I0.0"), na("I0.1")), uscite: [bobina("Q0.1")] },
      ],
    };
    const { uscite } = esegui(p, [[], ["I0.0"], ["I0.1"], ["I0.0", "I0.1"]]);
    expect(uscite).toEqual([[], ["Q0.1"], ["Q0.1"], ["Q0.0", "Q0.1"]]);
  });

  it("bobina negata e più uscite in parallelo", () => {
    const p: ProgrammaLadder = {
      segmenti: [{ logica: na("I0.0"), uscite: [bobina("Q0.0"), bobinaNegata("Q0.1")] }],
    };
    expect(esegui(p, [[], ["I0.0"]]).uscite).toEqual([["Q0.1"], ["Q0.0"]]);
  });

  it("segmento senza contatti: uscita sempre alimentata", () => {
    const p: ProgrammaLadder = { segmenti: [{ logica: null, uscite: [bobina("Q0.5")] }] };
    expect(esegui(p, [[]]).uscite).toEqual([["Q0.5"]]);
  });

  it("serie vuota conduce, parallelo vuoto no", () => {
    const p: ProgrammaLadder = {
      segmenti: [
        { logica: serie(), uscite: [bobina("Q0.0")] },
        { logica: parallelo(), uscite: [bobina("Q0.1")] },
      ],
    };
    expect(esegui(p, [[]]).uscite).toEqual([["Q0.0"]]);
  });

  it("le bobine sugli ingressi o con operando non valido non fanno nulla", () => {
    const p: ProgrammaLadder = {
      segmenti: [{ logica: null, uscite: [bobina("I0.0"), bobina("lampada")] }],
    };
    const { stato } = esegui(p, [[]]);
    expect(stato.bit).toEqual({});
  });
});

describe("marcia/arresto con autoritenuta", () => {
  // I0.0 = marcia (NA), I0.1 = arresto (pulsante NC cablato: vale 1 a riposo)
  const programma: ProgrammaLadder = {
    segmenti: [
      { logica: serie(parallelo(na("I0.0"), na("Q0.0")), na("I0.1")), uscite: [bobina("Q0.0")] },
    ],
  };

  it("si avvia con marcia, resta in moto, si ferma con arresto", () => {
    const { uscite } = esegui(programma, [
      ["I0.1"], //            a riposo
      ["I0.0", "I0.1"], //    premo marcia
      ["I0.1"], //            rilascio: autoritenuta
      ["I0.1"],
      [], //                  premo arresto (il NC si apre)
      ["I0.1"], //            rilascio: resta fermo
    ]);
    expect(uscite).toEqual([[], ["Q0.0"], ["Q0.0"], ["Q0.0"], [], []]);
  });

  it("indica quali contatti conducono e se il segmento è alimentato", () => {
    const r = scansione(programma, statoInizialePlc(), { "I0.0": true, "I0.1": true });
    // radice = serie; "0" = parallelo, "0.0" = I0.0, "0.1" = Q0.0, "1" = I0.1
    expect(r.segmenti[0].risultato).toBe(true);
    expect(r.segmenti[0].contattiChiusi.sort()).toEqual(["0.0", "1"]);
  });
});

describe("set e reset", () => {
  const programma: ProgrammaLadder = {
    segmenti: [
      { logica: na("I0.0"), uscite: [set("Q0.0")] },
      { logica: na("I0.1"), uscite: [reset("Q0.0")] },
    ],
  };

  it("set memorizza, reset cancella", () => {
    const { uscite } = esegui(programma, [["I0.0"], [], [], ["I0.1"], []]);
    expect(uscite).toEqual([["Q0.0"], ["Q0.0"], ["Q0.0"], [], []]);
  });

  it("con set e reset insieme vince il segmento scritto per ultimo", () => {
    expect(esegui(programma, [["I0.0", "I0.1"]]).uscite).toEqual([[]]);
    const invertito: ProgrammaLadder = { segmenti: [...programma.segmenti].reverse() };
    expect(esegui(invertito, [["I0.0", "I0.1"]]).uscite).toEqual([["Q0.0"]]);
  });
});

describe("merker e ordine dei segmenti", () => {
  it("un merker passa il risultato a un segmento successivo nello stesso ciclo", () => {
    const p: ProgrammaLadder = {
      segmenti: [
        { logica: na("I0.0"), uscite: [bobina("M0.0")] },
        { logica: na("M0.0"), uscite: [bobina("Q0.0")] },
      ],
    };
    expect(esegui(p, [["I0.0"]]).uscite).toEqual([["Q0.0"]]);
  });

  it("se il merker è letto prima di essere scritto, l'uscita arriva un ciclo dopo", () => {
    const p: ProgrammaLadder = {
      segmenti: [
        { logica: na("M0.0"), uscite: [bobina("Q0.0")] },
        { logica: na("I0.0"), uscite: [bobina("M0.0")] },
      ],
    };
    expect(esegui(p, [["I0.0"], ["I0.0"], []]).uscite).toEqual([[], ["Q0.0"], ["Q0.0"]]);
  });

  it("con due bobine sullo stesso operando vale l'ultima", () => {
    const p: ProgrammaLadder = {
      segmenti: [
        { logica: na("I0.0"), uscite: [bobina("Q0.0")] },
        { logica: na("I0.1"), uscite: [bobina("Q0.0")] },
      ],
    };
    expect(esegui(p, [["I0.0"], ["I0.1"]]).uscite).toEqual([[], ["Q0.0"]]);
  });
});

describe("fronti di salita e di discesa", () => {
  it("il fronte di salita conduce un solo ciclo", () => {
    const p: ProgrammaLadder = { segmenti: [{ logica: fronteSalita("I0.0"), uscite: [bobina("Q0.0")] }] };
    const { uscite } = esegui(p, [[], ["I0.0"], ["I0.0"], ["I0.0"], [], ["I0.0"]]);
    expect(uscite).toEqual([[], ["Q0.0"], [], [], [], ["Q0.0"]]);
  });

  it("il fronte di discesa conduce un solo ciclo al rilascio", () => {
    const p: ProgrammaLadder = { segmenti: [{ logica: fronteDiscesa("I0.0"), uscite: [bobina("Q0.0")] }] };
    const { uscite } = esegui(p, [[], ["I0.0"], ["I0.0"], [], []]);
    expect(uscite).toEqual([[], [], [], ["Q0.0"], []]);
  });

  it("un solo pulsante accende e spegne (telerruttore) con fronte + set/reset", () => {
    // Ad ogni pressione di I0.0 l'uscita Q0.0 cambia stato.
    const p: ProgrammaLadder = {
      segmenti: [
        { logica: fronteSalita("I0.0"), uscite: [bobina("M0.0")] },
        { logica: serie(na("M0.0"), nc("Q0.0")), uscite: [bobina("M0.1")] }, // accendi
        { logica: serie(na("M0.0"), na("Q0.0")), uscite: [reset("Q0.0")] }, //  spegni
        { logica: na("M0.1"), uscite: [set("Q0.0")] },
      ],
    };
    const { uscite } = esegui(p, [["I0.0"], ["I0.0"], [], ["I0.0"], [], ["I0.0"]]);
    expect(uscite).toEqual([["Q0.0"], ["Q0.0"], ["Q0.0"], [], [], ["Q0.0"]]);
  });

  it("due contatti di fronte sullo stesso operando hanno memorie separate", () => {
    const p: ProgrammaLadder = {
      segmenti: [
        { logica: fronteSalita("I0.0"), uscite: [bobina("Q0.0")] },
        { logica: fronteSalita("I0.0"), uscite: [bobina("Q0.1")] },
      ],
    };
    expect(esegui(p, [["I0.0"]]).uscite).toEqual([["Q0.0", "Q0.1"]]);
  });

  it("il fronte aggiorna la memoria anche in un ramo non alimentato", () => {
    // I0.1 aperto: il ramo non è alimentato, ma il fronte di I0.0 viene
    // comunque "consumato" e non scatta in ritardo quando si chiude I0.1.
    const p: ProgrammaLadder = {
      segmenti: [{ logica: serie(na("I0.1"), fronteSalita("I0.0")), uscite: [bobina("Q0.0")] }],
    };
    const { uscite } = esegui(p, [["I0.0"], ["I0.0", "I0.1"]]);
    expect(uscite).toEqual([[], []]);
  });
});

describe("ciclo di scansione", () => {
  it("l'immagine degli ingressi è rifatta a ogni ciclo, Q e M si conservano", () => {
    const p: ProgrammaLadder = { segmenti: [{ logica: na("I0.0"), uscite: [set("M0.0")] }] };
    const { stato } = esegui(p, [["I0.0"], []]);
    expect(valoreBit(stato, "I0.0")).toBe(false);
    expect(valoreBit(stato, "M0.0")).toBe(true);
    expect(stato.cicli).toBe(2);
  });

  it("ignora gli ingressi non validi o che non sono della zona I", () => {
    const p: ProgrammaLadder = { segmenti: [] };
    const r = scansione(p, statoInizialePlc(), { "Q0.0": true, pippo: true, "i0.2": true });
    expect(Object.keys(r.stato.bit)).toEqual(["I0.2"]);
    expect(r.usciteAttive).toEqual([]);
  });

  it("non modifica lo stato ricevuto", () => {
    const p: ProgrammaLadder = { segmenti: [{ logica: fronteSalita("I0.0"), uscite: [set("Q0.0")] }] };
    const iniziale = statoInizialePlc();
    scansione(p, iniziale, { "I0.0": true });
    expect(iniziale).toEqual(statoInizialePlc());
  });

  it("le uscite attive sono in ordine naturale", () => {
    const p: ProgrammaLadder = {
      segmenti: [{ logica: null, uscite: [set("Q1.0"), set("Q0.2"), set("Q0.10" as string), set("q0.1")] }],
    };
    expect(esegui(p, [[]]).uscite).toEqual([["Q0.1", "Q0.2", "Q1.0"]]);
  });
});
