// Oscilloscopio del banco Arduino ingrandito (doppio clic sullo strumento
// durante la simulazione). Lo schermo sul banco è piccolo (100 × 80 pixel):
// qui la stessa traccia si disegna grande, con il reticolo di 10 × 8
// divisioni, i valori massimo e minimo della tensione sullo schermo e i tasti
// per cambiare tempo/divisione e volt/divisione senza fermare la simulazione.
// "Blocca" congela l'immagine per guardarla con calma, come su uno strumento vero.
import { useEffect, useRef, useState, type MutableRefObject, type ReactElement } from "react";
import {
  DIVISIONI_X,
  DIVISIONI_Y,
  TEMPI_DIVISIONE,
  VOLT_DIVISIONE,
  testoScala,
  tracciaOscilloscopio,
  type CampioneOscilloscopio,
  type SessioneArduino,
} from "../motori/arduino";
import { t } from "../testi";

/** Misure dello schermo grande (unità del disegno SVG, che si adatta alla finestra). */
const L = 800;
const H = 640;

export interface PropsOscilloscopioIngrandito {
  id: string;
  sigla: string;
  /** Scale scelte nelle Proprietà dello strumento: sono quelle di partenza. */
  tempoDiv: number;
  voltDiv: number;
  sessione: MutableRefObject<SessioneArduino | null>;
  onChiudi: () => void;
}

/**
 * Tensione massima e minima sullo schermo (ultime 10 divisioni). Nei tratti in
 * PWM contano i livelli alto e basso dell'onda quadra, non il valore medio.
 */
export function estremiTraccia(campioni: readonly CampioneOscilloscopio[], oraUs: number, tempoDiv: number): { max: number; min: number } | null {
  const inizio = oraUs - tempoDiv * DIVISIONI_X * 1e6;
  let max = -Infinity;
  let min = Infinity;
  for (let i = 0; i < campioni.length; i++) {
    const c = campioni[i];
    const fine = i + 1 < campioni.length ? campioni[i + 1].t : oraUs;
    if (fine < inizio) continue; // campione finito prima della finestra
    const alto = c.pwm && c.pwm.duty > 0 && c.pwm.duty < 1 ? c.pwm.alto : c.v;
    const basso = c.pwm && c.pwm.duty > 0 && c.pwm.duty < 1 ? c.pwm.basso : c.v;
    max = Math.max(max, alto);
    min = Math.min(min, basso);
  }
  return max === -Infinity ? null : { max, min };
}

/** Valore successivo (o precedente) in un elenco di scale, fermo agli estremi. */
function scalaVicina(elenco: readonly number[], ora: number, passo: 1 | -1): number {
  const i = elenco.findIndex((v) => Math.abs(v - ora) < 1e-9);
  return elenco[Math.min(elenco.length - 1, Math.max(0, (i < 0 ? 0 : i) + passo))];
}

/** Tensione con due decimali e la virgola («4,98 V»); niente «−0,00» per i valori quasi nulli. */
export const scriviVolt = (v: number) => `${(Math.abs(v) < 0.005 ? 0 : v).toFixed(2).replace(".", ",")} V`;

export function OscilloscopioIngrandito(props: PropsOscilloscopioIngrandito) {
  const { id, sigla, sessione, onChiudi } = props;
  const [tempoDiv, setTempoDiv] = useState(props.tempoDiv);
  const [voltDiv, setVoltDiv] = useState(props.voltDiv);
  const [bloccato, setBloccato] = useState(false);
  // Fotografia dei campioni: si aggiorna 10 volte al secondo (se non bloccato).
  const fotografa = () => {
    const s = sessione.current;
    return { campioni: [...(s?.campioni[id] ?? [])], ora: s?.esecutore?.tempoUs ?? 0 };
  };
  const [foto, setFoto] = useState<{ campioni: CampioneOscilloscopio[]; ora: number }>(fotografa);
  const pulsanteChiudi = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (bloccato) return;
    const timer = window.setInterval(() => sessione.current && setFoto(fotografa()), 100);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bloccato, id, sessione]);

  // Esc chiude, come le altre finestre.
  useEffect(() => {
    pulsanteChiudi.current?.focus({ preventScroll: true });
    const tasto = (e: KeyboardEvent) => {
      if (e.key === "Escape") onChiudi();
    };
    window.addEventListener("keydown", tasto);
    return () => window.removeEventListener("keydown", tasto);
  }, [onChiudi]);

  const punti = tracciaOscilloscopio(foto.campioni, foto.ora, tempoDiv, voltDiv, L, H);
  const estremi = estremiTraccia(foto.campioni, foto.ora, tempoDiv);
  const linee: ReactElement[] = [];
  for (let i = 0; i <= DIVISIONI_X; i++) {
    const x = (i * L) / DIVISIONI_X;
    linee.push(<line key={`x${i}`} x1={x} y1={0} x2={x} y2={H} className={i === DIVISIONI_X / 2 ? "asse" : ""} />);
  }
  for (let j = 0; j <= DIVISIONI_Y; j++) {
    const y = (j * H) / DIVISIONI_Y;
    linee.push(<line key={`y${j}`} x1={0} y1={y} x2={L} y2={y} className={j === DIVISIONI_Y / 2 ? "asse" : ""} />);
  }

  return (
    <div className="sfondo-finestra" onClick={onChiudi}>
      <div
        className="finestra finestra-oscilloscopio-grande"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titolo-oscilloscopio-grande"
        data-testid={`oscilloscopio-grande-${sigla}`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="titolo-oscilloscopio-grande">{t("arduino.oscilloscopio.titolo", { sigla })}</h2>
        <svg className="schermo-oscilloscopio-grande" viewBox={`-2 -2 ${L + 4} ${H + 4}`} preserveAspectRatio="xMidYMid meet">
          <rect x={-2} y={-2} width={L + 4} height={H + 4} rx={6} className="fondo" />
          <g className="reticolo">{linee}</g>
          {punti.length >= 4 && <polyline className="traccia" points={punti.join(" ")} />}
          <text x={10} y={H - 12} className="scritta">{`${testoScala(tempoDiv, "s")}/div`}</text>
          <text x={L - 10} y={H - 12} className="scritta" textAnchor="end">{`${testoScala(voltDiv, "V")}/div`}</text>
          {bloccato && (
            <text x={L - 10} y={26} className="scritta bloccato" textAnchor="end">
              {t("arduino.oscilloscopio.bloccato")}
            </text>
          )}
        </svg>
        <div className="comandi-oscilloscopio-grande">
          <span className="misure" data-testid="misure-oscilloscopio">
            {estremi ? t("arduino.oscilloscopio.misure", { max: scriviVolt(estremi.max), min: scriviVolt(estremi.min) }) : t("arduino.oscilloscopio.vuoto")}
          </span>
          <span className="gruppo-scala">
            {t("arduino.oscilloscopio.tempo")}
            <button type="button" onClick={() => setTempoDiv((v) => scalaVicina(TEMPI_DIVISIONE, v, -1))} aria-label={t("arduino.oscilloscopio.tempoMeno")}>−</button>
            <b>{testoScala(tempoDiv, "s")}</b>
            <button type="button" onClick={() => setTempoDiv((v) => scalaVicina(TEMPI_DIVISIONE, v, 1))} aria-label={t("arduino.oscilloscopio.tempoPiu")}>+</button>
          </span>
          <span className="gruppo-scala">
            {t("arduino.oscilloscopio.volt")}
            <button type="button" onClick={() => setVoltDiv((v) => scalaVicina(VOLT_DIVISIONE, v, -1))} aria-label={t("arduino.oscilloscopio.voltMeno")}>−</button>
            <b>{testoScala(voltDiv, "V")}</b>
            <button type="button" onClick={() => setVoltDiv((v) => scalaVicina(VOLT_DIVISIONE, v, 1))} aria-label={t("arduino.oscilloscopio.voltPiu")}>+</button>
          </span>
          <button type="button" onClick={() => setBloccato((b) => !b)}>
            {bloccato ? t("arduino.oscilloscopio.riprendi") : t("arduino.oscilloscopio.blocca")}
          </button>
          <button type="button" ref={pulsanteChiudi} onClick={onChiudi}>
            {t("arduino.oscilloscopio.chiudi")}
          </button>
        </div>
      </div>
    </div>
  );
}
