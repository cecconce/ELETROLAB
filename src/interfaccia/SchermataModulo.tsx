// Schermata di un modulo: intestazione con ritorno alla schermata iniziale e
// comandi dei file (Nuovo, Apri, Salva, Salva con nome), libreria dei
// componenti a sinistra, area di disegno comune e pannello Proprietà a destra.
// Un unico grande pulsante ▶ AVVIA / ■ FERMA (anche con F5), sempre nello
// stesso punto dell'intestazione, avvia la simulazione: lo schema si blocca,
// libreria e Proprietà si disattivano e lo studente interagisce cliccando i
// componenti. Per ora simula solo il modulo Impianti elettrici; negli altri
// il pulsante c'è (stessa posizione) ma è disattivato.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { t } from "../testi";
import { AreaDisegno } from "../editor/AreaDisegno";
import { LibreriaLaterale } from "../editor/LibreriaLaterale";
import { libreriaDelModulo } from "../editor/caricaLibreria";
import { PannelloProprieta } from "../editor/PannelloProprieta";
import { rinumeraContatti } from "../editor/associazioni";
import type { Schema, Selezione } from "../editor/schema";
import { annulla, modifica, nuovaCronologia, puoAnnullare, puoRipetere, ripeti, schemiUguali } from "../editor/cronologia";
import type { Archivio } from "../progetto/archivio";
import { nomeDaPercorso, serializzaProgetto } from "../progetto/formato";
import { RITARDO_AUTOSALVATAGGIO_MS, serializzaAutosalvataggio } from "../progetto/autosalvataggio";
import { avviaSessione, clicGiu, clicSu, passo, rilasciaTutti, type SessioneImpianto } from "../motori/impianti";
import { firmaVista, formattaTempo, vistaDaSessione, type VistaSimulazione } from "../editor/vistaSimulazione";
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

/** Intervallo con cui scorre il tempo della simulazione, in millisecondi. */
const INTERVALLO_SIMULAZIONE_MS = 50;
/** Oltre questo intervallo (es. computer sospeso) il tempo non viene recuperato tutto. */
const PASSO_MASSIMO_S = 60;

/** Orologio della simulazione: si aggiorna da solo senza ridisegnare lo schema. */
function OrologioSimulazione({ sessione }: { sessione: React.MutableRefObject<SessioneImpianto | null> }) {
  const [tempo, setTempo] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTempo(sessione.current?.stato.tempo ?? 0), 100);
    return () => window.clearInterval(timer);
  }, [sessione]);
  return (
    <span className="orologio-simulazione" title={t("simulazione.tempo")}>
      ⏱ {formattaTempo(tempo)}
    </span>
  );
}

export function SchermataModulo(props: PropsSchermataModulo) {
  const { modulo, tema, documento, archivio, versione, onErrore } = props;
  // Lo schema vive dentro la cronologia, che permette Annulla/Ripeti illimitati.
  const libreria = useMemo(() => libreriaDelModulo(modulo.id), [modulo.id]);
  const [cronologia, setCronologia] = useState(() => nuovaCronologia(documento.schema));
  // Ogni modifica (posa, incolla, eliminazione…) passa da qui: la numerazione
  // dei contatti dei contattori resta così sempre coerente con la norma.
  const cambiaSchema = useCallback(
    (schema: Schema, provvisoria?: boolean) =>
      setCronologia((c) => modifica(c, rinumeraContatti(schema, libreria), provvisoria)),
    [libreria],
  );
  const [selezione, setSelezione] = useState<Selezione>([]);
  const suAnnulla = useCallback(() => setCronologia(annulla), []);
  const suRipeti = useCallback(() => setCronologia(ripeti), []);
  const [daPosare, setDaPosare] = useState<string | null>(null);

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

  // --- Simulazione --------------------------------------------------------
  // La sessione cambia a ogni scatto dell'orologio: vive in un ref e lo
  // schema viene ridisegnato solo quando cambia qualcosa di visibile.
  const simulabile = modulo.id === "impianti";
  const sessioneRif = useRef<SessioneImpianto | null>(null);
  const firmaRif = useRef("");
  const [vista, setVista] = useState<VistaSimulazione | null>(null);
  const inSimulazione = vista !== null;
  const aggiornaSessione = useCallback(
    (s: SessioneImpianto) => {
      sessioneRif.current = s;
      const v = vistaDaSessione(s, schema.fili);
      const firma = firmaVista(v);
      if (firma !== firmaRif.current) {
        firmaRif.current = firma;
        setVista(v);
      }
    },
    [schema.fili],
  );
  const avvia = useCallback(() => {
    if (!simulabile) return;
    setDaPosare(null);
    firmaRif.current = "";
    aggiornaSessione(avviaSessione(schema));
  }, [aggiornaSessione, schema, simulabile]);
  const ferma = useCallback(() => {
    sessioneRif.current = null;
    setVista(null);
  }, []);
  const avviaOFerma = useCallback(() => (sessioneRif.current ? ferma() : avvia()), [avvia, ferma]);

  // Il tempo scorre finché la simulazione è avviata.
  useEffect(() => {
    if (!inSimulazione) return;
    let ultimo = performance.now();
    const timer = window.setInterval(() => {
      const adesso = performance.now();
      const dt = Math.min((adesso - ultimo) / 1000, PASSO_MASSIMO_S);
      ultimo = adesso;
      if (sessioneRif.current) aggiornaSessione(passo(sessioneRif.current, dt));
    }, INTERVALLO_SIMULAZIONE_MS);
    return () => window.clearInterval(timer);
  }, [inSimulazione, aggiornaSessione]);

  // Un pulsante resta premuto solo finché si tiene premuto il mouse: se lo si
  // rilascia fuori dal componente (o la finestra perde il fuoco) torna a riposo.
  useEffect(() => {
    if (!inSimulazione) return;
    const rilascia = () => {
      if (sessioneRif.current) aggiornaSessione(rilasciaTutti(sessioneRif.current));
    };
    window.addEventListener("mouseup", rilascia);
    window.addEventListener("blur", rilascia);
    return () => {
      window.removeEventListener("mouseup", rilascia);
      window.removeEventListener("blur", rilascia);
    };
  }, [inSimulazione, aggiornaSessione]);

  const simulazione = useMemo(
    () =>
      vista
        ? {
            vista,
            onGiu: (id: string) => sessioneRif.current && aggiornaSessione(clicGiu(sessioneRif.current, id)),
            onSu: (id: string) => sessioneRif.current && aggiornaSessione(clicSu(sessioneRif.current, id)),
          }
        : null,
    [vista, aggiornaSessione],
  );

  // F5 avvia e ferma la simulazione (e non ricarica la pagina della WebView).
  const avviaOFermaRif = useRef(avviaOFerma);
  avviaOFermaRif.current = avviaOFerma;
  useEffect(() => {
    const giu = (e: KeyboardEvent) => {
      if (e.key !== "F5") return;
      e.preventDefault();
      avviaOFermaRif.current();
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
        <button
          type="button"
          className="pulsante-simulazione"
          data-attiva={inSimulazione}
          onClick={avviaOFerma}
          disabled={!simulabile}
          title={simulabile ? t("simulazione.tasti") : t("simulazione.nonDisponibile")}
        >
          {inSimulazione ? `■ ${t("simulazione.ferma")}` : `▶ ${t("simulazione.avvia")}`}
        </button>
        {inSimulazione && <OrologioSimulazione sessione={sessioneRif} />}
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
      <div className={inSimulazione ? "corpo-modulo in-simulazione" : "corpo-modulo"}>
        <LibreriaLaterale libreria={libreria} tema={tema} daPosare={daPosare} onScegli={setDaPosare} />
        <AreaDisegno
          tema={tema}
          schema={schema}
          onCambiaSchema={cambiaSchema}
          onAnnulla={inSimulazione ? undefined : suAnnulla}
          onRipeti={inSimulazione ? undefined : suRipeti}
          puoAnnullare={puoAnnullare(cronologia)}
          puoRipetere={puoRipetere(cronologia)}
          libreria={libreria}
          daPosare={daPosare}
          onFinePosa={() => setDaPosare(null)}
          onSelezione={setSelezione}
          simulazione={simulazione}
        />
        <PannelloProprieta schema={schema} selezione={selezione} libreria={libreria} onCambiaSchema={cambiaSchema} />
      </div>
    </div>
  );
}
