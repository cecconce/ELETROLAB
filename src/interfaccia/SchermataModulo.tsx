// Schermata di un modulo: intestazione con ritorno alla schermata iniziale e
// comandi dei file (Nuovo, Apri, Salva, Salva con nome), libreria dei
// componenti a sinistra, area di disegno comune e pannello Proprietà a destra.
// Un unico grande pulsante ▶ AVVIA / ■ FERMA (anche con F5), sempre nello
// stesso punto dell'intestazione, avvia la simulazione: lo schema si blocca,
// libreria e Proprietà si disattivano e lo studente interagisce cliccando i
// componenti. Simulano tutti e quattro i moduli. Nell'Elettronica, durante la
// simulazione, ogni oscilloscopio apre la sua finestra sopra il foglio. Nel PLC, durante la
// simulazione, il pannello "Ingressi e uscite" permette di commutare gli
// ingressi e mostra lo stato di uscite, merker, temporizzatori e contatori.
// Durante la simulazione, sotto il foglio, il pannello "Problemi nello schema"
// spiega in italiano gli errori trovati (circuito aperto, cortocircuito,
// contatti non associati, oscillazioni…) ed evidenzia sul foglio il punto.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { t } from "../testi";
import { AreaDisegno } from "../editor/AreaDisegno";
import { LibreriaLaterale } from "../editor/LibreriaLaterale";
import { haVistaRealistica, libreriaDelModulo } from "../editor/caricaLibreria";
import { PannelloProprieta } from "../editor/PannelloProprieta";
import { rinumeraContatti } from "../editor/associazioni";
import type { Schema, Selezione } from "../editor/schema";
import { annulla, modifica, nuovaCronologia, puoAnnullare, puoRipetere, ripeti, schemiUguali } from "../editor/cronologia";
import type { Archivio } from "../progetto/archivio";
import { nomeDaPercorso, serializzaProgetto } from "../progetto/formato";
import { RITARDO_AUTOSALVATAGGIO_MS, serializzaAutosalvataggio } from "../progetto/autosalvataggio";
import { avviaSessione, clicGiu, clicSu, passo, rilasciaTutti, type SessioneImpianto } from "../motori/impianti";
import { firmaVista, formattaTempo, vistaDaSessione, vistaDaSessionePlc, type VistaSimulazione } from "../editor/vistaSimulazione";
import {
  avviaSessionePlc,
  clicGiuPlc,
  clicSuPlc,
  commutaIngresso,
  passoPlc,
  rilasciaTuttiPlc,
  type SessionePlc,
} from "../motori/plc";
import { impiantiDaSchema, programmaDaSchema } from "../editor/ladder";
import {
  avviaSessioneArduino,
  clicGiuArduino,
  clicSuArduino,
  inviaSeriale,
  passoArduino,
  rilasciaTuttiArduino,
  tempoArduino,
  type SessioneArduino,
} from "../motori/arduino";
import { componentiDaSchema, nodiDaSchema, SKETCH_PREDEFINITO, vistaDaSessioneArduino } from "../editor/arduino";
import { PannelloCodice } from "../editor/PannelloCodice";
import {
  avviaSessioneElettronica,
  clicGiuElettronica,
  clicSuElettronica,
  passoElettronica,
  rilasciaTuttiElettronica,
  type SessioneElettronica,
} from "../motori/elettronica";
import { componentiDaSchemaElettronica, vistaDaSessioneElettronica } from "../editor/elettronica";
import { PannelloAnalizzatore, PannelloOscilloscopio } from "../editor/PannelloOscilloscopio";
import { vocePerTipo } from "../editor/libreria";
import { PannelloIngressiPlc } from "../editor/PannelloIngressiPlc";
import { problemiDaMostrare } from "../editor/messaggiProblemi";
import { PannelloProblemi } from "../editor/PannelloProblemi";
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
  /** Nome da mostrare finché il documento non ha un file (es. il titolo di un esempio aperto). */
  titolo?: string;
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
/** Sessione di simulazione di uno dei moduli simulabili. */
type Sessione = SessioneImpianto | SessionePlc | SessioneArduino | SessioneElettronica;
const eSessionePlc = (s: Sessione): s is SessionePlc => "conversione" in s;
const eSessioneArduino = (s: Sessione): s is SessioneArduino => "esecutore" in s;
const eSessioneElettronica = (s: Sessione): s is SessioneElettronica => "transitorio" in s;
/** Secondi trascorsi dall'avvio, per l'orologio. */
const tempoSessione = (s: Sessione | null) => (!s ? 0 : eSessioneArduino(s) ? tempoArduino(s) : eSessioneElettronica(s) ? s.tempo : s.stato.tempo);

function OrologioSimulazione({ sessione }: { sessione: React.MutableRefObject<Sessione | null> }) {
  const [tempo, setTempo] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTempo(tempoSessione(sessione.current)), 100);
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
  // Vista Simboli / Realistica (solo nei moduli che hanno i disegni realistici):
  // scelta dello studente ricordata su questo computer.
  const conVistaRealistica = useMemo(() => haVistaRealistica(libreria), [libreria]);
  const chiaveVista = `elettrolab.vista.${modulo.id}`;
  const [realistico, setRealistico] = useState(() => {
    try {
      return window.localStorage.getItem(chiaveVista) === "realistica";
    } catch {
      return false;
    }
  });
  const cambiaRealistico = useCallback(
    (r: boolean) => {
      setRealistico(r);
      try {
        window.localStorage.setItem(chiaveVista, r ? "realistica" : "simboli");
      } catch {
        // senza memoria del browser la scelta vale solo per questa volta
      }
    },
    [chiaveVista],
  );

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
  const simulabile = true;
  // Arduino: testo del monitor seriale e scheda mostrata a destra (Codice o Proprietà).
  const [seriale, setSeriale] = useState("");
  const [schedaDestra, setSchedaDestra] = useState<"codice" | "proprieta">("codice");
  const morsettiDi = useCallback((tipo: string) => vocePerTipo(libreria, tipo)?.morsetti, [libreria]);
  const sessioneRif = useRef<Sessione | null>(null);
  const firmaRif = useRef("");
  const [vista, setVista] = useState<VistaSimulazione | null>(null);
  const inSimulazione = vista !== null;
  // Pannello dei problemi: riga scelta e pannello aperto o ridotto.
  const [problemaScelto, setProblemaScelto] = useState<string | null>(null);
  const [problemiAperti, setProblemiAperti] = useState(true);
  const aggiornaSessione = useCallback(
    (s: Sessione) => {
      sessioneRif.current = s;
      if (eSessioneArduino(s)) setSeriale((prima) => (prima === s.seriale ? prima : s.seriale));
      const v = eSessioneElettronica(s)
        ? vistaDaSessioneElettronica(s, schema, libreria)
        : eSessioneArduino(s)
        ? vistaDaSessioneArduino(s, schema, libreria)
        : eSessionePlc(s)
          ? vistaDaSessionePlc(s, schema)
          : vistaDaSessione(s, schema.fili);
      const firma = firmaVista(v);
      if (firma !== firmaRif.current) {
        firmaRif.current = firma;
        setVista(v);
      }
    },
    [schema, libreria],
  );
  const avvia = useCallback(() => {
    if (!simulabile) return;
    setDaPosare(null);
    setProblemaScelto(null);
    setProblemiAperti(true);
    firmaRif.current = "";
    setSeriale("");
    aggiornaSessione(
      modulo.id === "elettronica"
        ? avviaSessioneElettronica(componentiDaSchemaElettronica(schema), nodiDaSchema(schema, morsettiDi))
        : modulo.id === "arduino"
        ? avviaSessioneArduino(schema.codice ?? SKETCH_PREDEFINITO, componentiDaSchema(schema), nodiDaSchema(schema, morsettiDi))
        : modulo.id === "plc"
        ? avviaSessionePlc(
            programmaDaSchema(schema),
            Object.fromEntries(schema.componenti.map((c) => [c.id, c.etichetta])),
            undefined,
            Object.fromEntries(schema.componenti.map((c) => [c.id, c.tipo])),
            impiantiDaSchema(schema),
          )
        : avviaSessione(schema),
    );
  }, [aggiornaSessione, schema, simulabile, modulo.id, morsettiDi]);
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
      const s = sessioneRif.current;
      if (!s) return;
      if (eSessioneElettronica(s)) {
        // Al massimo 30 ms di calcolo per scatto, così l'interfaccia resta reattiva.
        passoElettronica(s, dt, 30);
        aggiornaSessione(s);
      } else if (eSessioneArduino(s)) {
        passoArduino(s, dt * 1000);
        aggiornaSessione(s);
      } else aggiornaSessione(eSessionePlc(s) ? passoPlc(s, dt) : passo(s, dt));
    }, INTERVALLO_SIMULAZIONE_MS);
    return () => window.clearInterval(timer);
  }, [inSimulazione, aggiornaSessione]);

  // Un pulsante resta premuto solo finché si tiene premuto il mouse: se lo si
  // rilascia fuori dal componente (o la finestra perde il fuoco) torna a riposo.
  useEffect(() => {
    if (!inSimulazione) return;
    const rilascia = () => {
      const s = sessioneRif.current;
      if (!s) return;
      if (eSessioneElettronica(s)) {
        rilasciaTuttiElettronica(s);
        aggiornaSessione(s);
      } else if (eSessioneArduino(s)) {
        rilasciaTuttiArduino(s);
        aggiornaSessione(s);
      } else aggiornaSessione(eSessionePlc(s) ? rilasciaTuttiPlc(s) : rilasciaTutti(s));
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
            onGiu: (id: string, punto?: { x: number; y: number }) => {
              const s = sessioneRif.current;
              if (!s) return;
              const c = schema.componenti.find((x) => x.id === id);
              // Manopole e luce: clic a destra del componente aumenta, a sinistra diminuisce.
              const indietro = punto !== undefined && c !== undefined && punto.x < c.larghezza / 2;
              if (eSessioneElettronica(s)) {
                clicGiuElettronica(s, id, indietro);
                aggiornaSessione(s);
              } else if (eSessioneArduino(s)) {
                clicGiuArduino(s, id, indietro);
                aggiornaSessione(s);
              } else aggiornaSessione(eSessionePlc(s) ? clicGiuPlc(s, id, punto) : clicGiu(s, id));
            },
            onSu: (id: string) => {
              const s = sessioneRif.current;
              if (!s) return;
              if (eSessioneElettronica(s)) {
                clicSuElettronica(s, id);
                aggiornaSessione(s);
              } else if (eSessioneArduino(s)) {
                clicSuArduino(s, id);
                aggiornaSessione(s);
              } else aggiornaSessione(eSessionePlc(s) ? clicSuPlc(s, id) : clicSu(s, id));
            },
          }
        : null,
    [vista, aggiornaSessione, schema],
  );

  // Problemi da spiegare: riga scelta (evidenziata da sola) o, se nessuna, tutti i punti.
  const problemi = useMemo(
    () => (vista ? (vista.problemiPlc ?? problemiDaMostrare(vista.problemi, schema, libreria)) : []),
    [vista, schema, libreria],
  );
  const evidenzia = useMemo(() => {
    if (!vista) return null;
    const scelti = problemi.filter((p) => p.chiave === problemaScelto);
    const daMostrare = scelti.length > 0 ? scelti : problemiAperti ? problemi : [];
    return {
      componenti: [...new Set(daMostrare.flatMap((p) => p.componenti))],
      morsetti: [...new Set(daMostrare.flatMap((p) => p.morsetti))],
    };
  }, [vista, problemi, problemaScelto, problemiAperti]);

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

  const nomeFile = percorso ? nomeDaPercorso(percorso) : (documento.titolo ?? t("file.senzaNome"));
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
        <LibreriaLaterale libreria={libreria} tema={tema} daPosare={daPosare} onScegli={setDaPosare} realistico={conVistaRealistica && realistico} />
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
          evidenzia={evidenzia}
          realistico={conVistaRealistica && realistico}
          onCambiaRealistico={conVistaRealistica ? cambiaRealistico : undefined}
          sopraBarra={
            inSimulazione ? (
              <>
                <PannelloProblemi
                  problemi={problemi}
                  scelto={problemaScelto}
                  onScegli={setProblemaScelto}
                  aperto={problemiAperti}
                  onApri={setProblemiAperti}
                />
                {modulo.id === "elettronica" &&
                  schema.componenti
                    .filter((c) => c.tipo === "oscilloscopio" || c.tipo === "analizzatore-logico")
                    .map((c, i) =>
                      c.tipo === "oscilloscopio" ? (
                        <PannelloOscilloscopio
                          key={c.id}
                          indice={i}
                          id={c.id}
                          sigla={c.etichetta}
                          sessione={sessioneRif as React.MutableRefObject<SessioneElettronica | null>}
                        />
                      ) : (
                        <PannelloAnalizzatore
                          key={c.id}
                          indice={i}
                          id={c.id}
                          sigla={c.etichetta}
                          sessione={sessioneRif as React.MutableRefObject<SessioneElettronica | null>}
                        />
                      ),
                    )}
                {modulo.id === "plc" && sessioneRif.current && eSessionePlc(sessioneRif.current) && (
                  <PannelloIngressiPlc
                    sessione={sessioneRif.current}
                    schema={schema}
                    onCommuta={(op) => {
                      const s = sessioneRif.current;
                      if (s && eSessionePlc(s)) aggiornaSessione(commutaIngresso(s, op));
                    }}
                  />
                )}
              </>
            ) : null
          }
        />
        {modulo.id === "arduino" ? (
          <div className="colonna-arduino">
            <div className="schede-arduino" role="tablist">
              <button type="button" role="tab" aria-selected={schedaDestra === "codice"} className={schedaDestra === "codice" ? "scheda attiva" : "scheda"} onClick={() => setSchedaDestra("codice")}>
                {t("arduino.codice.titolo")}
              </button>
              <button type="button" role="tab" aria-selected={schedaDestra === "proprieta"} className={schedaDestra === "proprieta" ? "scheda attiva" : "scheda"} onClick={() => setSchedaDestra("proprieta")}>
                {t("proprieta.titolo")}
              </button>
            </div>
            {schedaDestra === "codice" ? (
              <PannelloCodice
                codice={schema.codice ?? SKETCH_PREDEFINITO}
                // Mentre si scrive la modifica è provvisoria; uscendo dal campo diventa un passo di Annulla.
                onCambia={(codice, definitivo) => cambiaSchema({ ...schema, codice }, !definitivo)}
                inSimulazione={inSimulazione}
                errore={(() => {
                  const s = sessioneRif.current;
                  return s && eSessioneArduino(s) && s.errore ? { riga: s.errore.riga, messaggio: s.errore.message } : null;
                })()}
                seriale={seriale}
                onInviaSeriale={(testo) => {
                  const s = sessioneRif.current;
                  if (s && eSessioneArduino(s)) inviaSeriale(s, testo);
                }}
                modo={schema.modoCodice ?? (schema.codice !== undefined ? "testo" : "blocchi")}
                blocchi={schema.blocchi}
                onCambiaBlocchi={(blocchi, codice, definitivo) => cambiaSchema({ ...schema, blocchi, codice, modoCodice: "blocchi" }, !definitivo)}
                onCambiaModo={(modoCodice) => cambiaSchema({ ...schema, modoCodice, codice: schema.codice ?? SKETCH_PREDEFINITO })}
                onPulisciSeriale={() => {
                  const s = sessioneRif.current;
                  if (s && eSessioneArduino(s)) s.seriale = "";
                  setSeriale("");
                }}
              />
            ) : (
              <PannelloProprieta schema={schema} selezione={selezione} libreria={libreria} onCambiaSchema={cambiaSchema} />
            )}
          </div>
        ) : (
          <PannelloProprieta schema={schema} selezione={selezione} libreria={libreria} onCambiaSchema={cambiaSchema} />
        )}
      </div>
    </div>
  );
}
