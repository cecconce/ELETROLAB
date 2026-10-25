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
    expect(tipiContatto(lib)).toEqual(new Set(["contatto-na", "contatto-nc"]));
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
