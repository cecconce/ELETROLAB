// Grafico del plotter seriale: le serie di numeri scritte dal programma,
// disegnate nel tempo (gli ultimi 200 campioni), con la scala verticale
// automatica, le tacche e la legenda con il valore attuale di ogni serie.
import { useMemo } from "react";
import { t } from "../testi";
import { CAMPIONI_PLOTTER, datiPlotter, scalaPlotter } from "./letturaPlotter";

/** Colori delle serie (ben distinguibili anche sul tema scuro). */
const COLORI = ["#1e88e5", "#e53935", "#43a047", "#fb8c00", "#8e24aa", "#00acc1"];

// Area del grafico in unità SVG; il grafico si allarga con il pannello.
const L = 400;
const H = 150;
const SINISTRA = 0;
const BASSO = 4;

const scrivi = (v: number) => String(Math.round(v * 1000) / 1000).replace(".", ",");

export function PlotterSeriale({ seriale }: { seriale: string }) {
  const dati = useMemo(() => datiPlotter(seriale), [seriale]);
  if (dati.serie.length === 0) {
    return <div className="plotter-vuoto">{t("arduino.plotter.vuoto")}</div>;
  }
  const scala = scalaPlotter(dati.minimo, dati.massimo);
  const y = (v: number) => BASSO + (H - 2 * BASSO) * (1 - (v - scala.da) / (scala.a - scala.da));
  const x = (i: number) => SINISTRA + ((L - SINISTRA - 4) * i) / (CAMPIONI_PLOTTER - 1);
  const tacche: number[] = [];
  for (let v = scala.da; v <= scala.a + scala.passo / 1000; v += scala.passo) tacche.push(Math.round(v * 1e9) / 1e9);
  return (
    <div className="plotter-seriale" data-testid="plotter-seriale">
      <div className="plotter-area">
        {/* Valori delle tacche in HTML (in un SVG stirato le scritte si deformerebbero). */}
        <div className="plotter-asse" aria-hidden="true">
          {tacche.map((v) => (
            <span key={v} style={{ top: `${(y(v) / H) * 100}%` }}>
              {scrivi(v)}
            </span>
          ))}
        </div>
        <svg viewBox={`0 0 ${L} ${H}`} preserveAspectRatio="none" role="img" aria-label={t("arduino.plotter.titolo")}>
          {tacche.map((v) => (
            <line key={v} x1={SINISTRA} x2={L} y1={y(v)} y2={y(v)} className="plotter-griglia" vectorEffect="non-scaling-stroke" />
          ))}
          {dati.serie.map((s, k) => {
            // Una linea spezzata nei "buchi" (righe in cui la serie manca).
            const tratti: string[] = [];
            let tratto = "";
            s.valori.forEach((v, i) => {
              if (v === null) {
                if (tratto) tratti.push(tratto);
                tratto = "";
              } else tratto += `${tratto ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
            });
            if (tratto) tratti.push(tratto);
            return <path key={s.nome} d={tratti.join("")} fill="none" stroke={COLORI[k % COLORI.length]} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />;
          })}
        </svg>
      </div>
      <ul className="plotter-legenda">
        {dati.serie.map((s, k) => {
          const ultimo = [...s.valori].reverse().find((v) => v !== null);
          return (
            <li key={s.nome}>
              <span className="plotter-colore" style={{ background: COLORI[k % COLORI.length] }} />
              {s.nome}: <b>{ultimo === undefined || ultimo === null ? "–" : scrivi(ultimo)}</b>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
