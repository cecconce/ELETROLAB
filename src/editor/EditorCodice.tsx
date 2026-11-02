// Editor del codice Arduino con CodeMirror 6: colori della sintassi C++,
// numeri di riga, parentesi abbinate, rientri automatici, completamento delle
// funzioni Arduino (Ctrl+Spazio o mentre si scrive) e riga dell'errore in
// rosso. CodeMirror si carica solo quando serve (file a parte, l'avvio del
// programma resta leggero); nel frattempo si vede una normale casella di testo.
import { useEffect, useRef, useState } from "react";
import { t } from "../testi";
import { COMPLETAMENTI_ARDUINO } from "./completamentiArduino";

export interface PropsEditorCodice {
  codice: string;
  /** `definitivo` = fine della modifica (uscita dall'editor): un passo di Annulla. */
  onCambia: (codice: string, definitivo: boolean) => void;
  sola: boolean;
  /** Riga (1…) da segnare in rosso, o null. */
  rigaErrore: number | null;
}

async function caricaCodeMirror() {
  const [view, state, commands, language, cpp, autocomplete, highlight] = await Promise.all([
    import("@codemirror/view"),
    import("@codemirror/state"),
    import("@codemirror/commands"),
    import("@codemirror/language"),
    import("@codemirror/lang-cpp"),
    import("@codemirror/autocomplete"),
    import("@lezer/highlight"),
  ]);
  return { view, state, commands, language, cpp, autocomplete, highlight };
}

export function EditorCodice({ codice, onCambia, sola, rigaErrore }: PropsEditorCodice) {
  const contenitore = useRef<HTMLDivElement>(null);
  const vista = useRef<import("@codemirror/view").EditorView | null>(null);
  const api = useRef<{ impostaSola: (s: boolean) => void; impostaErrore: (r: number | null) => void } | null>(null);
  const cambia = useRef(onCambia);
  cambia.current = onCambia;
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    let annullato = false;
    void caricaCodeMirror().then((m) => {
      if (annullato || !contenitore.current) return;
      const { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, Decoration, drawSelection } = m.view;
      const { EditorState, Compartment, StateEffect, StateField } = m.state;
      const { tags } = m.highlight;
      const sola = new Compartment();
      // Riga dell'errore: decorazione aggiornata con un effetto.
      const segnaErrore = StateEffect.define<number | null>();
      const campoErrore = StateField.define({
        create: () => Decoration.none,
        update(dec, tr) {
          for (const e of tr.effects) {
            if (e.is(segnaErrore)) {
              const r = e.value;
              if (r === null || r < 1 || r > tr.state.doc.lines) return Decoration.none;
              const riga = tr.state.doc.line(r);
              return Decoration.set([Decoration.line({ class: "cm-riga-errore" }).range(riga.from)]);
            }
          }
          return dec.map(tr.changes);
        },
        provide: (f) => EditorView.decorations.from(f),
      });
      // Colori chiari sul fondo scuro dell'editor (come gli editor di codice più usati).
      const colori = m.language.HighlightStyle.define([
        { tag: [tags.keyword, tags.controlKeyword, tags.modifier], color: "#fb923c", fontWeight: "bold" },
        { tag: [tags.typeName, tags.standard(tags.typeName)], color: "#22d3ee", fontWeight: "bold" },
        { tag: [tags.number, tags.bool, tags.null], color: "#c4b5fd" },
        { tag: [tags.string, tags.character], color: "#86efac" },
        { tag: [tags.comment, tags.lineComment, tags.blockComment], color: "#8a94a3", fontStyle: "italic" },
        { tag: [tags.processingInstruction, tags.macroName], color: "#f472b6" },
        { tag: tags.function(tags.variableName), color: "#93c5fd" },
      ]);
      const parole = COMPLETAMENTI_ARDUINO.map((c) => ({ label: c.label, type: c.tipo, info: c.info, apply: c.apply }));
      const completamento = m.autocomplete.autocompletion({
        override: [
          (ctx) => {
            const parola = ctx.matchBefore(/[#\w.]+/);
            if (!parola || (parola.from === parola.to && !ctx.explicit)) return null;
            return { from: parola.from, options: parole, validFor: /^[#\w.]*$/ };
          },
        ],
      });
      const v = new EditorView({
        parent: contenitore.current,
        state: EditorState.create({
          doc: codice,
          extensions: [
            lineNumbers(),
            // Le righe lunghe vanno a capo: niente barra orizzontale nel pannello stretto.
            EditorView.lineWrapping,
            highlightActiveLineGutter(),
            highlightActiveLine(),
            drawSelection(),
            m.commands.history(),
            m.language.indentOnInput(),
            m.language.bracketMatching(),
            m.autocomplete.closeBrackets(),
            completamento,
            m.cpp.cpp(),
            m.language.syntaxHighlighting(colori),
            EditorState.tabSize.of(2),
            m.language.indentUnit.of("  "),
            keymap.of([...m.autocomplete.closeBracketsKeymap, ...m.autocomplete.completionKeymap, ...m.commands.defaultKeymap, ...m.commands.historyKeymap, m.commands.indentWithTab]),
            sola.of([EditorState.readOnly.of(false), EditorView.editable.of(true)]),
            campoErrore,
            EditorView.updateListener.of((u) => {
              if (u.docChanged) cambia.current(u.state.doc.toString(), false);
            }),
            EditorView.domEventHandlers({
              blur: (_e, view) => {
                cambia.current(view.state.doc.toString(), true);
              },
            }),
            EditorView.contentAttributes.of({ "aria-label": t("arduino.codice.titolo"), spellcheck: "false" }),
          ],
        }),
      });
      vista.current = v;
      api.current = {
        impostaSola: (s) => v.dispatch({ effects: sola.reconfigure([EditorState.readOnly.of(s), EditorView.editable.of(!s)]) }),
        // La riga dell'errore viene anche portata in vista.
        impostaErrore: (r) =>
          v.dispatch({
            effects: r !== null && r >= 1 && r <= v.state.doc.lines ? [segnaErrore.of(r), EditorView.scrollIntoView(v.state.doc.line(r).from, { y: "center" })] : [segnaErrore.of(r)],
          }),
      };
      setPronto(true);
    });
    return () => {
      annullato = true;
      vista.current?.destroy();
      vista.current = null;
      api.current = null;
    };
    // L'editor si crea una volta sola: il testo poi si aggiorna qui sotto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Testo cambiato da fuori (Annulla, blocchi, apertura di un file): si sostituisce.
  useEffect(() => {
    const v = vista.current;
    if (v && v.state.doc.toString() !== codice) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: codice } });
  }, [codice, pronto]);
  useEffect(() => api.current?.impostaSola(sola), [sola, pronto]);
  useEffect(() => api.current?.impostaErrore(rigaErrore), [rigaErrore, pronto]);

  return (
    <div className="editor-codice" data-pronto={pronto}>
      <div ref={contenitore} className="editor-codemirror" />
      {!pronto && (
        <textarea
          className="codice-testo"
          value={codice}
          readOnly={sola}
          spellCheck={false}
          aria-label={t("arduino.codice.titolo")}
          onChange={(e) => onCambia(e.target.value, false)}
          onBlur={(e) => onCambia(e.target.value, true)}
        />
      )}
    </div>
  );
}
