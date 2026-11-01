// Ascensore a tre piani (0, 1, 2). Il motore sale (Q0.0) o scende (Q0.1);
// un finecorsa per piano dice quando la cabina è al piano (I0.2, I0.3, I0.4);
// i pulsanti di chiamata ai piani (I0.5, I0.6, I0.7) si tengono premuti
// cliccando sul pulsante disegnato accanto al piano. Comandare salita e
// discesa insieme, o spingere la cabina oltre l'ultimo piano, è segnalato.
import { limita, type ModelloImpianto, type Punto } from "./tipi";

export interface StatoAscensore {
  /** Posizione della cabina in piani: 0 = terra, 2 = secondo piano. */
  posizione: number;
  /** Pulsante di chiamata tenuto premuto (numero del piano) o null. */
  chiamata: number | null;
  movimento: "sale" | "scende" | null;
  comandiOpposti: boolean;
  /** Il motore spinge la cabina contro la fine del vano. */
  fineCorsaSuperato: boolean;
}

export const PIANI = 3;
/** Velocità: un piano ogni 2 secondi. */
export const VELOCITA_ASCENSORE = 0.5;
/** Tolleranza entro cui il finecorsa di piano vede la cabina. */
export const TOLLERANZA_PIANO = 0.03;

/** Geometria del disegno (160 × 300): quota del pavimento di ogni piano. */
export const Y_PIANO = [270, 170, 70];
export const X_PULSANTI = 130;

export const ASCENSORE: ModelloImpianto<StatoAscensore> = {
  tipo: "impianto-ascensore",
  sensori: [
    { id: "piano0", chiaveNome: "impianti.ascensore.piano0", operandoPredefinito: "I0.2" },
    { id: "piano1", chiaveNome: "impianti.ascensore.piano1", operandoPredefinito: "I0.3" },
    { id: "piano2", chiaveNome: "impianti.ascensore.piano2", operandoPredefinito: "I0.4" },
    { id: "chiamata0", chiaveNome: "impianti.ascensore.chiamata0", operandoPredefinito: "I0.5" },
    { id: "chiamata1", chiaveNome: "impianti.ascensore.chiamata1", operandoPredefinito: "I0.6" },
    { id: "chiamata2", chiaveNome: "impianti.ascensore.chiamata2", operandoPredefinito: "I0.7" },
  ],
  attuatori: [
    { id: "sali", chiaveNome: "impianti.ascensore.sali", operandoPredefinito: "Q0.0" },
    { id: "scendi", chiaveNome: "impianti.ascensore.scendi", operandoPredefinito: "Q0.1" },
  ],
  statoIniziale: () => ({ posizione: 0, chiamata: null, movimento: null, comandiOpposti: false, fineCorsaSuperato: false }),
  avanza(stato, attuatori, dt) {
    const sali = attuatori.sali === true;
    const scendi = attuatori.scendi === true;
    const comandiOpposti = sali && scendi;
    const movimento = comandiOpposti ? null : sali ? "sale" : scendi ? "scende" : null;
    const verso = movimento === "sale" ? 1 : movimento === "scende" ? -1 : 0;
    const grezza = stato.posizione + verso * VELOCITA_ASCENSORE * dt;
    // Il motore spinge la cabina che è già in cima (o in fondo) al vano.
    const inCima = stato.posizione >= PIANI - 1 - 1e-9;
    const inFondo = stato.posizione <= 1e-9;
    const fineCorsaSuperato = (verso > 0 && inCima) || (verso < 0 && inFondo);
    return { ...stato, posizione: limita(grezza, 0, PIANI - 1), movimento, comandiOpposti, fineCorsaSuperato };
  },
  letturaSensori(stato) {
    const letture: Record<string, boolean> = {};
    for (let p = 0; p < PIANI; p++) {
      letture[`piano${p}`] = Math.abs(stato.posizione - p) <= TOLLERANZA_PIANO;
      letture[`chiamata${p}`] = stato.chiamata === p;
    }
    return letture;
  },
  // Clic su un pulsante di chiamata (colonna a destra): si tiene premuto.
  clicGiu(stato, punto?: Punto) {
    if (!punto || punto.x < X_PULSANTI - 20) return stato;
    let piano = 0;
    for (let p = 1; p < PIANI; p++) if (Math.abs(punto.y - (Y_PIANO[p] - 25)) < Math.abs(punto.y - (Y_PIANO[piano] - 25))) piano = p;
    return stato.chiamata === piano ? stato : { ...stato, chiamata: piano };
  },
  clicSu: (stato) => (stato.chiamata === null ? stato : { ...stato, chiamata: null }),
};
