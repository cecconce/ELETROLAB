// Libreria laterale dei componenti: ricerca per nome, categorie, icone grandi
// e tooltip didattico. Due modi per posare un componente:
// 1. trascinarlo sul foglio (come in molti programmi di disegno);
// 2. cliccarlo e poi cliccare sul foglio (comodo anche su schermi touch e LIM).
import { useMemo, useState } from "react";
import { t } from "../testi";
import type { Tema } from "../interfaccia/tema";
import { ICONE } from "./caricaLibreria";
import { coloriEditor } from "./colori";
import { cercaComponenti, raggruppaPerCategoria, svgComeDataUrl, type Libreria, type VoceLibreria } from "./libreria";

/** Tipo MIME usato nel trascinamento verso l'area di disegno. */
export const MIME_COMPONENTE = "application/x-elettrolab-componente";

export interface PropsLibreriaLaterale {
  libreria: Libreria;
  tema: Tema;
  /** Componente scelto con un clic, in attesa del clic sul foglio. */
  daPosare: string | null;
  onScegli: (id: string | null) => void;
}

interface Suggerimento {
  voce: VoceLibreria;
  x: number;
  y: number;
}

export function LibreriaLaterale({ libreria, tema, daPosare, onScegli }: PropsLibreriaLaterale) {
  const [ricerca, setRicerca] = useState("");
  const [suggerimento, setSuggerimento] = useState<Suggerimento | null>(null);
  const colore = coloriEditor(tema).testo;

  const gruppi = useMemo(
    () => raggruppaPerCategoria(libreria, cercaComponenti(libreria, ricerca)),
    [libreria, ricerca],
  );
  // Le icone colorate per il tema corrente si calcolano una volta sola.
  const immagini = useMemo(
    () => new Map(libreria.componenti.map((v) => [v.id, svgComeDataUrl(ICONE.get(v.icona) ?? "", colore)])),
    [libreria, colore],
  );

  const mostraSuggerimento = (voce: VoceLibreria, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setSuggerimento({ voce, x: r.right + 8, y: r.top });
  };

  return (
    <aside className="libreria" aria-label={t("libreria.titolo")}>
      <h2>{t("libreria.titolo")}</h2>
      <div className="libreria-ricerca">
        <input
          type="search"
          value={ricerca}
          placeholder={t("libreria.cerca")}
          aria-label={t("libreria.cerca")}
          onChange={(e) => setRicerca(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setRicerca("");
          }}
        />
      </div>

      <div className="libreria-elenco">
        {gruppi.length === 0 && <p className="libreria-vuota">{t("libreria.nessunRisultato")}</p>}
        {gruppi.map((g) => (
          <section key={g.categoria.id} className="libreria-categoria">
            <h3>{g.categoria.nome}</h3>
            <div className="libreria-griglia">
              {g.voci.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={"voce-libreria" + (daPosare === v.id ? " scelta" : "")}
                  data-voce={v.id}
                  aria-pressed={daPosare === v.id}
                  aria-label={`${v.nome}. ${v.descrizione}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(MIME_COMPONENTE, v.id);
                    e.dataTransfer.effectAllowed = "copy";
                    setSuggerimento(null);
                  }}
                  onClick={() => onScegli(daPosare === v.id ? null : v.id)}
                  onMouseEnter={(e) => mostraSuggerimento(v, e.currentTarget)}
                  onMouseLeave={() => setSuggerimento(null)}
                  onFocus={(e) => mostraSuggerimento(v, e.currentTarget)}
                  onBlur={() => setSuggerimento(null)}
                >
                  <img src={immagini.get(v.id)} alt="" draggable={false} />
                  <span>{v.nome}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="libreria-aiuto">{daPosare ? t("libreria.aiutoPosa") : t("libreria.aiuto")}</p>

      {suggerimento && (
        <div className="tooltip-libreria" role="tooltip" style={{ left: suggerimento.x, top: suggerimento.y }}>
          <strong>
            {suggerimento.voce.nome}
            {suggerimento.voce.sigla && <span className="sigla"> ({suggerimento.voce.sigla})</span>}
          </strong>
          <p>{suggerimento.voce.descrizione}</p>
        </div>
      )}
    </aside>
  );
}
