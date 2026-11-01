// Parcheggio con sbarra di ingresso e di uscita. Con un clic a sinistra
// arriva un'auto all'ingresso, con un clic a destra un'auto si presenta
// all'uscita (se ce n'è almeno una dentro). Le fotocellule (ingresso I0.2,
// uscita I0.3) vedono l'auto ferma davanti alla sbarra e mentre passa; il
// PLC alza le sbarre (Q0.0 ingresso, Q0.1 uscita) e accende la scritta
// COMPLETO (Q0.2). Se un'auto entra quando i posti sono finiti è segnalato.
import { limita, type ModelloImpianto, type Punto } from "./tipi";

/** Auto davanti a una sbarra: ferma in attesa o in transito (secondi trascorsi). */
export type AutoAllaSbarra = { fase: "attesa" } | { fase: "transito"; trascorso: number } | null;

export interface StatoParcheggio {
  /** Auto dentro il parcheggio. */
  auto: number;
  ingresso: AutoAllaSbarra;
  uscita: AutoAllaSbarra;
  /** Sbarre: 0 = abbassata, 1 = tutta alzata. */
  sbarraIngresso: number;
  sbarraUscita: number;
  completo: boolean;
  /** Un'auto è entrata senza posto libero. */
  troppeAuto: boolean;
}

export const POSTI_PARCHEGGIO = 5;
/** La sbarra si alza (o si abbassa) in 1 secondo. */
export const VELOCITA_SBARRA = 1;
/** Un'auto attraversa la sbarra in 1,5 secondi. */
export const TEMPO_TRANSITO = 1.5;
export const LARGHEZZA_PARCHEGGIO = 360;

/** Fa avanzare l'auto davanti a una sbarra: parte quando la sbarra è tutta su. */
function avanzaAuto(a: AutoAllaSbarra, sbarra: number, dt: number): { auto: AutoAllaSbarra; passata: boolean } {
  if (a === null) return { auto: null, passata: false };
  if (a.fase === "attesa") return { auto: sbarra >= 1 ? { fase: "transito", trascorso: 0 } : a, passata: false };
  const trascorso = a.trascorso + dt;
  return trascorso >= TEMPO_TRANSITO ? { auto: null, passata: true } : { auto: { fase: "transito", trascorso }, passata: false };
}

export const PARCHEGGIO: ModelloImpianto<StatoParcheggio> = {
  tipo: "impianto-parcheggio",
  sensori: [
    { id: "fotoIngresso", chiaveNome: "impianti.parcheggio.fotoIngresso", operandoPredefinito: "I0.2" },
    { id: "fotoUscita", chiaveNome: "impianti.parcheggio.fotoUscita", operandoPredefinito: "I0.3" },
  ],
  attuatori: [
    { id: "sbarraIngresso", chiaveNome: "impianti.parcheggio.sbarraIngresso", operandoPredefinito: "Q0.0" },
    { id: "sbarraUscita", chiaveNome: "impianti.parcheggio.sbarraUscita", operandoPredefinito: "Q0.1" },
    { id: "completo", chiaveNome: "impianti.parcheggio.completo", operandoPredefinito: "Q0.2" },
  ],
  statoIniziale: () => ({
    auto: 0,
    ingresso: null,
    uscita: null,
    sbarraIngresso: 0,
    sbarraUscita: 0,
    completo: false,
    troppeAuto: false,
  }),
  avanza(stato, attuatori, dt) {
    const passo = VELOCITA_SBARRA * dt;
    const sbarraIngresso = limita(stato.sbarraIngresso + (attuatori.sbarraIngresso ? passo : -passo), 0, 1);
    const sbarraUscita = limita(stato.sbarraUscita + (attuatori.sbarraUscita ? passo : -passo), 0, 1);
    const ing = avanzaAuto(stato.ingresso, sbarraIngresso, dt);
    const usc = avanzaAuto(stato.uscita, sbarraUscita, dt);
    let auto = stato.auto;
    let troppeAuto = stato.troppeAuto;
    if (ing.passata) {
      if (auto >= POSTI_PARCHEGGIO) troppeAuto = true;
      auto++;
    }
    if (usc.passata) auto = Math.max(0, auto - 1);
    return {
      auto,
      ingresso: ing.auto,
      uscita: usc.auto,
      sbarraIngresso,
      sbarraUscita,
      completo: attuatori.completo === true,
      troppeAuto,
    };
  },
  letturaSensori: (stato) => ({ fotoIngresso: stato.ingresso !== null, fotoUscita: stato.uscita !== null }),
  // Clic a sinistra: arriva un'auto all'ingresso; a destra: un'auto chiede di uscire.
  clicGiu(stato, punto?: Punto) {
    const destra = (punto?.x ?? 0) > LARGHEZZA_PARCHEGGIO / 2;
    if (!destra) return stato.ingresso ? stato : { ...stato, ingresso: { fase: "attesa" } };
    // Escono solo le auto che sono dentro (contando quelle già in uscita).
    if (stato.uscita || stato.auto === 0) return stato;
    return { ...stato, uscita: { fase: "attesa" } };
  },
};
