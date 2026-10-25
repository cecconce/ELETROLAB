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
// La logica (calcoli e modifiche allo schema) sta in geometria.ts, schema.ts,
// fili.ts, appunti.ts, associazioni.ts e cronologia.ts.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, Group, Image as ImmagineKonva, Layer, Line, Rect, Shape, Stage, Text } from "react-konva";
import type Konva from "konva";
import { t } from "../testi";
import type { Tema } from "../interfaccia/tema";
import { coloriEditor } from "./colori";
import { ICONE, trovaVoce } from "./caricaLibreria";
import { componenteDaVoce, svgComeDataUrl, tipiContatto, type Libreria, type VoceLibreria } from "./libreria";
import { numeroMorsetto } from "./associazioni";
import { MIME_COMPONENTE } from "./LibreriaLaterale";
import { copiaSelezione, incolla, type Appunti } from "./appunti";
import {
  collega,
  filiSulMorsetto,
  instrada,
  morsettiDelComponente,
  percorsoFilo,
  ripristinaPercorso,
  spostaTrattoFilo,
  type MorsettiDelTipo,
  type MorsettoPosato,
} from "./fili";
import {
  FATTORE_ZOOM,
  VISTA_INIZIALE,
  agganciaPunto,
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
}

/**
 * Immagini delle icone della libreria, colorate per il tema. La mappa si
 * aggiorna quando le immagini finiscono di caricarsi (servono per Konva).
 */
function useImmaginiIcone(libreria: Libreria, colore: string): ReadonlyMap<string, HTMLImageElement> {
  const [pronte, setPronte] = useState<ReadonlyMap<string, HTMLImageElement>>(new Map());
  useEffect(() => {
    let attivo = true;
    const mappa = new Map<string, HTMLImageElement>();
    const nomi = [...new Set(libreria.componenti.map((v) => v.icona))];
    let mancanti = nomi.length;
    for (const nome of nomi) {
      const img = new window.Image();
      img.onload = img.onerror = () => {
        mancanti--;
        if (attivo && mancanti === 0) setPronte(mappa);
      };
      img.src = svgComeDataUrl(ICONE.get(nome) ?? "", colore);
      mappa.set(nome, img);
    }
    return () => {
      attivo = false;
    };
  }, [libreria, colore]);
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
}: PropsAreaDisegno) {
  const colori = coloriEditor(tema);
  const immagini = useImmaginiIcone(libreria, colori.testo);
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
  const [filoInCorso, setFiloInCorso] = useState<MorsettoPosato | null>(null);
  // Punto del foglio sotto il mouse (anteprima del filo in corso).
  const [mouseFoglio, setMouseFoglio] = useState<Punto | null>(null);
  // Morsetto sotto il mouse, evidenziato con il suo numero (chiave "componente/morsetto").
  const [morsettoSotto, setMorsettoSotto] = useState<string | null>(null);
  // Messaggio breve per lo studente (es. collegamento non valido).
  const [avviso, setAvviso] = useState<string | null>(null);
  // Filo di cui si sta trascinando il tratto centrale.
  const filoTrascinato = useRef<string | null>(null);

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
  const comandiRif = useRef({ elimina, copia, taglia, incollaAppunti, onAnnulla, onRipeti, tutto: () => setSelezione(tuttiGliId(schema)) });
  comandiRif.current = { elimina, copia, taglia, incollaAppunti, onAnnulla, onRipeti, tutto: () => setSelezione(tuttiGliId(schema)) };

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
      const cmd = comandiRif.current;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        cmd.elimina();
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
    const esito = collega(schema, filoInCorso, m, morsettiDi);
    if (!esito.ok) {
      setAvviso(t(esito.errore));
      // Sullo stesso morsetto il clic annulla; negli altri casi si può riprovare.
      if (esito.errore === "fili.stessoMorsetto") setFiloInCorso(null);
      return;
    }
    onCambiaSchema(esito.schema);
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
    // Sinistro sul vuoto con un filo in corso: annulla il collegamento.
    if (e.evt.button === 0 && filoInCorso) {
      setFiloInCorso(null);
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
      onCambiaSchema(spostaTrattoFilo(schema, filoTrascinato.current, schermoAFoglio(vista, p), morsettiDi), true);
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
    filoInCorso && (arrivoAnteprima || mouseFoglio)
      ? arrivoAnteprima
        ? instrada(filoInCorso, arrivoAnteprima)
        : [filoInCorso.posizione, mouseFoglio as Punto]
      : null;
  const raggioMorsetto = 3.5;
  const posAnteprima =
    voceDaPosare && anteprima ? componenteDaVoce(schema, voceDaPosare, anteprima, libreria) : null;

  return (
    <div className="area-disegno">
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
      >
        {larghezza > 0 && altezza > 0 && (
          <Stage
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
              {schema.componenti.map((c) => {
                const scelto = selezionati.has(c.id);
                return (
                  <Group
                    key={c.id}
                    x={c.x}
                    y={c.y}
                    draggable={!spazioPremuto && !voceDaPosare}
                    onMouseDown={(e) => {
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
                    <SimboloComponente
                      larghezza={c.larghezza}
                      altezza={c.altezza}
                      etichetta={siglaMostrata(c)}
                      nonAssociato={siglaMostrata(c) !== c.etichetta}
                      numeri={numeriDa(c)}
                      immagine={immagine(c.tipo)}
                      scelto={scelto}
                      colori={colori}
                    />
                  </Group>
                );
              })}
              {/* Fili: sopra i simboli, così si vedono e si afferrano facilmente. */}
              {schema.fili.map((f) => {
                const punti = percorsoFilo(schema, f, morsettiDi);
                if (!punti) return null;
                const scelto = selezionati.has(f.id);
                return (
                  <Line
                    key={f.id}
                    points={punti.flatMap((p) => [p.x, p.y])}
                    stroke={scelto ? colori.selezione : colori.filo}
                    strokeWidth={scelto ? 3 : 2}
                    hitStrokeWidth={12}
                    lineCap="round"
                    lineJoin="round"
                    listening={!voceDaPosare && !filoInCorso}
                    onMouseDown={(e) => {
                      if (e.evt.button !== 0 || spazioPremuto) return;
                      e.cancelBubble = true;
                      const aggiuntivo = e.evt.shiftKey || e.evt.ctrlKey;
                      setSelezione((sel) => (aggiuntivo ? selezionaConClic(sel, f.id, true) : [f.id]));
                      filoTrascinato.current = f.id;
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
              {morsetti.map((m) => {
                const chiave = `${m.componente}/${m.morsetto}`;
                const attivo =
                  morsettoSotto === chiave ||
                  (filoInCorso?.componente === m.componente && filoInCorso.morsetto === m.morsetto);
                const nFili = filiSulMorsetto(schema, m);
                return (
                  <Group key={chiave} x={m.posizione.x} y={m.posizione.y} listening={!voceDaPosare && !spazioPremuto}>
                    <Circle
                      radius={attivo ? raggioMorsetto + 1.5 : raggioMorsetto}
                      fill={nFili >= 2 ? colori.filo : attivo ? colori.morsettoAttivo : colori.foglio}
                      stroke={attivo ? colori.morsettoAttivo : nFili > 0 ? colori.filo : colori.morsetto}
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
              })}
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

      <div className="barra-zoom" role="toolbar" aria-label={t("editor.zoom")}>
        <button type="button" className="pulsante" onClick={onAnnulla} disabled={!puoAnnullare} title={t("modifica.annullaTasti")}>
          ↶ {t("modifica.annulla")}
        </button>
        <button type="button" className="pulsante" onClick={onRipeti} disabled={!puoRipetere} title={t("modifica.ripetiTasti")}>
          ↷ {t("modifica.ripeti")}
        </button>
        <button type="button" className="pulsante" onClick={elimina} disabled={selezione.length === 0} title={t("modifica.eliminaTasti")}>
          {t("modifica.elimina")}
        </button>
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
          {avviso ?? (filoInCorso ? t("fili.inCorso") : t("editor.suggerimento"))}
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
}

/** Disegno di un componente: simbolo, sigla a sinistra e contorno di selezione. */
function SimboloComponente({ larghezza, altezza, etichetta, nonAssociato, numeri, immagine, scelto, colori }: PropsSimbolo) {
  return (
    <>
      {/* Area cliccabile trasparente: si seleziona cliccando anche fra le linee del simbolo. */}
      <Rect width={larghezza} height={altezza} fill="rgba(0,0,0,0)" />
      {immagine ? (
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
      {etichetta && (
        <Text
          text={etichetta}
          x={-64}
          y={altezza / 2 - 8}
          width={58}
          align="right"
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
