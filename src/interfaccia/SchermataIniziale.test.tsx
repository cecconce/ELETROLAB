// Test della schermata iniziale: viene trasformata in HTML statico
// (senza browser) e si controlla che ci sia tutto quello che serve.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SchermataIniziale, type PropsSchermataIniziale } from "./SchermataIniziale";
import { MODULI, trovaModulo } from "./moduli";
import { t } from "../testi";

const nulla = () => {};

function disegna(sovrascrivi: Partial<PropsSchermataIniziale> = {}) {
  return renderToStaticMarkup(
    <SchermataIniziale
      tema="chiaro"
      versione="0.1.0"
      recenti={[]}
      onApriModulo={nulla}
      onApriRecente={nulla}
      onApriEsempi={nulla}
      onAlternaTema={nulla}
      {...sovrascrivi}
    />,
  );
}

describe("schermata iniziale", () => {
  it("mostra le 4 tessere nell'ordine previsto", () => {
    const html = disegna();
    const ordine = ["impianti", "plc", "arduino", "elettronica"].map((id) => html.indexOf(`data-modulo="${id}"`));
    expect(ordine.every((p) => p > -1)).toBe(true);
    expect([...ordine].sort((a, b) => a - b)).toEqual(ordine);
    expect(html.match(/class="tessera"/g)).toHaveLength(4);
  });

  it("usa i testi in italiano da lingue/it.json", () => {
    const html = disegna();
    for (const titolo of ["Impianti elettrici", "PLC", "Arduino", "Elettronica"]) {
      expect(html).toContain(titolo);
    }
    expect(html).toContain(t("home.recenti"));
    expect(html).toContain(t("home.esempi"));
    expect(html).toContain("Versione 0.1.0");
  });

  it("mostra un messaggio quando non ci sono file recenti", () => {
    expect(disegna()).toContain(t("home.recentiVuoto"));
  });

  it("elenca i file recenti quando ci sono", () => {
    const html = disegna({ recenti: [{ nome: "marcia-arresto.elab", percorso: "C:\\esercizi\\marcia-arresto.elab" }] });
    expect(html).toContain("marcia-arresto.elab");
    expect(html).not.toContain(t("home.recentiVuoto"));
  });

  it("il pulsante del tema propone il tema opposto", () => {
    expect(disegna({ tema: "chiaro" })).toContain(t("tema.passaScuro"));
    expect(disegna({ tema: "scuro" })).toContain(t("tema.passaChiaro"));
  });

  it("ogni modulo ha titolo e descrizione tradotti", () => {
    for (const m of MODULI) {
      expect(t(m.chiaveTitolo)).not.toBe(m.chiaveTitolo);
      expect(t(m.chiaveDescrizione)).not.toBe(m.chiaveDescrizione);
    }
    expect(trovaModulo("plc")?.id).toBe("plc");
    expect(trovaModulo("inesistente")).toBeUndefined();
  });
});
