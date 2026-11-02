// Test della traduzione Ladder → lista istruzioni (IEC 61131-3).
import { describe, expect, it } from "vitest";
import { listaIstruzioni } from "./listaIstruzioni";
import { bobina, ctu, fronteSalita, na, nc, parallelo, reset, serie, set, ton } from "./programma";

const righe = (testo: string) => testo.split("\n").map((r) => r.replace(/\s+\(\*.*\*\)$/, "").replace(/\s+/g, " ").trim());

describe("lista istruzioni", () => {
  it("marcia/arresto con autoritenuta: parallelo fra parentesi dopo il contatto in serie", () => {
    const testo = listaIstruzioni({ segmenti: [{ logica: serie(nc("I0.0"), parallelo(na("I0.1"), na("Q0.0"))), uscite: [bobina("Q0.0")] }] });
    expect(righe(testo)).toEqual(["(* Segmento 1 *)", "LDN I0.0", "AND(", "LD I0.1", "OR Q0.0", ")", "ST Q0.0", ""]);
  });

  it("parallelo per primo: niente parentesi, la serie che segue lo usa già", () => {
    const testo = listaIstruzioni({ segmenti: [{ logica: serie(parallelo(na("I0.1"), na("Q0.0")), nc("I0.0")), uscite: [bobina("Q0.0")] }] });
    expect(righe(testo).slice(1, 5)).toEqual(["LD I0.1", "OR Q0.0", "ANDN I0.0", "ST Q0.0"]);
  });

  it("ramo in serie dentro un parallelo: OR( … )", () => {
    const testo = listaIstruzioni({ segmenti: [{ logica: parallelo(na("I0.0"), serie(na("I0.1"), nc("M0.0"))), uscite: [set("M1.0")] }] });
    expect(righe(testo).slice(1, 7)).toEqual(["LD I0.0", "OR(", "LD I0.1", "ANDN M0.0", ")", "S M1.0"]);
  });

  it("fronti, temporizzatori e contatori: prima le uscite, poi i richiami dei blocchi", () => {
    const testo = listaIstruzioni({
      segmenti: [
        { commento: "conta i pezzi", logica: fronteSalita("I0.2"), uscite: [ctu("C0", 5), bobina("Q0.1")] },
        { logica: na("I0.3"), uscite: [ton("T0", 2.5), reset("C0")] },
        { logica: null, uscite: [bobina("M0.1")] },
      ],
    });
    const r = righe(testo);
    expect(r.slice(0, 5)).toEqual(["(* Segmento 1: conta i pezzi *)", "LDP I0.2", "ST C0.CU", "ST Q0.1", "CAL C0(PV := 5)"]);
    expect(r.slice(6, 11)).toEqual(["(* Segmento 2 *)", "LD I0.3", "ST T0.IN", "R C0", "CAL T0(PT := T#2.5s)"]);
    expect(r.slice(12, 15)).toEqual(["(* Segmento 3 *)", "LD TRUE", "ST M0.1"]);
    expect(testo).toContain("(* TON: ritardo all'inserzione *)");
  });

  it("programma vuoto: lo dice", () => {
    expect(listaIstruzioni({ segmenti: [] })).toMatch(/vuoto/);
  });
});
