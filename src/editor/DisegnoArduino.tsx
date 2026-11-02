// Parti che cambiano dei componenti del banco Arduino, disegnate sopra le
// icone della libreria (che sono fisse):
// - sempre: le fasce colorate della resistenza secondo il suo valore, il
//   braccio del servo e l'indice della manopola del potenziometro;
// - in simulazione: LED accesi con l'alone (più o meno forte secondo la
//   corrente) o bruciati, pulsante premuto, luce sulla fotoresistenza, note
//   del buzzer, LED «L» e «ON» della scheda.
import { useEffect, useRef } from "react";
import Konva from "konva";
import { Circle, Group, Line, Rect, Text } from "react-konva";
import { fasceResistenza, scriviOhm } from "./arduino";
import { PUNTO_DECIMALE, RETTANGOLI_SEGMENTI, SEGMENTI } from "./segmenti7";
import type { ComponenteSchema } from "./schema";
import type { AspettoComponente } from "./vistaSimulazione";

const COLORE_LED: Record<string, string> = { rosso: "#ff3b30", verde: "#34c759", giallo: "#ffd60a", blu: "#2f80ff" };
const FONT = "Segoe UI, system-ui, sans-serif";

export function DisegnoArduino({ componente: c, aspetto }: { componente: ComponenteSchema; aspetto?: AspettoComponente }) {
  const a = aspetto?.arduino;
  const inSimulazione = aspetto !== undefined;
  const led = /^led-(\w+)$/.exec(c.tipo);
  if (led && c.tipo !== "led-rgb") {
    const colore = COLORE_LED[led[1]] ?? "#ff3b30";
    if (a?.bruciato) {
      return (
        <Group listening={false}>
          <Circle x={20} y={26} radius={15} fill="#424242" opacity={0.85} />
          <Text x={-20} y={-14} width={80} align="center" text="BRUCIATO" fontSize={10} fontStyle="bold" fill="#d32f2f" fontFamily={FONT} />
        </Group>
      );
    }
    const l = a?.luminosita ?? 0;
    if (l <= 0) return null;
    return (
      <Group listening={false}>
        <Circle x={20} y={26} radius={14 + 12 * l} fill={colore} opacity={0.18 + 0.35 * l} shadowColor={colore} shadowBlur={30 * l} shadowOpacity={1} />
        <Circle x={20} y={26} radius={11} fill="#ffffff" opacity={0.25 + 0.5 * l} />
      </Group>
    );
  }
  switch (c.tipo) {
    case "resistenza": {
      const fasce = fasceResistenza(c.valore ?? 220);
      return (
        <Group listening={false}>
          <Rect x={18} y={12} width={44} height={16} cornerRadius={7} fill="#e4cf9e" stroke="#b39b62" strokeWidth={1} />
          {fasce.map((f, i) => (
            <Rect key={i} x={i < 3 ? 25 + i * 8 : 53} y={12} width={4} height={16} fill={f} />
          ))}
          <Text x={-10} y={30} width={100} align="center" text={scriviOhm(c.valore ?? 220)} fontSize={9} fill="#6d6d6d" fontFamily={FONT} />
        </Group>
      );
    }
    case "pulsante":
      return aspetto?.azionato ? <Circle x={20} y={30} radius={9} fill="#303030" stroke="#4caf50" strokeWidth={2} listening={false} /> : null;
    case "potenziometro": {
      // Indice della manopola: da −135° (tutto a sinistra) a +135° (tutto a destra).
      const pos = a?.posizione ?? 0.5;
      const ang = ((-135 + 270 * pos - 90) * Math.PI) / 180;
      return (
        <Group listening={false}>
          <Circle x={20} y={15} radius={10} fill="#eceff1" />
          <Line points={[20, 15, 20 + 9 * Math.cos(ang), 15 + 9 * Math.sin(ang)]} stroke="#455a64" strokeWidth={3} lineCap="round" />
          {inSimulazione && <Text x={-20} y={-14} width={80} align="center" text={`${Math.round(pos * 100)} %`} fontSize={10} fontStyle="bold" fill="#1565c0" fontFamily={FONT} />}
        </Group>
      );
    }
    case "fotoresistenza":
      if (!inSimulazione) return null;
      return (
        <Group listening={false}>
          <Circle x={10} y={12} radius={12 + 10 * (a?.luce ?? 0.5)} fill="#ffeb3b" opacity={0.15 + 0.45 * (a?.luce ?? 0.5)} />
          <Text x={-30} y={-16} width={80} align="center" text={`☀ ${Math.round((a?.luce ?? 0.5) * 100)} %`} fontSize={10} fontStyle="bold" fill="#f57f17" fontFamily={FONT} />
        </Group>
      );
    case "buzzer":
      if (!a?.suona) return null;
      return (
        <Group listening={false}>
          <Circle x={20} y={17} radius={20} stroke="#7e57c2" strokeWidth={2} opacity={0.6} />
          <Text x={-30} y={-16} width={100} align="center" text={a.frequenza ? `♪ ${Math.round(a.frequenza)} Hz` : "♪ clic"} fontSize={10} fontStyle="bold" fill="#5e35b1" fontFamily={FONT} />
        </Group>
      );
    case "servo": {
      // Braccio del servo: 0° a destra, 90° in alto, 180° a sinistra (visto dall'alto).
      const gradi = a?.angolo ?? 90;
      const rad = ((180 - gradi) * Math.PI) / 180;
      const lungo = 30;
      return (
        <Group listening={false}>
          <Line
            points={[96 - 8 * Math.cos(rad), 40 + 8 * Math.sin(rad), 96 + lungo * Math.cos(rad), 40 - lungo * Math.sin(rad)]}
            stroke="#fafafa"
            strokeWidth={8}
            lineCap="round"
            shadowColor="#000"
            shadowOpacity={0.3}
            shadowBlur={2}
          />
          <Circle x={96} y={40} radius={4} fill="#9e9e9e" />
          {a?.angolo !== undefined && <Text x={70} y={64} width={60} align="center" text={`${Math.round(gradi)}°`} fontSize={10} fontStyle="bold" fill="#1e5aa8" fontFamily={FONT} />}
        </Group>
      );
    }
    case "lcd": {
      // Schermo 16×2: sfondo verde chiaro con la retroilluminazione, caratteri scuri.
      const righe = a?.righe ?? [];
      const retro = a?.retro ?? 0;
      const LARGHEZZA_CELLA = 276 / 16;
      return (
        <Group listening={false}>
          <Rect x={32} y={67} width={276} height={58} fill={retro > 0 ? "#a8e063" : "#5f7f3c"} opacity={retro > 0 ? 0.55 + 0.45 * retro : 1} />
          {inSimulazione &&
            [0, 1].map((r) =>
              Array.from({ length: 16 }, (_, k) => (
                <Rect key={`${r}-${k}`} x={34 + k * LARGHEZZA_CELLA} y={71 + r * 27} width={LARGHEZZA_CELLA - 3} height={23} fill="#000000" opacity={0.06} />
              )),
            )}
          {righe.map((riga, r) =>
            [...riga.slice(0, 16)].map((ch, k) =>
              ch === " " ? null : (
                <Text
                  key={`${r}-${k}`}
                  x={34 + k * LARGHEZZA_CELLA}
                  y={72 + r * 27}
                  width={LARGHEZZA_CELLA - 3}
                  align="center"
                  text={ch}
                  fontSize={19}
                  fontFamily="Consolas, 'Courier New', monospace"
                  fill="#17260c"
                />
              ),
            ),
          )}
        </Group>
      );
    }
    case "ultrasuoni": {
      if (!inSimulazione) return null;
      const d = a?.distanza ?? 50;
      return (
        <Group listening={false}>
          {[0, 1, 2].map((i) => (
            <Line key={i} points={[60 + i * 8, -6 - i * 6, 70, -14 - i * 8, 80 - i * 8, -6 - i * 6]} stroke="#1565c0" strokeWidth={2} opacity={0.5} tension={0.5} />
          ))}
          <Text x={0} y={-40} width={140} align="center" text={`↕ ostacolo a ${d} cm`} fontSize={11} fontStyle="bold" fill="#0d47a1" fontFamily={FONT} />
        </Group>
      );
    }
    case "arduino-uno":
      if (!inSimulazione) return null;
      return (
        <Group listening={false}>
          {/* LED ON sempre acceso con la scheda alimentata; LED L collegato al pin 13. */}
          <Rect x={370} y={120} width={10} height={6} fill="#00e676" shadowColor="#00e676" shadowBlur={8} shadowOpacity={1} />
          {a?.ledL && <Rect x={120} y={80} width={10} height={6} fill="#ffab00" shadowColor="#ffab00" shadowBlur={10} shadowOpacity={1} />}
        </Group>
      );
    case "led-rgb": {
      if (a?.bruciato)
        return (
          <Group listening={false}>
            <Circle x={30} y={28} radius={15} fill="#424242" opacity={0.85} />
            <Text x={-20} y={-14} width={100} align="center" text="BRUCIATO" fontSize={10} fontStyle="bold" fill="#d32f2f" fontFamily={FONT} />
          </Group>
        );
      const [r, g, b] = a?.rgb ?? [0, 0, 0];
      const l = Math.max(r, g, b);
      if (l <= 0) return null;
      // Colore mescolato come lo vede l'occhio: ogni canale in proporzione alla sua luminosità.
      const colore = `rgb(${Math.round((255 * r) / l)}, ${Math.round((255 * g) / l)}, ${Math.round((255 * b) / l)})`;
      return (
        <Group listening={false}>
          <Circle x={30} y={28} radius={14 + 12 * l} fill={colore} opacity={0.2 + 0.4 * l} shadowColor={colore} shadowBlur={30 * l} shadowOpacity={1} />
          <Circle x={30} y={28} radius={11} fill={colore} opacity={0.5 + 0.4 * l} />
        </Group>
      );
    }
    case "display-sette-segmenti": {
      if (a?.bruciato)
        return (
          <Group listening={false}>
            <Rect x={10} y={13} width={60} height={74} fill="#212121" opacity={0.85} />
            <Text x={-10} y={-14} width={100} align="center" text="BRUCIATO" fontSize={10} fontStyle="bold" fill="#d32f2f" fontFamily={FONT} />
          </Group>
        );
      const lum = a?.segmenti ?? [];
      if (!lum.some((l) => l > 0)) return null;
      // Segmenti accesi in rosso, con un alone proporzionale alla corrente.
      return (
        <Group listening={false}>
          {SEGMENTI.map((seg, k) => {
            const l = lum[k] ?? 0;
            if (l <= 0) return null;
            const ombra = { fill: "#ff3b30", opacity: 0.45 + 0.55 * l, shadowColor: "#ff3b30", shadowBlur: 10 * l, shadowOpacity: 1 };
            if (seg === "dp") return <Circle key={seg} x={PUNTO_DECIMALE[0]} y={PUNTO_DECIMALE[1]} radius={PUNTO_DECIMALE[2]} {...ombra} />;
            const [x, y, w, h] = RETTANGOLI_SEGMENTI[seg];
            return <Rect key={seg} x={x} y={y} width={w} height={h} cornerRadius={2} {...ombra} />;
          })}
        </Group>
      );
    }
    case "multimetro": {
      // Lettura sul display e indice della manopola sulla funzione scelta.
      const angolo = { V: -50, A: 0, "Ω": 50 }[a?.funzione ?? "V"] ?? -50;
      return (
        <Group listening={false}>
          {inSimulazione && (
            <Text x={16} y={21} width={84} align="right" text={a?.lettura ?? ""} fontSize={17} fontStyle="bold" fill="#1b2a12" fontFamily="Consolas, 'Courier New', monospace" />
          )}
          <Line points={[60, 78, 60 + 17 * Math.sin((angolo * Math.PI) / 180), 78 - 17 * Math.cos((angolo * Math.PI) / 180)]} stroke="#ffffff" strokeWidth={4} lineCap="round" />
        </Group>
      );
    }
    case "motore-dc":
      return <MotoreDc velocita={a?.velocita ?? 0} />;
    case "sensore-pir":
      // Movimento rilevato: la cupola si illumina e compare la scritta.
      return inSimulazione && (a?.posizione ?? 0) >= 0.5 ? (
        <Group listening={false}>
          <Circle x={40} y={38} radius={24} fill="#ffcc80" opacity={0.45} shadowColor="#ff9800" shadowBlur={20} shadowOpacity={1} />
          <Rect x={0} y={-18} width={80} height={16} cornerRadius={4} fill="#e65100" />
          <Text x={0} y={-15} width={80} align="center" text="MOVIMENTO" fontSize={10} fontStyle="bold" fill="#ffffff" fontFamily={FONT} />
        </Group>
      ) : null;
    case "tmp36":
      return a?.temperatura !== undefined ? (
        <Group listening={false}>
          <Rect x={-6} y={-18} width={52} height={16} cornerRadius={4} fill="#263238" />
          <Text x={-6} y={-15} width={52} align="center" text={`${a.temperatura} °C`} fontSize={11} fontStyle="bold" fill={a.temperatura >= 30 ? "#ff8a65" : a.temperatura <= 5 ? "#81d4fa" : "#ffffff"} fontFamily={FONT} />
        </Group>
      ) : null;
    case "interruttore-slitta":
      // Levetta spostata a destra (centrale collegato al piedino 2).
      return (a?.posizione ?? 0) >= 0.5 ? (
        <Group listening={false}>
          <Rect x={6} y={13} width={28} height={10} cornerRadius={2} fill="#212121" />
          <Rect x={21} y={10} width={12} height={16} cornerRadius={2} fill="#bdbdbd" stroke="#757575" />
        </Group>
      ) : null;
    default:
      return null;
  }
}

/**
 * Motorino in continua: l'albero (un disco con una tacca) gira tanto più in
 * fretta quanto più tensione riceve, nel verso dato dal segno.
 */
function MotoreDc({ velocita }: { velocita: number }) {
  const disco = useRef<Konva.Group>(null);
  useEffect(() => {
    const g = disco.current;
    if (!g || velocita === 0) return;
    const animazione = new Konva.Animation((frame) => {
      if (frame) g.rotation(g.rotation() + velocita * frame.timeDiff * 1.2);
    }, g.getLayer());
    animazione.start();
    return () => {
      animazione.stop();
    };
  }, [velocita]);
  return (
    <Group listening={false}>
      <Group ref={disco} x={40} y={35}>
        <Circle radius={10} fill={velocita !== 0 ? "#fff59d" : "#eceff1"} stroke="#90a4ae" />
        <Line points={[0, 0, 0, -10]} stroke="#e53935" strokeWidth={3} lineCap="round" />
        <Line points={[0, 0, 8, 6]} stroke="#455a64" strokeWidth={2} lineCap="round" />
      </Group>
      {velocita !== 0 && (
        <Text x={-10} y={-16} width={100} align="center" text={`${velocita > 0 ? "↻" : "↺"} ${Math.round(Math.abs(velocita) * 100)} %`} fontSize={11} fontStyle="bold" fill="#2e7d32" fontFamily={FONT} />
      )}
    </Group>
  );
}
