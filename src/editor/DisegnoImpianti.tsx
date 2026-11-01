// Disegno animato degli impianti del PLC (nastro, semaforo, cancello).
// Il disegno fisso è l'icona SVG della libreria (stessa misura del
// componente); qui si aggiungono:
// - sempre: l'operando di ogni sensore e attuatore, scritto vicino al punto
//   dell'impianto a cui si riferisce (così lo studente sa che cosa usare nel Ladder);
// - in simulazione: le parti che si muovono (pacchi, rulli, luci, cancello,
//   auto, lampeggiante) secondo lo stato del modello in src/motori/plc/impianti.
import { useEffect, useState } from "react";
import { Circle, Group, Line, Rect, Text } from "react-konva";
import {
  LUNGHEZZA_PACCO,
  posizioneDisegno,
  type StatoCancello,
  type StatoNastro,
  type StatoSemaforo,
} from "../motori/plc";
import { t } from "../testi";
import type { ColoriEditor } from "./colori";

interface PropsDisegno {
  tipo: string;
  /** Segnale → operando (I… o Q…). */
  operandi: Record<string, string>;
  /** Stato del modello; assente quando non si simula. */
  stato?: unknown;
  colori: ColoriEditor;
}

const FONT = "Segoe UI, system-ui, sans-serif";

/** Piccola scritta con l'operando di un segnale. */
function Etichetta({ x, y, testo, colori, allinea = "center" }: { x: number; y: number; testo: string; colori: ColoriEditor; allinea?: "center" | "left" | "right" }) {
  const larghezza = 44;
  const dx = allinea === "center" ? -larghezza / 2 : allinea === "right" ? -larghezza : 0;
  return <Text x={x + dx} y={y} width={larghezza} align={allinea} text={testo} fontSize={11} fontStyle="bold" fontFamily={FONT} fill={colori.testo} listening={false} />;
}

/** Vero ogni 0,4 s alternato, finché `attivo` (per lampeggiare). */
function useLampeggio(attivo: boolean): boolean {
  const [acceso, setAcceso] = useState(true);
  useEffect(() => {
    if (!attivo) return;
    const timer = window.setInterval(() => setAcceso((a) => !a), 400);
    return () => window.clearInterval(timer);
  }, [attivo]);
  return attivo && acceso;
}

export function DisegnoImpianto({ tipo, operandi, stato, colori }: PropsDisegno) {
  if (tipo === "impianto-nastro") return <Nastro operandi={operandi} stato={stato as StatoNastro | undefined} colori={colori} />;
  if (tipo === "impianto-semaforo") return <Semaforo operandi={operandi} stato={stato as StatoSemaforo | undefined} colori={colori} />;
  if (tipo === "impianto-cancello") return <Cancello operandi={operandi} stato={stato as StatoCancello | undefined} colori={colori} />;
  return null;
}

// --- Nastro trasportatore (360 × 160) ---
const NASTRO_X0 = 30;
const NASTRO_X1 = 290;
function Nastro({ operandi, stato, colori }: { operandi: Record<string, string>; stato?: StatoNastro; colori: ColoriEditor }) {
  const lunghezza = NASTRO_X1 - NASTRO_X0;
  const larghezzaPacco = LUNGHEZZA_PACCO * lunghezza;
  // I raggi dei rulli ruotano con lo spostamento del nastro.
  const angolo = ((stato?.avanzamento ?? 0) * lunghezza * 360) / (2 * Math.PI * 10);
  const raggio = (cx: number) =>
    [0, 90].map((a) => {
      const r = ((angolo + a) * Math.PI) / 180;
      return <Line key={a} points={[cx - 8 * Math.cos(r), 100 - 8 * Math.sin(r), cx + 8 * Math.cos(r), 100 + 8 * Math.sin(r)]} stroke={stato?.inMoto ? colori.attivo : colori.testo} strokeWidth={2} listening={false} />;
    });
  return (
    <Group listening={false}>
      <Etichetta x={48} y={24} testo={operandi.inizio} colori={colori} />
      <Etichetta x={272} y={24} testo={operandi.fine} colori={colori} />
      <Etichetta x={30} y={118} testo={operandi.motore} colori={colori} />
      {raggio(30)}
      {raggio(290)}
      {stato?.inMoto && <Text x={130} y={112} width={100} align="center" text="→ → →" fontSize={13} fill={colori.attivo} fontFamily={FONT} />}
      {stato?.pacchi.map((p, i) => (
        <Rect
          key={i}
          x={NASTRO_X0 + posizioneDisegno(p) * lunghezza}
          y={62}
          width={larghezzaPacco}
          height={27}
          fill="#c08a4a"
          stroke="#7c5427"
          strokeWidth={1.5}
          cornerRadius={2}
        />
      ))}
      {/* Fotocellule: raggio rosso quando vedono un pacco. */}
      {stato && (
        <>
          <Line points={[48, 62, 48, 90]} stroke={stato.pacchi.some((p) => p < 0.1) ? colori.guasto : "transparent"} strokeWidth={2} dash={[3, 3]} />
          <Line points={[272, 62, 272, 90]} stroke={stato.pacchi.some((p) => p >= 0.9) ? colori.guasto : "transparent"} strokeWidth={2} dash={[3, 3]} />
          <Text x={300} y={132} width={58} align="center" text={t("impianti.nastro.consegnati", { numero: stato.consegnati })} fontSize={10} fill={colori.testo} fontFamily={FONT} />
        </>
      )}
    </Group>
  );
}

// --- Semaforo (120 × 240) ---
function Semaforo({ operandi, stato, colori }: { operandi: Record<string, string>; stato?: StatoSemaforo; colori: ColoriEditor }) {
  const luce = (y: number, acceso: boolean | undefined, colore: string) =>
    acceso ? <Circle x={60} y={y} radius={15} fill={colore} shadowColor={colore} shadowBlur={16} shadowOpacity={0.9} /> : null;
  return (
    <Group listening={false}>
      <Etichetta x={2} y={29} testo={operandi.rosso} colori={colori} allinea="left" />
      <Etichetta x={2} y={74} testo={operandi.giallo} colori={colori} allinea="left" />
      <Etichetta x={2} y={119} testo={operandi.verde} colori={colori} allinea="left" />
      <Etichetta x={95} y={206} testo={operandi.chiamata} colori={colori} />
      {luce(35, stato?.rosso, "#ef4444")}
      {luce(80, stato?.giallo, "#f59e0b")}
      {luce(125, stato?.verde, "#22c55e")}
      {stato?.chiamata && <Circle x={95} y={191} radius={6} fill={colori.attivo} />}
    </Group>
  );
}

// --- Cancello automatico (360 × 200) ---
const VARCO_X0 = 205;
const VARCO_X1 = 345;
function Cancello({ operandi, stato, colori }: { operandi: Record<string, string>; stato?: StatoCancello; colori: ColoriEditor }) {
  const lampeggia = useLampeggio(stato?.lampeggiante === true);
  const larghezza = VARCO_X1 - VARCO_X0;
  const apertura = stato?.apertura ?? 0;
  const x = VARCO_X0 - apertura * larghezza;
  // Sbarre del cancello.
  const sbarre = Array.from({ length: 8 }, (_, i) => x + 8 + (i * (larghezza - 16)) / 7);
  return (
    <Group listening={false}>
      <Etichetta x={30} y={112} testo={`${operandi.apri} ${operandi.chiudi}`} colori={colori} />
      <Etichetta x={197} y={40} testo={operandi.lampeggiante} colori={colori} />
      <Etichetta x={62} y={186} testo={operandi.aperto} colori={colori} />
      <Etichetta x={330} y={186} testo={operandi.chiuso} colori={colori} />
      <Etichetta x={275} y={124} testo={operandi.fotocellula} colori={colori} />
      {/* Il cancello si disegna sempre: chiuso in modifica, alla sua apertura in simulazione. */}
      <Rect x={x} y={88} width={larghezza} height={80} stroke={colori.testo} strokeWidth={2.5} />
      {sbarre.map((sx) => (
        <Line key={sx} points={[sx, 88, sx, 168]} stroke={colori.testo} strokeWidth={1.5} />
      ))}
      <Circle x={197} y={56} radius={6} fill={lampeggia ? "#f97316" : "transparent"} stroke={colori.testo} strokeWidth={1.5} shadowColor="#f97316" shadowBlur={lampeggia ? 14 : 0} />
      {stato?.ostacolo && (
        <Group>
          <Rect x={235} y={128} width={86} height={30} fill="#3b82f6" cornerRadius={8} opacity={0.85} />
          <Circle x={255} y={160} radius={7} fill={colori.testo} />
          <Circle x={302} y={160} radius={7} fill={colori.testo} />
          <Line points={[VARCO_X0, 140, VARCO_X1, 140]} stroke={colori.guasto} strokeWidth={2} dash={[3, 3]} />
        </Group>
      )}
      {stato?.movimento && (
        <Text x={60} y={70} width={130} align="center" text={stato.movimento === "apre" ? "← ← ←" : "→ → →"} fontSize={14} fill={colori.attivo} fontFamily={FONT} />
      )}
      {stato?.urto && <Text x={200} y={10} width={160} align="center" text={t("impianti.cancello.urto")} fontSize={14} fontStyle="bold" fill={colori.guasto} fontFamily={FONT} />}
      {stato?.comandiOpposti && (
        <Text x={10} y={10} width={180} align="left" text={t("impianti.cancello.comandiOpposti")} fontSize={12} fontStyle="bold" fill={colori.guasto} fontFamily={FONT} />
      )}
    </Group>
  );
}
