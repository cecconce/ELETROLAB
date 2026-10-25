// Finestra "Informazioni": autore, istituto, versione, licenza, privacy,
// cartella dei dati ed elenco delle librerie usate con la loro licenza.
// È un componente "puro" (dati dalle props), provato nei test senza browser.
import { useEffect, useRef } from "react";
import { t } from "../testi";
import { AUTORE, ISTITUTO, LIBRERIE, LICENZA_PROGRAMMA, istitutoDaMostrare } from "./dati";

export interface PropsFinestraInformazioni {
  versione: string;
  /** Cartella dei dati in uso (null finché non è nota, es. nei test). */
  cartellaDati: { percorso: string; portable: boolean } | null;
  onChiudi: () => void;
}

export function FinestraInformazioni(props: PropsFinestraInformazioni) {
  const { versione, cartellaDati, onChiudi } = props;
  const pulsanteChiudi = useRef<HTMLButtonElement>(null);

  // Esc chiude; il fuoco va sul pulsante "Chiudi" (comodo da tastiera).
  useEffect(() => {
    pulsanteChiudi.current?.focus({ preventScroll: true });
    const tasto = (e: KeyboardEvent) => {
      if (e.key === "Escape") onChiudi();
    };
    window.addEventListener("keydown", tasto);
    return () => window.removeEventListener("keydown", tasto);
  }, [onChiudi]);

  return (
    <div className="sfondo-finestra" onClick={onChiudi}>
      <div
        className="finestra finestra-informazioni"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titolo-informazioni"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="titolo-informazioni">{t("info.titolo")}</h2>

        <dl className="info-dati">
          <dt>{t("info.programma")}</dt>
          <dd>
            {t("app.titolo")} — {t("app.versione", { versione })}
          </dd>
          <dt>{t("info.autore")}</dt>
          <dd>{AUTORE}</dd>
          <dt>{t("info.istituto")}</dt>
          <dd>{istitutoDaMostrare(ISTITUTO, t("info.istitutoPredefinito"))}</dd>
          <dt>{t("info.licenza")}</dt>
          <dd>{t("info.licenzaTesto", { licenza: LICENZA_PROGRAMMA })}</dd>
          <dt>{t("info.privacy")}</dt>
          <dd>{t("info.privacyTesto")}</dd>
          {cartellaDati && (
            <>
              <dt>{t("info.cartellaDati")}</dt>
              <dd>
                <code>{cartellaDati.percorso}</code>{" "}
                <span className="tenue">({cartellaDati.portable ? t("info.modoPortable") : t("info.modoUtente")})</span>
              </dd>
            </>
          )}
        </dl>

        <h3>{t("info.librerie")}</h3>
        <p className="tenue">{t("info.librerieIntro")}</p>
        <table className="tabella-librerie">
          <thead>
            <tr>
              <th>{t("info.colNome")}</th>
              <th>{t("info.colLicenza")}</th>
              <th>{t("info.colAutori")}</th>
              <th>{t("info.colUso")}</th>
            </tr>
          </thead>
          <tbody>
            {LIBRERIE.map((l) => (
              <tr key={l.nome}>
                <td>
                  {l.nome}
                  <div className="tenue">{l.sito}</div>
                </td>
                <td className="senza-a-capo">{l.licenza}</td>
                <td>{l.autori}</td>
                <td>{l.uso}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="tenue">{t("info.testiLicenze")}</p>

        <div className="finestra-pulsanti">
          <button ref={pulsanteChiudi} type="button" className="pulsante" onClick={onChiudi}>
            {t("comune.chiudi")}
          </button>
        </div>
      </div>
    </div>
  );
}
