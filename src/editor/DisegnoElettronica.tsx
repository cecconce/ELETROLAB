// Parti che cambiano dei componenti del modulo Elettronica, disegnate sopra i
// simboli della libreria (che sono fissi):
// - in simulazione: LED e lampadine accesi (alone proporzionale alla corrente
//   o alla potenza), LED bruciato, interruttore e pulsante chiusi, cursore del
//   potenziometro, display del multimetro con la misura;
// - sempre: la funzione scelta sul multimetro e la forma d'onda del generatore.
// Le sigle e i valori ("R1 · 1 kΩ") si scrivono fuori, dritti anche se il
// componente è ruotato (vedi EtichettaElettronica).
import { Circle, Group, Line, Rect, Text } from "react-konva";
import type { ColoriEditor } from "./colori";
import { etichettaValore, valoreParametro } from "./elettronica";
import type { ComponenteSchema } from "./schema";
import type { AspettoComponente } from "./vistaSimulazione";

const COLORE_LED: Record<string, string> = { rosso: "#ff3b30", verde: "#34c759", giallo: "#ffd60a", blu: "#2f80ff" };
const FONT = "Segoe UI, system-ui, sans-serif";

export function DisegnoElettronica({ componente: c, aspetto, colori }: { componente: ComponenteSchema; aspetto?: AspettoComponente; colori: ColoriEditor }) {
  const e = aspetto?.elettronica;
  switch (c.tipo) {
    case "led": {
      const colore = COLORE_LED[String(valoreParametro(c.parametri, c.tipo, "colore"))] ?? COLORE_LED.rosso;
      if (e?.bruciato)
        return (
          <Group listening={false}>
            <Circle x={20} y={40} radius={13} fill="#424242" opacity={0.8} />
            <Text x={-30} y={-14} width={100} align="center" text="BRUCIATO" fontSize={10} fontStyle="bold" fill="#d32f2f" fontFamily={FONT} />
          </Group>
        );
      // Anche spento il triangolo si colora leggermente, per riconoscere il colore.
      const l = e?.luminosita ?? 0;
      return (
        <Group listening={false}>
          <Line points={[9, 29, 31, 29, 20, 51]} closed fill={colore} opacity={0.25 + 0.6 * l} />
          {l > 0 && <Circle x={20} y={40} radius={14 + 14 * l} fill={colore} opacity={0.15 + 0.3 * l} shadowColor={colore} shadowBlur={30 * l} shadowOpacity={1} />}
        </Group>
      );
    }
    case "lampadina": {
      const l = e?.luminosita ?? 0;
      if (l <= 0.01) return null;
      return <Circle x={40} y={20} radius={13 + 10 * l} fill="#ffd54f" opacity={0.2 + 0.55 * l} shadowColor="#ffb300" shadowBlur={30 * l} shadowOpacity={1} listening={false} />;
    }
    case "interruttore":
      // Lama chiusa: si copre quella aperta del simbolo e si disegna orizzontale.
      return aspetto?.chiuso ? (
        <Group listening={false}>
          <Line points={[26, 19, 54, 6]} stroke={colori.foglio} strokeWidth={5} />
          <Line points={[24, 20, 56, 20]} stroke={colori.attivo} strokeWidth={3} lineCap="round" />
        </Group>
      ) : null;
    case "pulsante":
      return aspetto?.chiuso ? (
        <Group listening={false}>
          <Line points={[18, 22, 62, 22]} stroke={colori.foglio} strokeWidth={5} />
          <Line points={[20, 30, 60, 30]} stroke={colori.attivo} strokeWidth={3} lineCap="round" />
        </Group>
      ) : null;
    case "potenziometro": {
      if (e?.posizione === undefined) return null;
      // Il cursore scorre lungo la resistenza: 0 = verso il morsetto 1, 1 = verso il 3.
      const x = 22 + 36 * e.posizione;
      return (
        <Group listening={false}>
          <Line points={[x, 4, x, 30]} stroke={colori.attivo} strokeWidth={2.5} />
          <Line points={[x - 5, 24, x, 31, x + 5, 24]} stroke={colori.attivo} strokeWidth={2.5} />
          <Text x={-20} y={50} width={120} align="center" text={`${Math.round(e.posizione * 100)} %`} fontSize={10} fill={colori.attivo} fontFamily={FONT} />
        </Group>
      );
    }
    case "multimetro": {
      const modo = String(valoreParametro(c.parametri, c.tipo, "modalita"));
      return (
        <Group listening={false}>
          <Rect x={13} y={13} width={54} height={24} fill="#c5d6b4" cornerRadius={2} />
          <Text x={13} y={17} width={52} align="right" text={e?.lettura ?? "– – –"} fontSize={e?.lettura && e.lettura.length > 8 ? 10 : 12} fontStyle="bold" fill="#1b2a12" fontFamily="Consolas, monospace" />
          <Text x={28} y={50} width={24} align="center" text={modo} fontSize={11} fontStyle="bold" fill={colori.testo} fontFamily={FONT} />
        </Group>
      );
    }
    case "generatore-funzioni":
      return (
        <Group listening={false}>
          <Rect x={13} y={13} width={54} height={26} fill={colori.foglio} />
          <Text x={13} y={14} width={54} align="center" text={etichettaValore(c.tipo, c.parametri).split(" ")[0]} fontSize={13} fill={colori.testo} fontFamily={FONT} />
          <Text x={9} y={28} width={62} align="center" text={etichettaValore(c.tipo, c.parametri).split(" ").slice(1, 3).join(" ")} fontSize={8} fill={colori.testo} fontFamily={FONT} />
        </Group>
      );
    default:
      return null;
  }
}

/** Strumenti e generatori: la sigla sta sopra, il valore è già sul disegno. */
const STRUMENTI = new Set(["multimetro", "oscilloscopio", "generatore-funzioni"]);

/**
 * Sigla e valore del componente, sempre dritti: sopra e sotto per i
 * componenti orizzontali, a destra (uno sotto l'altro) per quelli verticali.
 */
export function EtichettaElettronica({ componente: c, larghezza, altezza, colori, nonAssociato }: { componente: ComponenteSchema; larghezza: number; altezza: number; colori: ColoriEditor; nonAssociato?: boolean }) {
  const sigla = c.etichetta;
  const valore = STRUMENTI.has(c.tipo) ? "" : etichettaValore(c.tipo, c.parametri);
  if (!sigla && !valore) return null;
  const coloreSigla = nonAssociato ? colori.morsettoAttivo : colori.testo;
  if (larghezza >= altezza || STRUMENTI.has(c.tipo)) {
    return (
      <Group listening={false}>
        {sigla && <Text x={-30} y={-16} width={larghezza + 60} align="center" text={sigla} fontSize={13} fontStyle="bold" fill={coloreSigla} fontFamily={FONT} />}
        {valore && <Text x={-30} y={altezza + 2} width={larghezza + 60} align="center" text={valore} fontSize={11} fill={colori.testo} fontFamily={FONT} />}
      </Group>
    );
  }
  return (
    <Group listening={false}>
      {sigla && <Text x={larghezza + 2} y={altezza / 2 - (valore ? 16 : 8)} text={sigla} fontSize={13} fontStyle="bold" fill={coloreSigla} fontFamily={FONT} />}
      {valore && <Text x={larghezza + 2} y={altezza / 2 + 1} text={valore} fontSize={11} fill={colori.testo} fontFamily={FONT} />}
    </Group>
  );
}
