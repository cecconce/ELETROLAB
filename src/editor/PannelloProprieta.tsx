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
import { COMMENTO_MASSIMO, TIPO_COMMENTO, impostaCollegamento, impostaCommento } from "./ladder";
import { leggiOhm, scriviOhm } from "./arduino";
import { COLORI_FILI, colorePropostoFilo } from "./fili";
import { MODELLI_IMPIANTI_PLC, operandiImpianto } from "../motori/plc";
import { eContatore, eTemporizzatore, impostaPreset, impostaTempo, presetDaMostrare, tempoDaMostrare } from "./parametri";
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
  // Tempo dei temporizzatori, con lo stesso meccanismo della sigla.
  const [bozzaTempo, setBozzaTempo] = useState("");
  const [erroreTempo, setErroreTempo] = useState<string | null>(null);
  useEffect(() => {
    setBozzaTempo(tempoDaMostrare(componente?.tempo));
    setErroreTempo(null);
  }, [componente?.id, componente?.tempo]);
  // Preset dei contatori del PLC, con lo stesso meccanismo.
  const [bozzaPreset, setBozzaPreset] = useState("");
  const [errorePreset, setErrorePreset] = useState<string | null>(null);
  useEffect(() => {
    setBozzaPreset(presetDaMostrare(componente?.preset));
    setErrorePreset(null);
  }, [componente?.id, componente?.preset]);

  // Banco Arduino: un cavetto selezionato → scelta del colore.
  const filo = selezione.length === 1 && libreria.modulo === "arduino" ? schema.fili.find((f) => f.id === selezione[0]) : undefined;
  if (!componente && filo) {
    return (
      <aside className="proprieta" aria-label={t("proprieta.titolo")}>
        <h2>{t("proprieta.titolo")}</h2>
        <p className="proprieta-tipo">{t("proprieta.cavetto")}</p>
        <div className="proprieta-campo">
          <span>{t("proprieta.coloreCavetto")}</span>
          <div className="tavolozza-fili">
            {COLORI_FILI.map((c) => (
              <button
                key={c.valore}
                type="button"
                className={(filo.colore ?? colorePropostoFilo(filo.da, filo.a)) === c.valore ? "colore-filo scelto" : "colore-filo"}
                style={{ background: c.valore }}
                title={c.nome}
                aria-label={c.nome}
                data-colore={c.nome}
                onClick={() => onCambiaSchema({ ...schema, fili: schema.fili.map((f) => (f.id === filo.id ? { ...f, colore: c.valore } : f)) })}
              />
            ))}
          </div>
        </div>
        <p className="proprieta-nota">{t("proprieta.cavettoSuggerimento")}</p>
      </aside>
    );
  }

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

  const applicaPreset = () => {
    const esito = impostaPreset(schema, componente.id, bozzaPreset);
    if (esito.ok) {
      setErrorePreset(null);
      if (esito.schema !== schema) onCambiaSchema(esito.schema);
    } else setErrorePreset(esito.errore);
  };
  const applicaTempo = () => {
    const esito = impostaTempo(schema, componente.id, bozzaTempo);
    if (esito.ok) {
      setErroreTempo(null);
      setBozzaTempo(tempoDaMostrare(esito.schema.componenti.find((c) => c.id === componente.id)?.tempo));
      if (esito.schema !== schema) onCambiaSchema(esito.schema);
    } else setErroreTempo(esito.errore);
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
            <span>{libreria.modulo === "plc" ? t("proprieta.operando") : t("proprieta.sigla")}</span>
            <input
              type="text"
              value={bozza}
              maxLength={8}
              spellCheck={false}
              title={libreria.modulo === "plc" ? t("proprieta.operandoSuggerimento") : t("proprieta.siglaSuggerimento")}
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

      {eTemporizzatore(componente.tipo) && (
        <>
          <label className="proprieta-campo">
            <span>{t("proprieta.tempo")}</span>
            <input
              type="text"
              inputMode="decimal"
              value={bozzaTempo}
              maxLength={8}
              spellCheck={false}
              title={t("proprieta.tempoSuggerimento")}
              aria-invalid={erroreTempo !== null}
              onChange={(e) => setBozzaTempo(e.target.value)}
              onBlur={applicaTempo}
              onKeyDown={(e) => {
                if (e.key === "Enter") applicaTempo();
                if (e.key === "Escape") setBozzaTempo(tempoDaMostrare(componente.tempo));
              }}
            />
          </label>
          {erroreTempo && (
            <p className="proprieta-avviso" role="alert">
              {erroreTempo}
            </p>
          )}
        </>
      )}

      {MODELLI_IMPIANTI_PLC[componente.tipo] && (
        <CollegamentiImpianto key={componente.id} schema={schema} id={componente.id} onCambiaSchema={onCambiaSchema} />
      )}

      {libreria.modulo === "arduino" && componente.tipo === "resistenza" && (
        <label className="proprieta-campo">
          <span>{t("proprieta.resistenza")}</span>
          <input
            type="text"
            key={`${componente.id}-${componente.valore ?? 220}`}
            defaultValue={scriviOhm(componente.valore ?? 220)}
            maxLength={12}
            spellCheck={false}
            title={t("proprieta.resistenzaSuggerimento")}
            onBlur={(e) => {
              const ohm = leggiOhm(e.currentTarget.value);
              if (ohm === null) {
                e.currentTarget.value = scriviOhm(componente.valore ?? 220);
                return;
              }
              if (ohm !== (componente.valore ?? 220)) {
                onCambiaSchema({ ...schema, componenti: schema.componenti.map((c) => (c.id === componente.id ? { ...c, valore: ohm } : c)) });
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
        </label>
      )}

      {componente.tipo === TIPO_COMMENTO && (
        <label className="proprieta-campo">
          <span>{t("proprieta.commento")}</span>
          <textarea
            key={componente.id}
            defaultValue={componente.etichetta}
            maxLength={COMMENTO_MASSIMO}
            rows={3}
            title={t("proprieta.commentoSuggerimento")}
            onBlur={(e) => {
              const nuovo = impostaCommento(schema, componente.id, e.target.value);
              if (nuovo !== schema) onCambiaSchema(nuovo);
            }}
          />
        </label>
      )}

      {eContatore(componente.tipo) && (
        <>
          <label className="proprieta-campo">
            <span>{t("proprieta.preset")}</span>
            <input
              type="text"
              inputMode="numeric"
              value={bozzaPreset}
              maxLength={6}
              spellCheck={false}
              title={t("proprieta.presetSuggerimento")}
              aria-invalid={errorePreset !== null}
              onChange={(e) => setBozzaPreset(e.target.value)}
              onBlur={applicaPreset}
              onKeyDown={(e) => {
                if (e.key === "Enter") applicaPreset();
                if (e.key === "Escape") setBozzaPreset(presetDaMostrare(componente.preset));
              }}
            />
          </label>
          {errorePreset && (
            <p className="proprieta-avviso" role="alert">
              {errorePreset}
            </p>
          )}
        </>
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

/**
 * Operandi dei segnali di un impianto animato: un campo per ogni sensore
 * (→ ingresso I) e per ogni attuatore (uscita Q →). Si applica con Invio o
 * uscendo dal campo; un operando sbagliato viene spiegato sotto.
 */
function CollegamentiImpianto({ schema, id, onCambiaSchema }: { schema: Schema; id: string; onCambiaSchema: (s: Schema) => void }) {
  const componente = schema.componenti.find((c) => c.id === id);
  const modello = componente ? MODELLI_IMPIANTI_PLC[componente.tipo] : undefined;
  const [errore, setErrore] = useState<string | null>(null);
  if (!componente || !modello) return null;
  const operandi = operandiImpianto(modello, componente.collegamenti);
  const applica = (segnale: string, campo: HTMLInputElement) => {
    const esito = impostaCollegamento(schema, id, segnale, campo.value);
    if (!esito.ok) {
      setErrore(t("proprieta.collegamentoNonValido", { operando: esito.operando }));
      campo.value = operandi[segnale];
      return;
    }
    setErrore(null);
    if (esito.schema !== schema) onCambiaSchema(esito.schema);
  };
  const riga = (segnale: { id: string; chiaveNome: string }, tipo: "sensore" | "attuatore") => (
    <label className="proprieta-campo" key={segnale.id}>
      <span>
        {t(segnale.chiaveNome)} ({t(`proprieta.${tipo}`)})
      </span>
      <input
        type="text"
        defaultValue={operandi[segnale.id]}
        key={`${segnale.id}-${operandi[segnale.id]}`}
        maxLength={8}
        spellCheck={false}
        data-segnale={segnale.id}
        onBlur={(e) => applica(segnale.id, e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key === "Enter") applica(segnale.id, e.currentTarget);
        }}
      />
    </label>
  );
  return (
    <div className="proprieta-collegamenti">
      <h3>{t("proprieta.collegamentiImpianto")}</h3>
      {modello.sensori.map((x) => riga(x, "sensore"))}
      {modello.attuatori.map((x) => riga(x, "attuatore"))}
      {errore && (
        <p className="proprieta-avviso" role="alert">
          {errore}
        </p>
      )}
    </div>
  );
}
