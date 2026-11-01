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
  LIVELLO_MASSIMO,
  LIVELLO_MINIMO,
  LUNGHEZZA_PACCO,
  POSTI_PARCHEGGIO,
  TEMPO_TRANSITO,
  Y_PIANO,
  posizioneDisegno,
  type AutoAllaSbarra,
  type StatoAscensore,
  type StatoCancello,
  type StatoNastro,
  type StatoParcheggio,
  type StatoSemaforo,
  type StatoSerbatoio,
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
  if (tipo === "impianto-serbatoio") return <Serbatoio operandi={operandi} stato={stato as StatoSerbatoio | undefined} colori={colori} />;
  if (tipo === "impianto-ascensore") return <Ascensore operandi={operandi} stato={stato as StatoAscensore | undefined} colori={colori} />;
  if (tipo === "impianto-parcheggio") return <Parcheggio operandi={operandi} stato={stato as StatoParcheggio | undefined} colori={colori} />;
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

/** Scritta di avviso in rosso (urti, comandi opposti…). */
function Avviso({ x, y, larghezza, testo, colori }: { x: number; y: number; larghezza: number; testo: string; colori: ColoriEditor }) {
  return <Text x={x} y={y} width={larghezza} align="center" text={testo} fontSize={12} fontStyle="bold" fill={colori.guasto} fontFamily={FONT} />;
}

// --- Serbatoio con pompa (200 × 260) ---
const FONDO_SERBATOIO = 230;
const ALTEZZA_SERBATOIO = 190;
function Serbatoio({ operandi, stato, colori }: { operandi: Record<string, string>; stato?: StatoSerbatoio; colori: ColoriEditor }) {
  const quota = (livello: number) => FONDO_SERBATOIO - livello * ALTEZZA_SERBATOIO;
  const livello = stato?.livello ?? 0;
  return (
    <Group listening={false}>
      <Etichetta x={25} y={234} testo={operandi.pompa} colori={colori} />
      <Etichetta x={176} y={230} testo={operandi.scarico} colori={colori} />
      <Etichetta x={164} y={quota(LIVELLO_MINIMO) - 6} testo={operandi.minimo} colori={colori} allinea="left" />
      <Etichetta x={164} y={quota(LIVELLO_MASSIMO) - 6} testo={operandi.massimo} colori={colori} allinea="left" />
      {livello > 0 && <Rect x={51} y={quota(livello)} width={98} height={livello * ALTEZZA_SERBATOIO - 1} fill="#3b82f6" opacity={0.55} />}
      {stato?.pompa && (
        <>
          <Circle x={25} y={215} radius={13} fill={colori.attivo} opacity={0.5} />
          <Line points={[25, 201, 25, 25, 80, 25, 80, 40]} stroke="#3b82f6" strokeWidth={4} opacity={0.7} />
        </>
      )}
      {stato?.scarico && <Line points={[150, 220, 190, 220]} stroke="#3b82f6" strokeWidth={4} opacity={0.7} />}
      {stato?.consumo && (
        <>
          <Line points={[100, 246, 100, 258]} stroke="#3b82f6" strokeWidth={3} dash={[3, 3]} />
          <Text x={110} y={246} width={90} text={t("impianti.serbatoio.consumo")} fontSize={10} fill={colori.testo} fontFamily={FONT} />
        </>
      )}
      {stato && <Text x={50} y={quota(livello) - 16 < 42 ? 44 : quota(livello) - 16} width={100} align="center" text={`${Math.round(livello * 100)} %`} fontSize={11} fontStyle="bold" fill={colori.testo} fontFamily={FONT} />}
      {stato?.trabocca && <Avviso x={40} y={2} larghezza={160} testo={t("impianti.serbatoio.trabocca")} colori={colori} />}
    </Group>
  );
}

// --- Ascensore (160 × 300) ---
function Ascensore({ operandi, stato, colori }: { operandi: Record<string, string>; stato?: StatoAscensore; colori: ColoriEditor }) {
  const posizione = stato?.posizione ?? 0;
  // Quota del pavimento della cabina: fra un piano e l'altro ci sono 100 unità.
  const pavimento = Y_PIANO[0] - posizione * (Y_PIANO[0] - Y_PIANO[1]);
  return (
    <Group listening={false}>
      {[0, 1, 2].map((p) => (
        <Group key={p}>
          <Etichetta x={104} y={Y_PIANO[p] - 52} testo={operandi[`piano${p}`]} colori={colori} allinea="left" />
          <Etichetta x={130} y={Y_PIANO[p] - 14} testo={operandi[`chiamata${p}`]} colori={colori} />
          {stato?.chiamata === p && <Circle x={130} y={Y_PIANO[p] - 25} radius={7} fill={colori.attivo} />}
        </Group>
      ))}
      <Text x={22} y={-14} width={80} align="center" text={`↑${operandi.sali} ↓${operandi.scendi}`} fontSize={10} fontStyle="bold" fill={colori.testo} fontFamily={FONT} />
      {/* La cabina c'è sempre: al piano terra in modifica. */}
      <Rect x={26} y={pavimento - 46} width={68} height={46} stroke={colori.testo} strokeWidth={2} fill={stato?.movimento ? colori.attivo : undefined} opacity={stato?.movimento ? 0.6 : 1} cornerRadius={3} />
      <Line points={[60, 10, 60, pavimento - 46]} stroke={colori.testo} strokeWidth={1} />
      {stato?.movimento && (
        <Text x={26} y={pavimento - 32} width={68} align="center" text={stato.movimento === "sale" ? "▲" : "▼"} fontSize={16} fill={colori.testo} fontFamily={FONT} />
      )}
      {stato?.fineCorsaSuperato && <Avviso x={0} y={292} larghezza={160} testo={t("impianti.ascensore.fineCorsa")} colori={colori} />}
      {stato?.comandiOpposti && <Avviso x={0} y={292} larghezza={160} testo={t("impianti.ascensore.comandiOpposti")} colori={colori} />}
    </Group>
  );
}

// --- Parcheggio (360 × 180) ---
function Parcheggio({ operandi, stato, colori }: { operandi: Record<string, string>; stato?: StatoParcheggio; colori: ColoriEditor }) {
  /** Sbarra che ruota verso l'alto attorno al palo. */
  const sbarra = (x: number, apertura: number, verso: 1 | -1) => {
    const angolo = (apertura * 80 * Math.PI) / 180;
    return <Line points={[x, 114, x + verso * 52 * Math.cos(angolo), 114 - 52 * Math.sin(angolo)]} stroke="#dc2626" strokeWidth={4} lineCap="round" />;
  };
  /** Auto: ferma prima della sbarra o in transito verso la destinazione. */
  const auto = (a: AutoAllaSbarra, xAttesa: number, xArrivo: number) => {
    if (!a) return null;
    const f = a.fase === "attesa" ? 0 : Math.min(1, a.trascorso / TEMPO_TRANSITO);
    const x = xAttesa + f * (xArrivo - xAttesa);
    return (
      <Group>
        <Rect x={x} y={124} width={46} height={24} fill="#3b82f6" cornerRadius={7} opacity={0.9} />
        <Circle x={x + 10} y={150} radius={5} fill={colori.testo} />
        <Circle x={x + 36} y={150} radius={5} fill={colori.testo} />
      </Group>
    );
  };
  return (
    <Group listening={false}>
      <Etichetta x={76} y={166} testo={operandi.fotoIngresso} colori={colori} />
      <Etichetta x={284} y={166} testo={operandi.fotoUscita} colori={colori} />
      <Etichetta x={66} y={96} testo={operandi.sbarraIngresso} colori={colori} />
      <Etichetta x={294} y={96} testo={operandi.sbarraUscita} colori={colori} />
      <Etichetta x={300} y={4} testo={operandi.completo} colori={colori} />
      <Text x={120} y={4} width={120} align="center" text={t("impianti.parcheggio.scritta")} fontSize={13} fontStyle="bold" fill={stato?.completo ? colori.guasto : colori.testo} opacity={stato?.completo ? 1 : 0.25} fontFamily={FONT} />
      {sbarra(90, stato?.sbarraIngresso ?? 0, 1)}
      {sbarra(270, stato?.sbarraUscita ?? 0, -1)}
      {stato && (
        <>
          <Text x={120} y={66} width={120} align="center" text={t("impianti.parcheggio.auto", { numero: stato.auto, posti: POSTI_PARCHEGGIO })} fontSize={12} fontStyle="bold" fill={colori.testo} fontFamily={FONT} />
          {Array.from({ length: Math.min(stato.auto, POSTI_PARCHEGGIO) }, (_, i) => (
            <Rect key={i} x={124 + i * 24} y={26} width={16} height={12} fill="#3b82f6" cornerRadius={3} opacity={0.8} />
          ))}
          {auto(stato.ingresso, 22, 150)}
          {auto(stato.uscita, 212, 330)}
          {stato.troppeAuto && <Avviso x={240} y={30} larghezza={120} testo={t("impianti.parcheggio.troppeAuto")} colori={colori} />}
        </>
      )}
    </Group>
  );
}
