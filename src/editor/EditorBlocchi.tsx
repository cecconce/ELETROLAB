// Editor a blocchi (Blockly) del modulo Arduino.
// Blockly viene caricato solo quando lo studente apre la modalità Blocchi.
// Ad ogni modifica il programma a blocchi viene salvato (JSON) e il codice
// Arduino rigenerato; durante la simulazione i blocchi non si modificano.
// Le immagini di Blockly sono nella cartella dell'app (public/blockly): nessuna
// connessione a Internet.
import { useEffect, useRef, useState } from "react";
import type * as BlocklyTipo from "blockly/core";
import { t } from "../testi";
import { BLOCCHI_INIZIALI, caricaBlockly, CASSETTA, codiceDaBlocchi } from "./blocchi";

export interface PropsEditorBlocchi {
  /** Programma a blocchi salvato (JSON), o undefined per partire dal Blink. */
  blocchi: string | undefined;
  inSimulazione: boolean;
  /** Nuovo programma a blocchi e codice generato; `definitivo` = un passo di Annulla. */
  onCambia: (blocchi: string, codice: string, definitivo: boolean) => void;
}

/** Attesa dopo l'ultima modifica prima di registrare un passo di Annulla. */
const ATTESA_PASSO_MS = 600;

export function EditorBlocchi({ blocchi, inSimulazione, onCambia }: PropsEditorBlocchi) {
  const contenitore = useRef<HTMLDivElement>(null);
  const ws = useRef<BlocklyTipo.WorkspaceSvg | null>(null);
  const ultimo = useRef<string | undefined>(blocchi);
  const onCambiaRif = useRef(onCambia);
  onCambiaRif.current = onCambia;
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    let annullato = false;
    let timer = 0;
    let ridimensiona: ResizeObserver | null = null;
    caricaBlockly()
      .then((Blockly) => {
        if (annullato || !contenitore.current) return;
        const area = Blockly.inject(contenitore.current, {
          toolbox: CASSETTA,
          media: "blockly/",
          sounds: false,
          trashcan: true,
          zoom: { controls: true, wheel: true, startScale: 0.9 },
          grid: { spacing: 20, length: 3, colour: "#d0d0d0", snap: true },
          move: { scrollbars: true, drag: true, wheel: false },
        });
        ws.current = area;
        try {
          Blockly.serialization.workspaces.load(blocchi ? JSON.parse(blocchi) : BLOCCHI_INIZIALI, area);
        } catch {
          Blockly.serialization.workspaces.load(BLOCCHI_INIZIALI, area);
        }
        const salva = (definitivo: boolean) => {
          const json = JSON.stringify(Blockly.serialization.workspaces.save(area));
          if (json === ultimo.current && !definitivo) return;
          ultimo.current = json;
          onCambiaRif.current(json, codiceDaBlocchi(Blockly, area), definitivo);
        };
        // Il primo salvataggio dà subito il codice del programma iniziale.
        if (!blocchi) salva(true);
        area.addChangeListener((evento) => {
          if (evento.isUiEvent) return;
          salva(false);
          window.clearTimeout(timer);
          timer = window.setTimeout(() => salva(true), ATTESA_PASSO_MS);
        });
        ridimensiona = new ResizeObserver(() => Blockly.svgResize(area));
        ridimensiona.observe(contenitore.current);
      })
      .catch((e) => setErrore(String((e as Error).message ?? e)));
    return () => {
      annullato = true;
      window.clearTimeout(timer);
      ridimensiona?.disconnect();
      ws.current?.dispose();
      ws.current = null;
    };
    // L'area di lavoro si crea una volta sola: le modifiche arrivano da Blockly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="editor-blocchi">
      {errore && <p className="codice-errore">{t("arduino.blocchi.errore", { motivo: errore })}</p>}
      <div ref={contenitore} className="area-blocchi" data-testid="area-blocchi" />
      {inSimulazione && <div className="blocchi-bloccati" title={t("arduino.blocchi.bloccati")} />}
    </div>
  );
}
