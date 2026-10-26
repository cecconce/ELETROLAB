// Pannello "Proprietà" a destra dell'area di disegno (attività 2.2).
// Mostra il componente selezionato e permette di:
// - cambiare la sigla (K1 → KA1…): i contatti di una bobina la seguono;
// - scegliere da quale bobina è comandato un contatto NA/NC (prende la sua sigla);
// - vedere la numerazione automatica dei morsetti (13-14, 21-22…) e, per una
//   bobina, l'elenco dei suoi contatti.
// Le regole stanno in associazioni.ts: qui c'è solo l'interfaccia.
import { useEffect, useState } from "react";
import { t } from "../testi";
import { associaContatto, cambiaSigla, contattoAssociato, numeroMorsetto, proprietariPer } from "./associazioni";
import { vocePerTipo, type Libreria } from "./libreria";
import type { Schema, Selezione } from "./schema";

export interface PropsPannelloProprieta {
  schema: Schema;
  selezione: Selezione;
  libreria: Libreria;
  onCambiaSchema: (schema: Schema) => void;
}

export function PannelloProprieta({ schema, selezione, libreria, onCambiaSchema }: PropsPannelloProprieta) {
  const componente = selezione.length === 1 ? schema.componenti.find((c) => c.id === selezione[0]) : undefined;
  const voce = componente ? vocePerTipo(libreria, componente.tipo) : undefined;
  // Testo della sigla mentre lo studente lo scrive (si applica con Invio o uscendo dal campo).
  const [bozza, setBozza] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  useEffect(() => {
    setBozza(componente?.etichetta ?? "");
    setErrore(null);
  }, [componente?.id, componente?.etichetta]);

  if (!componente) {
    return (
      <aside className="proprieta" aria-label={t("proprieta.titolo")}>
        <h2>{t("proprieta.titolo")}</h2>
        <p className="proprieta-nota">
          {selezione.length > 1 ? t("proprieta.piuComponenti", { numero: selezione.length }) : t("proprieta.nessuna")}
        </p>
      </aside>
    );
  }

  const applicaSigla = () => {
    const esito = cambiaSigla(schema, componente.id, bozza, libreria);
    if (esito.ok) {
      setErrore(null);
      if (esito.schema !== schema) onCambiaSchema(esito.schema);
    } else setErrore(esito.errore);
  };

  const contatto = voce?.contatto;
  // Solo i componenti che possono comandare questo tipo di contatto (il relè
  // termico per 95-96 / 97-98, le bobine per gli altri).
  const bobine = contatto ? proprietariPer(schema, contatto, libreria) : [];
  // Una bobina mostra i propri contatti con i numeri dei morsetti.
  const contattiDellaBobina = voce?.comandaContatti
    ? schema.componenti.filter((c) => vocePerTipo(libreria, c.tipo)?.contatto && c.etichetta === componente.etichetta)
    : [];

  return (
    <aside className="proprieta" aria-label={t("proprieta.titolo")}>
      <h2>{t("proprieta.titolo")}</h2>
      <dl className="proprieta-campi">
        <dt>{t("proprieta.tipo")}</dt>
        <dd>{voce?.nome ?? componente.tipo}</dd>
      </dl>

      {contatto ? (
        <>
          <label className="proprieta-campo">
            <span>{contatto.tipo === "termico" ? t("proprieta.comandatoDaTermico") : t("proprieta.comandatoDa")}</span>
            <select
              value={componente.etichetta}
              onChange={(e) => onCambiaSchema(associaContatto(schema, componente.id, e.target.value, libreria))}
            >
              <option value="">{t("proprieta.nessunaBobina")}</option>
              {bobine.map((b) => (
                <option key={b.id} value={b.etichetta}>
                  {b.etichetta}
                </option>
              ))}
              {/* Sigla senza bobina (es. bobina eliminata): resta visibile nell'elenco. */}
              {componente.etichetta !== "" && !bobine.some((b) => b.etichetta === componente.etichetta) && (
                <option value={componente.etichetta}>{componente.etichetta} ?</option>
              )}
            </select>
          </label>
          {bobine.length === 0 && (
            <p className="proprieta-nota">
              {contatto.tipo === "termico" ? t("proprieta.senzaReleTermico") : t("proprieta.senzaBobine")}
            </p>
          )}
          {!contattoAssociato(schema, componente, libreria) && <p className="proprieta-avviso">{t("proprieta.nonAssociato")}</p>}
          <dl className="proprieta-campi">
            <dt>{t("proprieta.morsetti")}</dt>
            <dd className="proprieta-numeri">{voce.morsetti.map((m) => numeroMorsetto(componente, m.id)).join(" – ")}</dd>
          </dl>
          <p className="proprieta-nota">{t("proprieta.numerazioneAutomatica")}</p>
        </>
      ) : (
        voce?.sigla !== "" && (
          <label className="proprieta-campo">
            <span>{t("proprieta.sigla")}</span>
            <input
              type="text"
              value={bozza}
              maxLength={8}
              spellCheck={false}
              title={t("proprieta.siglaSuggerimento")}
              aria-invalid={errore !== null}
              onChange={(e) => setBozza(e.target.value)}
              onBlur={applicaSigla}
              onKeyDown={(e) => {
                if (e.key === "Enter") applicaSigla();
                if (e.key === "Escape") setBozza(componente.etichetta);
              }}
            />
          </label>
        )
      )}
      {errore && (
        <p className="proprieta-avviso" role="alert">
          {errore}
        </p>
      )}

      {voce?.comandaContatti && (
        <div className="proprieta-contatti">
          <h3>{t("proprieta.contattiDellaBobina")}</h3>
          {contattiDellaBobina.length === 0 ? (
            <p className="proprieta-nota">{t("proprieta.nessunContatto")}</p>
          ) : (
            <ul>
              {contattiDellaBobina.map((c) => {
                const v = vocePerTipo(libreria, c.tipo)!;
                return (
                  <li key={c.id}>
                    <strong>{v.contatto?.stato === "NA" ? t("proprieta.contattoNa") : t("proprieta.contattoNc")}</strong>{" "}
                    {v.morsetti.map((m) => numeroMorsetto(c, m.id)).join("-")}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {voce?.descrizione && <p className="proprieta-descrizione">{voce.descrizione}</p>}
    </aside>
  );
}
