// Modalità Esercizio.
// - Riquadro della consegna (per lo studente), sopra il foglio, con il
//   pulsante «Verifica il funzionamento» quando il docente ha registrato la soluzione.
// - Finestra «Prepara esercizio» (per il docente): consegna, soluzione presa
//   dallo schema attuale, aiuti per togliere i fili, rimozione dell'esercizio.
import { useEffect, useRef, useState } from "react";
import { t } from "../testi";
import type { Esercizio, Schema } from "../editor/schema";

export interface EsitoMostrato {
  riuscito: boolean;
  righe: string[];
}

export function RiquadroConsegna({
  esercizio,
  onVerifica,
  esito,
  onChiudiEsito,
  verificabile,
}: {
  esercizio: Esercizio;
  onVerifica: () => void;
  esito: EsitoMostrato | null;
  onChiudiEsito: () => void;
  verificabile: boolean;
}) {
  const [ridotto, setRidotto] = useState(false);
  return (
    <section className="riquadro-consegna" aria-label={t("esercizio.consegna")} data-testid="consegna">
      <header>
        <strong>📝 {t("esercizio.consegna")}</strong>
        {esercizio.soluzione && verificabile && (
          <button type="button" className="pulsante piccolo primario" onClick={onVerifica}>
            ✔ {t("esercizio.verifica")}
          </button>
        )}
        <button type="button" className="pulsante piccolo" onClick={() => setRidotto((r) => !r)}>
          {ridotto ? t("esercizio.mostra") : t("esercizio.riduci")}
        </button>
      </header>
      {!ridotto && <p className="testo-consegna">{esercizio.consegna}</p>}
      {esito && (
        <div className={esito.riuscito ? "esito-verifica riuscito" : "esito-verifica non-riuscito"} role="status" data-testid="esito-verifica">
          <strong>{esito.riuscito ? `🎉 ${t("esercizio.riuscito")}` : `✖ ${t("esercizio.nonRiuscito")}`}</strong>
          <ul>
            {esito.righe.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          <button type="button" className="pulsante piccolo" onClick={onChiudiEsito}>
            {t("comune.chiudi")}
          </button>
        </div>
      )}
    </section>
  );
}

/** Toglie dallo schema tutti i fili (lo studente dovrà ridisegnarli). */
export function senzaFili(schema: Schema): Schema {
  return { ...schema, fili: [] };
}

export function FinestraPreparaEsercizio({ schema, onCambia, onChiudi, verificabile }: { schema: Schema; onCambia: (s: Schema) => void; onChiudi: () => void; verificabile: boolean }) {
  const [consegna, setConsegna] = useState(schema.esercizio?.consegna ?? "");
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    area.current?.focus();
    const tasto = (e: KeyboardEvent) => {
      if (e.key === "Escape") onChiudi();
    };
    window.addEventListener("keydown", tasto);
    return () => window.removeEventListener("keydown", tasto);
  }, [onChiudi]);
  const soluzione = schema.esercizio?.soluzione;
  const conConsegna = (s: Schema): Schema => ({ ...s, esercizio: { ...s.esercizio, consegna } });
  return (
    <div className="sfondo-finestra" onClick={onChiudi}>
      <div className="finestra finestra-esercizio" role="dialog" aria-modal="true" aria-labelledby="titolo-esercizio" onClick={(e) => e.stopPropagation()}>
        <h2 id="titolo-esercizio">📝 {t("esercizio.prepara")}</h2>
        <ol className="tenue passi-esercizio">
          <li>{t("esercizio.passo1")}</li>
          <li>{t("esercizio.passo2")}</li>
          <li>{t("esercizio.passo3")}</li>
          <li>{t("esercizio.passo4")}</li>
        </ol>
        <label className="proprieta-campo">
          <span>{t("esercizio.testoConsegna")}</span>
          <textarea ref={area} rows={4} value={consegna} maxLength={1500} onChange={(e) => setConsegna(e.target.value)} placeholder={t("esercizio.esempioConsegna")} />
        </label>
        {!verificabile && <p className="proprieta-avviso">{t("esercizio.senzaVerifica")}</p>}
        <p className={soluzione ? "esito-soluzione registrata" : "esito-soluzione"} data-testid="stato-soluzione">
          {soluzione ? `✔ ${t("esercizio.soluzioneRegistrata", { componenti: soluzione.componenti.length, fili: soluzione.fili.length })}` : t("esercizio.soluzioneMancante")}
        </p>
        <div className="pulsanti-finestra">
          <button
            type="button"
            className="pulsante"
            disabled={schema.componenti.length === 0}
            onClick={() =>
              onCambia(
                conConsegna({
                  ...schema,
                  esercizio: { consegna, soluzione: { componenti: schema.componenti, fili: schema.fili, ...(schema.codice !== undefined ? { codice: schema.codice } : {}) } },
                }),
              )
            }
          >
            {t("esercizio.registraSoluzione")}
          </button>
          <button type="button" className="pulsante" disabled={schema.fili.length === 0} onClick={() => onCambia(conConsegna(senzaFili(schema)))}>
            {t("esercizio.togliFili")}
          </button>
        </div>
        <div className="pulsanti-finestra">
          <button
            type="button"
            className="pulsante primario"
            disabled={consegna.trim() === ""}
            onClick={() => {
              onCambia(conConsegna(schema));
              onChiudi();
            }}
          >
            {t("esercizio.salvaConsegna")}
          </button>
          {schema.esercizio && (
            <button
              type="button"
              className="pulsante"
              onClick={() => {
                const { esercizio: _tolto, ...resto } = schema;
                onCambia(resto);
                onChiudi();
              }}
            >
              {t("esercizio.rimuovi")}
            </button>
          )}
          <button type="button" className="pulsante" onClick={onChiudi}>
            {t("comune.chiudi")}
          </button>
        </div>
      </div>
    </div>
  );
}
