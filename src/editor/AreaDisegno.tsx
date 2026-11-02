// Area di disegno comune a tutti i moduli, basata su Konva (react-konva).
// - griglia con aggancio dei componenti
// - zoom con la rotellina centrato sul cursore, pulsanti +/−, 100% e "Adatta"
// - spostamento della vista: trascinare con il tasto centrale o destro del mouse,
//   oppure tenere premuta la barra spaziatrice e trascinare con il sinistro
// - selezione: clic (Maiusc/Ctrl per aggiungere), rettangolo trascinando sul vuoto,
//   Esc per deselezionare
// - trascinamento dei componenti (il gruppo selezionato si muove insieme)
// - posa dei componenti della libreria: rilasciandoli sul foglio (drag & drop)
//   oppure, dopo averli scelti con un clic, cliccando sul foglio
// - collegamenti: clic su un morsetto e poi su un altro; il filo si instrada da
//   solo con tratti ortogonali, si sposta trascinandolo e torna automatico con
//   un doppio clic
// - modifica: Annulla/Ripeti illimitati (Ctrl+Z, Ctrl+Y o Ctrl+Maiusc+Z),
//   Canc per eliminare, Ctrl+C / Ctrl+X / Ctrl+V per copiare, tagliare e
//   incollare, Ctrl+A per selezionare tutto; gli stessi comandi sono anche
//   pulsanti nella barra in basso (comodi alla LIM)
// - accanto ai contatti dei contattori compaiono i numeri dei morsetti
//   (13-14, 21-22…) e la sigla della bobina; "K?" se il contatto non è legato
//   a nessuna bobina
// - simulazione (prop `simulazione`): lo schema è bloccato (niente
//   spostamenti, fili, eliminazioni), i fili si colorano secondo il polo che
//   li raggiunge, i contatti chiusi mostrano un tratto verde fra i morsetti,
//   bobine eccitate, lampade accese e motori che girano con il loro verso;
//   il clic sui pulsanti (tenuti premuti), selettori, finecorsa, sensori,
//   sezionatori, protezioni e motori viene passato a chi gestisce la simulazione
// - evidenziazione (prop `evidenzia`): riquadri rossi tratteggiati attorno ai
//   componenti e cerchi rossi sui morsetti dove c'è un problema (attività 2.6);
//   la prop `sopraBarra` mostra un pannello (es. "Problemi") fra il foglio e la barra
// La logica (calcoli e modifiche allo schema) sta in geometria.ts, schema.ts,
// fili.ts, appunti.ts, associazioni.ts, cronologia.ts e vistaSimulazione.ts.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Arc, Circle, Group, Image as ImmagineKonva, Layer, Line, Rect, Shape, Stage, Text } from "react-konva";
import Konva from "konva";
import { t } from "../testi";
import type { Tema } from "../interfaccia/tema";
import { coloriEditor } from "./colori";
import { testoIcona, trovaVoce } from "./caricaLibreria";
import { componenteDaVoce, svgComeDataUrl, tipiContatto, type Libreria, type VoceLibreria } from "./libreria";
import { numeroMorsetto } from "./associazioni";
import { MIME_COMPONENTE } from "./LibreriaLaterale";
import { DisegnoImpianto } from "./DisegnoImpianti";
import { DisegnoArduino } from "./DisegnoArduino";
import { DisegnoElettronica, EtichettaElettronica } from "./DisegnoElettronica";
import { coloreLampada, conColoreLampada } from "./coloriLampade";
import { MODELLI_IMPIANTI_PLC, operandiImpianto } from "../motori/plc";
import { copiaSelezione, incolla, type Appunti } from "./appunti";
import {
  coloreFilo,
  tipoUtilizzatore,
  trattiDelContatto,
  trattiDiScambio,
  type AspettoComponente,
  type VistaSimulazione,
} from "./vistaSimulazione";
import type { ColoriEditor } from "./colori";
import {
  collega,
  filiSulMorsetto,
  instrada,
  morsettiDelComponente,
  percorsoFilo,
  ripristinaPercorso,
  spostaTrattoDelFilo,
  trattoPiuVicino,
  anteprimaConPieghe,
  inserisciPiega,
  spostaPiega,
  colorePropostoFilo,
  type MorsettiDelTipo,
  type MorsettoPosato,
} from "./fili";
import {
  FATTORE_ZOOM,
  VISTA_INIZIALE,
  agganciaPunto,
  agganciaValore,
  lineeGriglia,
  schermoAFoglio,
  spostaVista,
  vistaPerAdattare,
  zoomRotellina,
  zoomVerso,
  type Punto,
  type Vista,
} from "./geometria";
import {
  aggiungiComponente,
  componentiNelRettangolo,
  eliminaSelezione,
  tuttiGliId,
  ingombroSchema,
  rettangoloTra,
  selezionaConClic,
  selezionePerTrascinamento,
  spostaSelezione,
  dimensioni,
  ruotaSelezione,
  trasformazioneRotazione,
  type ComponenteSchema,
  type Schema,
  type Selezione,
} from "./schema";

export interface PropsAreaDisegno {
  tema: Tema;
  schema: Schema;
  /**
   * Nuovo schema dopo una modifica. `provvisoria` è true durante un
   * trascinamento: la cronologia crea un solo passo al rilascio del mouse.
   */
  onCambiaSchema: (schema: Schema, provvisoria?: boolean) => void;
  /** Annulla/Ripeti: la cronologia è tenuta da chi usa l'editor. */
  onAnnulla?: () => void;
  onRipeti?: () => void;
  puoAnnullare?: boolean;
  puoRipetere?: boolean;
  /** Libreria del modulo: dà icona e dimensioni ai componenti. */
  libreria: Libreria;
  /** Voce della libreria scelta con un clic, da posare al prossimo clic sul foglio. */
  daPosare?: string | null;
  /** Chiamata quando la posa con clic è conclusa o annullata (Esc). */
  onFinePosa?: () => void;
  /** Avvisa chi usa l'editor quando cambia la selezione (pannello Proprietà). */
  onSelezione?: (selezione: Selezione) => void;
  /**
   * Simulazione avviata: aspetto da disegnare e clic dello studente sui
   * componenti (pressione e rilascio del mouse). null/assente = modifica.
   */
  simulazione?: {
    vista: VistaSimulazione;
    /** `punto`: dove si è cliccato, in coordinate del componente (serve agli impianti animati). */
    onGiu: (id: string, punto?: Punto) => void;
    onSu: (id: string) => void;
  } | null;
  /** Componenti e morsetti ("id:morsetto") da evidenziare in rosso (punti di un problema). */
  evidenzia?: { componenti: readonly string[]; morsetti: readonly string[] } | null;
  /** Contenuto mostrato fra il foglio e la barra in basso (es. il pannello dei problemi). */
  sopraBarra?: React.ReactNode;
  /** Vista realistica (disegni a colori) invece dei simboli CEI, se il modulo la prevede. */
  realistico?: boolean;
  /** Se presente, nella barra compare il pulsante per passare da Simboli a Realistico. */
  onCambiaRealistico?: (realistico: boolean) => void;
  /**
   * Riferimento in cui l'area mette la funzione che disegna tutto lo schema
   * (senza griglia) su un canvas, per l'esportazione e la stampa; null se il foglio è vuoto.
   */
  esportatore?: React.MutableRefObject<(() => HTMLCanvasElement | null) | null>;
  /** Riquadro sopra il foglio (es. la consegna dell'esercizio). */
  sopraFoglio?: React.ReactNode;
}

/**
 * Immagini delle icone della libreria, colorate per il tema. La mappa si
 * aggiorna quando le immagini finiscono di caricarsi (servono per Konva).
 */
function useImmaginiIcone(libreria: Libreria, colore: string, realistico: boolean): ReadonlyMap<string, HTMLImageElement> {
  const [pronte, setPronte] = useState<ReadonlyMap<string, HTMLImageElement>>(new Map());
  useEffect(() => {
    let attivo = true;
    const mappa = new Map<string, HTMLImageElement>();
    const nomi = [...new Set(libreria.componenti.map((v) => v.icona))];
    let mancanti = nomi.length;
    for (const nome of nomi) {
      const img = new window.Image();
      img.onload = () => {
        mancanti--;
        if (attivo && mancanti === 0) setPronte(mappa);
      };
      // Un'icona illeggibile (file modificato a mano e rovinato) non deve bloccare il
      // disegno di tutto il foglio: si toglie dalla mappa e il componente resta senza disegno.
      img.onerror = () => {
        mappa.delete(nome);
        mancanti--;
        if (attivo && mancanti === 0) setPronte(mappa);
      };
      img.src = svgComeDataUrl(testoIcona(nome, realistico), colore);
      mappa.set(nome, img);
    }
    return () => {
      attivo = false;
    };
  }, [libreria, colore, realistico]);
  return pronte;
}

/**
 * Appunti di Copia/Incolla, condivisi fra tutte le aree di disegno aperte
 * finché l'app resta aperta. Si incolla solo nello stesso modulo da cui si è
 * copiato: un contattore non ha senso sulla breadboard di Arduino.
 */
let appuntiEditor: { modulo: string; appunti: Appunti; volte: number } | null = null;

/** Il tasto è stato premuto mentre si scrive in un campo di testo (es. la ricerca della libreria)? */
const staScrivendo = (e: KeyboardEvent) =>
  e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement | null)?.isContentEditable === true;

/** Dimensioni in pixel del riquadro che contiene il canvas (seguono la finestra). */
function useDimensioni(rif: React.RefObject<HTMLDivElement>) {
  const [dim, setDim] = useState({ larghezza: 0, altezza: 0 });
  useEffect(() => {
    const el = rif.current;
    if (!el) return;
    const aggiorna = () => setDim({ larghezza: el.clientWidth, altezza: el.clientHeight });
    aggiorna();
    const osservatore = new ResizeObserver(aggiorna);
    osservatore.observe(el);
    return () => osservatore.disconnect();
  }, [rif]);
  return dim;
}

export function AreaDisegno({
  tema,
  schema,
  onCambiaSchema,
  libreria,
  daPosare = null,
  onFinePosa,
  onAnnulla,
  onRipeti,
  puoAnnullare = false,
  puoRipetere = false,
  onSelezione,
  simulazione = null,
  evidenzia = null,
  sopraBarra = null,
  realistico = false,
  onCambiaRealistico,
  esportatore,
  sopraFoglio = null,
}: PropsAreaDisegno) {
  const inSimulazione = simulazione !== null;
  // Letto dal gestore dei tasti, registrato una volta sola.
  const inSimulazioneRif = useRef(inSimulazione);
  inSimulazioneRif.current = inSimulazione;
  // Componente cliccabile sotto il mouse durante la simulazione (cursore a manina).
  const [cliccabileSotto, setCliccabileSotto] = useState<string | null>(null);
  const colori = coloriEditor(tema);
  const immagini = useImmaginiIcone(libreria, colori.testo, realistico);
  const vociPerTipo = useMemo(() => new Map(libreria.componenti.map((v) => [v.id, v])), [libreria]);
  const morsettiDi = useCallback<MorsettiDelTipo>((tipo) => vociPerTipo.get(tipo)?.morsetti, [vociPerTipo]);
  const voceDaPosare = daPosare ? trovaVoce(libreria, daPosare) : undefined;
  // Posizione del mouse sul foglio, per l'anteprima del componente da posare.
  const [anteprima, setAnteprima] = useState<Punto | null>(null);
  const contenitore = useRef<HTMLDivElement>(null);
  const { larghezza, altezza } = useDimensioni(contenitore);

  const [vista, setVista] = useState<Vista>(VISTA_INIZIALE);
  const [selezione, setSelezione] = useState<Selezione>([]);
  const contatti = useMemo(() => tipiContatto(libreria), [libreria]);
  useEffect(() => onSelezione?.(selezione), [selezione, onSelezione]);
  const [rettangolo, setRettangolo] = useState<{ inizio: Punto; fine: Punto } | null>(null);
  const [spazioPremuto, setSpazioPremuto] = useState(false);
  const [spostandoVista, setSpostandoVista] = useState(false);
  // Collegamento iniziato: morsetto di partenza, in attesa del clic sul morsetto di arrivo.
  const [filoInCorso, setFiloInCorsoStato] = useState<MorsettoPosato | null>(null);
  // Pieghe aggiunte con un clic sul foglio vuoto mentre si disegna il filo.
  const [pieghe, setPieghe] = useState<Punto[]>([]);
  // Per il gestore dei tasti (registrato una volta sola): c'è un filo in corso?
  const filoInCorsoRif = useRef(false);
  filoInCorsoRif.current = filoInCorso !== null;
  // Iniziare o abbandonare un filo azzera sempre le pieghe.
  const setFiloInCorso = (m: MorsettoPosato | null) => {
    setFiloInCorsoStato(m);
    setPieghe([]);
  };
  // Punto del foglio sotto il mouse (anteprima del filo in corso).
  const [mouseFoglio, setMouseFoglio] = useState<Punto | null>(null);
  // Morsetto sotto il mouse, evidenziato con il suo numero (chiave "componente/morsetto").
  const [morsettoSotto, setMorsettoSotto] = useState<string | null>(null);
  // Messaggio breve per lo studente (es. collegamento non valido).
  const [avviso, setAvviso] = useState<string | null>(null);
  // Filo di cui si sta trascinando un tratto: quale filo, quale tratto e il
  // percorso che aveva quando è stato afferrato.
  // Nei fili diretti (banco Arduino) si trascina invece una piega: `piega` è il suo indice.
  // `diretto`: la piega si crea solo quando il mouse si sposta davvero (un clic seleziona e basta).
  const filoTrascinato = useRef<{ id: string; tratto: number; percorso: Punto[]; piega?: number; diretto?: { da: Punto } } | null>(null);

  // Riferimento sempre aggiornato alla callback, usato dal gestore dei tasti.
  const onFinePosaRif = useRef(onFinePosa);
  onFinePosaRif.current = onFinePosa;

  // Dati del trascinamento in corso (non servono al disegno, quindi in un ref).
  const trascinamento = useRef<{ schemaIniziale: Schema; id: string; da: Punto; selezione: Selezione } | null>(null);
  const ultimoPuntatore = useRef<Punto | null>(null);

  // --- Comandi di modifica (tastiera e pulsanti) ---
  const elimina = () => {
    if (selezione.length === 0) return;
    onCambiaSchema(eliminaSelezione(schema, selezione));
    setSelezione([]);
  };
  // Rotazione di 90° in senso orario dei componenti selezionati (tasto R).
  const ruota = () => {
    const nuovo = ruotaSelezione(schema, selezione);
    if (nuovo !== schema) onCambiaSchema(nuovo);
  };
  const copia = () => {
    const appunti = copiaSelezione(schema, selezione);
    if (!appunti) {
      if (selezione.length > 0) setAvviso(t("modifica.niente"));
      return false;
    }
    appuntiEditor = { modulo: libreria.modulo, appunti, volte: 0 };
    setAvviso(t("modifica.copiato"));
    return true;
  };
  const taglia = () => {
    if (copia()) elimina();
  };
  const incollaAppunti = () => {
    if (!appuntiEditor || appuntiEditor.modulo !== libreria.modulo) {
      setAvviso(t("modifica.appuntiVuoti"));
      return;
    }
    const esito = incolla(schema, appuntiEditor.appunti, (tipo) => vociPerTipo.get(tipo)?.sigla, appuntiEditor.volte, contatti);
    appuntiEditor.volte++;
    onCambiaSchema(esito.schema);
    setSelezione(esito.incollati);
  };

  // Il gestore dei tasti è registrato una volta sola: legge i comandi aggiornati da qui.
  const comandiRif = useRef({ elimina, ruota, copia, taglia, incollaAppunti, onAnnulla, onRipeti, tutto: () => setSelezione(tuttiGliId(schema)) });
  comandiRif.current = { elimina, ruota, copia, taglia, incollaAppunti, onAnnulla, onRipeti, tutto: () => setSelezione(tuttiGliId(schema)) };

  // Barra spaziatrice = modalità "mano" per spostare la vista; Esc = deseleziona;
  // scorciatoie di modifica come nei programmi più comuni.
  useEffect(() => {
    const giu = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelezione([]);
        setFiloInCorso(null);
        onFinePosaRif.current?.();
      }
      // Mentre si scrive nella ricerca i tasti servono al testo, non all'editor.
      if (staScrivendo(e)) return;
      if (e.code === "Space") {
        setSpazioPremuto(true);
        e.preventDefault();
      }
      // In simulazione lo schema è bloccato: niente eliminazioni né modifiche.
      if (inSimulazioneRif.current) return;
      const cmd = comandiRif.current;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        // Mentre si disegna un filo il tasto toglie l'ultima piega.
        if (filoInCorsoRif.current) {
          setPieghe((pp) => pp.slice(0, -1));
          return;
        }
        cmd.elimina();
        return;
      }
      if ((e.key === "r" || e.key === "R") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        cmd.ruota();
        return;
      }
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const tasto = e.key.toLowerCase();
      const azioni: Record<string, (() => unknown) | undefined> = {
        z: e.shiftKey ? cmd.onRipeti : cmd.onAnnulla,
        y: cmd.onRipeti,
        c: cmd.copia,
        x: cmd.taglia,
        v: cmd.incollaAppunti,
        a: cmd.tutto,
      };
      const azione = azioni[tasto];
      if (tasto in azioni) {
        e.preventDefault(); // niente comandi della WebView (es. Ctrl+A seleziona la pagina)
        azione?.();
      }
    };
    const su = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpazioPremuto(false);
    };
    window.addEventListener("keydown", giu);
    window.addEventListener("keyup", su);
    return () => {
      window.removeEventListener("keydown", giu);
      window.removeEventListener("keyup", su);
    };
  }, []);

  // Se un componente sparisce dallo schema lo togliamo anche dalla selezione.
  useEffect(() => {
    setSelezione((sel) => {
      const filtrata = sel.filter((id) => schema.componenti.some((c) => c.id === id) || schema.fili.some((f) => f.id === id));
      return filtrata.length === sel.length ? sel : filtrata;
    });
  }, [schema]);

  // All'avvio della simulazione si abbandona quello che si stava facendo.
  useEffect(() => {
    if (!inSimulazione) return;
    setSelezione([]);
    setFiloInCorso(null);
    setRettangolo(null);
    setAvviso(null);
    filoTrascinato.current = null;
    trascinamento.current = null;
  }, [inSimulazione]);
  useEffect(() => {
    if (!inSimulazione) setCliccabileSotto(null);
  }, [inSimulazione]);

  // L'avviso sparisce da solo dopo qualche secondo.
  useEffect(() => {
    if (!avviso) return;
    const timer = window.setTimeout(() => setAvviso(null), 3500);
    return () => window.clearTimeout(timer);
  }, [avviso]);

  /** Clic su un morsetto: inizia il filo oppure lo conclude sul morsetto di arrivo. */
  const clicMorsetto = (m: MorsettoPosato) => {
    if (!filoInCorso) {
      setFiloInCorso(m);
      setAvviso(null);
      return;
    }
    const esito = collega(schema, filoInCorso, m, morsettiDi, pieghe);
    if (!esito.ok) {
      setAvviso(t(esito.errore));
      // Sullo stesso morsetto il clic annulla; negli altri casi si può riprovare.
      if (esito.errore === "fili.stessoMorsetto") setFiloInCorso(null);
      return;
    }
    // Nel banco Arduino il cavetto prende subito un colore (rosso +, nero GND, verde).
    const conColore =
      libreria.modulo === "arduino"
        ? { ...esito.schema, fili: esito.schema.fili.map((f) => (f.id === esito.filo.id ? { ...f, colore: colorePropostoFilo(f.da, f.a) } : f)) }
        : esito.schema;
    onCambiaSchema(conColore);
    setSelezione([esito.filo.id]);
    setFiloInCorso(null);
  };

  const puntatore = (e: Konva.KonvaEventObject<MouseEvent | WheelEvent>): Punto | null =>
    e.target.getStage()?.getPointerPosition() ?? null;

  /** Posa una voce della libreria centrata nel punto del foglio indicato e la seleziona. */
  const posa = (voce: VoceLibreria, centro: Punto) => {
    const nuovo = componenteDaVoce(schema, voce, centro, libreria);
    onCambiaSchema(aggiungiComponente(schema, nuovo));
    setSelezione([nuovo.id]);
  };

  // Rilascio di un componente trascinato dalla libreria laterale.
  const suTrascinaSopra = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(MIME_COMPONENTE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  };
  const suRilascioLibreria = (e: React.DragEvent) => {
    const voce = trovaVoce(libreria, e.dataTransfer.getData(MIME_COMPONENTE));
    const el = contenitore.current;
    if (!voce || !el) return;
    e.preventDefault();
    const r = el.getBoundingClientRect();
    posa(voce, schermoAFoglio(vista, { x: e.clientX - r.left, y: e.clientY - r.top }));
  };

  const suRotellina = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const p = puntatore(e);
    if (p) setVista((v) => zoomRotellina(v, e.evt.deltaY, p));
  };

  const suPressione = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const p = puntatore(e);
    if (!p) return;
    // Tasto centrale (1), destro (2) o spazio + sinistro: si sposta la vista.
    if (e.evt.button === 1 || e.evt.button === 2 || (e.evt.button === 0 && spazioPremuto)) {
      e.evt.preventDefault();
      setSpostandoVista(true);
      ultimoPuntatore.current = p;
      return;
    }
    // In simulazione il foglio serve solo a guardare (zoom e spostamento).
    if (inSimulazione) return;
    // Sinistro sul vuoto con un filo in corso: aggiunge una piega (il filo
    // gira in quel punto). Esc annulla il collegamento.
    if (e.evt.button === 0 && filoInCorso) {
      const f = schermoAFoglio(vista, p);
      setPieghe((pp) => [...pp, { x: agganciaValore(f.x), y: agganciaValore(f.y) }]);
      return;
    }
    // Sinistro con un componente scelto nella libreria: lo posa dove si clicca.
    if (e.evt.button === 0 && voceDaPosare) {
      e.cancelBubble = true;
      posa(voceDaPosare, schermoAFoglio(vista, p));
      onFinePosa?.();
      return;
    }
    // Sinistro sul vuoto: inizia il rettangolo di selezione.
    if (e.evt.button === 0 && e.target === e.target.getStage()) {
      const f = schermoAFoglio(vista, p);
      setRettangolo({ inizio: f, fine: f });
    }
  };

  const suMovimento = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const p = puntatore(e);
    if (!p) return;
    if (voceDaPosare) setAnteprima(schermoAFoglio(vista, p));
    if (filoInCorso) setMouseFoglio(schermoAFoglio(vista, p));
    if (filoTrascinato.current) {
      const { id, tratto, percorso, piega, diretto } = filoTrascinato.current;
      const qui = schermoAFoglio(vista, p);
      if (diretto && piega === undefined) {
        if (Math.hypot(qui.x - diretto.da.x, qui.y - diretto.da.y) < 6 / vista.scala) return;
        const conPiega = inserisciPiega(schema, id, tratto, qui);
        filoTrascinato.current = { ...filoTrascinato.current, piega: conPiega.indice };
        onCambiaSchema(conPiega.schema, true);
        return;
      }
      if (piega !== undefined) onCambiaSchema(spostaPiega(schema, id, piega, qui), true);
      else onCambiaSchema(spostaTrattoDelFilo(schema, id, percorso, tratto, schermoAFoglio(vista, p)), true);
      return;
    }
    if (spostandoVista && ultimoPuntatore.current) {
      const prec = ultimoPuntatore.current;
      setVista((v) => spostaVista(v, p.x - prec.x, p.y - prec.y));
      ultimoPuntatore.current = p;
      return;
    }
    if (rettangolo) setRettangolo({ ...rettangolo, fine: schermoAFoglio(vista, p) });
  };

  const suRilascio = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (filoTrascinato.current) {
      // Fine dello spostamento del filo: un solo passo nella cronologia.
      filoTrascinato.current = null;
      onCambiaSchema(schema);
    }
    if (spostandoVista) {
      setSpostandoVista(false);
      ultimoPuntatore.current = null;
      return;
    }
    if (rettangolo) {
      const r = rettangoloTra(rettangolo.inizio, rettangolo.fine);
      const aggiuntivo = e.evt.shiftKey || e.evt.ctrlKey;
      // Un clic senza trascinare sul vuoto deseleziona tutto.
      if (r.larghezza < 3 / vista.scala && r.altezza < 3 / vista.scala) {
        if (!aggiuntivo) setSelezione([]);
      } else {
        const presi = componentiNelRettangolo(schema, r);
        setSelezione((sel) => (aggiuntivo ? [...new Set([...sel, ...presi])] : presi));
      }
      setRettangolo(null);
    }
  };

  // --- Trascinamento dei componenti ---
  const inizioTrascinamento = (id: string, nodo: Konva.Node) => {
    const sel = selezionePerTrascinamento(selezione, id);
    setSelezione(sel);
    trascinamento.current = { schemaIniziale: schema, id, da: nodo.position(), selezione: sel };
  };

  /** @param definitivo true al rilascio: la cronologia registra lo spostamento come un passo solo */
  const durante = (nodo: Konva.Node, definitivo = false) => {
    const tr = trascinamento.current;
    if (!tr) return;
    // Il componente "salta" da un incrocio di griglia all'altro.
    const agganciato = agganciaPunto(nodo.position());
    nodo.position(agganciato);
    onCambiaSchema(
      spostaSelezione(tr.schemaIniziale, tr.selezione, agganciato.x - tr.da.x, agganciato.y - tr.da.y),
      !definitivo,
    );
  };

  const fineTrascinamento = (nodo: Konva.Node) => {
    durante(nodo, true);
    trascinamento.current = null;
  };

  // --- Comandi della barra dello zoom ---
  const centroRiquadro = { x: larghezza / 2, y: altezza / 2 };
  const ingrandisci = () => setVista((v) => zoomVerso(v, v.scala * FATTORE_ZOOM, centroRiquadro));
  const rimpicciolisci = () => setVista((v) => zoomVerso(v, v.scala / FATTORE_ZOOM, centroRiquadro));
  const zoom100 = () => setVista((v) => zoomVerso(v, 1, centroRiquadro));
  const adatta = useCallback(() => {
    const r = ingombroSchema(schema);
    setVista(r ? vistaPerAdattare(r, larghezza, altezza) : VISTA_INIZIALE);
  }, [schema, larghezza, altezza]);

  // Alla prima misura del riquadro lo schema viene centrato.
  const centrato = useRef(false);
  useEffect(() => {
    if (!centrato.current && larghezza > 0 && altezza > 0) {
      centrato.current = true;
      adatta();
    }
  }, [adatta, larghezza, altezza]);

  const immagine = (tipo: string) => {
    const voce = vociPerTipo.get(tipo);
    return voce ? immagini.get(voce.icona) : undefined;
  };
  /** Sigla da disegnare: un contatto senza bobina mostra "K?" (lettera della libreria + "?"). */
  const siglaMostrata = (c: { tipo: string; etichetta: string }) => {
    const voce = vociPerTipo.get(c.tipo);
    return voce?.contatto && c.etichetta === "" ? `${voce.sigla}?` : c.etichetta;
  };
  /** Numeri dei morsetti dei contatti, scritti a destra di ciascun morsetto. */
  const numeriDa = (c: ComponenteSchema) => {
    const voce = vociPerTipo.get(c.tipo);
    if (!voce?.contatto) return undefined;
    return voce.morsetti.map((m) => ({ x: m.x, y: m.y, testo: numeroMorsetto(c, m.id), inAlto: m.y < c.altezza / 2 }));
  };
  const componentePerId = new Map(schema.componenti.map((c) => [c.id, c]));

  const griglia = lineeGriglia(vista, larghezza, altezza);
  const selezionati = new Set(selezione);
  const rett = rettangolo ? rettangoloTra(rettangolo.inizio, rettangolo.fine) : null;
  const cursore = spostandoVista
    ? "grabbing"
    : spazioPremuto
      ? "grab"
      : inSimulazione
        ? cliccabileSotto
          ? "pointer"
          : "default"
        : voceDaPosare
        ? "copy"
        : filoInCorso || morsettoSotto
          ? "crosshair"
          : "default";
  // Tutti i morsetti visibili, disegnati sopra i componenti.
  const morsetti = schema.componenti.flatMap((c) => morsettiDelComponente(c, morsettiDi));
  // Anteprima del filo in corso: dal morsetto di partenza al mouse (o al morsetto sotto il mouse).
  const arrivoAnteprima = morsettoSotto ? morsetti.find((m) => `${m.componente}/${m.morsetto}` === morsettoSotto) : undefined;
  const anteprimaFilo =
    filoInCorso && (arrivoAnteprima || mouseFoglio) && libreria.modulo === "arduino"
      ? [filoInCorso.posizione, ...pieghe, arrivoAnteprima ? arrivoAnteprima.posizione : (mouseFoglio as Punto)]
      : filoInCorso && (arrivoAnteprima || mouseFoglio)
      ? arrivoAnteprima
        ? pieghe.length > 0
          ? anteprimaConPieghe(filoInCorso.posizione, pieghe, arrivoAnteprima.posizione)
          : instrada(filoInCorso, arrivoAnteprima)
        : anteprimaConPieghe(filoInCorso.posizione, pieghe, {
            x: agganciaValore((mouseFoglio as Punto).x),
            y: agganciaValore((mouseFoglio as Punto).y),
          })
      : null;
  const raggioMorsetto = 3.5;

  // Ordine di disegno: nel modulo Arduino prima le breadboard e i loro fori,
  // poi gli altri componenti (che vi si infilano sopra), i fili e i piedini.
  const banco = libreria.modulo === "arduino";
  const eFondo = (tipo: string) => banco && tipo === "breadboard";
  const componentiFondo = schema.componenti.filter((c) => eFondo(c.tipo));
  const componentiSopra = schema.componenti.filter((c) => !eFondo(c.tipo));
  const tipoDi = new Map(schema.componenti.map((c) => [c.id, c.tipo]));
  const morsettiFondo = morsetti.filter((m) => eFondo(tipoDi.get(m.componente) ?? ""));
  const morsettiSopra = morsetti.filter((m) => !eFondo(tipoDi.get(m.componente) ?? ""));

  // Esportazione: lo strato dei componenti e dei fili (non la griglia) disegnato
  // su un canvas a risoluzione doppia, qualunque sia lo zoom attuale.
  const stageRif = useRef<Konva.Stage>(null);
  if (esportatore) {
    esportatore.current = () => {
      const stage = stageRif.current;
      const r = ingombroSchema(schema);
      const strato = stage?.getLayers()[1];
      if (!stage || !r || !strato) return null;
      const margine = 60;
      const s = vista.scala;
      return strato.toCanvas({
        x: vista.x + (r.x - margine) * s,
        y: vista.y + (r.y - margine) * s,
        width: (r.larghezza + 2 * margine) * s,
        height: (r.altezza + 2 * margine) * s,
        pixelRatio: 2 / s,
      });
    };
  }

  const disegnaComponente = (c: ComponenteSchema) => {
                const scelto = selezionati.has(c.id);
                const aspetto = simulazione?.vista.componenti[c.id];
                // Componente ruotato: il disegno (fatto per 0°) gira dentro un gruppo
                // interno; la sigla resta dritta e si scrive fuori dal gruppo.
                const rot = trasformazioneRotazione(c);
                const ruotato = rot.rotazione !== 0;
                const ingombro = dimensioni(c);
                // Nel banco Arduino niente sigle; nell'Elettronica sigla e valore si scrivono a parte.
                const elettronica = libreria.modulo === "elettronica";
                const sigla = libreria.modulo === "arduino" || elettronica ? "" : siglaMostrata(c);
                return (
                  <Group
                    key={c.id}
                    x={c.x}
                    y={c.y}
                    draggable={!spazioPremuto && !voceDaPosare && !inSimulazione}
                    onMouseEnter={() => aspetto?.clic && setCliccabileSotto(c.id)}
                    onMouseLeave={() => setCliccabileSotto((x) => (x === c.id ? null : x))}
                    onMouseUp={() => simulazione?.onSu(c.id)}
                    onMouseDown={(e) => {
                      if (simulazione) {
                        // In simulazione il clic aziona il componente (se si può).
                        if (e.evt.button !== 0 || spazioPremuto || !aspetto?.clic) return;
                        e.cancelBubble = true;
                        // Punto del clic nel disegno non ruotato (serve a impianti e banco).
                        const gruppo = ((e.currentTarget as Konva.Group).findOne(".disegno") ?? e.currentTarget) as Konva.Group;
                        const locale = gruppo.getRelativePointerPosition();
                        simulazione.onGiu(c.id, locale ? { x: locale.x, y: locale.y } : undefined);
                        return;
                      }
                      // Con un componente da posare il clic passa al foglio (posa anche sopra un altro).
                      if (e.evt.button !== 0 || spazioPremuto || voceDaPosare) return;
                      e.cancelBubble = true; // non far partire il rettangolo di selezione
                      const aggiuntivo = e.evt.shiftKey || e.evt.ctrlKey;
                      if (aggiuntivo) setSelezione((sel) => selezionaConClic(sel, c.id, true));
                      else if (!selezionati.has(c.id)) setSelezione([c.id]);
                    }}
                    onDragStart={(e) => inizioTrascinamento(c.id, e.target)}
                    onDragMove={(e) => durante(e.target)}
                    onDragEnd={(e) => fineTrascinamento(e.target)}
                  >
                    <Group name="disegno" x={rot.x} y={rot.y} rotation={rot.rotazione}>
                    <SimboloComponente
                      larghezza={c.larghezza}
                      altezza={c.altezza}
                      // Nel banco Arduino niente sigle sopra i componenti (come sul banco vero).
                      etichetta={ruotato ? "" : sigla}
                      nonAssociato={siglaMostrata(c) !== c.etichetta}
                      numeri={numeriDa(c)}
                      immagine={immagine(c.tipo)}
                      scelto={scelto}
                      colori={colori}
                      siglaSopra={libreria.modulo === "plc" || libreria.modulo === "arduino"}
                      siglaDentro={c.tipo === "ladder-commento"}
                      colpoPreciso={libreria.modulo === "arduino"}
                    />
                    {MODELLI_IMPIANTI_PLC[c.tipo] && (
                      <DisegnoImpianto
                        tipo={c.tipo}
                        operandi={operandiImpianto(MODELLI_IMPIANTI_PLC[c.tipo], c.collegamenti)}
                        stato={aspetto?.impianto}
                        colori={colori}
                      />
                    )}
                    {libreria.modulo === "arduino" && <DisegnoArduino componente={c} aspetto={aspetto} />}
                    {elettronica && <DisegnoElettronica componente={c} aspetto={aspetto} colori={colori} />}
                    {libreria.modulo === "impianti" && conColoreLampada(c.tipo) && (
                      // Colore della spia: sigla normativa (simboli) o calotta colorata (vista realistica).
                      realistico ? (
                        <Circle x={20} y={40} radius={10} fill={coloreLampada(c).luce} opacity={0.75} listening={false} />
                      ) : (
                        <Text x={31} y={58} text={coloreLampada(c).sigla} fontSize={10} fontStyle="bold" fill={colori.testo} fontFamily="Segoe UI, system-ui, sans-serif" listening={false} />
                      )
                    )}
                    {aspetto && libreria.modulo !== "arduino" && !elettronica && (
                      <AspettoInSimulazione
                        componente={c}
                        voce={vociPerTipo.get(c.tipo)}
                        aspetto={aspetto}
                        colori={colori}
                        realistico={realistico}
                      />
                    )}
                    </Group>
                    {elettronica && <EtichettaElettronica componente={c} larghezza={ingombro.larghezza} altezza={ingombro.altezza} colori={colori} />}
                    {ruotato && sigla && (
                      <Text
                        text={sigla}
                        x={libreria.modulo === "plc" ? -20 : -64}
                        y={libreria.modulo === "plc" ? -18 : ingombro.altezza / 2 - 8}
                        width={libreria.modulo === "plc" ? ingombro.larghezza + 40 : 58}
                        align={libreria.modulo === "plc" ? "center" : "right"}
                        fontSize={14}
                        fontStyle="bold"
                        fontFamily="Segoe UI, system-ui, sans-serif"
                        fill={colori.testo}
                        listening={false}
                      />
                    )}
                  </Group>
                );
              };

  const disegnaMorsetto = (m: MorsettoPosato) => {
                const chiave = `${m.componente}/${m.morsetto}`;
                const attivo =
                  morsettoSotto === chiave ||
                  (filoInCorso?.componente === m.componente && filoInCorso.morsetto === m.morsetto);
                const nFili = filiSulMorsetto(schema, m);
                const inCorto = simulazione?.vista.morsettiInCorto.has(`${m.componente}:${m.morsetto}`) ?? false;
                return (
                  <Group
                    key={chiave}
                    x={m.posizione.x}
                    y={m.posizione.y}
                    listening={!voceDaPosare && !spazioPremuto && !inSimulazione}
                  >
                    {inCorto && <Circle radius={9} stroke={colori.corto} strokeWidth={3} listening={false} />}
                    <Circle
                      radius={attivo ? raggioMorsetto + 1.5 : raggioMorsetto}
                      // Banco Arduino: fori e piedini sono già disegnati; il cerchio
                      // compare (verde) solo sotto il mouse, come in un simulatore di breadboard.
                      fill={banco ? (attivo ? colori.morsettoAttivo : "rgba(0,0,0,0)") : nFili >= 2 ? colori.filo : attivo ? colori.morsettoAttivo : colori.foglio}
                      stroke={banco ? (attivo ? colori.morsettoAttivo : "rgba(0,0,0,0)") : attivo ? colori.morsettoAttivo : nFili > 0 ? colori.filo : colori.morsetto}
                      strokeWidth={1.5}
                      hitStrokeWidth={14}
                      onMouseEnter={() => setMorsettoSotto(chiave)}
                      onMouseLeave={() => setMorsettoSotto((x) => (x === chiave ? null : x))}
                      onMouseDown={(e) => {
                        if (e.evt.button !== 0) return;
                        e.cancelBubble = true; // né rettangolo di selezione né trascinamento
                        clicMorsetto(m);
                      }}
                    />
                    {attivo && (
                      <Text
                        text={(() => {
                          const comp = componentePerId.get(m.componente);
                          return comp ? numeroMorsetto(comp, m.morsetto) : m.morsetto;
                        })()}
                        x={6}
                        y={-16}
                        fontSize={11}
                        fontStyle="bold"
                        fontFamily="Segoe UI, system-ui, sans-serif"
                        fill={colori.morsettoAttivo}
                        listening={false}
                      />
                    )}
                  </Group>
                );
              };
  const posAnteprima =
    voceDaPosare && anteprima ? componenteDaVoce(schema, voceDaPosare, anteprima, libreria) : null;

  return (
    <div className="area-disegno">
      {sopraFoglio}
      <div
        ref={contenitore}
        className="area-disegno-canvas"
        style={{ cursor: cursore, background: colori.foglio }}
        onContextMenu={(e) => e.preventDefault()}
        onDragOver={suTrascinaSopra}
        onDrop={suRilascioLibreria}
        onMouseLeave={() => setAnteprima(null)}
        data-zoom={Math.round(vista.scala * 100)}
        data-selezionati={selezione.join(",")}
        data-componenti={schema.componenti.length}
        data-fili={schema.fili.length}
        data-filo-in-corso={filoInCorso ? `${filoInCorso.componente}/${filoInCorso.morsetto}` : ""}
        data-simulazione={inSimulazione}
        data-evidenziati={evidenzia ? evidenzia.componenti.join(",") : ""}
      >
        {larghezza > 0 && altezza > 0 && (
          <Stage
            ref={stageRif}
            width={larghezza}
            height={altezza}
            scaleX={vista.scala}
            scaleY={vista.scala}
            x={vista.x}
            y={vista.y}
            onWheel={suRotellina}
            onMouseDown={suPressione}
            onMouseMove={suMovimento}
            onMouseUp={suRilascio}
            onMouseLeave={suRilascio}
          >
            {/* Griglia: un'unica forma disegnata a mano, molto più leggera di centinaia di linee. */}
            <Layer listening={false}>
              <Shape
                sceneFunc={(ctx) => {
                  const spessore = 1 / vista.scala;
                  const inizioY = griglia.orizzontali[0] ?? 0;
                  const fineY = griglia.orizzontali[griglia.orizzontali.length - 1] ?? 0;
                  const inizioX = griglia.verticali[0] ?? 0;
                  const fineX = griglia.verticali[griglia.verticali.length - 1] ?? 0;
                  const passoForte = griglia.passoVisibile * 5;
                  for (const forte of [false, true]) {
                    ctx.beginPath();
                    for (const x of griglia.verticali) {
                      if ((x % passoForte === 0) !== forte) continue;
                      ctx.moveTo(x, inizioY);
                      ctx.lineTo(x, fineY);
                    }
                    for (const y of griglia.orizzontali) {
                      if ((y % passoForte === 0) !== forte) continue;
                      ctx.moveTo(inizioX, y);
                      ctx.lineTo(fineX, y);
                    }
                    ctx.strokeStyle = forte ? colori.grigliaForte : colori.griglia;
                    ctx.lineWidth = spessore;
                    ctx.stroke();
                  }
                }}
              />
            </Layer>

            <Layer>
              {/* Nel modulo Arduino la breadboard e i suoi fori stanno sotto agli
                  altri componenti: i piedini infilati restano cliccabili. */}
              {componentiFondo.map(disegnaComponente)}
              {morsettiFondo.map(disegnaMorsetto)}
              {componentiSopra.map(disegnaComponente)}
              {/* Fili: sopra i simboli, così si vedono e si afferrano facilmente. */}
              {schema.fili.map((f) => {
                const punti = percorsoFilo(schema, f, morsettiDi, banco ? "diretto" : "ortogonale");
                if (!punti) return null;
                const scelto = selezionati.has(f.id);
                if (banco) {
                  // Cavetto colorato, più spesso, con il contorno quando è selezionato.
                  const colore = f.colore ?? colorePropostoFilo(f.da, f.a);
                  return (
                    <Group key={f.id}>
                      {scelto && <Line points={punti.flatMap((q) => [q.x, q.y])} stroke={colori.selezione} strokeWidth={9} lineCap="round" lineJoin="round" listening={false} />}
                      <Line
                        points={punti.flatMap((q) => [q.x, q.y])}
                        stroke={colore}
                        strokeWidth={5}
                        shadowColor="#000000"
                        shadowOpacity={0.25}
                        shadowBlur={2}
                        shadowOffsetY={1}
                        hitStrokeWidth={12}
                        lineCap="round"
                        lineJoin="round"
                        listening={!voceDaPosare && !filoInCorso && !inSimulazione}
                        onMouseDown={(e) => {
                          if (e.evt.button !== 0 || spazioPremuto) return;
                          e.cancelBubble = true;
                          const aggiuntivo = e.evt.shiftKey || e.evt.ctrlKey;
                          setSelezione((sel) => (aggiuntivo ? selezionaConClic(sel, f.id, true) : [f.id]));
                          const pos = e.target.getStage()?.getPointerPosition();
                          if (!pos) return;
                          // Trascinando il cavetto si crea una piega dove lo si è afferrato.
                          const punto = schermoAFoglio(vista, pos);
                          filoTrascinato.current = { id: f.id, tratto: trattoPiuVicino(punti, punto), percorso: punti, diretto: { da: punto } };
                        }}
                        onDblClick={() => onCambiaSchema(ripristinaPercorso(schema, f.id))}
                      />
                    </Group>
                  );
                }
                // In simulazione: colore del polo che raggiunge il filo (più spesso se in tensione).
                const poli = simulazione?.vista.poliDeiFili[f.id] ?? [];
                const coloreTensione = coloreFilo(poli, colori);
                return (
                  <Line
                    key={f.id}
                    points={punti.flatMap((p) => [p.x, p.y])}
                    stroke={coloreTensione ?? (scelto ? colori.selezione : colori.filo)}
                    strokeWidth={coloreTensione ? 3 : scelto ? 3 : 2}
                    dash={poli.length > 1 ? [8, 4] : undefined}
                    hitStrokeWidth={12}
                    lineCap="round"
                    lineJoin="round"
                    listening={!voceDaPosare && !filoInCorso && !inSimulazione}
                    onMouseDown={(e) => {
                      if (e.evt.button !== 0 || spazioPremuto) return;
                      e.cancelBubble = true;
                      const aggiuntivo = e.evt.shiftKey || e.evt.ctrlKey;
                      setSelezione((sel) => (aggiuntivo ? selezionaConClic(sel, f.id, true) : [f.id]));
                      // Si afferra il tratto più vicino al mouse: si sposterà
                      // perpendicolarmente a se stesso (in su/giù o di lato).
                      const pos = e.target.getStage()?.getPointerPosition();
                      if (pos) {
                        const tratto = trattoPiuVicino(punti, schermoAFoglio(vista, pos));
                        filoTrascinato.current = { id: f.id, tratto, percorso: punti };
                      }
                    }}
                    onDblClick={() => onCambiaSchema(ripristinaPercorso(schema, f.id))}
                  />
                );
              })}
              {anteprimaFilo && (
                <Line
                  points={anteprimaFilo.flatMap((p) => [p.x, p.y])}
                  stroke={colori.morsettoAttivo}
                  strokeWidth={2}
                  dash={[6, 4]}
                  listening={false}
                />
              )}
              {/* Morsetti: cerchietto vuoto se libero, pallino pieno se ci arrivano due o più fili (giunzione). */}
              {morsettiSopra.map(disegnaMorsetto)}
              {/* Punti di un problema: riquadro rosso tratteggiato e cerchi sui morsetti. */}
              {evidenzia &&
                evidenzia.componenti.map((id) => {
                  const c = componentePerId.get(id);
                  if (!c) return null;
                  return (
                    <Rect
                      key={`evidenzia-${id}`}
                      x={c.x - 8}
                      y={c.y - 8}
                      width={dimensioni(c).larghezza + 16}
                      height={dimensioni(c).altezza + 16}
                      stroke={colori.guasto}
                      strokeWidth={2.5}
                      dash={[8, 5]}
                      cornerRadius={6}
                      listening={false}
                    />
                  );
                })}
              {evidenzia &&
                morsetti
                  .filter((m) => evidenzia.morsetti.includes(`${m.componente}:${m.morsetto}`))
                  .map((m) => (
                    <Circle
                      key={`evidenzia-${m.componente}:${m.morsetto}`}
                      x={m.posizione.x}
                      y={m.posizione.y}
                      radius={11}
                      stroke={colori.guasto}
                      strokeWidth={3}
                      listening={false}
                    />
                  ))}
              {posAnteprima && voceDaPosare && (
                <Group x={posAnteprima.x} y={posAnteprima.y} opacity={0.45} listening={false}>
                  <SimboloComponente
                    larghezza={posAnteprima.larghezza}
                    altezza={posAnteprima.altezza}
                    etichetta={siglaMostrata(posAnteprima)}
                    immagine={immagine(voceDaPosare.id)}
                    scelto={false}
                    colori={colori}
                  />
                </Group>
              )}
              {rett && (
                <Rect
                  x={rett.x}
                  y={rett.y}
                  width={rett.larghezza}
                  height={rett.altezza}
                  fill={colori.rettangoloSelezione}
                  stroke={colori.selezione}
                  strokeWidth={1 / vista.scala}
                  dash={[6 / vista.scala, 4 / vista.scala]}
                  listening={false}
                />
              )}
            </Layer>
          </Stage>
        )}
      </div>

      {sopraBarra}
      <div className="barra-zoom" role="toolbar" aria-label={t("editor.zoom")}>
        <button
          type="button"
          className="pulsante"
          onClick={onAnnulla}
          disabled={!puoAnnullare || inSimulazione}
          title={t("modifica.annullaTasti")}
        >
          ↶ {t("modifica.annulla")}
        </button>
        <button
          type="button"
          className="pulsante"
          onClick={onRipeti}
          disabled={!puoRipetere || inSimulazione}
          title={t("modifica.ripetiTasti")}
        >
          ↷ {t("modifica.ripeti")}
        </button>
        <button
          type="button"
          className="pulsante"
          onClick={ruota}
          disabled={!selezione.some((id) => componentePerId.has(id)) || inSimulazione}
          title={t("modifica.ruotaTasti")}
        >
          ↻ {t("modifica.ruota")}
        </button>
        <button type="button" className="pulsante" onClick={elimina} disabled={selezione.length === 0 || inSimulazione} title={t("modifica.eliminaTasti")}>
          {t("modifica.elimina")}
        </button>
        {onCambiaRealistico && (
          <>
            <span className="separatore-barra" aria-hidden="true" />
            <div className="scelta-vista" role="radiogroup" aria-label={t("vista.titolo")} title={t("vista.suggerimento")}>
              {([false, true] as const).map((r) => (
                <button key={String(r)} type="button" role="radio" aria-checked={realistico === r} className={realistico === r ? "pulsante attivo" : "pulsante"} onClick={() => onCambiaRealistico(r)}>
                  {r ? `🖼 ${t("vista.realistica")}` : `📐 ${t("vista.simboli")}`}
                </button>
              ))}
            </div>
          </>
        )}
        <span className="separatore-barra" aria-hidden="true" />
        <button type="button" className="pulsante" onClick={rimpicciolisci} title={t("editor.rimpicciolisci")}>
          −
        </button>
        <span className="valore-zoom">{Math.round(vista.scala * 100)}%</span>
        <button type="button" className="pulsante" onClick={ingrandisci} title={t("editor.ingrandisci")}>
          +
        </button>
        <button type="button" className="pulsante" onClick={zoom100}>
          100%
        </button>
        <button type="button" className="pulsante" onClick={adatta}>
          {t("editor.adatta")}
        </button>
        <span className={avviso ? "suggerimento avviso" : "suggerimento"} role="status" aria-live="polite">
          {avviso ?? (inSimulazione ? t(libreria.modulo === "plc" ? "simulazione.suggerimentoPlc" : libreria.modulo === "arduino" ? "simulazione.suggerimentoArduino" : libreria.modulo === "elettronica" ? "simulazione.suggerimentoElettronica" : "simulazione.suggerimento") : filoInCorso ? t("fili.inCorso") : t("editor.suggerimento"))}
        </span>
      </div>
    </div>
  );
}

interface PropsSimbolo {
  larghezza: number;
  altezza: number;
  etichetta: string;
  /** true per un contatto senza bobina: la sigla "K?" è scritta in rosso. */
  nonAssociato?: boolean;
  /** Numeri dei morsetti da scrivere accanto al simbolo (contatti dei contattori). */
  numeri?: { x: number; y: number; testo: string; inAlto: boolean }[];
  /** Icona della libreria; se manca si disegna un semplice riquadro. */
  immagine: HTMLImageElement | undefined;
  scelto: boolean;
  colori: ReturnType<typeof coloriEditor>;
  /**
   * Sigla sopra il simbolo invece che a sinistra: nel Ladder i fili entrano
   * da sinistra e l'operando si scrive sopra contatti e bobine.
   */
  siglaSopra?: boolean;
  /** Sigla scritta dentro il simbolo, a capo se serve (commenti del Ladder). */
  siglaDentro?: boolean;
  /**
   * Si clicca solo sulle parti disegnate (non sul riquadro intero): nel banco
   * Arduino i fori della breadboard accanto ai piedini restano raggiungibili.
   */
  colpoPreciso?: boolean;
}

/** Immagine che risponde ai clic solo dove non è trasparente. */
function ImmaginePrecisa({ immagine, larghezza, altezza }: { immagine: HTMLImageElement; larghezza: number; altezza: number }) {
  const rif = useRef<Konva.Image>(null);
  useEffect(() => {
    const nodo = rif.current;
    if (!nodo) return;
    nodo.cache({ pixelRatio: 1 });
    nodo.drawHitFromCache(0);
  }, [immagine, larghezza, altezza]);
  return <ImmagineKonva ref={rif} image={immagine} width={larghezza} height={altezza} />;
}

/** Disegno di un componente: simbolo, sigla a sinistra (o sopra) e contorno di selezione. */
function SimboloComponente({ larghezza, altezza, etichetta, nonAssociato, numeri, immagine, scelto, colori, siglaSopra, siglaDentro, colpoPreciso }: PropsSimbolo) {
  return (
    <>
      {/* Area cliccabile trasparente: si seleziona cliccando anche fra le linee del simbolo. */}
      {!(colpoPreciso && immagine) && <Rect width={larghezza} height={altezza} fill="rgba(0,0,0,0)" />}
      {immagine && colpoPreciso ? (
        <ImmaginePrecisa immagine={immagine} larghezza={larghezza} altezza={altezza} />
      ) : immagine ? (
        <ImmagineKonva image={immagine} width={larghezza} height={altezza} listening={false} />
      ) : (
        <Rect
          width={larghezza}
          height={altezza}
          fill={colori.componente}
          stroke={colori.bordoComponente}
          strokeWidth={1.5}
          cornerRadius={4}
          listening={false}
        />
      )}
      {etichetta && siglaDentro && (
        <Text
          text={etichetta}
          x={8}
          y={4}
          width={larghezza - 16}
          height={altezza - 8}
          verticalAlign="middle"
          fontSize={13}
          fontStyle="italic"
          fontFamily="Segoe UI, system-ui, sans-serif"
          fill={colori.testo}
          ellipsis
          listening={false}
        />
      )}
      {etichetta && !siglaDentro && (
        <Text
          text={etichetta}
          x={siglaSopra ? -20 : -64}
          y={siglaSopra ? -18 : altezza / 2 - 8}
          width={siglaSopra ? larghezza + 40 : 58}
          align={siglaSopra ? "center" : "right"}
          fontSize={14}
          fontStyle="bold"
          fontFamily="Segoe UI, system-ui, sans-serif"
          fill={nonAssociato ? colori.morsettoAttivo : colori.testo}
          listening={false}
        />
      )}
      {numeri?.map((n) => (
        <Text
          key={`${n.x},${n.y}`}
          text={n.testo}
          x={n.x + 6}
          y={n.inAlto ? n.y + 4 : n.y - 15}
          fontSize={11}
          fontFamily="Segoe UI, system-ui, sans-serif"
          fill={colori.morsetto}
          listening={false}
        />
      ))}
      {scelto && (
        <Rect
          x={-4}
          y={-4}
          width={larghezza + 8}
          height={altezza + 8}
          stroke={colori.selezione}
          strokeWidth={2}
          dash={[6, 3]}
          cornerRadius={4}
          listening={false}
        />
      )}
    </>
  );
}

interface PropsAspetto {
  componente: ComponenteSchema;
  voce: VoceLibreria | undefined;
  aspetto: AspettoComponente;
  colori: ColoriEditor;
  /** Vista realistica: manopole, leve e maniglie si disegnano nella posizione azionata. */
  realistico?: boolean;
}

/**
 * Disegno sovrapposto al simbolo durante la simulazione. I simboli SVG della
 * libreria sono fissi, quindi lo stato si mostra con segni aggiunti:
 * - contatto chiuso: tratto verde fra i due morsetti di ogni polo;
 * - comando azionato dallo studente: riquadro azzurro;
 * - bobina eccitata: riempimento verde; lampada accesa / sirena: alone giallo;
 * - motore che gira: freccia che ruota nel verso di rotazione (con Y/Δ);
 * - protezione intervenuta o motore in sovraccarico: segni rossi.
 */
function AspettoInSimulazione({ componente: c, voce, aspetto, colori, realistico = false }: PropsAspetto) {
  const w = c.larghezza;
  const h = c.altezza;
  const posMorsetto = (id: string) => voce?.morsetti.find((m) => m.id === id);
  const utilizzatore = tipoUtilizzatore(c.tipo);
  const testo = (contenuto: string, y: number, colore: string) => (
    <Text
      text={contenuto}
      x={-30}
      y={y}
      width={w + 60}
      align="center"
      fontSize={11}
      fontStyle="bold"
      fontFamily="Segoe UI, system-ui, sans-serif"
      fill={colore}
      listening={false}
    />
  );
  return (
    <Group listening={false}>
      {utilizzatore === "bobina" && aspetto.alimentato && (
        <Rect width={w} height={h} fill={colori.attivo} opacity={0.3} cornerRadius={4} />
      )}
      {(utilizzatore === "luce" || utilizzatore === "suono") && aspetto.alimentato && (
        <Circle
          x={w / 2}
          y={h / 2}
          radius={Math.min(w, h) / 2}
          fill={conColoreLampada(c.tipo) ? coloreLampada(c).luce : colori.luce}
          opacity={0.6}
          shadowColor={conColoreLampada(c.tipo) ? (coloreLampada(c).alone ?? coloreLampada(c).luce) : colori.luce}
          shadowBlur={22}
          shadowOpacity={0.95}
        />
      )}
      {utilizzatore === "suono" && aspetto.alimentato && testo("♪ ♪", -16, colori.luce)}
      {(aspetto.chiuso ? trattiDelContatto(c.tipo) : trattiDiScambio(c.tipo)).map(([a, b]) => {
          const pa = posMorsetto(a);
          const pb = posMorsetto(b);
          if (!pa || !pb) return null;
          return (
            <Line
              key={`${a}-${b}`}
              points={[pa.x, pa.y, pb.x, pb.y]}
              stroke={colori.attivo}
              strokeWidth={4}
              opacity={0.7}
              lineCap="round"
            />
          );
        })}
      {aspetto.azionato && (
        <Rect x={-3} y={-3} width={w + 6} height={h + 6} stroke={colori.azionato} strokeWidth={2.5} cornerRadius={5} />
      )}
      {aspetto.azionato && ePulsante(c.tipo) && (
        // Pulsante premuto: il tasto (a sinistra del simbolo) si colora e "rientra" verso il contatto.
        <>
          {c.tipo.startsWith("pulsante-") && (
            <>
              <Rect x={-6} y={26} width={16} height={28} fill={colori.azionato} opacity={0.9} cornerRadius={4} shadowColor={colori.azionato} shadowBlur={10} shadowOpacity={0.8} />
              <Line points={[10, 40, 18, 40]} stroke={colori.azionato} strokeWidth={3} lineCap="round" />
            </>
          )}
          {testo(`👇 ${t("simulazione.premuto")}`, -18, colori.azionato)}
        </>
      )}
      {aspetto.azionato && !ePulsante(c.tipo) && aspetto.clic === "manuale" && utilizzatore === null && testo(`● ${t("simulazione.azionato")}`, -18, colori.azionato)}
      {realistico && aspetto.azionato && <ComandoRealisticoAzionato tipo={c.tipo} />}
      {aspetto.plcSchema && <LedPlc stato={aspetto.plcSchema} />}
      {aspetto.cilindro !== undefined && aspetto.cilindro > 0 && (
        // Stelo del cilindro che esce (fino a 40 unità oltre il fondello).
        <Group listening={false}>
          <Rect x={150} y={27} width={10 + 36 * aspetto.cilindro} height={6} fill="#cfd5da" stroke="#5f686e" strokeWidth={0.8} cornerRadius={1} />
          <Rect x={156 + 36 * aspetto.cilindro} y={23} width={6} height={14} fill="#90a4ae" stroke="#455a64" strokeWidth={0.8} cornerRadius={1} />
        </Group>
      )}
      {realistico && (c.tipo === "contatti-principali" ? aspetto.chiuso : utilizzatore === "bobina" && aspetto.alimentato) && (
        // Indicatore meccanico del contattore: finestrella verde con "I" quando è chiuso.
        <Group listening={false}>
          <Rect x={c.tipo === "contatti-principali" ? 32 : 16} y={33} width={c.tipo === "contatti-principali" ? 16 : 8} height={5} fill="#43a047" />
          {testo("I", 22, "#43a047")}
        </Group>
      )}
      {aspetto.motore && (
        <MotoreInMarcia
          {...centroMotore(c.tipo, w, h)}
          verso={aspetto.motore.verso}
          colore={colori.attivo}
          etichetta={`${aspetto.motore.verso === "orario" ? "↻" : "↺"} ${t("simulazione.inMarcia")}${aspetto.motore.collegamento ? (aspetto.motore.collegamento === "stella" ? "  Y" : "  Δ") : ""}`}
          larghezza={w}
        />
      )}
      {aspetto.intervenuta && (
        <>
          <Rect x={-4} y={-4} width={w + 8} height={h + 8} stroke={colori.guasto} strokeWidth={2.5} dash={[5, 3]} cornerRadius={5} />
          {testo(t("simulazione.intervenuto"), -18, colori.guasto)}
        </>
      )}
      {aspetto.sovraccarico && testo(t("simulazione.sovraccarico"), h + 6, colori.guasto)}
      {aspetto.valore && testo(aspetto.valore, h + 4, colori.attivo)}
    </Group>
  );
}

/**
 * Vista realistica: il comando a posizione mantenuta disegnato nella posizione
 * azionata (stesse coordinate dei disegni di genera-icone-realistiche-impianti.ts):
 * manopola del selettore girata, leva dell'interruttore abbassata, maniglia del
 * sezionatore orizzontale.
 */
function ComandoRealisticoAzionato({ tipo }: { tipo: string }) {
  if (tipo === "selettore" || tipo === "selettore-nc")
    return (
      <Group listening={false}>
        <Circle x={11} y={40} radius={10} fill="#37474f" stroke="#212121" />
        <Group x={11} y={40} rotation={30}>
          <Rect x={-2} y={-9} width={4} height={18} cornerRadius={2} fill="#eceff1" />
        </Group>
      </Group>
    );
  if (tipo === "deviatore" || tipo === "invertitore" || tipo === "interruttore-unipolare" || tipo === "interruttore-bipolare")
    // Tasto basculante premuto in basso.
    return (
      <Group listening={false}>
        <Rect x={12} y={23} width={16} height={15} cornerRadius={2} fill="#ffffff" />
        <Rect x={12} y={42} width={16} height={15} cornerRadius={2} fill="#cfd8dc" />
      </Group>
    );
  if (tipo === "pulsante-emergenza")
    // Fungo premuto e agganciato: più piccolo e più scuro, con l'anello giallo che si vede tutto.
    return (
      <Group listening={false}>
        <Circle x={11} y={40} radius={11} fill="#fdd835" stroke="#f9a825" />
        <Circle x={13} y={40} radius={6.5} fill="#b71c1c" stroke="#7f0000" />
      </Group>
    );
  if (tipo === "interruttore-na" || tipo === "interruttore-nc")
    return (
      <Group listening={false}>
        <Rect x={4} y={30} width={16} height={22} cornerRadius={3} fill="#455a64" />
        <Rect x={8} y={40} width={8} height={18} cornerRadius={3} fill="#eceff1" stroke="#90a4ae" />
      </Group>
    );
  if (tipo === "sezionatore")
    return (
      <Group listening={false}>
        <Circle x={40} y={40} radius={13} fill="#c62828" />
        <Rect x={25} y={36} width={30} height={8} cornerRadius={3} fill="#e53935" stroke="#b71c1c" />
      </Group>
    );
  return null;
}

/**
 * LED del PLC posato nello schema elettrico (stesse posizioni del disegno
 * realistico): verdi sopra gli ingressi a 1, arancioni sopra le uscite a 1, RUN acceso.
 */
function LedPlc({ stato }: { stato: { acceso: boolean; ingressi: string[]; uscite: string[] } }) {
  const led = (x: number, y: number, colore: string, chiave: string) => (
    <Circle key={chiave} x={x} y={y} radius={3.2} fill={colore} shadowColor={colore} shadowBlur={8} shadowOpacity={1} />
  );
  return (
    <Group listening={false}>
      {stato.acceso && led(214, 52, "#2ecc40", "run")}
      {stato.ingressi.map((i) => led(80 + 20 * Number(i.split(".")[1]), 27, "#2ecc40", i))}
      {stato.uscite.map((q) => led(60 + 20 * Number(q.split(".")[1]), 93, "#ff9800", q))}
    </Group>
  );
}

/** Pulsanti (si tengono premuti): impianti e quadro del PLC. */
const ePulsante = (tipo: string) => tipo.startsWith("pulsante-") || tipo.startsWith("quadro-pulsante");

/** Centro del cerchio del simbolo del motore (dove gira la ventola). */
function centroMotore(tipo: string, w: number, h: number): { x: number; y: number; raggio: number } {
  if (tipo === "motore-trifase-6") return { x: 40, y: 40, raggio: 22 };
  if (tipo.startsWith("motore-")) return { x: 40, y: 50, raggio: 24 };
  return { x: w / 2, y: h / 2, raggio: Math.min(w, h) / 2 - 2 };
}

/**
 * Motore in marcia, ben visibile: disco colorato, ventola che gira dentro il
 * simbolo (due giri al secondo, nel verso di rotazione), freccia circolare
 * attorno e la scritta "↻ IN MARCIA" sotto (con Y o Δ nell'avviamento stella-triangolo).
 */
function MotoreInMarcia({ x, y, raggio, verso, colore, etichetta, larghezza }: { x: number; y: number; raggio: number; verso: "orario" | "antiorario"; colore: string; etichetta: string; larghezza: number }) {
  const ventola = useRef<Konva.Group>(null);
  const segno = verso === "orario" ? 1 : -1;
  useEffect(() => {
    const g = ventola.current;
    if (!g) return;
    const animazione = new Konva.Animation((frame) => {
      if (frame) g.rotation(g.rotation() + segno * frame.timeDiff * 0.72);
    }, g.getLayer());
    animazione.start();
    return () => {
      animazione.stop();
    };
  }, [segno]);
  const pala = raggio * 0.62;
  return (
    <Group listening={false}>
      <Circle x={x} y={y} radius={raggio} fill={colore} opacity={0.18} />
      <Group ref={ventola} x={x} y={y} opacity={0.75}>
        {[0, 120, 240].map((a) => (
          <Group key={a} rotation={a}>
            <Line points={[0, 0, pala * 0.35, -pala * 0.55, 0, -pala, -pala * 0.2, -pala * 0.5]} closed tension={0.3} fill={colore} />
          </Group>
        ))}
        <Circle radius={3} fill={colore} />
      </Group>
      <FrecciaRotante x={x} y={y} raggio={raggio + 5} verso={verso} colore={colore} />
      {/* Scritta a destra del motore (sotto spesso c'è il bordo del foglio). */}
      <Text text={etichetta} x={larghezza + 6} y={y - 7} fontSize={12} fontStyle="bold" fontFamily="Segoe UI, system-ui, sans-serif" fill={colore} />
    </Group>
  );
}

/** Freccia circolare che ruota finché il motore gira (animazione di Konva, senza ridisegnare React). */
function FrecciaRotante({
  x,
  y,
  raggio,
  verso,
  colore,
}: {
  x: number;
  y: number;
  raggio: number;
  verso: "orario" | "antiorario";
  colore: string;
}) {
  const rif = useRef<Konva.Group>(null);
  const segno = verso === "orario" ? 1 : -1;
  useEffect(() => {
    const gruppo = rif.current;
    if (!gruppo) return;
    // Circa un giro al secondo: 360 gradi / 1000 ms.
    const animazione = new Konva.Animation((frame) => {
      if (frame) gruppo.rotation(gruppo.rotation() + segno * frame.timeDiff * 0.36);
    }, gruppo.getLayer());
    animazione.start();
    return () => {
      animazione.stop();
    };
  }, [segno]);
  // Punta della freccia alla fine dell'arco (300°), orientata in senso orario;
  // per il verso antiorario il disegno è specchiato.
  const angolo = (300 * Math.PI) / 180;
  const px = raggio * Math.cos(angolo);
  const py = raggio * Math.sin(angolo);
  const tx = -Math.sin(angolo);
  const ty = Math.cos(angolo);
  const nx = Math.cos(angolo);
  const ny = Math.sin(angolo);
  const punta = [px + tx * 8, py + ty * 8, px + nx * 5, py + ny * 5, px - nx * 5, py - ny * 5];
  return (
    <Group ref={rif} x={x} y={y} listening={false}>
      <Group scaleX={segno}>
        <Arc innerRadius={raggio - 1.5} outerRadius={raggio + 1.5} angle={300} fill={colore} opacity={0.9} />
        <Line points={punta} closed fill={colore} opacity={0.9} />
      </Group>
    </Group>
  );
}
