// Serbatoio con pompa: la pompa (Q0.0) lo riempie, la valvola di scarico
// (Q0.1) lo svuota; due galleggianti dicono quando il liquido ha raggiunto il
// livello minimo (I0.2) e il livello massimo (I0.3). Con un clic lo studente
// apre o chiude un rubinetto di consumo (prelievo dell'utenza) che svuota
// lentamente il serbatoio. Se si continua a pompare a serbatoio pieno il
// liquido trabocca (segnalato).
import { limita, type ModelloImpianto } from "./tipi";

export interface StatoSerbatoio {
  /** 0 = vuoto, 1 = pieno fino all'orlo. */
  livello: number;
  /** Rubinetto dell'utenza aperto dallo studente. */
  consumo: boolean;
  pompa: boolean;
  scarico: boolean;
  /** Si è pompato a serbatoio pieno. */
  trabocca: boolean;
}

/** Portate in frazioni di serbatoio al secondo. */
export const PORTATA_POMPA = 0.1;
export const PORTATA_SCARICO = 0.08;
export const PORTATA_CONSUMO = 0.04;
/** Altezza dei galleggianti. */
export const LIVELLO_MINIMO = 0.2;
export const LIVELLO_MASSIMO = 0.9;

export const SERBATOIO: ModelloImpianto<StatoSerbatoio> = {
  tipo: "impianto-serbatoio",
  sensori: [
    { id: "minimo", chiaveNome: "impianti.serbatoio.minimo", operandoPredefinito: "I0.2" },
    { id: "massimo", chiaveNome: "impianti.serbatoio.massimo", operandoPredefinito: "I0.3" },
  ],
  attuatori: [
    { id: "pompa", chiaveNome: "impianti.serbatoio.pompa", operandoPredefinito: "Q0.0" },
    { id: "scarico", chiaveNome: "impianti.serbatoio.scarico", operandoPredefinito: "Q0.1" },
  ],
  statoIniziale: () => ({ livello: 0, consumo: false, pompa: false, scarico: false, trabocca: false }),
  avanza(stato, attuatori, dt) {
    const pompa = attuatori.pompa === true;
    const scarico = attuatori.scarico === true;
    const variazione =
      ((pompa ? PORTATA_POMPA : 0) - (scarico ? PORTATA_SCARICO : 0) - (stato.consumo ? PORTATA_CONSUMO : 0)) * dt;
    const grezzo = stato.livello + variazione;
    const trabocca = stato.trabocca || (pompa && grezzo > 1);
    return { ...stato, livello: limita(grezzo, 0, 1), pompa, scarico, trabocca };
  },
  letturaSensori: (stato) => ({
    minimo: stato.livello >= LIVELLO_MINIMO,
    massimo: stato.livello >= LIVELLO_MASSIMO,
  }),
  // Clic: apre o chiude il rubinetto dell'utenza (e azzera la segnalazione di troppo pieno).
  clicGiu: (stato) => ({ ...stato, consumo: !stato.consumo, trabocca: false }),
};
