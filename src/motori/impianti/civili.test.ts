// Impianti civili (Fase 8): interruttori, pulsanti, relè passo-passo, suoneria,
// magnetotermico bipolare e differenziale con il tasto di prova.
import { describe, expect, it } from "vitest";
import type { Circuito, ComponenteCircuito, FiloCircuito } from "./simulatore";
import { avviaSessione, azioneClic, clicGiu, clicSu } from "./sessione";
import { problemiSessione } from "./index";

const filo = (da: string, a: string): FiloCircuito => {
  const [c1, m1] = da.split(":");
  const [c2, m2] = a.split(":");
  return { da: { componente: c1, morsetto: m1 }, a: { componente: c2, morsetto: m2 } };
};
const comp = (id: string, tipo: string, etichetta = id): ComponenteCircuito => ({ id, tipo, etichetta });
const accesa = (s: ReturnType<typeof avviaSessione>, id = "H1") => s.risultato.carichiAlimentati.includes(id);
const premiERilascia = (s: ReturnType<typeof avviaSessione>, id: string) => clicSu(clicGiu(s, id), id);

describe("impianti civili", () => {
  it("relè passo-passo: ogni impulso da un pulsante qualsiasi cambia lo stato della lampada", () => {
    // Rete → Q1 (2P) → pulsanti S1, S2 in parallelo → bobina KA1; contatto KA1 → lampada.
    const c: Circuito = {
      componenti: [
        comp("RM", "rete-monofase", ""),
        comp("Q1", "magnetotermico-2p"),
        comp("S1", "pulsante-civile"),
        comp("S2", "pulsante-civile"),
        comp("KA1", "rele-passo-passo"),
        comp("KA1c", "contatto-na", "KA1"),
        comp("H1", "lampada"),
      ],
      fili: [
        filo("RM:L", "Q1:1"),
        filo("RM:N", "Q1:3"),
        filo("Q1:2", "S1:L"),
        filo("Q1:2", "S2:L"),
        filo("S1:1", "KA1:A1"),
        filo("S2:1", "KA1:A1"),
        filo("KA1:A2", "Q1:4"),
        filo("Q1:2", "KA1c:13"),
        filo("KA1c:14", "H1:X1"),
        filo("H1:X2", "Q1:4"),
      ],
    };
    let s = avviaSessione(c);
    expect(problemiSessione(s)).toEqual([]);
    expect(accesa(s)).toBe(false);
    s = clicGiu(s, "S1");
    expect(accesa(s)).toBe(true); // l'impulso commuta subito
    s = clicSu(s, "S1");
    expect(accesa(s)).toBe(true); // e resta così dopo il rilascio
    s = premiERilascia(s, "S2");
    expect(accesa(s)).toBe(false);
    s = premiERilascia(s, "S1");
    expect(accesa(s)).toBe(true);
    expect(problemiSessione(s)).toEqual([]);
  });

  it("differenziale: il tasto di prova lo fa scattare e toglie tensione, un altro clic lo riarma", () => {
    const c: Circuito = {
      componenti: [comp("RM", "rete-monofase", ""), comp("Q1", "differenziale"), comp("S1", "interruttore-unipolare"), comp("H1", "lampada"), comp("HA1", "suoneria"), comp("S2", "pulsante-civile")],
      fili: [
        filo("RM:L", "Q1:1"),
        filo("RM:N", "Q1:3"),
        filo("Q1:2", "S1:L"),
        filo("S1:1", "H1:X1"),
        filo("H1:X2", "Q1:4"),
        filo("Q1:2", "S2:L"),
        filo("S2:1", "HA1:X1"),
        filo("HA1:X2", "Q1:4"),
      ],
    };
    expect(azioneClic("differenziale")).toBe("riarmo");
    let s = clicGiu(avviaSessione(c), "S1");
    expect(accesa(s)).toBe(true);
    s = clicGiu(s, "S2");
    expect(accesa(s, "HA1")).toBe(true); // il campanello suona finché si tiene premuto
    s = clicSu(s, "S2");
    s = clicGiu(s, "Q1"); // tasto di prova T
    expect(s.stato.protezioniIntervenute).toContain("Q1");
    expect(accesa(s)).toBe(false);
    expect(problemiSessione(s).map((p) => p.codice)).toContain("interventoProva");
    s = clicGiu(s, "Q1"); // riarmo
    expect(s.stato.protezioniIntervenute).not.toContain("Q1");
    expect(accesa(s)).toBe(true);
  });

  it("interruttore bipolare: apre fase e neutro insieme", () => {
    const c: Circuito = {
      componenti: [comp("RM", "rete-monofase", ""), comp("S1", "interruttore-bipolare"), comp("H1", "lampada")],
      fili: [filo("RM:L", "S1:1"), filo("RM:N", "S1:3"), filo("S1:2", "H1:X1"), filo("S1:4", "H1:X2")],
    };
    let s = avviaSessione(c);
    expect(accesa(s)).toBe(false);
    s = clicGiu(s, "S1");
    expect(accesa(s)).toBe(true);
  });
});

describe("sensori di processo", () => {
  it("galleggiante, pressostato e fotocellula chiudono quando azionati, il termostato apre", () => {
    for (const [tipo, a, b, chiusoARiposo] of [
      ["galleggiante", "13", "14", false],
      ["pressostato", "13", "14", false],
      ["fotocellula", "13", "14", false],
      ["termostato", "11", "12", true],
    ] as const) {
      const c: Circuito = {
        componenti: [comp("RM", "rete-monofase", ""), comp("B1", tipo), comp("H1", "lampada")],
        fili: [filo("RM:L", `B1:${a}`), filo(`B1:${b}`, "H1:X1"), filo("H1:X2", "RM:N")],
      };
      const s = avviaSessione(c);
      expect(accesa(s), tipo).toBe(chiusoARiposo);
      expect(azioneClic(tipo)).toBe("manuale");
      expect(accesa(clicGiu(s, "B1")), tipo).toBe(!chiusoARiposo);
    }
  });
});
