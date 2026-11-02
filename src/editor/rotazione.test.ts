// Test della rotazione dei componenti (attività 4.1).
import { describe, expect, it } from "vitest";
import { leggiProgetto, serializzaProgetto } from "../progetto/formato";
import { morsettiDelComponente, percorsoFilo, type MorsettiDelTipo } from "./fili";
import { dimensioni, ruotaPunto, ruotaSelezione, trasformazioneRotazione, type ComponenteSchema, type Schema } from "./schema";
import { libreriaDelModulo } from "./caricaLibreria";
import { vocePerTipo } from "./libreria";
import { nodiDaSchema } from "./arduino";

// Resistenza orizzontale 80×40 con i morsetti a metà altezza.
const morsettiDi: MorsettiDelTipo = () => [
  { id: "1", x: 0, y: 20 },
  { id: "2", x: 80, y: 20 },
];
const R: ComponenteSchema = { id: "R1", tipo: "resistenza", etichetta: "R1", x: 100, y: 100, larghezza: 80, altezza: 40 };

describe("rotazione dei componenti", () => {
  it("a 90° e 270° larghezza e altezza si scambiano", () => {
    expect(dimensioni(R)).toEqual({ larghezza: 80, altezza: 40 });
    expect(dimensioni({ ...R, rotazione: 90 })).toEqual({ larghezza: 40, altezza: 80 });
    expect(dimensioni({ ...R, rotazione: 180 })).toEqual({ larghezza: 80, altezza: 40 });
  });

  it("i punti del disegno ruotano in senso orario restando nel riquadro", () => {
    const p = { x: 0, y: 20 };
    expect(ruotaPunto({ ...R, rotazione: 90 }, p)).toEqual({ x: 20, y: 0 });
    expect(ruotaPunto({ ...R, rotazione: 180 }, p)).toEqual({ x: 80, y: 20 });
    expect(ruotaPunto({ ...R, rotazione: 270 }, p)).toEqual({ x: 20, y: 80 });
  });

  it("la trasformazione del disegno porta gli stessi punti nello stesso posto", () => {
    for (const rotazione of [90, 180, 270] as const) {
      const c = { ...R, rotazione };
      const t = trasformazioneRotazione(c);
      const rad = (t.rotazione * Math.PI) / 180;
      const p = { x: 80, y: 20 };
      // rotazione di Konva (oraria con l'asse y in giù) + spostamento
      const q = { x: t.x + p.x * Math.cos(rad) - p.y * Math.sin(rad), y: t.y + p.x * Math.sin(rad) + p.y * Math.cos(rad) };
      const atteso = ruotaPunto(c, p);
      expect(q.x).toBeCloseTo(atteso.x);
      expect(q.y).toBeCloseTo(atteso.y);
    }
  });

  it("i morsetti ruotati escono dal lato giusto", () => {
    const m = morsettiDelComponente({ ...R, rotazione: 90 }, morsettiDi);
    expect(m.map((x) => [x.morsetto, x.posizione, x.direzione])).toEqual([
      ["1", { x: 120, y: 100 }, "su"],
      ["2", { x: 120, y: 180 }, "giu"],
    ]);
  });

  it("quattro rotazioni riportano il componente com'era, attorno al suo centro", () => {
    let s: Schema = { componenti: [R], fili: [] };
    s = ruotaSelezione(s, ["R1"]);
    expect(s.componenti[0]).toMatchObject({ rotazione: 90, x: 120, y: 80 });
    for (let i = 0; i < 3; i++) s = ruotaSelezione(s, ["R1"]);
    expect(s.componenti[0]).toEqual(R);
    // Senza componenti selezionati non cambia niente.
    expect(ruotaSelezione(s, [])).toBe(s);
  });

  it("i fili restano attaccati ai morsetti ruotati", () => {
    const L: ComponenteSchema = { id: "R2", tipo: "resistenza", etichetta: "R2", x: 400, y: 100, larghezza: 80, altezza: 40 };
    let s: Schema = { componenti: [R, L], fili: [{ id: "f1", da: { componente: "R1", morsetto: "2" }, a: { componente: "R2", morsetto: "1" } }] };
    s = ruotaSelezione(s, ["R1"]);
    const p = percorsoFilo(s, s.fili[0], morsettiDi)!;
    const m2 = morsettiDelComponente(s.componenti[0], morsettiDi).find((m) => m.morsetto === "2")!;
    expect(p[0]).toEqual(m2.posizione);
    expect(p[p.length - 1]).toEqual({ x: 400, y: 120 });
  });

  it("la rotazione si salva nel file .elab", () => {
    const s: Schema = { componenti: [{ ...R, rotazione: 270 }], fili: [] };
    const r = leggiProgetto(serializzaProgetto({ modulo: "elettronica", schema: s }, "0.1.0"));
    expect(r.ok && r.progetto.schema.componenti[0].rotazione).toBe(270);
  });

  it("banco Arduino: una resistenza ruotata in verticale collega la parte alta e quella bassa della breadboard", () => {
    const lib = libreriaDelModulo("arduino");
    const md = (tipo: string) => vocePerTipo(lib, tipo)?.morsetti;
    const bb: ComponenteSchema = { id: "BB", tipo: "breadboard", etichetta: "", x: 0, y: 0, larghezza: 660, altezza: 380 };
    // A 90° i piedini (0,20) e (80,20) finiscono in (20,0) e (20,80) rispetto all'angolo:
    // con l'angolo in (colonna 10 − 20, 160) il primo piedino va nel foro e10 (y 160)
    // e il secondo nel foro g10 (y 240), dall'altra parte del solco.
    const col10 = 40 + 9 * 20;
    const res: ComponenteSchema = { id: "R", tipo: "resistenza", etichetta: "R1", x: col10 - 20, y: 160, larghezza: 80, altezza: 40, rotazione: 90 };
    const nodo = nodiDaSchema({ componenti: [bb, res], fili: [] }, md);
    expect(nodo("R", "1")).toBe(nodo("BB", "e10"));
    expect(nodo("R", "2")).toBe(nodo("BB", "g10"));
  });
});
