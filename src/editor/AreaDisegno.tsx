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
// La logica (calcoli e modifiche allo schema) sta in geometria.ts e schema.ts.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Group, Image as ImmagineKonva, Layer, Rect, Shape, Stage, Text } from "react-konva";
import type Konva from "konva";
import { t } from "../testi";
import type { Tema } from "../interfaccia/tema";
import { coloriEditor } from "./colori";
import { ICONE, trovaVoce } from "./caricaLibreria";
import { componenteDaVoce, svgComeDataUrl, type Libreria, type VoceLibreria } from "./libreria";
import { MIME_COMPONENTE } from "./LibreriaLaterale";
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
  ingombroSchema,
  rettangoloTra,
  selezionaConClic,
  selezionePerTrascinamento,
  spostaSelezione,
  type Schema,
  type Selezione,
} from "./schema";

export interface PropsAreaDisegno {
  tema: Tema;
  schema: Schema;
  onCambiaSchema: (schema: Schema) => void;
  /** Libreria del modulo: dà icona e dimensioni ai componenti. */
  libreria: Libreria;
  /** Voce della libreria scelta con un clic, da posare al prossimo clic sul foglio. */
  daPosare?: string | null;
  /** Chiamata quando la posa con clic è conclusa o annullata (Esc). */
  onFinePosa?: () => void;
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

export function AreaDisegno({ tema, schema, onCambiaSchema, libreria, daPosare = null, onFinePosa }: PropsAreaDisegno) {
  const colori = coloriEditor(tema);
  const immagini = useImmaginiIcone(libreria, colori.testo);
  const vociPerTipo = useMemo(() => new Map(libreria.componenti.map((v) => [v.id, v])), [libreria]);
  const voceDaPosare = daPosare ? trovaVoce(libreria, daPosare) : undefined;
  // Posizione del mouse sul foglio, per l'anteprima del componente da posare.
  const [anteprima, setAnteprima] = useState<Punto | null>(null);
  const contenitore = useRef<HTMLDivElement>(null);
  const { larghezza, altezza } = useDimensioni(contenitore);

  const [vista, setVista] = useState<Vista>(VISTA_INIZIALE);
  const [selezione, setSelezione] = useState<Selezione>([]);
  const [rettangolo, setRettangolo] = useState<{ inizio: Punto; fine: Punto } | null>(null);
  const [spazioPremuto, setSpazioPremuto] = useState(false);
  const [spostandoVista, setSpostandoVista] = useState(false);

  // Riferimento sempre aggiornato alla callback, usato dal gestore dei tasti.
  const onFinePosaRif = useRef(onFinePosa);
  onFinePosaRif.current = onFinePosa;

  // Dati del trascinamento in corso (non servono al disegno, quindi in un ref).
  const trascinamento = useRef<{ schemaIniziale: Schema; id: string; da: Punto; selezione: Selezione } | null>(null);
  const ultimoPuntatore = useRef<Punto | null>(null);

  // Barra spaziatrice = modalità "mano" per spostare la vista; Esc = deseleziona.
  useEffect(() => {
    const giu = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement)) {
        setSpazioPremuto(true);
        e.preventDefault();
      }
      if (e.key === "Escape") {
        setSelezione([]);
        onFinePosaRif.current?.();
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
      const filtrata = sel.filter((id) => schema.componenti.some((c) => c.id === id));
      return filtrata.length === sel.length ? sel : filtrata;
    });
  }, [schema]);

  const puntatore = (e: Konva.KonvaEventObject<MouseEvent | WheelEvent>): Punto | null =>
    e.target.getStage()?.getPointerPosition() ?? null;

  /** Posa una voce della libreria centrata nel punto del foglio indicato e la seleziona. */
  const posa = (voce: VoceLibreria, centro: Punto) => {
    const nuovo = componenteDaVoce(schema, voce, centro);
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
    if (spostandoVista && ultimoPuntatore.current) {
      const prec = ultimoPuntatore.current;
      setVista((v) => spostaVista(v, p.x - prec.x, p.y - prec.y));
      ultimoPuntatore.current = p;
      return;
    }
    if (rettangolo) setRettangolo({ ...rettangolo, fine: schermoAFoglio(vista, p) });
  };

  const suRilascio = (e: Konva.KonvaEventObject<MouseEvent>) => {
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

  const durante = (nodo: Konva.Node) => {
    const tr = trascinamento.current;
    if (!tr) return;
    // Il componente "salta" da un incrocio di griglia all'altro.
    const agganciato = agganciaPunto(nodo.position());
    nodo.position(agganciato);
    onCambiaSchema(spostaSelezione(tr.schemaIniziale, tr.selezione, agganciato.x - tr.da.x, agganciato.y - tr.da.y));
  };

  const fineTrascinamento = (nodo: Konva.Node) => {
    durante(nodo);
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

  const griglia = lineeGriglia(vista, larghezza, altezza);
  const selezionati = new Set(selezione);
  const rett = rettangolo ? rettangoloTra(rettangolo.inizio, rettangolo.fine) : null;
  const cursore = spostandoVista ? "grabbing" : spazioPremuto ? "grab" : voceDaPosare ? "copy" : "default";
  const posAnteprima =
    voceDaPosare && anteprima ? componenteDaVoce(schema, voceDaPosare, anteprima) : null;

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
                      etichetta={c.etichetta}
                      immagine={immagine(c.tipo)}
                      scelto={scelto}
                      colori={colori}
                    />
                  </Group>
                );
              })}
              {posAnteprima && voceDaPosare && (
                <Group x={posAnteprima.x} y={posAnteprima.y} opacity={0.45} listening={false}>
                  <SimboloComponente
                    larghezza={posAnteprima.larghezza}
                    altezza={posAnteprima.altezza}
                    etichetta={posAnteprima.etichetta}
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
        <span className="suggerimento">{t("editor.suggerimento")}</span>
      </div>
    </div>
  );
}

interface PropsSimbolo {
  larghezza: number;
  altezza: number;
  etichetta: string;
  /** Icona della libreria; se manca si disegna un semplice riquadro. */
  immagine: HTMLImageElement | undefined;
  scelto: boolean;
  colori: ReturnType<typeof coloriEditor>;
}

/** Disegno di un componente: simbolo, sigla a sinistra e contorno di selezione. */
function SimboloComponente({ larghezza, altezza, etichetta, immagine, scelto, colori }: PropsSimbolo) {
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
          fill={colori.testo}
          listening={false}
        />
      )}
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
