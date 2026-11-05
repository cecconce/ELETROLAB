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
import { displayAlimentatore, fasceResistenza, scriviOhm, valoreParametroArduino } from "./arduino";
import { TASTIERINO_H, TASTIERINO_L, TASTIERINO_X0, TASTIERINO_Y0 } from "../motori/arduino";
import { PUNTO_DECIMALE, RETTANGOLI_SEGMENTI, SEGMENTI } from "./segmenti7";
import type { ComponenteSchema } from "./schema";
import { t } from "../testi";
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
    case "alimentatore": {
      // Ferma la simulazione: i display mostrano la tensione impostata e il limite
      // di corrente. In simulazione: tensione ai morsetti, corrente erogata e la
      // spia CV (verde) o CC (rossa, limite raggiunto).
      const al = a?.alimentatore;
      const cifre = al
        ? displayAlimentatore(al.volt, al.ampere)
        : displayAlimentatore(valoreParametroArduino(c.parametri, c.tipo, "tensione"), valoreParametroArduino(c.parametri, c.tipo, "correnteMax"));
      const cifra = { fontSize: 19, fontStyle: "bold", fontFamily: "Consolas, 'Courier New', monospace", align: "right" as const, width: 58 };
      return (
        <Group listening={false}>
          <Text x={14} y={17} text={cifre.volt} fill="#ff5252" shadowColor="#ff1744" shadowBlur={inSimulazione ? 6 : 0} shadowOpacity={1} opacity={inSimulazione ? 1 : 0.75} {...cifra} />
          <Text x={86} y={17} text={cifre.ampere} fill="#69f0ae" shadowColor="#00e676" shadowBlur={inSimulazione ? 6 : 0} shadowOpacity={1} opacity={inSimulazione ? 1 : 0.75} {...cifra} />
          {inSimulazione && al && (
            <>
              <Circle x={66} y={62} radius={3.5} fill={al.cc ? "#33402e" : "#76ff03"} shadowColor="#76ff03" shadowBlur={al.cc ? 0 : 8} shadowOpacity={1} />
              <Circle x={94} y={62} radius={3.5} fill={al.cc ? "#ff1744" : "#402e2e"} shadowColor="#ff1744" shadowBlur={al.cc ? 8 : 0} shadowOpacity={1} />
            </>
          )}
          {!inSimulazione && <Text x={84} y={41} width={64} align="right" text={t("arduino.alimentatore.limite")} fontSize={6} fill="#90a4ae" fontFamily={FONT} />}
        </Group>
      );
    }
    case "sensore-inclinazione":
      // Inclinato: il corpo si piega di lato, la pallina si stacca dai contatti.
      return inSimulazione && (a?.posizione ?? 0) >= 0.5 ? (
        <Group listening={false}>
          <Rect x={-2} y={-18} width={64} height={16} cornerRadius={4} fill="#e65100" />
          <Text x={-2} y={-15} width={64} align="center" text={t("arduino.sensore.inclinato")} fontSize={9} fontStyle="bold" fill="#ffffff" fontFamily={FONT} />
          <Rect x={3} y={2} width={14} height={26} cornerRadius={5} fill="#616161" stroke="#e65100" strokeWidth={1.5} rotation={25} offsetX={-4} opacity={0.85} />
        </Group>
      ) : null;
    case "sensore-forza":
    case "sensore-umidita":
    case "sensore-gas": {
      if (!inSimulazione) return null;
      const livello = a?.posizione ?? 0;
      const percento = `${Math.round(livello * 100)} %`;
      const etichetta = { "sensore-forza": "arduino.sensore.forza", "sensore-umidita": "arduino.sensore.umidita", "sensore-gas": "arduino.sensore.gas" }[c.tipo]!;
      const colore = c.tipo === "sensore-umidita" ? "#1565c0" : c.tipo === "sensore-gas" ? (livello >= 0.5 ? "#c62828" : "#546e7a") : "#6d4c41";
      const larghezza = c.larghezza;
      return (
        <Group listening={false}>
          {c.tipo === "sensore-forza" && livello > 0 && <Circle x={20} y={18} radius={8 + 8 * livello} fill="#ffcc80" opacity={0.35 + 0.4 * livello} />}
          {c.tipo === "sensore-umidita" && <Rect x={10} y={70} width={60} height={50} fill="#6d4c41" opacity={0.25 + 0.5 * (1 - livello)} cornerRadius={4} />}
          {c.tipo === "sensore-umidita" && livello > 0 && <Rect x={10} y={120 - 50 * livello} width={60} height={50 * livello} fill="#42a5f5" opacity={0.35} cornerRadius={4} />}
          {c.tipo === "sensore-gas" && livello > 0 && <Circle x={40} y={32} radius={20 + 10 * livello} fill="#9e9e9e" opacity={0.15 + 0.35 * livello} />}
          <Rect x={larghezza / 2 - 45} y={-18} width={90} height={16} cornerRadius={4} fill={colore} />
          <Text x={larghezza / 2 - 45} y={-15} width={90} align="center" text={`${t(etichetta)} ${percento}`} fontSize={10} fontStyle="bold" fill="#ffffff" fontFamily={FONT} />
        </Group>
      );
    }
    case "tastierino": {
      // Tasto premuto: si illumina di verde.
      const k = a?.posizione ?? -1;
      if (k < 0) return null;
      const x = TASTIERINO_X0 + (k % 4) * TASTIERINO_L;
      const y = TASTIERINO_Y0 + Math.floor(k / 4) * TASTIERINO_H;
      return <Rect x={x + 3} y={y + 3} width={TASTIERINO_L - 6} height={TASTIERINO_H - 6} cornerRadius={6} fill="#4caf50" opacity={0.55} stroke="#1b5e20" strokeWidth={2} listening={false} />;
    }
    case "l293d": {
      // Pallino su ogni uscita: rosso = alta (verso VS), blu = bassa (verso GND).
      if (!inSimulazione) return null;
      const posizioni = [
        { x: 40, y: 54 },
        { x: 100, y: 54 },
        { x: 100, y: 6 },
        { x: 40, y: 6 },
      ];
      return (
        <Group listening={false}>
          {(a?.uscitePonte ?? []).map((stato, i) =>
            stato === "aperto" ? null : (
              <Circle key={i} x={posizioni[i].x} y={posizioni[i].y} radius={4} fill={stato === "alto" ? "#ff1744" : "#2979ff"} shadowColor={stato === "alto" ? "#ff1744" : "#2979ff"} shadowBlur={6} shadowOpacity={1} />
            ),
          )}
        </Group>
      );
    }
    case "modulo-rele": {
      if (!inSimulazione) return null;
      // LED rosso di alimentazione, LED verde di stato e, nella morsettiera, il
      // contatto chiuso: COM-NO con la bobina eccitata, COM-NC a riposo.
      const yContatto = a?.eccitato ? 20 : 60;
      return (
        <Group listening={false}>
          {a?.alimentato && <Circle x={26} y={70} radius={3} fill="#ff5252" shadowColor="#ff1744" shadowBlur={8} shadowOpacity={1} />}
          {a?.eccitato && <Circle x={38} y={70} radius={3} fill="#69f0ae" shadowColor="#00e676" shadowBlur={8} shadowOpacity={1} />}
          <Line points={[124, 40, 128, 40, 128, yContatto, 124, yContatto]} stroke="#ffca28" strokeWidth={3} lineCap="round" lineJoin="round" />
          {a?.eccitato && (
            <>
              <Rect x={44} y={-18} width={54} height={16} cornerRadius={4} fill="#2e7d32" />
              <Text x={44} y={-15} width={54} align="center" text={t("arduino.rele.eccitato")} fontSize={10} fontStyle="bold" fill="#ffffff" fontFamily={FONT} />
            </>
          )}
        </Group>
      );
    }
    case "lampadina": {
      if (a?.bruciato) {
        return (
          <Group listening={false}>
            <Circle x={30} y={24} radius={20} fill="#424242" opacity={0.6} />
            <Text x={-10} y={-14} width={80} align="center" text={t("arduino.lampadina.bruciata")} fontSize={10} fontStyle="bold" fill="#d32f2f" fontFamily={FONT} />
          </Group>
        );
      }
      const l = a?.luminosita ?? 0;
      if (l <= 0) return null;
      return (
        <Group listening={false}>
          <Circle x={30} y={24} radius={18 + 14 * l} fill="#ffd54f" opacity={0.2 + 0.35 * l} shadowColor="#ffb300" shadowBlur={30 * l} shadowOpacity={1} />
          <Circle x={30} y={24} radius={14} fill="#fff8e1" opacity={0.3 + 0.6 * l} />
        </Group>
      );
    }
    case "transistor-npn":
      return a?.bruciato ? (
        <Group listening={false}>
          <Rect x={6} y={6} width={28} height={28} cornerRadius={6} fill="#5d4037" opacity={0.8} shadowColor="#ff6d00" shadowBlur={14} shadowOpacity={1} />
          <Text x={-20} y={-14} width={80} align="center" text="BRUCIATO" fontSize={10} fontStyle="bold" fill="#d32f2f" fontFamily={FONT} />
        </Group>
      ) : null;
    case "batteria-9v":
    case "portapile-4aa": {
      // Pila che eroga corrente: piccola etichetta con tensione e corrente.
      const al = a?.alimentatore;
      if (!inSimulazione || !al || al.ampere === 0) return null;
      const larghezza = c.tipo === "batteria-9v" ? 60 : 100;
      const testoPila = `${al.volt.toFixed(2).replace(".", ",")} V · ${(Math.abs(al.ampere) * 1000).toFixed(0)} mA`;
      return (
        <Group listening={false}>
          <Rect x={larghezza / 2 - 45} y={-18} width={90} height={16} cornerRadius={4} fill="#263238" />
          <Text x={larghezza / 2 - 45} y={-15} width={90} align="center" text={testoPila} fontSize={10} fontStyle="bold" fill="#ffffff" fontFamily={FONT} />
        </Group>
      );
    }
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
