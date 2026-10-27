// Test della finestra "Esempi" (HTML statico, senza browser).
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FinestraEsempi } from "./FinestraEsempi";
import { ESEMPI } from "../progetto/caricaEsempi";
import { t } from "../testi";

const nulla = () => {};

describe("finestra Esempi", () => {
  it("elenca gli esempi degli impianti con titolo, descrizione e pulsante Apri", () => {
    const html = renderToStaticMarkup(<FinestraEsempi esempi={ESEMPI} onApri={nulla} onChiudi={nulla} />);
    expect(html).toContain(t("esempi.titolo"));
    for (const e of ESEMPI) {
      expect(html).toContain(`data-esempio="${e.file}"`);
      expect(html).toContain(e.titolo);
    }
    expect(html).toContain('data-esempio="marcia-arresto.elab"');
    expect(html).toContain('data-esempio="comando-piu-punti.elab"');
  });

  it("per i moduli senza esempi dice che arriveranno", () => {
    const html = renderToStaticMarkup(<FinestraEsempi esempi={[]} onApri={nulla} onChiudi={nulla} />);
    expect(html.split(t("esempi.inArrivo")).length - 1).toBe(4);
    expect(html).not.toContain("data-esempio=");
  });
});
