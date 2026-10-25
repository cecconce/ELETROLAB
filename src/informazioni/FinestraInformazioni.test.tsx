// Test della finestra "Informazioni" trasformata in HTML statico.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FinestraInformazioni } from "./FinestraInformazioni";
import { AUTORE, LIBRERIE } from "./dati";
import { t } from "../testi";

const nulla = () => {};

describe("finestra Informazioni", () => {
  it("mostra autore, versione, licenza e privacy", () => {
    const html = renderToStaticMarkup(<FinestraInformazioni versione="1.2.3" cartellaDati={null} onChiudi={nulla} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain(AUTORE);
    expect(html).toContain("Versione 1.2.3");
    expect(html).toContain("GPL-3.0");
    expect(html).toContain(t("info.privacyTesto"));
    expect(html).toContain(t("info.istitutoPredefinito"));
    expect(html).toContain(t("comune.chiudi"));
  });

  it("elenca tutte le librerie con la loro licenza", () => {
    const html = renderToStaticMarkup(<FinestraInformazioni versione="1.0.0" cartellaDati={null} onChiudi={nulla} />);
    for (const l of LIBRERIE) {
      expect(html).toContain(l.nome);
      expect(html).toContain(l.licenza);
    }
  });

  it("mostra la cartella dei dati e se il programma è portable", () => {
    const portable = renderToStaticMarkup(
      <FinestraInformazioni versione="1" cartellaDati={{ percorso: "E:\\ElettroLab\\dati", portable: true }} onChiudi={nulla} />,
    );
    expect(portable).toContain("E:\\ElettroLab\\dati");
    expect(portable).toContain(t("info.modoPortable"));
    const utente = renderToStaticMarkup(
      <FinestraInformazioni versione="1" cartellaDati={{ percorso: "C:\\Users\\x\\AppData\\Roaming\\ElettroLab", portable: false }} onChiudi={nulla} />,
    );
    expect(utente).toContain(t("info.modoUtente").replace("'", "&#x27;"));
    // Senza informazioni sulla cartella la riga non compare.
    expect(renderToStaticMarkup(<FinestraInformazioni versione="1" cartellaDati={null} onChiudi={nulla} />)).not.toContain(
      t("info.cartellaDati"),
    );
  });
});
