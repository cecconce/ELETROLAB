// Nastro trasportatore: un motore fa avanzare i pacchi da sinistra a destra.
// Due fotocellule vedono il pacco all'inizio e alla fine del nastro. Con un
// clic sull'impianto si posa un nuovo pacco all'inizio. Arrivato in fondo, il
// pacco cade nel contenitore e sparisce (si contano i pacchi consegnati).
import { limita, type ModelloImpianto } from "./tipi";

export interface StatoNastro {
  /** Posizione di ogni pacco: 0 = inizio del nastro, 1 = fine. */
  pacchi: number[];
  /** Pacchi caduti nel contenitore. */
  consegnati: number;
  /** Il nastro sta girando (per l'animazione dei rulli). */
  inMoto: boolean;
  /** Spostamento totale del nastro (per far girare i rulli nel disegno). */
  avanzamento: number;
}

/** Velocità del nastro: lo percorre tutto in 5 secondi. */
export const VELOCITA_NASTRO = 0.2;
/** Lunghezza di un pacco in frazioni del nastro. */
export const LUNGHEZZA_PACCO = 0.12;
/** Le fotocellule vedono il pacco in queste zone. */
export const ZONA_INIZIO = 0.1;
export const ZONA_FINE = 0.9;
/** Oltre questa posizione il pacco cade nel contenitore. */
export const FINE_NASTRO = 1;

export const NASTRO: ModelloImpianto<StatoNastro> = {
  tipo: "impianto-nastro",
  sensori: [
    { id: "inizio", chiaveNome: "impianti.nastro.inizio", operandoPredefinito: "I0.2" },
    { id: "fine", chiaveNome: "impianti.nastro.fine", operandoPredefinito: "I0.3" },
  ],
  attuatori: [{ id: "motore", chiaveNome: "impianti.nastro.motore", operandoPredefinito: "Q0.0" }],
  statoIniziale: () => ({ pacchi: [], consegnati: 0, inMoto: false, avanzamento: 0 }),
  avanza(stato, attuatori, dt) {
    const inMoto = attuatori.motore === true;
    if (!inMoto || dt <= 0) return stato.inMoto === inMoto ? stato : { ...stato, inMoto };
    const spostamento = VELOCITA_NASTRO * dt;
    const mossi = stato.pacchi.map((p) => p + spostamento);
    const restano = mossi.filter((p) => p <= FINE_NASTRO);
    return {
      pacchi: restano,
      consegnati: stato.consegnati + (mossi.length - restano.length),
      inMoto,
      avanzamento: stato.avanzamento + spostamento,
    };
  },
  letturaSensori: (stato) => ({
    inizio: stato.pacchi.some((p) => p < ZONA_INIZIO),
    fine: stato.pacchi.some((p) => p >= ZONA_FINE),
  }),
  // Clic: nuovo pacco all'inizio, se lo spazio è libero.
  clicGiu(stato) {
    if (stato.pacchi.some((p) => p < LUNGHEZZA_PACCO * 1.5)) return stato;
    return { ...stato, pacchi: [...stato.pacchi, 0].sort((a, b) => a - b) };
  },
};

/** Posizione del pacco limitata al nastro (per il disegno). */
export const posizioneDisegno = (p: number) => limita(p, 0, FINE_NASTRO);
