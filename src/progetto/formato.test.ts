// Test del formato dei file .elab.
import { describe, expect, it } from "vitest";
import { conEstensioneElab, leggiProgetto, nomeDaPercorso, serializzaProgetto, VERSIONE_FORMATO, type Progetto } from "./formato";
import { t } from "../testi";

const progetto: Progetto = {
  modulo: "impianti",
  schema: {
    componenti: [
      { id: "c1", tipo: "pulsante-na", etichetta: "S1", x: 40, y: 60, larghezza: 40, altezza: 60 },
      { id: "c2", tipo: "lampada", etichetta: "H1", x: 200, y: 60, larghezza: 40, altezza: 60 },
    ],
    fili: [
      { id: "f1", da: { componente: "c1", morsetto: "14" }, a: { componente: "c2", morsetto: "X1" } },
      { id: "f2", da: { componente: "c1", morsetto: "13" }, a: { componente: "c2", morsetto: "X2" }, medio: 120 },
    ],
  },
};

const testo = (dati: unknown) => JSON.stringify(dati);
const base = () => JSON.parse(serializzaProgetto(progetto, "0.1.0")) as Record<string, unknown>;

describe("file .elab", () => {
  it("salvataggio e riapertura restituiscono lo stesso progetto", () => {
    const esito = leggiProgetto(serializzaProgetto(progetto, "0.1.0"));
    expect(esito).toEqual({ ok: true, progetto, avvisi: [] });
  });

  it("salva e rilegge la numerazione dei contatti; scarta i numeri non validi", () => {
    const conContatto: Progetto = {
      modulo: "impianti",
      schema: {
        componenti: [
          { id: "k", tipo: "bobina-contattore", etichetta: "K1", x: 0, y: 0, larghezza: 40, altezza: 80 },
          { id: "c", tipo: "contatto-na", etichetta: "K1", x: 80, y: 0, larghezza: 40, altezza: 80, numeriMorsetti: { "13": "23", "14": "24" } },
        ],
        fili: [],
      },
    };
    expect(leggiProgetto(serializzaProgetto(conContatto, "0.1.0"))).toEqual({ ok: true, progetto: conContatto, avvisi: [] });
    const dati = JSON.parse(serializzaProgetto(conContatto, "0.1.0"));
    dati.schema.componenti[1].numeriMorsetti = { "13": 23, "14": "" };
    const esito = leggiProgetto(JSON.stringify(dati));
    expect(esito.ok && esito.progetto.schema.componenti[1].numeriMorsetti).toBeUndefined();
  });

  it("scrive formato, versione, modulo, versione del programma e data", () => {
    const dati = JSON.parse(serializzaProgetto(progetto, "0.1.0", new Date("2026-10-25T21:00:00Z")));
    expect(dati).toMatchObject({ formato: "elettrolab", versione: VERSIONE_FORMATO, modulo: "impianti", programma: "0.1.0" });
    expect(dati.salvato).toBe("2026-10-25T21:00:00.000Z");
  });

  it("è JSON indentato, leggibile e modificabile a mano", () => {
    const s = serializzaProgetto(progetto, "0.1.0");
    expect(s).toContain('\n  "modulo": "impianti"');
    expect(s.endsWith("\n")).toBe(true);
  });

  it("accetta il BOM aggiunto da Blocco note", () => {
    expect(leggiProgetto("\uFEFF" + serializzaProgetto(progetto, "0.1.0")).ok).toBe(true);
  });

  it("rifiuta testo che non è JSON", () => {
    expect(leggiProgetto("ciao")).toEqual({ ok: false, errore: t("file.nonJson") });
  });

  it("rifiuta JSON che non è di ElettroLab", () => {
    expect(leggiProgetto(testo({ nome: "altro" }))).toEqual({ ok: false, errore: t("file.nonElettrolab") });
    expect(leggiProgetto("[1,2]")).toEqual({ ok: false, errore: t("file.nonElettrolab") });
  });

  it("rifiuta i file di una versione più nuova, spiegando di aggiornare", () => {
    const esito = leggiProgetto(testo({ ...base(), versione: VERSIONE_FORMATO + 1 }));
    expect(esito).toEqual({ ok: false, errore: t("file.versioneNuova") });
  });

  it("rifiuta versioni mancanti o non valide", () => {
    for (const versione of [undefined, 0, 1.5, "1"]) {
      expect(leggiProgetto(testo({ ...base(), versione }))).toEqual({ ok: false, errore: t("file.versioneNonValida") });
    }
  });

  it("rifiuta un modulo sconosciuto", () => {
    expect(leggiProgetto(testo({ ...base(), modulo: "cucina" }))).toEqual({ ok: false, errore: t("file.moduloSconosciuto") });
  });

  it("uno schema mancante diventa un foglio vuoto", () => {
    const { schema: _tolto, ...senza } = base();
    const esito = leggiProgetto(testo(senza));
    expect(esito.ok && esito.progetto.schema).toEqual({ componenti: [], fili: [] });
  });

  it("scarta componenti incompleti o doppi e lo dice", () => {
    const dati = base();
    const schema = dati.schema as { componenti: unknown[] };
    schema.componenti.push({ id: "c3", tipo: "lampada" }, { ...progetto.schema.componenti[0] }, "a caso");
    const esito = leggiProgetto(testo(dati));
    expect(esito.ok).toBe(true);
    if (!esito.ok) return;
    expect(esito.progetto.schema.componenti.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(esito.avvisi).toEqual([t("file.componentiScartati", { numero: 3 })]);
  });

  it("scarta i fili verso componenti inesistenti e lo dice", () => {
    const dati = base();
    const schema = dati.schema as { fili: unknown[] };
    schema.fili.push({ id: "f3", da: { componente: "c1", morsetto: "13" }, a: { componente: "sparito", morsetto: "1" } });
    schema.fili.push({ id: "f4", da: { componente: "c1" } });
    const esito = leggiProgetto(testo(dati));
    expect(esito.ok && esito.progetto.schema.fili.map((f) => f.id)).toEqual(["f1", "f2"]);
    expect(esito.ok && esito.avvisi).toEqual([t("file.filiScartati", { numero: 2 })]);
  });

  it("un'etichetta mancante diventa vuota (reti e masse non hanno sigla)", () => {
    const dati = base();
    const schema = dati.schema as { componenti: Record<string, unknown>[] };
    delete schema.componenti[0].etichetta;
    const esito = leggiProgetto(testo(dati));
    expect(esito.ok && esito.progetto.schema.componenti[0].etichetta).toBe("");
  });

  it("ignora i campi sconosciuti aggiunti a mano", () => {
    const dati = base();
    const schema = dati.schema as { componenti: Record<string, unknown>[] };
    schema.componenti[0].colore = "rosso";
    const esito = leggiProgetto(testo({ ...dati, nota: "esercizio 3" }));
    expect(esito.ok && esito.progetto).toEqual(progetto);
  });
});

describe("nomi dei file", () => {
  it("toglie cartella ed estensione, con \\ e /", () => {
    expect(nomeDaPercorso("C:\\Esercizi\\Marcia arresto.elab")).toBe("Marcia arresto");
    expect(nomeDaPercorso("/home/studente/teleinvertitore.ELAB")).toBe("teleinvertitore");
    expect(nomeDaPercorso("schema")).toBe("schema");
  });

  it("aggiunge .elab solo se manca", () => {
    expect(conEstensioneElab("C:\\Esercizi\\prova")).toBe("C:\\Esercizi\\prova.elab");
    expect(conEstensioneElab("prova.elab")).toBe("prova.elab");
    expect(conEstensioneElab("prova.ELAB")).toBe("prova.ELAB");
  });
});
