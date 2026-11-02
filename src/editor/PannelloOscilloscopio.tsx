// Finestra dell'oscilloscopio a due canali (durante la simulazione del modulo
// Elettronica). Schermo con 10 divisioni orizzontali e 8 verticali; si
// scelgono la base dei tempi (tempo per divisione) e i volt per divisione di
// ciascun canale. La traccia parte quando il canale A sale attraverso il suo
// valore medio (trigger sul fronte di salita), così un segnale periodico sta
// fermo sullo schermo come su uno strumento vero. "Blocca" congela l'immagine.
import { useEffect, useRef, useState } from "react";
import { registrazionePer, scriviValore, type SessioneElettronica, type Storia } from "../motori/elettronica";
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

/**
 * Regolazione automatica (come il tasto AUTOSET degli oscilloscopi veri):
 * - volt/divisione: il più piccolo che fa stare il segnale in 3,6 divisioni
 *   sopra o sotto il centro (segnali quasi nulli: si lascia com'era);
 * - base dei tempi: se il canale A è periodico, circa due periodi e mezzo
 *   sullo schermo; se varia lentamente (carica di un condensatore) 1 s/div.
 */
export function regolazioneAutomatica(storia: Storia, attuale: StatoSchermo): StatoSchermo {
  const scala = (valori: number[], prima: number) => {
    const massimo = valori.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    if (massimo < 0.05) return prima;
    return VOLT_DIV.find((v) => massimo <= 3.6 * v) ?? VOLT_DIV[VOLT_DIV.length - 1];
  };
  const lenta = storia.lenta;
  // Fronti di salita del canale A attraverso il suo valore medio (registrazione fine).
  const a = storia.canali[0];
  let min = Infinity;
  let max = -Infinity;
  for (const v of a) {
    min = Math.min(min, v);
    max = Math.max(max, v);
  }
  const livelloA = (min + max) / 2;
  const fronti: number[] = [];
  if (max - min > 1e-3) for (let k = 1; k < a.length; k++) if (a[k - 1] < livelloA && a[k] >= livelloA) fronti.push(storia.t[k]);
  let baseTempi = attuale.baseTempi;
  if (fronti.length >= 3) {
    const periodo = (fronti[fronti.length - 1] - fronti[0]) / (fronti.length - 1);
    baseTempi = BASI_TEMPI.find((b) => b * DIV_X >= 2.5 * periodo) ?? BASI_TEMPI[BASI_TEMPI.length - 1];
  } else {
    // Non periodico: se nella registrazione lenta il segnale cambia, base lunga.
    const la = lenta.canali[0];
    const varia = la.length > 1 && Math.max(...la) - Math.min(...la) > 0.05;
    if (varia) baseTempi = 1;
  }
  return { baseTempi, voltA: scala(lenta.canali[0], attuale.voltA), voltB: scala(lenta.canali[1], attuale.voltB) };
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


/**
 * Finestra spostabile trascinando l'intestazione (come gli strumenti da
 * banco: si mettono dove non coprono il circuito). Restituisce lo stile da
 * dare alla finestra e il gestore da mettere sull'intestazione.
 */
function useSpostabile(indice: number) {
  const [spostamento, setSpostamento] = useState({ x: 0, y: 0 });
  const inizio = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const suGiu = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, select")) return;
    e.preventDefault();
    inizio.current = { x: e.clientX, y: e.clientY, dx: spostamento.x, dy: spostamento.y };
    const muovi = (ev: MouseEvent) => {
      const i = inizio.current;
      if (i) setSpostamento({ x: i.dx + ev.clientX - i.x, y: Math.max(-8 - indice * 44, i.dy + ev.clientY - i.y) });
    };
    const su = () => {
      inizio.current = null;
      window.removeEventListener("mousemove", muovi);
      window.removeEventListener("mouseup", su);
    };
    window.addEventListener("mousemove", muovi);
    window.addEventListener("mouseup", su);
  };
  const stile = { top: 8 + indice * 44 + spostamento.y, right: 8 + indice * 24 - spostamento.x };
  return { stile, suGiu };
}

export function PannelloOscilloscopio({ sessione, id, sigla, indice = 0 }: { sessione: React.MutableRefObject<SessioneElettronica | null>; id: string; sigla: string; indice?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [schermo, setSchermo] = useState<StatoSchermo>({ baseTempi: 5e-4, voltA: 1, voltB: 1 });
  const { stile, suGiu } = useSpostabile(indice);
  const [bloccato, setBloccato] = useState(false);
  const [aperto, setAperto] = useState(true);
  const [misure, setMisure] = useState({ ppa: 0, ppb: 0 });
  const schermoRif = useRef(schermo);
  schermoRif.current = schermo;

  const auto = () => {
    const storia = sessione.current?.oscilloscopi[id];
    if (storia) setSchermo((attuale) => regolazioneAutomatica(storia, attuale));
  };
  // Poco dopo l'avvio la regolazione automatica parte da sola, così il segnale si vede subito.
  useEffect(() => {
    const timer = window.setTimeout(auto, 700);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (bloccato || !aperto) return;
    const ridisegna = () => {
      const s = sessione.current;
      const completa = s?.oscilloscopi[id];
      if (!canvas.current || !completa) return;
      const r = registrazionePer(completa, schermoRif.current.baseTempi * DIV_X);
      const m = disegna(canvas.current, { t: r.t, a: r.canali[0], b: r.canali[1] }, schermoRif.current);
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
    <section className="pannello-oscilloscopio" style={stile} aria-label={t("elettronica.oscilloscopio.titolo", { sigla })} data-testid={`oscilloscopio-${sigla}`}>
      <header onMouseDown={suGiu} title={t("elettronica.oscilloscopio.sposta")}>
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
            <button type="button" className="pulsante piccolo" onClick={auto} title={t("elettronica.oscilloscopio.autoSuggerimento")}>
              {t("elettronica.oscilloscopio.auto")}
            </button>
            <button type="button" className="pulsante piccolo" onClick={() => setBloccato((b) => !b)}>
              {bloccato ? t("elettronica.oscilloscopio.riprendi") : t("elettronica.oscilloscopio.ferma")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

const COLORI_CANALI = ["#f59e0b", "#22d3ee", "#a3e635", "#f472b6"];

/**
 * Finestra dell'analizzatore logico: quattro tracce (D0…D3), una sotto
 * l'altra, con il livello 0 in basso e 1 in alto. Mostra le ultime 10
 * divisioni della base dei tempi scelta.
 */
export function PannelloAnalizzatore({ sessione, id, sigla, indice = 0 }: { sessione: React.MutableRefObject<SessioneElettronica | null>; id: string; sigla: string; indice?: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // Predefinita lenta: gli esempi didattici usano clock di pochi hertz.
  const [baseTempi, setBaseTempi] = useState(0.5);
  const { stile, suGiu } = useSpostabile(indice);
  const [aperto, setAperto] = useState(true);
  const [bloccato, setBloccato] = useState(false);
  useEffect(() => {
    if (!aperto || bloccato) return;
    const ridisegna = () => {
      const completa = sessione.current?.analizzatori[id];
      const cv = canvas.current;
      const ctx = cv?.getContext("2d");
      if (!cv || !ctx || !completa) return;
      const storia = registrazionePer(completa, baseTempi * DIV_X);
      const w = cv.width;
      const h = cv.height;
      ctx.fillStyle = "#0b1a14";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(120, 200, 160, 0.2)";
      ctx.lineWidth = 1;
      for (let i = 0; i <= DIV_X; i++) {
        ctx.beginPath();
        ctx.moveTo((i * w) / DIV_X + 0.5, 0);
        ctx.lineTo((i * w) / DIV_X + 0.5, h);
        ctx.stroke();
      }
      const n = storia.t.length;
      if (n === 0) return;
      const durata = baseTempi * DIV_X;
      const fine = storia.t[n - 1];
      const inizio = Math.max(0, fine - durata);
      const fascia = h / 4;
      storia.canali.forEach((valori, k) => {
        const alto = k * fascia + fascia * 0.2;
        const basso = (k + 1) * fascia - fascia * 0.2;
        ctx.fillStyle = COLORI_CANALI[k];
        ctx.font = "12px Segoe UI, sans-serif";
        ctx.fillText(`D${k}`, 4, alto + 12);
        ctx.strokeStyle = COLORI_CANALI[k];
        ctx.lineWidth = 2;
        ctx.beginPath();
        let primo = true;
        let prima = 0;
        for (let i = 0; i < n; i++) {
          if (storia.t[i] < inizio) continue;
          const x = 28 + ((storia.t[i] - inizio) / durata) * (w - 32);
          const y = valori[i] === 1 ? alto : basso;
          if (primo) ctx.moveTo(x, y);
          else {
            if (valori[i] !== prima) ctx.lineTo(x, prima === 1 ? alto : basso); // fronte verticale
            ctx.lineTo(x, y);
          }
          prima = valori[i];
          primo = false;
        }
        ctx.stroke();
      });
    };
    ridisegna();
    const timer = window.setInterval(ridisegna, 100);
    return () => window.clearInterval(timer);
  }, [sessione, id, baseTempi, aperto, bloccato]);
  return (
    <section className="pannello-oscilloscopio" style={stile} aria-label={t("elettronica.analizzatore.titolo", { sigla })} data-testid={`analizzatore-${sigla}`}>
      <header onMouseDown={suGiu} title={t("elettronica.oscilloscopio.sposta")}>
        <strong>📊 {t("elettronica.analizzatore.titolo", { sigla })}</strong>
        <span className="osc-misure" />
        <button type="button" className="pulsante piccolo" onClick={() => setAperto((a) => !a)}>
          {aperto ? t("elettronica.oscilloscopio.riduci") : t("elettronica.oscilloscopio.apri")}
        </button>
      </header>
      {aperto && (
        <div className="osc-corpo">
          <canvas ref={canvas} width={360} height={200} className="osc-schermo" style={{ height: 200 }} />
          <div className="osc-comandi">
            <label className="osc-scelta">
              <span>{t("elettronica.oscilloscopio.baseTempi")}</span>
              <select value={baseTempi} onChange={(e) => setBaseTempi(Number(e.target.value))}>
                {BASI_TEMPI.map((v) => (
                  <option key={v} value={v}>
                    {scriviValore(v, "s")}
                    {t("elettronica.oscilloscopio.perDivisione")}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="pulsante piccolo" onClick={() => setBloccato((b) => !b)}>
              {bloccato ? t("elettronica.oscilloscopio.riprendi") : t("elettronica.oscilloscopio.ferma")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
