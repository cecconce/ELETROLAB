// Pannello "Problemi nello schema" mostrato durante la simulazione, fra il
// foglio e la barra in basso. Elenca gli errori (prima) e gli avvisi spiegati
// in italiano semplice; un clic su una riga evidenzia sul foglio i componenti
// e i morsetti di quel problema (un secondo clic toglie la scelta). Non blocca
// niente: la simulazione continua e il pannello si può ridurre a una riga.
import { t } from "../testi";
import type { ProblemaMostrato } from "./messaggiProblemi";

export interface PropsPannelloProblemi {
  problemi: readonly ProblemaMostrato[];
  /** Chiave della riga scelta (evidenziata sul foglio), null = nessuna. */
  scelto: string | null;
  onScegli: (chiave: string | null) => void;
  aperto: boolean;
  onApri: (aperto: boolean) => void;
}

export function PannelloProblemi({ problemi, scelto, onScegli, aperto, onApri }: PropsPannelloProblemi) {
  const errori = problemi.filter((p) => p.gravita === "errore").length;
  return (
    <section
      className="pannello-problemi"
      data-errori={errori}
      data-numero={problemi.length}
      aria-label={t("problemi.titolo")}
    >
      <header>
        <strong>
          {problemi.length === 0 ? "✔" : errori > 0 ? "⛔" : "⚠"} {t("problemi.titolo")} ({problemi.length})
        </strong>
        {problemi.length > 0 && aperto && <span className="pannello-problemi-aiuto">{t("problemi.aiuto")}</span>}
        {problemi.length > 0 && (
          <button type="button" className="pulsante" onClick={() => onApri(!aperto)}>
            {aperto ? t("problemi.nascondi") : t("problemi.mostra")}
          </button>
        )}
      </header>
      {problemi.length === 0 && <p className="pannello-problemi-vuoto">{t("problemi.nessuno")}</p>}
      {aperto && problemi.length > 0 && (
        <ul>
          {problemi.map((p) => (
            <li key={p.chiave}>
              <button
                type="button"
                className="riga-problema"
                data-gravita={p.gravita}
                aria-pressed={scelto === p.chiave}
                onClick={() => onScegli(scelto === p.chiave ? null : p.chiave)}
              >
                <span className="etichetta-gravita">
                  {p.gravita === "errore" ? `⛔ ${t("problemi.errore")}` : `⚠ ${t("problemi.avviso")}`}
                </span>
                <span>{p.testo}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
