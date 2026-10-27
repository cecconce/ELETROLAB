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
      expect.arrayContaining(["marcia-arresto.elab", "comando-piu-punti.elab"]),
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
