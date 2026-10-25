// Schermata di un modulo: intestazione con ritorno alla schermata iniziale e
// comandi dei file (Nuovo, Apri, Salva, Salva con nome), libreria dei
// componenti a sinistra e area di disegno comune.
// Gli strumenti di simulazione si aggiungeranno nelle fasi successive.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { t } from "../testi";
import { AreaDisegno } from "../editor/AreaDisegno";
import { LibreriaLaterale } from "../editor/LibreriaLaterale";
import { libreriaDelModulo } from "../editor/caricaLibreria";
import type { Schema } from "../editor/schema";
import { annulla, modifica, nuovaCronologia, puoAnnullare, puoRipetere, ripeti, schemiUguali } from "../editor/cronologia";
import type { Archivio } from "../progetto/archivio";
import { nomeDaPercorso, serializzaProgetto } from "../progetto/formato";
import { RITARDO_AUTOSALVATAGGIO_MS, serializzaAutosalvataggio } from "../progetto/autosalvataggio";
import type { DefinizioneModulo } from "./moduli";
import type { Tema } from "./tema";

/** Schema aperto nel modulo e file da cui proviene. */
export interface Documento {
  /** Cambia a ogni apertura: la schermata riparte da capo (cronologia nuova). */
  id: number;
  schema: Schema;
  percorso: string | null;
  /** true se lo schema contiene modifiche non salvate nel file (es. ripreso dal salvataggio automatico). */
  modificato: boolean;
}

export interface PropsSchermataModulo {
  modulo: DefinizioneModulo;
  tema: Tema;
  documento: Documento;
  archivio: Archivio;
  versione: string;
  onIndietro: () => void;
  /** Foglio vuoto nello stesso modulo. */
  onNuovo: () => void;
  /** Apre un file .elab (anche di un altro modulo: l'app cambia schermata). */
  onApriPercorso: (percorso: string) => void;
  /** Il documento è stato salvato in `percorso` (per l'elenco dei recenti). */
  onSalvato: (percorso: string) => void;
  onErrore: (messaggio: string) => void;
}

export function SchermataModulo(props: PropsSchermataModulo) {
  const { modulo, tema, documento, archivio, versione, onErrore } = props;
  // Lo schema vive dentro la cronologia, che permette Annulla/Ripeti illimitati.
  const [cronologia, setCronologia] = useState(() => nuovaCronologia(documento.schema));
  const cambiaSchema = useCallback(
    (schema: Schema, provvisoria?: boolean) => setCronologia((c) => modifica(c, schema, provvisoria)),
    [],
  );
  const suAnnulla = useCallback(() => setCronologia(annulla), []);
  const suRipeti = useCallback(() => setCronologia(ripeti), []);
  const [daPosare, setDaPosare] = useState<string | null>(null);
  const libreria = useMemo(() => libreriaDelModulo(modulo.id), [modulo.id]);

  // --- File e modifiche non salvate -------------------------------------
  const [percorso, setPercorso] = useState(documento.percorso);
  // Ultimo schema scritto nel file; null = c'è qualcosa da salvare.
  const [salvato, setSalvato] = useState<Schema | null>(documento.modificato ? null : documento.schema);
  const schema = cronologia.presente;
  const modificato = useMemo(() => salvato === null || !schemiUguali(schema, salvato), [schema, salvato]);
  const [salvataggioInCorso, setSalvataggioInCorso] = useState(false);

  const salva = useCallback(
    async (conNome: boolean) => {
      if (salvataggioInCorso) return;
      const destinazione =
        conNome || !percorso ? await archivio.scegliFileDaSalvare(percorso ? nomeDaPercorso(percorso) : t("file.nomePredefinito")) : percorso;
      if (!destinazione) return; // lo studente ha annullato
      setSalvataggioInCorso(true);
      try {
        await archivio.scriviFile(destinazione, serializzaProgetto({ modulo: modulo.id, schema }, versione));
        setPercorso(destinazione);
        setSalvato(schema);
        props.onSalvato(destinazione);
      } catch (e) {
        onErrore(t("file.erroreSalva", { motivo: (e as Error).message }));
      } finally {
        setSalvataggioInCorso(false);
      }
    },
    [archivio, modulo.id, onErrore, percorso, props, salvataggioInCorso, schema, versione],
  );

  /** Prima di sostituire lo schema: se ci sono modifiche non salvate chiede conferma. */
  const puoiLasciare = useCallback(
    async () => !modificato || (await archivio.conferma(t("file.perdereModifiche"))),
    [archivio, modificato],
  );

  const nuovo = useCallback(async () => {
    if (await puoiLasciare()) props.onNuovo();
  }, [props, puoiLasciare]);

  const apri = useCallback(async () => {
    const scelto = await archivio.scegliFileDaAprire();
    if (scelto && (await puoiLasciare())) props.onApriPercorso(scelto);
  }, [archivio, props, puoiLasciare]);

  // --- Salvataggio automatico -------------------------------------------
  // Poco dopo ogni modifica lo schema viene scritto in autosalvataggi/<modulo>.elab;
  // uscendo dal modulo si scrive subito quello che era in attesa.
  const inAttesa = useRef<string | null>(null);
  const scriviAutomatico = useCallback(
    (testo: string) => {
      archivio.scriviAutosalvataggio(modulo.id, testo).catch(() => {
        // Un salvataggio automatico fallito non deve disturbare la lezione:
        // il prossimo tentativo avverrà alla modifica successiva.
      });
    },
    [archivio, modulo.id],
  );
  useEffect(() => {
    const testo = serializzaAutosalvataggio({ progetto: { modulo: modulo.id, schema }, percorso, modificato }, versione);
    inAttesa.current = testo;
    const timer = window.setTimeout(() => {
      inAttesa.current = null;
      scriviAutomatico(testo);
    }, RITARDO_AUTOSALVATAGGIO_MS);
    return () => window.clearTimeout(timer);
  }, [schema, percorso, modificato, modulo.id, versione, scriviAutomatico]);
  useEffect(
    () => () => {
      if (inAttesa.current) scriviAutomatico(inAttesa.current);
    },
    [scriviAutomatico],
  );

  // --- Scorciatoie dei file: Ctrl+N, Ctrl+O, Ctrl+S, Ctrl+Maiusc+S ------
  const comandi = useRef({ nuovo, apri, salva });
  comandi.current = { nuovo, apri, salva };
  useEffect(() => {
    const giu = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const tasto = e.key.toLowerCase();
      const c = comandi.current;
      const azione = { n: c.nuovo, o: c.apri, s: () => c.salva(e.shiftKey) }[tasto];
      if (azione) {
        e.preventDefault(); // niente comandi della WebView (es. Ctrl+N = nuova finestra)
        void azione();
      }
    };
    window.addEventListener("keydown", giu);
    return () => window.removeEventListener("keydown", giu);
  }, []);

  const nomeFile = percorso ? nomeDaPercorso(percorso) : t("file.senzaNome");
  return (
    <div className="schermata-modulo" data-modulo={modulo.id}>
      <header className="intestazione intestazione-modulo" style={{ borderColor: modulo.coloreAccento }}>
        <button type="button" className="pulsante" onClick={props.onIndietro}>
          ← {t("comune.home")}
        </button>
        <h1>{t(modulo.chiaveTitolo)}</h1>
        <span className="nome-file" title={percorso ?? undefined} data-modificato={modificato}>
          {nomeFile}
          {modificato && (
            <span className="segno-modificato" title={t("file.modificheNonSalvate")} aria-label={t("file.modificheNonSalvate")}>
              {" "}●
            </span>
          )}
        </span>
        <nav className="comandi-file" aria-label={t("file.comandi")}>
          <button type="button" className="pulsante" onClick={() => void nuovo()} title={t("file.nuovoTasti")}>
            {t("file.nuovo")}
          </button>
          <button type="button" className="pulsante" onClick={() => void apri()} title={t("file.apriTasti")}>
            {t("file.apri")}
          </button>
          <button type="button" className="pulsante" onClick={() => void salva(false)} title={t("file.salvaTasti")} disabled={salvataggioInCorso}>
            {t("file.salva")}
          </button>
          <button type="button" className="pulsante" onClick={() => void salva(true)} title={t("file.salvaConNomeTasti")} disabled={salvataggioInCorso}>
            {t("file.salvaConNome")}
          </button>
        </nav>
      </header>
      <div className="corpo-modulo">
        <LibreriaLaterale libreria={libreria} tema={tema} daPosare={daPosare} onScegli={setDaPosare} />
        <AreaDisegno
          tema={tema}
          schema={schema}
          onCambiaSchema={cambiaSchema}
          onAnnulla={suAnnulla}
          onRipeti={suRipeti}
          puoAnnullare={puoAnnullare(cronologia)}
          puoRipetere={puoRipetere(cronologia)}
          libreria={libreria}
          daPosare={daPosare}
          onFinePosa={() => setDaPosare(null)}
        />
      </div>
    </div>
  );
}
