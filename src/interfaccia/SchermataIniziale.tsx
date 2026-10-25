// Schermata iniziale: 4 grandi tessere dei moduli, "Apri esercizio recente"
// ed "Esempi". È un componente "puro": riceve i dati e le azioni dalle props,
// così si può provare nei test senza Tauri.
import { t } from "../testi";
import { MODULI, type IdModulo } from "./moduli";
import { IconaModulo } from "./IconeModuli";
import type { Tema } from "./tema";
import type { FileRecente } from "../progetto/impostazioni";

export type { FileRecente };

export interface PropsSchermataIniziale {
  tema: Tema;
  versione: string;
  /** Elenco dei file recenti (dal file delle impostazioni), il più recente per primo. */
  recenti: FileRecente[];
  onApriModulo: (id: IdModulo) => void;
  onApriRecente: (file: FileRecente) => void;
  /** Finestra "Apri" per scegliere un file .elab qualsiasi. */
  onApriFile: () => void;
  onApriEsempi: () => void;
  onAlternaTema: () => void;
}

export function SchermataIniziale(props: PropsSchermataIniziale) {
  const { tema, versione, recenti } = props;
  const etichettaTema = tema === "chiaro" ? t("tema.passaScuro") : t("tema.passaChiaro");

  return (
    <div className="schermata-iniziale">
      <header className="intestazione">
        <div>
          <h1>{t("app.titolo")}</h1>
          <p className="sottotitolo">{t("app.sottotitolo")}</p>
        </div>
        <button type="button" className="pulsante-tema" onClick={props.onAlternaTema} title={etichettaTema}>
          {tema === "chiaro" ? "☾" : "☀"} {etichettaTema}
        </button>
      </header>

      <nav className="griglia-tessere" aria-label={t("home.moduli")}>
        {MODULI.map((m) => (
          <button
            key={m.id}
            type="button"
            className="tessera"
            data-modulo={m.id}
            style={{ ["--accento" as string]: m.coloreAccento }}
            onClick={() => props.onApriModulo(m.id)}
          >
            <span className="tessera-icona">
              <IconaModulo id={m.id} />
            </span>
            <span className="tessera-titolo">{t(m.chiaveTitolo)}</span>
            <span className="tessera-descrizione">{t(m.chiaveDescrizione)}</span>
          </button>
        ))}
      </nav>

      <section className="riga-secondaria">
        <div className="pannello">
          <h2>{t("home.recenti")}</h2>
          {recenti.length === 0 ? (
            <p className="vuoto">{t("home.recentiVuoto")}</p>
          ) : (
            <ul className="elenco-recenti">
              {recenti.map((f) => (
                <li key={f.percorso}>
                  <button type="button" onClick={() => props.onApriRecente(f)} title={f.percorso}>
                    {f.nome}
                    {f.modulo && <span className="recente-modulo"> · {t(`modulo.${f.modulo}.titolo`)}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="pulsante" onClick={props.onApriFile}>
            {t("home.apriFile")}
          </button>
        </div>
        <div className="pannello">
          <h2>{t("home.esempi")}</h2>
          <p>{t("home.esempiDescrizione")}</p>
          <button type="button" className="pulsante" onClick={props.onApriEsempi}>
            {t("home.apriEsempi")}
          </button>
        </div>
      </section>

      <footer className="piede">{t("app.versione", { versione })}</footer>
    </div>
  );
}
