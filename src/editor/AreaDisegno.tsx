// Area di disegno comune a tutti i moduli, basata su Konva (react-konva).
// - griglia con aggancio dei componenti
// - zoom con la rotellina centrato sul cursore, pulsanti +/−, 100% e "Adatta"
// - spostamento della vista: trascinare con il tasto centrale o destro del mouse,
//   oppure tenere premuta la barra spaziatrice e trascinare con il sinistro
// - selezione: clic (Maiusc/Ctrl per aggiungere), rettangolo trascinando sul vuoto,
//   Esc per deselezionare
// - trascinamento dei componenti (il gruppo selezionato si muove insieme)
// La logica (calcoli e modifiche allo schema) sta in geometria.ts e schema.ts.
import { useCallback, useEffect, useRef, useState } from "react";
import { Group, Layer, Rect, Shape, Stage, Text } from "react-konva";
import type Konva from "konva";
import { t } from "../testi";
import type { Tema } from "../interfaccia/tema";
import { coloriEditor } from "./colori";
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

export function AreaDisegno({ tema, schema, onCambiaSchema }: PropsAreaDisegno) {
  const colori = coloriEditor(tema);
  const contenitore = useRef<HTMLDivElement>(null);
  const { larghezza, altezza } = useDimensioni(contenitore);

  const [vista, setVista] = useState<Vista>(VISTA_INIZIALE);
  const [selezione, setSelezione] = useState<Selezione>([]);
  const [rettangolo, setRettangolo] = useState<{ inizio: Punto; fine: Punto } | null>(null);
  const [spazioPremuto, setSpazioPremuto] = useState(false);
  const [spostandoVista, setSpostandoVista] = useState(false);

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
      if (e.key === "Escape") setSelezione([]);
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
    // Sinistro sul vuoto: inizia il rettangolo di selezione.
    if (e.evt.button === 0 && e.target === e.target.getStage()) {
      const f = schermoAFoglio(vista, p);
      setRettangolo({ inizio: f, fine: f });
    }
  };

  const suMovimento = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const p = puntatore(e);
    if (!p) return;
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

  const griglia = lineeGriglia(vista, larghezza, altezza);
  const selezionati = new Set(selezione);
  const rett = rettangolo ? rettangoloTra(rettangolo.inizio, rettangolo.fine) : null;
  const cursore = spostandoVista ? "grabbing" : spazioPremuto ? "grab" : "default";

  return (
    <div className="area-disegno">
      <div
        ref={contenitore}
        className="area-disegno-canvas"
        style={{ cursor: cursore, background: colori.foglio }}
        onContextMenu={(e) => e.preventDefault()}
        data-zoom={Math.round(vista.scala * 100)}
        data-selezionati={selezione.join(",")}
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
                    draggable={!spazioPremuto}
                    onMouseDown={(e) => {
                      if (e.evt.button !== 0 || spazioPremuto) return;
                      e.cancelBubble = true; // non far partire il rettangolo di selezione
                      const aggiuntivo = e.evt.shiftKey || e.evt.ctrlKey;
                      if (aggiuntivo) setSelezione((sel) => selezionaConClic(sel, c.id, true));
                      else if (!selezionati.has(c.id)) setSelezione([c.id]);
                    }}
                    onDragStart={(e) => inizioTrascinamento(c.id, e.target)}
                    onDragMove={(e) => durante(e.target)}
                    onDragEnd={(e) => fineTrascinamento(e.target)}
                  >
                    <Rect
                      width={c.larghezza}
                      height={c.altezza}
                      fill={colori.componente}
                      stroke={scelto ? colori.selezione : colori.bordoComponente}
                      strokeWidth={scelto ? 3 : 1.5}
                      cornerRadius={4}
                    />
                    <Text
                      text={c.etichetta}
                      width={c.larghezza}
                      height={c.altezza}
                      align="center"
                      verticalAlign="middle"
                      fontSize={14}
                      fontFamily="Segoe UI, system-ui, sans-serif"
                      fill={colori.testo}
                    />
                  </Group>
                );
              })}
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
