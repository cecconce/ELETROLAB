// Manopola a scatti degli strumenti da banco (oscilloscopio): si gira con un
// clic (a destra del centro avanza, a sinistra torna indietro), con la
// rotellina del mouse o con le frecce della tastiera. L'indice disegnato
// indica la posizione fra il primo e l'ultimo valore (da −135° a +135°),
// come sulle manopole vere con le tacche serigrafate.
import type React from "react";

export interface PropsManopola {
  etichetta: string;
  valori: readonly number[];
  valore: number;
  /** Testo di un valore (es. "1 V/div"). */
  scrivi: (v: number) => string;
  onCambia: (v: number) => void;
  /** Colore dell'anello (giallo canale 1, azzurro canale 2…). */
  colore?: string;
  dimensione?: number;
}

export function Manopola({ etichetta, valori, valore, scrivi, onCambia, colore = "#9aa2a8", dimensione = 54 }: PropsManopola) {
  const indice = Math.max(0, valori.indexOf(valore));
  const passo = (d: number) => {
    const i = Math.min(valori.length - 1, Math.max(0, indice + d));
    if (i !== indice) onCambia(valori[i]);
  };
  const angolo = valori.length > 1 ? -135 + (270 * indice) / (valori.length - 1) : 0;
  const c = 30;
  const tacche = valori.map((_, i) => {
    const a = (((valori.length > 1 ? -135 + (270 * i) / (valori.length - 1) : 0) - 90) * Math.PI) / 180;
    return <line key={i} x1={c + Math.cos(a) * 25} y1={c + Math.sin(a) * 25} x2={c + Math.cos(a) * 28} y2={c + Math.sin(a) * 28} stroke={i === indice ? colore : "#c8cdd2"} strokeWidth={i === indice ? 2.2 : 1.2} />;
  });
  const clic = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    passo(e.clientX - r.left < r.width / 2 ? -1 : 1);
  };
  return (
    <div className="manopola">
      <span className="manopola-etichetta">{etichetta}</span>
      <svg
        width={dimensione}
        height={dimensione}
        viewBox="0 0 60 60"
        role="slider"
        tabIndex={0}
        aria-label={etichetta}
        aria-valuemin={0}
        aria-valuemax={valori.length - 1}
        aria-valuenow={indice}
        aria-valuetext={scrivi(valore)}
        onClick={clic}
        onWheel={(e) => passo(e.deltaY < 0 ? 1 : -1)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") passo(1);
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") passo(-1);
        }}
      >
        <defs>
          <radialGradient id="manopola-corpo" cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor="#7b858d" />
            <stop offset="0.6" stopColor="#30373c" />
            <stop offset="1" stopColor="#15181b" />
          </radialGradient>
        </defs>
        {tacche}
        <circle cx={c} cy={c} r={21} fill={colore} />
        <circle cx={c} cy={c} r={18.5} fill="url(#manopola-corpo)" />
        {Array.from({ length: 18 }, (_, i) => {
          const a = (i * 20 * Math.PI) / 180;
          return <line key={i} x1={c + Math.cos(a) * 16} y1={c + Math.sin(a) * 16} x2={c + Math.cos(a) * 18.5} y2={c + Math.sin(a) * 18.5} stroke="#0d0f11" strokeWidth={1.2} />;
        })}
        <g transform={`rotate(${angolo} ${c} ${c})`}>
          <line x1={c} y1={c - 4} x2={c} y2={c - 15} stroke="#ffffff" strokeWidth={2.6} strokeLinecap="round" />
        </g>
      </svg>
      <span className="manopola-valore">{scrivi(valore)}</span>
    </div>
  );
}
