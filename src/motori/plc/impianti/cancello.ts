// Cancello automatico scorrevole: un motore lo apre (Q0.0) o lo chiude
// (Q0.1), un lampeggiante (Q0.2) avvisa del movimento. Due finecorsa dicono
// quando è tutto chiuso (I0.2) o tutto aperto (I0.3); una fotocellula (I0.4)
// vede un'auto in mezzo: con un clic sull'impianto l'auto entra o esce.
// Se il PLC comanda apertura e chiusura insieme il motore resta fermo e
// l'impianto segnala il guasto (come farebbe la protezione del motore).
import { limita, type ModelloImpianto } from "./tipi";

export interface StatoCancello {
  /** 0 = tutto chiuso, 1 = tutto aperto. */
  apertura: number;
  /** Auto davanti alla fotocellula. */
  ostacolo: boolean;
  lampeggiante: boolean;
  /** Il cancello si è chiuso sull'auto: urto! */
  urto: boolean;
  /** Apertura e chiusura comandate insieme. */
  comandiOpposti: boolean;
  /** Verso del movimento in corso (per la freccia nel disegno). */
  movimento: "apre" | "chiude" | null;
}

/** Velocità: il cancello si apre tutto in 5 secondi. */
export const VELOCITA_CANCELLO = 0.2;
/** Con l'auto in mezzo il cancello non può chiudersi oltre questo punto. */
export const APERTURA_MINIMA_CON_AUTO = 0.6;
const TOLLERANZA = 1e-6;

export const CANCELLO: ModelloImpianto<StatoCancello> = {
  tipo: "impianto-cancello",
  sensori: [
    { id: "chiuso", chiaveNome: "impianti.cancello.chiuso", operandoPredefinito: "I0.2" },
    { id: "aperto", chiaveNome: "impianti.cancello.aperto", operandoPredefinito: "I0.3" },
    { id: "fotocellula", chiaveNome: "impianti.cancello.fotocellula", operandoPredefinito: "I0.4" },
  ],
  attuatori: [
    { id: "apri", chiaveNome: "impianti.cancello.apri", operandoPredefinito: "Q0.0" },
    { id: "chiudi", chiaveNome: "impianti.cancello.chiudi", operandoPredefinito: "Q0.1" },
    { id: "lampeggiante", chiaveNome: "impianti.cancello.lampeggiante", operandoPredefinito: "Q0.2" },
  ],
  statoIniziale: () => ({ apertura: 0, ostacolo: false, lampeggiante: false, urto: false, comandiOpposti: false, movimento: null }),
  avanza(stato, attuatori, dt) {
    const apri = attuatori.apri === true;
    const chiudi = attuatori.chiudi === true;
    const comandiOpposti = apri && chiudi;
    const movimento = comandiOpposti ? null : apri ? "apre" : chiudi ? "chiude" : null;
    let apertura = stato.apertura;
    let urto = stato.urto;
    if (movimento === "apre") apertura = limita(apertura + VELOCITA_CANCELLO * dt, 0, 1);
    if (movimento === "chiude") {
      const minimo = stato.ostacolo ? APERTURA_MINIMA_CON_AUTO : 0;
      const nuova = apertura - VELOCITA_CANCELLO * dt;
      // Chiudendo contro l'auto il cancello la urta e si ferma lì.
      if (stato.ostacolo && nuova < minimo) urto = true;
      apertura = limita(nuova, minimo, 1);
    }
    return { ...stato, apertura, urto, comandiOpposti, movimento, lampeggiante: attuatori.lampeggiante === true };
  },
  letturaSensori: (stato) => ({
    chiuso: stato.apertura <= TOLLERANZA,
    aperto: stato.apertura >= 1 - TOLLERANZA,
    fotocellula: stato.ostacolo,
  }),
  // Clic: l'auto entra davanti alla fotocellula oppure se ne va (solo se il
  // cancello è abbastanza aperto da farla passare). Andando via l'urto si dimentica.
  clicGiu(stato) {
    if (stato.ostacolo) return { ...stato, ostacolo: false, urto: false };
    if (stato.apertura < APERTURA_MINIMA_CON_AUTO) return stato;
    return { ...stato, ostacolo: true };
  },
};
