// Finestra "Lista istruzioni" del modulo PLC: lo stesso programma del Ladder
// scritto come lista istruzioni (IEC 61131-3), in sola lettura, con il
// pulsante per copiarlo (per esempio in una relazione).
import { useEffect, useMemo, useState } from "react";
import { t } from "../testi";
import { listaIstruzioni } from "../motori/plc";
import { programmaConCommenti } from "../editor/ladder";
import type { Schema } from "../editor/schema";

export function FinestraListaIstruzioni({ schema, onChiudi }: { schema: Schema; onChiudi: () => void }) {
  const testo = useMemo(() => listaIstruzioni(programmaConCommenti(schema)), [schema]);
  const [copiato, setCopiato] = useState(false);
  useEffect(() => {
    const tasto = (e: KeyboardEvent) => {
      if (e.key === "Escape") onChiudi();
    };
    window.addEventListener("keydown", tasto);
    return () => window.removeEventListener("keydown", tasto);
  }, [onChiudi]);
  const copia = () => {
    void navigator.clipboard?.writeText(testo).then(
      () => setCopiato(true),
      () => setCopiato(false),
    );
  };
  return (
    <div className="sfondo-finestra" onClick={onChiudi}>
      <div className="finestra finestra-lista-istruzioni" role="dialog" aria-modal="true" aria-labelledby="titolo-lista" onClick={(e) => e.stopPropagation()}>
        <h2 id="titolo-lista">{t("lista.titolo")}</h2>
        <p className="tenue">{t("lista.introduzione")}</p>
        <pre className="lista-istruzioni" data-testid="lista-istruzioni">
          {testo}
        </pre>
        <details className="tenue">
          <summary>{t("lista.legenda")}</summary>
          <p>{t("lista.spiegazione")}</p>
        </details>
        <div className="pulsanti-finestra">
          <button type="button" className="pulsante" onClick={copia}>
            📋 {copiato ? t("lista.copiato") : t("lista.copia")}
          </button>
          <button type="button" className="pulsante" onClick={onChiudi}>
            {t("comune.chiudi")}
          </button>
        </div>
      </div>
    </div>
  );
}
