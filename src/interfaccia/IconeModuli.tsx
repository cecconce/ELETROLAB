// Icone delle tessere, disegnate da zero in SVG (nessuna risorsa di terzi).
// Usano currentColor, così seguono automaticamente il tema chiaro/scuro.
import type { IdModulo } from "./moduli";

const attributiComuni = {
  viewBox: "0 0 64 64",
  width: 64,
  height: 64,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 3,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** Impianti: bobina di contattore (rettangolo IEC) con contatto NA. */
function IconaImpianti() {
  return (
    <svg {...attributiComuni}>
      <rect x="8" y="22" width="20" height="20" />
      <line x1="18" y1="8" x2="18" y2="22" />
      <line x1="18" y1="42" x2="18" y2="56" />
      <line x1="46" y1="8" x2="46" y2="22" />
      <line x1="46" y1="22" x2="38" y2="40" />
      <line x1="46" y1="42" x2="46" y2="56" />
      <line x1="28" y1="32" x2="40" y2="32" strokeDasharray="3 3" />
    </svg>
  );
}

/** PLC: due binari verticali con un ramo Ladder (contatto e bobina). */
function IconaPlc() {
  return (
    <svg {...attributiComuni}>
      <line x1="6" y1="8" x2="6" y2="56" />
      <line x1="58" y1="8" x2="58" y2="56" />
      <line x1="6" y1="32" x2="18" y2="32" />
      <line x1="18" y1="24" x2="18" y2="40" />
      <line x1="26" y1="24" x2="26" y2="40" />
      <line x1="26" y1="32" x2="38" y2="32" />
      <path d="M42 24 q-4 8 0 16" />
      <path d="M48 24 q4 8 0 16" />
      <line x1="52" y1="32" x2="58" y2="32" />
    </svg>
  );
}

/** Arduino: scheda generica a microcontrollore con piedini (nessun logo). */
function IconaArduino() {
  return (
    <svg {...attributiComuni}>
      <rect x="10" y="14" width="44" height="36" rx="4" />
      <rect x="24" y="24" width="16" height="16" />
      {[18, 26, 34, 42].map((x) => (
        <g key={x}>
          <line x1={x} y1="8" x2={x} y2="14" />
          <line x1={x} y1="50" x2={x} y2="56" />
        </g>
      ))}
    </svg>
  );
}

/** Elettronica: resistore IEC e un'onda sinusoidale (oscilloscopio). */
function IconaElettronica() {
  return (
    <svg {...attributiComuni}>
      <line x1="4" y1="18" x2="18" y2="18" />
      <rect x="18" y="11" width="28" height="14" />
      <line x1="46" y1="18" x2="60" y2="18" />
      <path d="M6 44 C 14 30, 22 30, 30 44 S 46 58, 54 44" />
    </svg>
  );
}

export function IconaModulo({ id }: { id: IdModulo }) {
  switch (id) {
    case "impianti":
      return <IconaImpianti />;
    case "plc":
      return <IconaPlc />;
    case "arduino":
      return <IconaArduino />;
    case "elettronica":
      return <IconaElettronica />;
  }
}
