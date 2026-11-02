// Finestra dell'oscilloscopio a due canali (durante la simulazione del modulo
// Elettronica). Schermo con 10 divisioni orizzontali e 8 verticali; si
// scelgono la base dei tempi (tempo per divisione) e i volt per divisione di
// ciascun canale. La traccia parte quando il canale A sale attraverso il suo
// valore medio (trigger sul fronte di salita), così un segnale periodico sta
// fermo sullo schermo come su uno strumento vero. "Blocca" congela l'immagine.
import { useEffect, useRef, useState } from "react";
import { scriviValore, type SessioneElettronica } from "../motori/elettronica";
import { t } from "../testi";

const BASI_TEMPI = [1e-6, 2e-6, 5e-6, 1e-5, 2e-5, 5e-5, 1e-4, 2e-4, 5e-4, 1e-3, 2e-3, 5e-3, 1e-2, 2e-2, 5e-2, 0.1, 0.2, 0.5, 1];
const VOLT_DIV = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50];
const DIV_X = 10;
const DIV_Y = 8;
const COLORE_A = "#f59e0b";
const COLORE_B = "#22d3ee";

export interface StatoSchermo {
  baseTempi: number;
  voltA: number;
  voltB: number;
}

/**
 * Sceglie il tratto di storia da mostrare: finestra di 10 divisioni che
 * termina il più tardi possibile e inizia su un fronte di salita del canale A
 * (attraverso il suo valore medio). Senza fronti: le ultime 10 divisioni.
 */
export function finestraTraccia(storia: { t: number[]; a: number[] }, durata: number): { inizio: number; da: number } {
  const n = storia.t.length;
  if (n === 0) return { inizio: 0, da: 0 };
  const fine = storia.t[n - 1];
  let min = Infinity;
  let max = -Infinity;
  // Valore medio del canale A negli ultimi campioni (per il livello del trigger).
  let da = n - 1;
  while (da > 0 && storia.t[da] > fine - 4 * durata) da--;
  for (let k = da; k < n; k++) {
    min = Math.min(min, storia.a[k]);
    max = Math.max(max, storia.a[k]);
  }
  const livello = (min + max) / 2;
  if (max - min > 1e-6) {
    for (let k = n - 1; k > da; k--) {
      if (storia.t[k] > fine - durata) continue; // la finestra deve stare tutta nella storia
      if (storia.a[k - 1] < livello && storia.a[k] >= livello) {
        return { inizio: storia.t[k], da: k };
      }
    }
  }
  const inizio = Math.max(storia.t[0], fine - durata);
  let i = n - 1;
  while (i > 0 && storia.t[i - 1] >= inizio) i--;
  return { inizio, da: i };
}

function disegna(canvas: HTMLCanvasElement, storia: { t: number[]; a: number[]; b: number[] }, schermo: StatoSchermo): { ppa: number; ppb: number } {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  if (!ctx) return { ppa: 0, ppb: 0 };
  ctx.fillStyle = "#0b1a14";
  ctx.fillRect(0, 0, w, h);
  // Reticolo
  ctx.strokeStyle = "rgba(120, 200, 160, 0.25)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= DIV_X; i++) {
    ctx.beginPath();
    ctx.moveTo((i * w) / DIV_X + 0.5, 0);
    ctx.lineTo((i * w) / DIV_X + 0.5, h);
    ctx.stroke();
  }
  for (let j = 0; j <= DIV_Y; j++) {
    ctx.beginPath();
    ctx.moveTo(0, (j * h) / DIV_Y + 0.5);
    ctx.lineTo(w, (j * h) / DIV_Y + 0.5);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(120, 200, 160, 0.5)";
  ctx.beginPath();
  ctx.moveTo(0, h / 2 + 0.5);
  ctx.lineTo(w, h / 2 + 0.5);
  ctx.moveTo(w / 2 + 0.5, 0);
  ctx.lineTo(w / 2 + 0.5, h);
  ctx.stroke();
  const durata = schermo.baseTempi * DIV_X;
  const { inizio, da } = finestraTraccia(storia, durata);
  let pp = { ppa: 0, ppb: 0 };
  for (const [canale, colore, vdiv] of [
    ["a", COLORE_A, schermo.voltA],
    ["b", COLORE_B, schermo.voltB],
  ] as const) {
    const valori = storia[canale];
    ctx.strokeStyle = colore;
    ctx.lineWidth = 2;
    ctx.beginPath();
    let min = Infinity;
    let max = -Infinity;
    let primo = true;
    for (let k = da; k < storia.t.length; k++) {
      const dt = storia.t[k] - inizio;
      if (dt > durata) break;
      const v = valori[k];
      min = Math.min(min, v);
      max = Math.max(max, v);
      const x = (dt / durata) * w;
      const y = h / 2 - (v / vdiv) * (h / DIV_Y);
      const yy = Math.max(-2, Math.min(h + 2, y));
      if (primo) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
      primo = false;
    }
    ctx.stroke();
    const ampiezza = Number.isFinite(max - min) ? max - min : 0;
    pp = canale === "a" ? { ...pp, ppa: ampiezza } : { ...pp, ppb: ampiezza };
  }
  return pp;
}

export function PannelloOscilloscopio({ sessione, id, sigla, indice = 0 }: { sessione: React.MutableRefObject<SessioneElettronica | null>; id: string; sigla: string; indice?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [schermo, setSchermo] = useState<StatoSchermo>({ baseTempi: 5e-4, voltA: 1, voltB: 1 });
  const [bloccato, setBloccato] = useState(false);
  const [aperto, setAperto] = useState(true);
  const [misure, setMisure] = useState({ ppa: 0, ppb: 0 });
  const schermoRif = useRef(schermo);
  schermoRif.current = schermo;

  useEffect(() => {
    if (bloccato || !aperto) return;
    const ridisegna = () => {
      const s = sessione.current;
      const storia = s?.oscilloscopi[id];
      if (!canvas.current || !storia) return;
      const m = disegna(canvas.current, storia, schermoRif.current);
      setMisure((x) => (Math.abs(x.ppa - m.ppa) > 1e-6 || Math.abs(x.ppb - m.ppb) > 1e-6 ? m : x));
    };
    ridisegna();
    const timer = window.setInterval(ridisegna, 100);
    return () => window.clearInterval(timer);
  }, [sessione, id, bloccato, aperto, schermo]);

  const scelta = (etichetta: string, valori: number[], valore: number, unita: string, onCambia: (v: number) => void, colore?: string) => (
    <label className="osc-scelta" style={colore ? { borderColor: colore } : undefined}>
      <span>{etichetta}</span>
      <select value={valore} onChange={(e) => onCambia(Number(e.target.value))}>
        {valori.map((v) => (
          <option key={v} value={v}>
            {scriviValore(v, unita)}
            {t("elettronica.oscilloscopio.perDivisione")}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <section className="pannello-oscilloscopio" style={{ top: 8 + indice * 44, right: 8 + indice * 24 }} aria-label={t("elettronica.oscilloscopio.titolo", { sigla })} data-testid={`oscilloscopio-${sigla}`}>
      <header>
        <strong>📈 {t("elettronica.oscilloscopio.titolo", { sigla })}</strong>
        {aperto && (
          <span className="osc-misure">
            {t("elettronica.oscilloscopio.misure", { ppa: scriviValore(misure.ppa, "V"), ppb: scriviValore(misure.ppb, "V") })}
          </span>
        )}
        <button type="button" className="pulsante piccolo" onClick={() => setAperto((a) => !a)}>
          {aperto ? t("elettronica.oscilloscopio.riduci") : t("elettronica.oscilloscopio.apri")}
        </button>
      </header>
      {aperto && (
        <div className="osc-corpo">
          <canvas ref={canvas} width={360} height={216} className="osc-schermo" />
          <div className="osc-comandi">
            {scelta(t("elettronica.oscilloscopio.baseTempi"), BASI_TEMPI, schermo.baseTempi, "s", (baseTempi) => setSchermo((s) => ({ ...s, baseTempi })))}
            {scelta(t("elettronica.oscilloscopio.canaleA"), VOLT_DIV, schermo.voltA, "V", (voltA) => setSchermo((s) => ({ ...s, voltA })), COLORE_A)}
            {scelta(t("elettronica.oscilloscopio.canaleB"), VOLT_DIV, schermo.voltB, "V", (voltB) => setSchermo((s) => ({ ...s, voltB })), COLORE_B)}
            <button type="button" className="pulsante piccolo" onClick={() => setBloccato((b) => !b)}>
              {bloccato ? t("elettronica.oscilloscopio.riprendi") : t("elettronica.oscilloscopio.ferma")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
