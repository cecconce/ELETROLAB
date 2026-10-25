// Test di Annulla/Ripeti: passi illimitati, gesti continui, rami cancellati.
import { describe, expect, it } from "vitest";
import { annulla, modifica, nuovaCronologia, puoAnnullare, puoRipetere, ripeti, schemiUguali } from "./cronologia";
import { SCHEMA_VUOTO, aggiungiComponente, spostaComponente, type ComponenteSchema, type Schema } from "./schema";

const comp = (id: string, x = 0, y = 0): ComponenteSchema => ({ id, tipo: "prova", etichetta: id, x, y, larghezza: 40, altezza: 40 });
const ids = (s: Schema) => s.componenti.map((c) => c.id);

describe("cronologia", () => {
  it("una cronologia nuova non ha nulla da annullare né da ripetere", () => {
    const c = nuovaCronologia(SCHEMA_VUOTO);
    expect(puoAnnullare(c)).toBe(false);
    expect(puoRipetere(c)).toBe(false);
    expect(annulla(c)).toBe(c);
    expect(ripeti(c)).toBe(c);
  });

  it("annulla e ripete una modifica", () => {
    const s1 = aggiungiComponente(SCHEMA_VUOTO, comp("a"));
    let c = modifica(nuovaCronologia(SCHEMA_VUOTO), s1);
    expect(puoAnnullare(c)).toBe(true);
    c = annulla(c);
    expect(c.presente).toBe(SCHEMA_VUOTO);
    expect(puoRipetere(c)).toBe(true);
    c = ripeti(c);
    expect(c.presente).toBe(s1);
    expect(puoRipetere(c)).toBe(false);
  });

  it("non ha limiti: 500 modifiche si annullano tutte, in ordine", () => {
    let c = nuovaCronologia(SCHEMA_VUOTO);
    for (let i = 0; i < 500; i++) c = modifica(c, aggiungiComponente(c.presente, comp(`c${i}`, i * 20)));
    expect(c.presente.componenti).toHaveLength(500);
    for (let i = 499; i >= 0; i--) {
      c = annulla(c);
      expect(c.presente.componenti).toHaveLength(i);
    }
    expect(puoAnnullare(c)).toBe(false);
    for (let i = 0; i < 500; i++) c = ripeti(c);
    expect(c.presente.componenti).toHaveLength(500);
  });

  it("una nuova modifica dopo un annulla cancella i passi da ripetere", () => {
    let c = nuovaCronologia(SCHEMA_VUOTO);
    c = modifica(c, aggiungiComponente(c.presente, comp("a")));
    c = modifica(c, aggiungiComponente(c.presente, comp("b", 100)));
    c = annulla(c);
    c = modifica(c, aggiungiComponente(c.presente, comp("x", 200)));
    expect(puoRipetere(c)).toBe(false);
    expect(ids(c.presente)).toEqual(["a", "x"]);
    expect(ids(annulla(c).presente)).toEqual(["a"]);
  });

  it("una modifica che non cambia nulla non crea passi", () => {
    const s1 = aggiungiComponente(SCHEMA_VUOTO, comp("a"));
    let c = modifica(nuovaCronologia(SCHEMA_VUOTO), s1);
    c = modifica(c, s1);
    c = modifica(c, { componenti: [...s1.componenti], fili: [] }); // stesso contenuto, oggetto diverso
    expect(c.passato).toHaveLength(1);
  });

  it("un trascinamento (tante modifiche provvisorie) diventa un solo passo", () => {
    const s1 = aggiungiComponente(SCHEMA_VUOTO, comp("a"));
    let c = modifica(nuovaCronologia(SCHEMA_VUOTO), s1);
    let s = s1;
    for (let x = 20; x <= 200; x += 20) {
      s = spostaComponente(s1, "a", { x, y: 0 });
      c = modifica(c, s, true);
      expect(c.presente).toBe(s); // lo studente vede il movimento
    }
    expect(c.passato).toHaveLength(1); // nessun passo durante il gesto
    c = modifica(c, s); // rilascio del mouse
    expect(c.passato).toHaveLength(2);
    expect(c.inizioGesto).toBeUndefined();
    c = annulla(c);
    expect(c.presente).toBe(s1); // si torna a prima del trascinamento, non a metà strada
  });

  it("un trascinamento che riporta il componente al punto di partenza non crea passi", () => {
    const s1 = aggiungiComponente(SCHEMA_VUOTO, comp("a"));
    let c = modifica(nuovaCronologia(SCHEMA_VUOTO), s1);
    c = modifica(c, spostaComponente(s1, "a", { x: 60, y: 0 }), true);
    c = modifica(c, spostaComponente(s1, "a", { x: 0, y: 0 }));
    expect(c.passato).toHaveLength(1);
    expect(c.inizioGesto).toBeUndefined();
  });

  it("Annulla durante un trascinamento annulla il trascinamento", () => {
    const s1 = aggiungiComponente(SCHEMA_VUOTO, comp("a"));
    let c = modifica(nuovaCronologia(SCHEMA_VUOTO), s1);
    c = modifica(c, spostaComponente(s1, "a", { x: 60, y: 0 }), true);
    expect(puoAnnullare(c)).toBe(true);
    expect(puoRipetere(c)).toBe(false);
    c = annulla(c);
    expect(c.presente).toBe(s1);
    expect(c.inizioGesto).toBeUndefined();
  });

  it("schemiUguali confronta il contenuto", () => {
    const a = aggiungiComponente(SCHEMA_VUOTO, comp("a"));
    expect(schemiUguali(a, a)).toBe(true);
    expect(schemiUguali(a, aggiungiComponente(SCHEMA_VUOTO, comp("a")))).toBe(true);
    expect(schemiUguali(a, aggiungiComponente(SCHEMA_VUOTO, comp("b")))).toBe(false);
  });
});
