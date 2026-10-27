// Finestra "Esempi": elenco degli schemi pronti divisi per modulo, con una
// breve descrizione e le istruzioni per provarli. Componente "puro" (dati
// dalle props), provato nei test senza browser.
import { useEffect, useRef } from "react";
import { t } from "../testi";
import { MODULI } from "./moduli";
import { esempiDelModulo, type Esempio } from "../progetto/esempi";

export interface PropsFinestraEsempi {
  esempi: readonly Esempio[];
  onApri: (esempio: Esempio) => void;
  onChiudi: () => void;
}

export function FinestraEsempi(props: PropsFinestraEsempi) {
  const { esempi, onApri, onChiudi } = props;
  const pulsanteChiudi = useRef<HTMLButtonElement>(null);

  // Esc chiude, come la finestra Informazioni.
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
        className="finestra finestra-esempi"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titolo-esempi"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="titolo-esempi">{t("esempi.titolo")}</h2>
        <p className="tenue">{t("esempi.introduzione")}</p>
        {MODULI.map((m) => {
          const delModulo = esempiDelModulo(esempi, m.id);
          return (
            <section key={m.id} className="gruppo-esempi" data-modulo={m.id} style={{ ["--accento" as string]: m.coloreAccento }}>
              <h3>{t(m.chiaveTitolo)}</h3>
              {delModulo.length === 0 ? (
                <p className="tenue">{t("esempi.inArrivo")}</p>
              ) : (
                <ul className="elenco-esempi">
                  {delModulo.map((e) => (
                    <li key={e.file} className="voce-esempio">
                      <div>
                        <strong>{e.titolo}</strong>
                        {e.descrizione && <p>{e.descrizione}</p>}
                        {e.prova && (
                          <p className="tenue">
                            <b>{t("esempi.comeProvarlo")}</b> {e.prova}
                          </p>
                        )}
                      </div>
                      <button type="button" className="pulsante" data-esempio={e.file} onClick={() => onApri(e)}>
                        {t("esempi.apri")}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
        <div className="finestra-pulsanti">
          <button type="button" className="pulsante" ref={pulsanteChiudi} onClick={onChiudi}>
            {t("comune.chiudi")}
          </button>
        </div>
      </div>
    </div>
  );
}
