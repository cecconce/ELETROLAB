// Pannello del codice del modulo Arduino (a destra del banco).
// - Editor di testo con i numeri di riga; la riga con un errore è segnata in
//   rosso e il messaggio è spiegato sotto.
// - Durante la simulazione il codice non si modifica (come sulla scheda vera
//   bisogna fermare, correggere e riavviare) e compare il monitor seriale,
//   con la casella per inviare testo al programma.
import { useEffect, useRef, useState } from "react";
import { t } from "../testi";

export interface PropsPannelloCodice {
  codice: string;
  /** Il testo è cambiato; `definitivo` = fine della modifica (un passo di Annulla). */
  onCambia: (codice: string, definitivo: boolean) => void;
  inSimulazione: boolean;
  /** Errore del programma da segnare (riga 1…) o null. */
  errore: { riga: number; messaggio: string } | null;
  seriale: string;
  onInviaSeriale: (testo: string) => void;
  onPulisciSeriale: () => void;
}

const ALTEZZA_RIGA = 19;

export function PannelloCodice({ codice, onCambia, inSimulazione, errore, seriale, onInviaSeriale, onPulisciSeriale }: PropsPannelloCodice) {
  const testo = useRef<HTMLTextAreaElement>(null);
  const numeri = useRef<HTMLDivElement>(null);
  const monitor = useRef<HTMLPreElement>(null);
  const [daInviare, setDaInviare] = useState("");
  const righe = codice.split("\n").length;

  // Il monitor seriale scorre da solo fino all'ultima riga.
  useEffect(() => {
    if (monitor.current) monitor.current.scrollTop = monitor.current.scrollHeight;
  }, [seriale]);

  // Il tasto Tab inserisce due spazi invece di spostarsi su un altro controllo.
  const suTasto = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const el = e.currentTarget;
    const inizio = el.selectionStart;
    const nuovo = `${codice.slice(0, inizio)}  ${codice.slice(el.selectionEnd)}`;
    onCambia(nuovo, false);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = inizio + 2;
    });
  };

  return (
    <div className="pannello-codice">
      <div className="codice-editor" data-errore={errore ? errore.riga : undefined}>
        <div className="codice-numeri" ref={numeri} aria-hidden="true">
          {Array.from({ length: righe }, (_, i) => (
            <div key={i} className={errore?.riga === i + 1 ? "riga-errore" : undefined} style={{ height: ALTEZZA_RIGA }}>
              {i + 1}
            </div>
          ))}
        </div>
        <textarea
          ref={testo}
          className="codice-testo"
          value={codice}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          readOnly={inSimulazione}
          aria-label={t("arduino.codice.titolo")}
          style={{ lineHeight: `${ALTEZZA_RIGA}px` }}
          onChange={(e) => onCambia(e.target.value, false)}
          onBlur={(e) => onCambia(e.target.value, true)}
          onKeyDown={suTasto}
          onScroll={(e) => {
            if (numeri.current) numeri.current.scrollTop = e.currentTarget.scrollTop;
          }}
        />
      </div>
      {errore && (
        <p className="codice-errore" role="alert">
          ⛔ {t("arduino.problema.codice", { riga: errore.riga, messaggio: errore.messaggio })}
        </p>
      )}
      {inSimulazione && (
        <div className="monitor-seriale">
          <div className="monitor-intestazione">
            <strong>{t("arduino.seriale.titolo")}</strong>
            <button type="button" className="pulsante piccolo" onClick={onPulisciSeriale}>
              {t("arduino.seriale.pulisci")}
            </button>
          </div>
          <pre ref={monitor} className="monitor-testo" data-testid="monitor-seriale">
            {seriale || t("arduino.seriale.vuoto")}
          </pre>
          <form
            className="monitor-invio"
            onSubmit={(e) => {
              e.preventDefault();
              onInviaSeriale(daInviare);
              setDaInviare("");
            }}
          >
            <input value={daInviare} onChange={(e) => setDaInviare(e.target.value)} placeholder={t("arduino.seriale.scrivi")} aria-label={t("arduino.seriale.scrivi")} />
            <button type="submit" className="pulsante piccolo">
              {t("arduino.seriale.invia")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
