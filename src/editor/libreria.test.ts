// Test della libreria dei componenti: i file forniti sono corretti, la ricerca
// trova quello che uno studente scriverebbe, la posa crea componenti agganciati.
import { describe, expect, it } from "vitest";
import { MODULI } from "../interfaccia/moduli";
import { ERRORI_LIBRERIA, ICONE, libreriaDelModulo, trovaVoce } from "./caricaLibreria";
import { PASSO_GRIGLIA } from "./geometria";
import {
  cercaComponenti,
  componenteDaVoce,
  prossimaSigla,
  leggiLibreria,
  normalizza,
  nuovoId,
  raggruppaPerCategoria,
  svgComeDataUrl,
} from "./libreria";
import { SCHEMA_VUOTO, aggiungiComponente } from "./schema";

const vocePulsante = {
  id: "pulsante-na",
  nome: "Pulsante NA",
  categoria: "comandi",
  sigla: "S",
  descrizione: "Chiude quando lo premi.",
  icona: "pulsante-na.svg",
  larghezza: 40,
  altezza: 80,
  morsetti: [
    { id: "13", x: 20, y: 0 },
    { id: "14", x: 20, y: 80 },
  ],
};
const fileProva = (componenti: unknown[]) => ({
  versione: 1,
  modulo: "impianti",
  categorie: [{ id: "comandi", nome: "Comandi" }],
  componenti,
});

describe("file della libreria forniti con l'app", () => {
  it("si leggono senza errori", () => {
    expect(ERRORI_LIBRERIA).toEqual([]);
  });

  it("ogni modulo ha una libreria con almeno una voce per categoria", () => {
    for (const m of MODULI) {
      const lib = libreriaDelModulo(m.id);
      expect(lib.componenti.length, m.id).toBeGreaterThan(4);
      for (const c of lib.categorie) expect(lib.componenti.some((v) => v.categoria === c.id), c.id).toBe(true);
    }
  });

  it("ogni voce ha nome, descrizione didattica e icona con le stesse dimensioni del componente", () => {
    for (const m of MODULI) {
      for (const v of libreriaDelModulo(m.id).componenti) {
        expect(v.descrizione.length, v.id).toBeGreaterThan(20);
        const svg = ICONE.get(v.icona) ?? "";
        expect(svg, v.icona).toContain(`viewBox="0 0 ${v.larghezza} ${v.altezza}"`);
        expect(svg, v.icona).toContain("currentColor");
        // Le icone sono originali e senza script o risorse esterne.
        expect(svg).not.toMatch(/<script|href=|url\(/i);
      }
    }
  });

  it("i contatti seguono la numerazione normativa (NA 13-14, NC 11-12 / 21-22)", () => {
    const imp = libreriaDelModulo("impianti");
    expect(trovaVoce(imp, "contatto-na")?.morsetti.map((m) => m.id)).toEqual(["13", "14"]);
    expect(trovaVoce(imp, "contatto-nc")?.morsetti.map((m) => m.id)).toEqual(["21", "22"]);
    expect(trovaVoce(imp, "bobina-contattore")?.morsetti.map((m) => m.id)).toEqual(["A1", "A2"]);
  });

  it("modulo senza file: libreria vuota, nessun errore", () => {
    expect(libreriaDelModulo("inesistente" as never).componenti).toEqual([]);
  });
});

describe("lettura e controllo di un file modificato a mano", () => {
  it("accetta una voce corretta", () => {
    const { libreria, errori } = leggiLibreria(fileProva([vocePulsante]), "prova.json", new Set(["pulsante-na.svg"]));
    expect(errori).toEqual([]);
    expect(libreria.componenti[0]).toMatchObject({ id: "pulsante-na", sigla: "S", paroleChiave: [] });
  });

  it("scarta solo le voci errate e spiega il motivo in italiano", () => {
    const { libreria, errori } = leggiLibreria(
      fileProva([
        vocePulsante,
        { ...vocePulsante, id: "storto", larghezza: 35 },
        { ...vocePulsante, id: "senza-categoria", categoria: "boh" },
        { ...vocePulsante, id: "morsetto-fuori", morsetti: [{ id: "1", x: 20, y: 100 }] },
        { ...vocePulsante, id: "icona-mancante", icona: "nessuna.svg" },
        { ...vocePulsante },
      ]),
      "prova.json",
      new Set(["pulsante-na.svg"]),
    );
    expect(libreria.componenti.map((v) => v.id)).toEqual(["pulsante-na"]);
    expect(errori).toHaveLength(5);
    expect(errori.join("\n")).toMatch(/multipli di 20/);
    expect(errori.join("\n")).toMatch(/categoria "boh" non esiste/);
    expect(errori.join("\n")).toMatch(/identificativo ripetuto/);
  });

  it("non si blocca con contenuti assurdi", () => {
    expect(leggiLibreria(null, "x.json").errori).toHaveLength(1);
    expect(leggiLibreria([], "x.json").libreria.componenti).toEqual([]);
    expect(leggiLibreria({ versione: 99, modulo: "plc" }, "x.json").errori[0]).toMatch(/versione 99/);
  });
});

describe("ricerca per nome", () => {
  const imp = libreriaDelModulo("impianti");

  it("senza testo restituisce tutto", () => {
    expect(cercaComponenti(imp, "  ")).toHaveLength(imp.componenti.length);
  });

  it("ignora maiuscole e accenti", () => {
    expect(normalizza("  Relè ")).toBe("rele");
    expect(cercaComponenti(imp, "RELE").length).toBeGreaterThan(0);
    expect(cercaComponenti(imp, "lampada").map((v) => v.id)).toEqual(["lampada"]);
  });

  it("cerca anche nelle parole chiave e nella sigla", () => {
    expect(cercaComponenti(imp, "autoritenuta").map((v) => v.id)).toEqual(["contatto-na"]);
    expect(cercaComponenti(imp, "k").length).toBeGreaterThanOrEqual(3);
  });

  it("tutte le parole devono corrispondere; prima i nomi che iniziano col testo", () => {
    expect(cercaComponenti(imp, "pulsante arresto").map((v) => v.id)).toEqual(["pulsante-nc"]);
    const risultato = cercaComponenti(imp, "contatto").map((v) => v.id);
    expect(risultato.slice(0, 2)).toEqual(["contatto-na", "contatto-nc"]);
    expect(cercaComponenti(imp, "xyz")).toEqual([]);
  });

  it("raggruppa per categoria nell'ordine del file, senza categorie vuote", () => {
    const gruppi = raggruppaPerCategoria(imp, cercaComponenti(imp, "pulsante"));
    expect(gruppi.map((g) => g.categoria.id)).toEqual(["comandi"]);
    expect(raggruppaPerCategoria(imp, imp.componenti)[0].categoria.id).toBe("alimentazione");
  });
});

describe("posa di un componente dalla libreria", () => {
  const voce = trovaVoce(libreriaDelModulo("impianti"), "bobina-contattore")!;

  it("centra il componente sul punto di rilascio, agganciato alla griglia", () => {
    const c = componenteDaVoce(SCHEMA_VUOTO, voce, { x: 107, y: 133 });
    expect(c).toMatchObject({ tipo: "bobina-contattore", etichetta: "K1", larghezza: 40, altezza: 80 });
    expect(c.x % PASSO_GRIGLIA).toBe(0);
    expect(c.y % PASSO_GRIGLIA).toBe(0);
    expect(Math.abs(c.x + 20 - 107)).toBeLessThanOrEqual(PASSO_GRIGLIA / 2);
    expect(Math.abs(c.y + 40 - 133)).toBeLessThanOrEqual(PASSO_GRIGLIA / 2);
  });

  it("assegna identificativi sempre diversi", () => {
    let s = SCHEMA_VUOTO;
    for (let i = 0; i < 3; i++) s = aggiungiComponente(s, componenteDaVoce(s, voce, { x: 0, y: 0 }));
    expect(s.componenti.map((c) => c.id)).toEqual(["bobina-contattore-1", "bobina-contattore-2", "bobina-contattore-3"]);
    const senzaSecondo = { ...s, componenti: s.componenti.filter((c) => c.id !== "bobina-contattore-2") };
    expect(nuovoId(senzaSecondo, "bobina-contattore")).toBe("bobina-contattore-2");
  });

  it("numera le sigle in automatico: K1, K2, K3…", () => {
    let s = SCHEMA_VUOTO;
    for (let i = 0; i < 3; i++) s = aggiungiComponente(s, componenteDaVoce(s, voce, { x: 0, y: 0 }));
    expect(s.componenti.map((c) => c.etichetta)).toEqual(["K1", "K2", "K3"]);
  });

  it("riusa il primo numero libero dopo un'eliminazione e tiene separate le lettere", () => {
    const comp = (etichetta: string) => ({ id: etichetta, tipo: "x", etichetta, x: 0, y: 0, larghezza: 20, altezza: 20 });
    const s = { componenti: ["K1", "K3", "KA1", "S1"].map(comp), fili: [] };
    expect(prossimaSigla(s, "K")).toBe("K2");
    expect(prossimaSigla(s, "KA")).toBe("KA2");
    expect(prossimaSigla(s, "S")).toBe("S2");
    expect(prossimaSigla(s, "H")).toBe("H1");
    expect(prossimaSigla(s, "")).toBe("");
  });

  it("colora l'icona secondo il tema", () => {
    const url = svgComeDataUrl('<svg stroke="currentColor"/>', "#ffffff");
    expect(url.startsWith("data:image/svg+xml")).toBe(true);
    expect(decodeURIComponent(url)).toContain('stroke="#ffffff"');
    expect(decodeURIComponent(url)).not.toContain("currentColor");
  });
});
