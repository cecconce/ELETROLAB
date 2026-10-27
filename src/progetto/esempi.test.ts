// Test dell'attività 2.7: catalogo degli esempi e simulazione degli esempi pronti.
import { describe, expect, it } from "vitest";
import { apriEsempio, esempiDelModulo, leggiCatalogo, type Esempio } from "./esempi";
import { ERRORI_ESEMPI, ESEMPI } from "./caricaEsempi";
import { serializzaProgetto } from "./formato";
import { SCHEMA_VUOTO, type Schema } from "../editor/schema";
import { libreriaDelModulo } from "../editor/caricaLibreria";
import { rinumeraContatti } from "../editor/associazioni";
import { vocePerTipo } from "../editor/libreria";
import {
  avviaSessione,
  clicGiu,
  clicSu,
  passo,
  problemiSessione,
  TEMPO_INTERVENTO_TERMICO,
  type SessioneImpianto,
} from "../motori/impianti";

const elabVuoto = serializzaProgetto({ modulo: "impianti", schema: SCHEMA_VUOTO }, "0.1.0");

describe("lettura del catalogo", () => {
  it("abbina le voci ai file e tiene l'ordine", () => {
    const { esempi, errori } = leggiCatalogo(
      {
        versione: 1,
        esempi: [
          { file: "b.elab", modulo: "impianti", titolo: " B ", descrizione: "d", prova: "p" },
          { file: "a.elab", modulo: "plc", titolo: "A" },
        ],
      },
      { "a.elab": elabVuoto, "b.elab": elabVuoto },
    );
    expect(errori).toEqual([]);
    expect(esempi.map((e) => [e.file, e.modulo, e.titolo])).toEqual([
      ["b.elab", "impianti", "B"],
      ["a.elab", "plc", "A"],
    ]);
    expect(esempi[1].descrizione).toBe("");
    expect(esempiDelModulo(esempi, "plc").map((e) => e.file)).toEqual(["a.elab"]);
  });

  it("scarta voci incomplete, moduli sconosciuti, doppioni e file mancanti senza bloccarsi", () => {
    const { esempi, errori } = leggiCatalogo(
      {
        versione: 1,
        esempi: [
          { file: "a.elab", modulo: "impianti" }, // senza titolo
          { file: "a.elab", modulo: "cucina", titolo: "X" },
          { file: "a.elab", modulo: "impianti", titolo: "Buono" },
          { file: "a.elab", modulo: "impianti", titolo: "Doppione" },
          { file: "manca.elab", modulo: "impianti", titolo: "Manca" },
          "testo a caso",
        ],
      },
      { "a.elab": elabVuoto },
    );
    expect(esempi.map((e) => e.titolo)).toEqual(["Buono"]);
    expect(errori).toHaveLength(5);
    expect(errori.join("\n")).toContain("manca.elab");
  });

  it("catalogo non valido: nessun esempio e un errore", () => {
    expect(leggiCatalogo(null, {})).toEqual({ esempi: [], errori: [expect.stringContaining("esempi")] });
  });

  it("rifiuta un esempio il cui file appartiene a un altro modulo", () => {
    const e: Esempio = { file: "x.elab", modulo: "plc", titolo: "X", descrizione: "", prova: "", testo: elabVuoto };
    expect(apriEsempio(e).ok).toBe(false);
  });
});

// --- Gli esempi veri della cartella esempi/ -------------------------------

const libreria = libreriaDelModulo("impianti");

function schemaDi(file: string): Schema {
  const e = ESEMPI.find((x) => x.file === file);
  if (!e) throw new Error(`Esempio ${file} non trovato`);
  const esito = apriEsempio(e);
  if (!esito.ok) throw new Error(esito.errore);
  expect(esito.avvisi).toEqual([]);
  return esito.progetto.schema;
}

/** Tiene premuto un pulsante e lo rilascia (come un clic dello studente). */
const premiERilascia = (s: SessioneImpianto, id: string) => clicSu(clicGiu(s, id), id);
const k1Eccitato = (s: SessioneImpianto) => s.risultato.bobineEccitate.includes("K1");
const motoreGira = (s: SessioneImpianto) => s.risultato.motori["M1"]?.verso;
const spiaAccesa = (s: SessioneImpianto) => s.risultato.carichiAlimentati.includes("H1");

describe("esempi della cartella esempi/", () => {
  it("il catalogo è valido e contiene gli esempi degli impianti", () => {
    expect(ERRORI_ESEMPI).toEqual([]);
    expect(esempiDelModulo(ESEMPI, "impianti").map((e) => e.file)).toEqual(
      expect.arrayContaining([
        "marcia-arresto.elab",
        "comando-piu-punti.elab",
        "teleinvertitore.elab",
        "stella-triangolo.elab",
        "comando-temporizzato.elab",
      ]),
    );
    for (const e of ESEMPI) {
      expect(e.descrizione, e.file).not.toBe("");
      expect(e.prova, e.file).not.toBe("");
    }
  });

  it.each(ESEMPI.filter((e) => e.modulo === "impianti").map((e) => e.file))(
    "%s: componenti della libreria, numerazione aggiornata e nessun problema all'avvio",
    (file) => {
      const schema = schemaDi(file);
      for (const c of schema.componenti) {
        const voce = vocePerTipo(libreria, c.tipo);
        expect(voce, c.id).toBeDefined();
        expect([c.larghezza, c.altezza, c.x % 20, c.y % 20], c.id).toEqual([voce!.larghezza, voce!.altezza, 0, 0]);
      }
      // La numerazione salvata è quella che calcolerebbe il programma.
      expect(rinumeraContatti(schema, libreria)).toBe(schema);
      // Nessun errore né avviso (circuito aperto, contatti non associati…).
      expect(problemiSessione(avviaSessione(schema))).toEqual([]);
    },
  );

  it("marcia/arresto: l'autoritenuta tiene K1 eccitato, S0 lo ferma, il termico interviene", () => {
    const schema = schemaDi("marcia-arresto.elab");
    const numeri = Object.fromEntries(schema.componenti.map((c) => [c.id, c.numeriMorsetti]));
    expect(numeri["K1-autoritenuta"]).toEqual({ "13": "13", "14": "14" });
    expect(numeri["K1-spia"]).toEqual({ "13": "23", "14": "24" });

    let s = avviaSessione(schema);
    expect(k1Eccitato(s)).toBe(false);
    s = clicGiu(s, "Q1"); // chiude il sezionatore
    s = clicGiu(s, "S1");
    expect(k1Eccitato(s)).toBe(true);
    s = clicSu(s, "S1");
    expect(k1Eccitato(s)).toBe(true); // autoritenuta
    expect(motoreGira(s)).toBe("orario");
    expect(spiaAccesa(s)).toBe(true);
    s = premiERilascia(s, "S0");
    expect(k1Eccitato(s)).toBe(false);
    expect(motoreGira(s)).toBeUndefined();
    expect(spiaAccesa(s)).toBe(false);

    // Sovraccarico: il relè termico apre 95-96 e K1 si diseccita; poi riarmo.
    s = premiERilascia(s, "S1");
    s = clicGiu(s, "M1");
    s = passo(s, TEMPO_INTERVENTO_TERMICO + 0.5);
    expect(s.stato.protezioniIntervenute).toContain("F1");
    expect(k1Eccitato(s)).toBe(false);
    s = clicGiu(s, "M1"); // tolto il sovraccarico
    s = clicGiu(s, "F1"); // riarmo
    expect(s.stato.protezioniIntervenute).not.toContain("F1");
    expect(k1Eccitato(s)).toBe(false); // serve una nuova marcia
    expect(k1Eccitato(premiERilascia(s, "S1"))).toBe(true);
  });

  it("marcia/arresto: con il sezionatore aperto K1 si eccita ma il motore non gira", () => {
    let s = avviaSessione(schemaDi("marcia-arresto.elab"));
    s = premiERilascia(s, "S1");
    expect(k1Eccitato(s)).toBe(true);
    expect(motoreGira(s)).toBeUndefined();
  });

  it("comando da più punti: si avvia da S1 o S3, si ferma da S0 o S2", () => {
    const avviato = clicGiu(avviaSessione(schemaDi("comando-piu-punti.elab")), "Q1");
    for (const marcia of ["S1", "S3"]) {
      for (const arresto of ["S0", "S2"]) {
        let s = premiERilascia(avviato, marcia);
        expect(k1Eccitato(s), `marcia ${marcia}`).toBe(true);
        expect(motoreGira(s)).toBe("orario");
        s = premiERilascia(s, arresto);
        expect(k1Eccitato(s), `arresto ${arresto}`).toBe(false);
        expect(motoreGira(s)).toBeUndefined();
      }
    }
    // Arresto tenuto premuto: la marcia non ha effetto (l'arresto ha la precedenza).
    let s = clicGiu(avviato, "S2");
    s = clicGiu(s, "S3");
    expect(k1Eccitato(s)).toBe(false);
  });
});

// --- Attività 2.8: teleinvertitore, stella-triangolo, comando temporizzato ---

const eccitate = (s: SessioneImpianto) => [...s.risultato.bobineEccitate].sort();
const collegamento = (s: SessioneImpianto) => s.risultato.motori["M1"]?.collegamento;

describe("esempi pronti (2)", () => {
  it("teleinvertitore: S1 avanti, S2 indietro, l'interblocco impedisce K1 e K2 insieme", () => {
    const schema = schemaDi("teleinvertitore.elab");
    const numeri = Object.fromEntries(schema.componenti.map((c) => [c.id, c.numeriMorsetti]));
    // Ogni contattore: 13-14 autoritenuta, 21-22 interblocco, 33-34 spia.
    expect(numeri["K1-autoritenuta"]).toEqual({ "13": "13", "14": "14" });
    expect(numeri["K2-autoritenuta"]).toEqual({ "13": "13", "14": "14" });
    expect(Object.values(numeri["K1-interblocco"] ?? {})).toEqual(["21", "22"]);
    expect(Object.values(numeri["K2-interblocco"] ?? {})).toEqual(["21", "22"]);
    expect(Object.values(numeri["K1-spia"] ?? {})).toEqual(["33", "34"]);

    const avviato = clicGiu(avviaSessione(schema), "Q1");
    let s = premiERilascia(avviato, "S1");
    expect(eccitate(s)).toEqual(["K1"]);
    expect(motoreGira(s)).toBe("orario");
    expect(spiaAccesa(s)).toBe(true);
    // Con K1 eccitato S2 non ha effetto: niente cortocircuito, niente fusibili.
    s = clicGiu(s, "S2");
    expect(eccitate(s)).toEqual(["K1"]);
    expect(s.risultato.cortocircuiti).toEqual([]);
    s = clicSu(s, "S2");
    s = premiERilascia(s, "S0");
    expect(eccitate(s)).toEqual([]);
    expect(motoreGira(s)).toBeUndefined();
    s = premiERilascia(s, "S2");
    expect(eccitate(s)).toEqual(["K2"]);
    expect(motoreGira(s)).toBe("antiorario");
    expect(s.risultato.carichiAlimentati).toContain("H2");
    expect(s.risultato.carichiAlimentati).not.toContain("H1");
    // Anche premendo S1 e S2 insieme da fermo si eccita al più un contattore.
    s = clicGiu(clicGiu(premiERilascia(s, "S0"), "S1"), "S2");
    expect(eccitate(s).length).toBeLessThanOrEqual(1);
    expect(s.risultato.cortocircuiti).toEqual([]);
    expect(problemiSessione(s).filter((p) => p.gravita === "errore")).toEqual([]);
  });

  it("stella-triangolo: parte a stella, dopo il tempo di KT1 passa a triangolo, S0 ferma tutto", () => {
    const schema = schemaDi("stella-triangolo.elab");
    expect(schema.componenti.find((c) => c.id === "KT1")?.tempo).toBe(4);

    let s = clicGiu(avviaSessione(schema), "Q1");
    s = premiERilascia(s, "S1");
    expect(eccitate(s)).toEqual(["K1", "K2", "KT1"]);
    expect(motoreGira(s)).toBe("orario");
    expect(collegamento(s)).toBe("stella");
    s = passo(s, 3.9);
    expect(collegamento(s)).toBe("stella");
    s = passo(s, 0.2);
    expect(eccitate(s)).toEqual(["K1", "K3", "KT1"]);
    expect(motoreGira(s)).toBe("orario");
    expect(collegamento(s)).toBe("triangolo");
    expect(s.risultato.cortocircuiti).toEqual([]);
    expect(s.stato.protezioniIntervenute).toEqual([]);
    s = premiERilascia(s, "S0");
    expect(eccitate(s)).toEqual([]);
    expect(motoreGira(s)).toBeUndefined();
    // Una nuova marcia riparte da stella (il temporizzatore si è azzerato).
    s = premiERilascia(s, "S1");
    expect(collegamento(s)).toBe("stella");
  });

  it("comando temporizzato: il motore si ferma da solo dopo il tempo di KT1", () => {
    const schema = schemaDi("comando-temporizzato.elab");
    expect(schema.componenti.find((c) => c.id === "KT1")?.tempo).toBe(8);

    let s = clicGiu(avviaSessione(schema), "Q1");
    s = premiERilascia(s, "S1");
    expect(eccitate(s)).toEqual(["K1", "KT1"]);
    expect(motoreGira(s)).toBe("orario");
    expect(spiaAccesa(s)).toBe(true);
    s = passo(s, 7.9);
    expect(motoreGira(s)).toBe("orario");
    s = passo(s, 0.2);
    expect(eccitate(s)).toEqual([]);
    expect(motoreGira(s)).toBeUndefined();
    expect(spiaAccesa(s)).toBe(false);
    expect(problemiSessione(s)).toEqual([]); // fermata regolare, nessuna oscillazione
    // Si può ripartire e fermare prima del tempo con S0.
    s = premiERilascia(s, "S1");
    expect(k1Eccitato(s)).toBe(true);
    s = passo(s, 2);
    s = premiERilascia(s, "S0");
    expect(eccitate(s)).toEqual([]);
  });
});
