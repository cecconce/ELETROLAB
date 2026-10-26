// Test dei contatti legati alla bobina e della numerazione normativa (attività 2.2).
import { describe, expect, it } from "vitest";
import { t } from "../testi";
import { simula } from "../motori/impianti";
import { libreriaDelModulo } from "./caricaLibreria";
import { copiaSelezione, incolla } from "./appunti";
import {
  associaContatto,
  bobineDelloSchema,
  cambiaSigla,
  contattoAssociato,
  numeriContatto,
  numeroMorsetto,
  proprietariPer,
  rinumeraContatti,
} from "./associazioni";
import { componenteDaVoce, leggiLibreria, prossimaSigla, tipiContatto, vocePerTipo } from "./libreria";
import { SCHEMA_VUOTO, aggiungiComponente, eliminaSelezione, type Schema } from "./schema";

const lib = libreriaDelModulo("impianti");

/** Posa in ordine i tipi indicati, come farebbe lo studente, e rinumera come l'interfaccia. */
function posa(tipi: string[], partenza: Schema = SCHEMA_VUOTO): Schema {
  let s = partenza;
  tipi.forEach((tipo, i) => {
    const voce = vocePerTipo(lib, tipo)!;
    s = rinumeraContatti(aggiungiComponente(s, componenteDaVoce(s, voce, { x: 100 + 80 * i, y: 100 }, lib)), lib);
  });
  return s;
}
const numeri = (s: Schema, id: string) => {
  const c = s.componenti.find((x) => x.id === id)!;
  return vocePerTipo(lib, c.tipo)!.morsetti.map((m) => numeroMorsetto(c, m.id)).join("-");
};

describe("numerazione normativa", () => {
  it("contatti ausiliari: prima cifra = ordine, seconda 3-4 (NA) o 1-2 (NC)", () => {
    expect(numeriContatto({ tipo: "ausiliario", stato: "NA" }, 1)).toEqual(["13", "14"]);
    expect(numeriContatto({ tipo: "ausiliario", stato: "NC" }, 2)).toEqual(["21", "22"]);
    expect(numeriContatto({ tipo: "ausiliario", stato: "NA" }, 3)).toEqual(["33", "34"]);
    expect(numeriContatto({ tipo: "ausiliario", stato: "NC" }, 4)).toEqual(["41", "42"]);
  });
  it("contatti principali: 1-2, 3-4, 5-6", () => {
    expect([1, 2, 3].map((n) => numeriContatto({ tipo: "principale", stato: "NA" }, n))).toEqual([
      ["1", "2"],
      ["3", "4"],
      ["5", "6"],
    ]);
  });
});

describe("libreria degli impianti", () => {
  it("la bobina comanda i contatti e i contatti NA/NC sono ausiliari", () => {
    expect(vocePerTipo(lib, "bobina-contattore")?.comandaContatti).toBe(true);
    expect(vocePerTipo(lib, "contatto-na")?.contatto).toEqual({ tipo: "ausiliario", stato: "NA" });
    expect(vocePerTipo(lib, "contatto-nc")?.contatto).toEqual({ tipo: "ausiliario", stato: "NC" });
    expect(tipiContatto(lib)).toEqual(
      new Set([
        "contatto-na",
        "contatto-nc",
        "contatti-principali",
        "contatto-temporizzato-na",
        "contatto-temporizzato-nc",
        "contatto-termico-nc",
        "contatto-termico-na",
      ]),
    );
    // I pulsanti non sono comandati da bobina.
    expect(vocePerTipo(lib, "pulsante-na")?.contatto).toBeUndefined();
  });
  it("un campo 'contatto' scritto male scarta la voce con un errore in italiano", () => {
    const dati = {
      versione: 1,
      modulo: "prova",
      categorie: [{ id: "c", nome: "C" }],
      componenti: [
        {
          id: "x",
          nome: "X",
          categoria: "c",
          icona: "x.svg",
          larghezza: 40,
          altezza: 80,
          morsetti: [
            { id: "1", x: 20, y: 0 },
            { id: "2", x: 20, y: 80 },
          ],
          contatto: { tipo: "ausiliario", stato: "aperto" },
        },
      ],
    };
    const esito = leggiLibreria(dati, "prova.json");
    expect(esito.libreria.componenti).toHaveLength(0);
    expect(esito.errori[0]).toContain('"contatto"');
  });
});

describe("posa dei contatti", () => {
  it("un contatto prende la sigla dell'ultima bobina posata", () => {
    const s = posa(["bobina-contattore", "bobina-contattore", "contatto-na"]);
    expect(s.componenti.map((c) => c.etichetta)).toEqual(["K1", "K2", "K2"]);
  });
  it("senza bobine il contatto resta non associato", () => {
    const s = posa(["contatto-na"]);
    expect(s.componenti[0].etichetta).toBe("");
    expect(contattoAssociato(s, s.componenti[0], lib)).toBe(false);
    expect(numeri(s, s.componenti[0].id)).toBe("13-14"); // numeri della libreria
  });
  it("i contatti non occupano numeri: la bobina posata dopo un contatto è K1", () => {
    const s = posa(["contatto-na"]);
    expect(prossimaSigla(s, "K", tipiContatto(lib))).toBe("K1");
    const s2 = posa(["bobina-contattore"], associaContatto(s, s.componenti[0].id, "K1", lib));
    expect(s2.componenti[1].etichetta).toBe("K1");
  });
  it("numerazione in ordine di posa: NA 13-14, NC 21-22, NA 33-34, NC 41-42", () => {
    const s = posa(["bobina-contattore", "contatto-na", "contatto-nc", "contatto-na", "contatto-nc"]);
    const contatti = s.componenti.slice(1).map((c) => numeri(s, c.id));
    expect(contatti).toEqual(["13-14", "21-22", "33-34", "41-42"]);
  });
  it("ogni contattore ha la sua numerazione", () => {
    let s = posa(["bobina-contattore", "contatto-na", "bobina-contattore", "contatto-na"]);
    expect(s.componenti.map((c) => `${c.etichetta}:${numeri(s, c.id)}`)).toEqual(["K1:A1-A2", "K1:13-14", "K2:A1-A2", "K2:13-14"]);
    // Spostando il contatto di K2 su K1 diventa il secondo contatto di K1.
    s = associaContatto(s, s.componenti[3].id, "K1", lib);
    expect(numeri(s, s.componenti[3].id)).toBe("23-24");
  });
  it("eliminando un contatto gli altri si rinumerano", () => {
    let s = posa(["bobina-contattore", "contatto-na", "contatto-na"]);
    expect(numeri(s, s.componenti[2].id)).toBe("23-24");
    s = rinumeraContatti(eliminaSelezione(s, [s.componenti[1].id]), lib);
    expect(numeri(s, s.componenti[1].id)).toBe("13-14");
  });
  it("rinumeraContatti senza cambiamenti restituisce lo stesso schema (nessun passo inutile in Annulla)", () => {
    const s = posa(["bobina-contattore", "contatto-na"]);
    expect(rinumeraContatti(s, lib)).toBe(s);
  });
  it("togliere la bobina a un contatto lo riporta ai numeri della libreria", () => {
    let s = posa(["bobina-contattore", "contatto-nc", "contatto-nc"]);
    expect(numeri(s, s.componenti[2].id)).toBe("21-22");
    s = associaContatto(s, s.componenti[1].id, "", lib);
    expect(s.componenti[1].etichetta).toBe("");
    expect(s.componenti[1].numeriMorsetti).toBeUndefined();
    expect(numeri(s, s.componenti[2].id)).toBe("11-12"); // ora è il primo (NC) di K1
  });
});

describe("cambio della sigla", () => {
  it("rinominando la bobina i suoi contatti la seguono", () => {
    const s = posa(["bobina-contattore", "contatto-na", "bobina-contattore", "contatto-nc"]);
    const esito = cambiaSigla(s, s.componenti[0].id, " ka1 ", lib);
    expect(esito.ok).toBe(true);
    if (!esito.ok) return;
    expect(esito.schema.componenti.map((c) => c.etichetta)).toEqual(["KA1", "KA1", "K2", "K2"]);
    expect(bobineDelloSchema(esito.schema, lib).map((b) => b.etichetta)).toEqual(["KA1", "K2"]);
  });
  it("sigla già usata o scritta male: errore spiegato, schema invariato", () => {
    const s = posa(["bobina-contattore", "contatto-na", "bobina-contattore"]);
    expect(cambiaSigla(s, s.componenti[2].id, "K1", lib)).toEqual({ ok: false, errore: t("proprieta.siglaUsata", { sigla: "K1" }) });
    const errata = cambiaSigla(s, s.componenti[2].id, "K-1!", lib);
    expect(errata.ok).toBe(false);
    if (!errata.ok) expect(errata.errore).toContain("K-1!");
    expect(cambiaSigla(s, s.componenti[2].id, "", lib).ok).toBe(false);
  });
  it("la stessa sigla di prima non cambia nulla", () => {
    const s = posa(["bobina-contattore"]);
    const esito = cambiaSigla(s, s.componenti[0].id, "k1", lib);
    expect(esito).toEqual({ ok: true, schema: s });
  });
});

describe("copia e incolla con i contatti", () => {
  it("bobina e contatto copiati insieme diventano K2 con il suo contatto", () => {
    const s = posa(["bobina-contattore", "contatto-na"]);
    const appunti = copiaSelezione(s, s.componenti.map((c) => c.id))!;
    const esito = incolla(s, appunti, (tipo) => vocePerTipo(lib, tipo)?.sigla, 0, tipiContatto(lib));
    const r = rinumeraContatti(esito.schema, lib);
    expect(r.componenti.map((c) => c.etichetta)).toEqual(["K1", "K1", "K2", "K2"]);
    expect(numeri(r, r.componenti[3].id)).toBe("13-14");
  });
  it("un contatto copiato da solo resta della stessa bobina (contatto in più)", () => {
    const s = posa(["bobina-contattore", "contatto-na"]);
    const appunti = copiaSelezione(s, [s.componenti[1].id])!;
    const esito = incolla(s, appunti, (tipo) => vocePerTipo(lib, tipo)?.sigla, 0, tipiContatto(lib));
    const r = rinumeraContatti(esito.schema, lib);
    expect(r.componenti.map((c) => c.etichetta)).toEqual(["K1", "K1", "K1"]);
    expect(numeri(r, r.componenti[2].id)).toBe("23-24");
  });
});

describe("legame con il motore di simulazione", () => {
  it("il contatto associato a K1 commuta con la bobina K1 (autoritenuta)", () => {
    // S1 (NA) in parallelo al contatto NA di K1, in serie alla bobina K1.
    let s = posa(["rete-monofase", "pulsante-na", "bobina-contattore", "contatto-na"]);
    const [rete, s1, k1, contatto] = s.componenti.map((c) => c.id);
    const f = (da: string, md: string, a: string, ma: string) => ({ da: { componente: da, morsetto: md }, a: { componente: a, morsetto: ma } });
    s = {
      ...s,
      fili: [f(rete, "L", s1, "13"), f(rete, "L", contatto, "13"), f(s1, "14", k1, "A1"), f(contatto, "14", k1, "A1"), f(k1, "A2", rete, "N")].map(
        (x, i) => ({ id: `filo-${i + 1}`, ...x }),
      ),
    };
    const premuto = simula(s, { premuti: [s1] });
    expect(premuto.bobineEccitate).toEqual([k1]);
    const rilasciato = simula(s, {}, premuto.bobineEccitate);
    expect(rilasciato.bobineEccitate).toEqual([k1]); // l'autoritenuta tiene
    // Staccato da K1, il contatto non tiene più.
    const staccato = associaContatto(s, contatto, "", lib);
    expect(simula(staccato, {}, premuto.bobineEccitate).bobineEccitate).toEqual([]);
  });
});

describe("libreria completa degli impianti (attività 2.3)", () => {
  const morsetti = (tipo: string) => vocePerTipo(lib, tipo)?.morsetti.map((m) => m.id);

  it("contiene tutti i componenti richiesti", () => {
    for (const tipo of [
      "sezionatore",
      "salvamotore",
      "rele-termico",
      "contatto-termico-nc",
      "contatto-termico-na",
      "contatti-principali",
      "bobina-rele",
      "bobina-ritardata-eccitazione",
      "bobina-ritardata-diseccitazione",
      "contatto-temporizzato-na",
      "contatto-temporizzato-nc",
      "selettore",
      "finecorsa-na",
      "finecorsa-nc",
      "sensore-prossimita",
      "sirena",
      "motore-monofase",
      "motore-cc",
    ])
      expect(vocePerTipo(lib, tipo), tipo).toBeDefined();
  });

  it("morsetti secondo la norma", () => {
    expect(morsetti("sezionatore")).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(morsetti("rele-termico")).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(morsetti("contatto-termico-nc")).toEqual(["95", "96"]);
    expect(morsetti("contatto-termico-na")).toEqual(["97", "98"]);
    expect(morsetti("contatto-temporizzato-nc")).toEqual(["15", "16"]);
    expect(morsetti("contatto-temporizzato-na")).toEqual(["17", "18"]);
    expect(morsetti("bobina-ritardata-eccitazione")).toEqual(["A1", "A2"]);
    expect(morsetti("motore-cc")).toEqual(["A1", "A2"]);
    expect(vocePerTipo(lib, "rele-termico")).toMatchObject({ comandaContatti: true, protezioneTermica: true });
    expect(vocePerTipo(lib, "bobina-rele")).toMatchObject({ sigla: "KA", comandaContatti: true });
    expect(vocePerTipo(lib, "bobina-ritardata-diseccitazione")).toMatchObject({ sigla: "KT", comandaContatti: true });
  });

  it("numeri dei contatti temporizzati e termici", () => {
    expect(numeriContatto({ tipo: "temporizzato", stato: "NA" }, 1)).toEqual(["17", "18"]);
    expect(numeriContatto({ tipo: "temporizzato", stato: "NC" }, 2)).toEqual(["25", "26"]);
    expect(numeriContatto({ tipo: "termico", stato: "NC" }, 3)).toEqual(["95", "96"]);
    expect(numeriContatto({ tipo: "termico", stato: "NA" }, 1)).toEqual(["97", "98"]);
  });

  it("i contatti principali tripolari occupano tre coppie: 1…6, poi 7…12", () => {
    const s = posa(["bobina-contattore", "contatti-principali", "contatti-principali"]);
    expect(numeri(s, "contatti-principali-1")).toBe("1-2-3-4-5-6");
    expect(numeri(s, "contatti-principali-2")).toBe("7-8-9-10-11-12");
  });

  it("ausiliari e temporizzati dello stesso temporizzatore condividono il numero d'ordine", () => {
    const s = posa(["bobina-ritardata-eccitazione", "contatto-na", "contatto-temporizzato-na", "contatto-temporizzato-nc"]);
    expect(s.componenti.map((c) => c.etichetta)).toEqual(["KT1", "KT1", "KT1", "KT1"]);
    expect(numeri(s, "contatto-na-1")).toBe("13-14");
    expect(numeri(s, "contatto-temporizzato-na-1")).toBe("27-28");
    expect(numeri(s, "contatto-temporizzato-nc-1")).toBe("35-36");
  });

  it("i contatti del relè termico vanno al relè termico, gli altri alla bobina", () => {
    // Relè termico posato per ultimo: il contatto NA del contattore resta a K1.
    const s = posa(["bobina-contattore", "rele-termico", "contatto-na", "contatto-termico-nc", "contatto-termico-na"]);
    const sigla = (id: string) => s.componenti.find((c) => c.id === id)!.etichetta;
    expect(sigla("rele-termico-1")).toBe("F1");
    expect(sigla("contatto-na-1")).toBe("K1");
    expect(sigla("contatto-termico-nc-1")).toBe("F1");
    expect(numeri(s, "contatto-termico-nc-1")).toBe("95-96");
    expect(numeri(s, "contatto-termico-na-1")).toBe("97-98");
    for (const c of s.componenti) if (eContattoTipo(c.tipo)) expect(contattoAssociato(s, c, lib), c.id).toBe(true);
    // Un contatto termico con la sigla di una bobina non è associato (e viceversa).
    const sbagliato = associaContatto(s, "contatto-termico-nc-1", "K1", lib);
    expect(contattoAssociato(sbagliato, sbagliato.componenti.find((c) => c.id === "contatto-termico-nc-1")!, lib)).toBe(false);
    expect(proprietariPer(s, { tipo: "termico", stato: "NC" }, lib).map((c) => c.etichetta)).toEqual(["F1"]);
    expect(proprietariPer(s, { tipo: "ausiliario", stato: "NA" }, lib).map((c) => c.etichetta)).toEqual(["K1"]);
  });

  it("contatto termico senza relè termico: resta senza sigla", () => {
    const s = posa(["bobina-contattore", "contatto-termico-nc"]);
    expect(s.componenti[1].etichetta).toBe("");
  });

  it("rinominando il relè termico i suoi contatti lo seguono", () => {
    const s = posa(["rele-termico", "contatto-termico-nc"]);
    const esito = cambiaSigla(s, "rele-termico-1", "F5", lib);
    expect(esito.ok && esito.schema.componenti.map((c) => c.etichetta)).toEqual(["F5", "F5"]);
  });

  it("il file letto rifiuta contatti con tipo o numero di morsetti sbagliati", () => {
    const voce = {
      id: "x",
      nome: "Prova",
      categoria: "c",
      sigla: "K",
      descrizione: "",
      icona: "x.svg",
      larghezza: 80,
      altezza: 80,
      morsetti: [
        { id: "1", x: 20, y: 0 },
        { id: "2", x: 20, y: 80 },
        { id: "3", x: 40, y: 0 },
      ],
    };
    const file = (componenti: unknown[]) => ({ versione: 1, modulo: "impianti", categorie: [{ id: "c", nome: "C" }], componenti });
    const icone = new Set(["x.svg"]);
    const dispari = leggiLibreria(file([{ ...voce, contatto: { tipo: "principale", stato: "NA" } }]), "p.json", icone);
    expect(dispari.libreria.componenti).toEqual([]);
    const strano = leggiLibreria(file([{ ...voce, morsetti: voce.morsetti.slice(0, 2), contatto: { tipo: "boh", stato: "NA" } }]), "p.json", icone);
    expect(strano.libreria.componenti).toEqual([]);
    const quattro = leggiLibreria(
      file([{ ...voce, morsetti: [...voce.morsetti, { id: "4", x: 40, y: 80 }], contatto: { tipo: "principale", stato: "NA" } }]),
      "p.json",
      icone,
    );
    expect(quattro.errori).toEqual([]);
    expect(quattro.libreria.componenti[0].contatto).toEqual({ tipo: "principale", stato: "NA" });
  });
});

function eContattoTipo(tipo: string): boolean {
  return vocePerTipo(lib, tipo)?.contatto !== undefined;
}
