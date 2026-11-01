// Semaforo: tre lampade (rosso, giallo, verde) comandate dal PLC e un
// pulsante di chiamata pedonale (si tiene premuto cliccando sull'impianto).
import type { ModelloImpianto } from "./tipi";

export interface StatoSemaforo {
  rosso: boolean;
  giallo: boolean;
  verde: boolean;
  /** Pulsante pedonale tenuto premuto. */
  chiamata: boolean;
}

export const SEMAFORO: ModelloImpianto<StatoSemaforo> = {
  tipo: "impianto-semaforo",
  sensori: [{ id: "chiamata", chiaveNome: "impianti.semaforo.chiamata", operandoPredefinito: "I0.0" }],
  attuatori: [
    { id: "rosso", chiaveNome: "impianti.semaforo.rosso", operandoPredefinito: "Q0.0" },
    { id: "giallo", chiaveNome: "impianti.semaforo.giallo", operandoPredefinito: "Q0.1" },
    { id: "verde", chiaveNome: "impianti.semaforo.verde", operandoPredefinito: "Q0.2" },
  ],
  statoIniziale: () => ({ rosso: false, giallo: false, verde: false, chiamata: false }),
  avanza(stato, attuatori) {
    const rosso = attuatori.rosso === true;
    const giallo = attuatori.giallo === true;
    const verde = attuatori.verde === true;
    if (stato.rosso === rosso && stato.giallo === giallo && stato.verde === verde) return stato;
    return { ...stato, rosso, giallo, verde };
  },
  letturaSensori: (stato) => ({ chiamata: stato.chiamata }),
  clicGiu: (stato) => (stato.chiamata ? stato : { ...stato, chiamata: true }),
  clicSu: (stato) => (stato.chiamata ? { ...stato, chiamata: false } : stato),
};

/** Vero se sono accese insieme luci che non dovrebbero (es. rosso e verde). */
export function luciIncompatibili(s: Pick<StatoSemaforo, "rosso" | "giallo" | "verde">): boolean {
  return s.rosso && s.verde;
}
