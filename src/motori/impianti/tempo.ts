// Scorrere del tempo nella simulazione degli impianti (puro: nessuna interfaccia).
//
// Il simulatore (simulatore.ts) calcola lo stato del circuito in un istante.
// Qui si tiene la "memoria" fra un istante e l'altro e si conta il tempo:
// - bobine eccitate (per l'autoritenuta);
// - da quando un temporizzatore è alimentato (ritardo all'eccitazione) o da
//   quando non lo è più (ritardo alla diseccitazione);
// - da quando una protezione termica alimenta un motore in sovraccarico;
// - protezioni intervenute, che restano tali fino al riarmo.
//
// L'interfaccia chiama `avanza` a intervalli regolari (es. ogni 50 ms) e
// subito dopo ogni clic dello studente (con dt = 0).
import { MODELLI_IMPIANTI, PROTEZIONI, TEMPO_CORSA_CILINDRO, TEMPO_INTERVENTO_TERMICO } from "./modelli";
import {
  simulaConProtezioni,
  tempoDi,
  type Circuito,
  type Ingressi,
  type RisultatoConProtezioni,
} from "./simulatore";

/** Memoria della simulazione fra un istante e il successivo. */
export interface StatoImpianto {
  /** Secondi trascorsi dall'avvio della simulazione. */
  tempo: number;
  bobineEccitate: string[];
  /** Temporizzatori ritardati all'eccitazione: istante in cui sono stati alimentati. */
  eccitataDa: Record<string, number>;
  /** Temporizzatori ritardati alla diseccitazione: istante in cui hanno perso tensione. */
  diseccitataDa: Record<string, number>;
  /** Protezioni termiche: istante in cui è iniziato il sovraccarico. */
  sovraccaricoDa: Record<string, number>;
  /** Protezioni intervenute (restano così fino al riarmo). */
  protezioniIntervenute: string[];
  /** Relè passo-passo con i contatti commutati (cambiano a ogni impulso sulla bobina). */
  passoPassoChiusi?: string[];
  /** Cilindri pneumatici: posizione dello stelo (0 dentro, 1 fuori) e se l'elettrovalvola è alimentata. */
  cilindri?: Record<string, { posizione: number; alimentato: boolean }>;
}

/** Azioni dello studente: le protezioni le gestisce lo stato. */
export type AzioniStudente = Omit<Ingressi, "protezioniIntervenute" | "termiciIntervenuti">;

/** Tolleranza per i confronti fra tempi (somme di decimali non sono esatte). */
const EPSILON = 1e-9;

/** Stato all'avvio della simulazione: tutto a riposo. */
export function statoIniziale(): StatoImpianto {
  return { tempo: 0, bobineEccitate: [], eccitataDa: {}, diseccitataDa: {}, sovraccaricoDa: {}, protezioniIntervenute: [] };
}

/** Temporizzatori del circuito, divisi per tipo di ritardo. */
function temporizzatoriDel(circuito: Circuito) {
  const eccitazione = new Map<string, number>();
  const diseccitazione = new Map<string, number>();
  for (const c of circuito.componenti) {
    const m = MODELLI_IMPIANTI[c.tipo];
    if (m?.tipo !== "carico") continue;
    if (m.temporizzata === "eccitazione") eccitazione.set(c.id, tempoDi(c));
    if (m.temporizzata === "diseccitazione") diseccitazione.set(c.id, tempoDi(c));
  }
  return { eccitazione, diseccitazione };
}

/**
 * Fa avanzare la simulazione di `dt` secondi e calcola il nuovo stato.
 * I ritardi scadono al primo passo in cui il tempo trascorso li raggiunge,
 * quindi la precisione è quella dell'intervallo con cui si chiama `avanza`
 * (`prossimoEvento` dice quando cadrà il prossimo, per non saltarlo).
 */
export function avanza(
  circuito: Circuito,
  stato: StatoImpianto,
  azioni: AzioniStudente,
  dt: number,
): { stato: StatoImpianto; risultato: RisultatoConProtezioni } {
  const adesso = stato.tempo + Math.max(0, dt);
  const { eccitazione, diseccitazione } = temporizzatoriDel(circuito);
  const trascorso = (da: number | undefined) => (da === undefined ? -Infinity : adesso - da);

  const scaduti = [...eccitazione].filter(([id, t]) => trascorso(stato.eccitataDa[id]) >= t - EPSILON).map(([id]) => id);
  const inRitardo = [...diseccitazione]
    .filter(([id, t]) => stato.diseccitataDa[id] !== undefined && trascorso(stato.diseccitataDa[id]) < t - EPSILON)
    .map(([id]) => id);

  // Protezioni termiche rimaste in sovraccarico abbastanza a lungo: intervengono.
  const intervenute = new Set(stato.protezioniIntervenute);
  for (const [id, da] of Object.entries(stato.sovraccaricoDa)) {
    if (adesso - da >= TEMPO_INTERVENTO_TERMICO - EPSILON) intervenute.add(id);
  }

  // Cilindri: lo stelo si muove verso la posizione voluta dall'elettrovalvola (stato del calcolo precedente).
  const cilindri: Record<string, { posizione: number; alimentato: boolean }> = {};
  const cilindriDelCircuito = circuito.componenti.filter((c) => {
    const m = MODELLI_IMPIANTI[c.tipo];
    return m?.tipo === "carico" && m.cilindro;
  });
  for (const c of cilindriDelCircuito) {
    const m = MODELLI_IMPIANTI[c.tipo];
    const corsa = m?.tipo === "carico" && m.cilindro ? m.cilindro.corsa : TEMPO_CORSA_CILINDRO;
    const prima = stato.cilindri?.[c.id] ?? { posizione: 0, alimentato: false };
    const verso = prima.alimentato ? 1 : -1;
    const posizione = Math.min(1, Math.max(0, prima.posizione + (verso * Math.max(0, dt)) / corsa));
    cilindri[c.id] = { posizione: Math.abs(posizione - Math.round(posizione)) < 1e-6 ? Math.round(posizione) : posizione, alimentato: prima.alimentato };
  }
  const posizioniPerSigla = (): Record<string, number> =>
    Object.fromEntries(cilindriDelCircuito.filter((c) => c.etichetta.trim() !== "").map((c) => [c.etichetta.trim(), cilindri[c.id].posizione]));
  let passoPassoChiusi = stato.passoPassoChiusi ?? [];
  let risultato = simulaConProtezioni(
    circuito,
    { ...azioni, protezioniIntervenute: intervenute },
    stato.bobineEccitate,
    { scaduti, inRitardo, passoPassoChiusi, posizioniCilindri: posizioniPerSigla() },
  );
  // Relè passo-passo: a ogni impulso (bobina appena alimentata) i contatti cambiano stato;
  // poi si ricalcola il circuito con i contatti nella nuova posizione.
  const passoPasso = circuito.componenti.filter((c) => {
    const m = MODELLI_IMPIANTI[c.tipo];
    return m?.tipo === "carico" && m.passoPasso;
  });
  const impulsi = passoPasso.filter((c) => risultato.bobineEccitate.includes(c.id) && !stato.bobineEccitate.includes(c.id)).map((c) => c.id);
  if (impulsi.length > 0) {
    const chiusi = new Set(passoPassoChiusi);
    for (const id of impulsi) {
      if (chiusi.has(id)) chiusi.delete(id);
      else chiusi.add(id);
    }
    passoPassoChiusi = [...chiusi];
    risultato = simulaConProtezioni(
      circuito,
      { ...azioni, protezioniIntervenute: new Set(risultato.protezioniIntervenute) },
      risultato.bobineEccitate,
      { scaduti, inRitardo, passoPassoChiusi, posizioniCilindri: posizioniPerSigla() },
    );
  }
  for (const c of cilindriDelCircuito) cilindri[c.id].alimentato = risultato.carichiAlimentati.includes(c.id);

  // Aggiornamento della memoria dei temporizzatori.
  const eccitateOra = new Set(risultato.bobineEccitate);
  const eccitatePrima = new Set(stato.bobineEccitate);
  const eccitataDa: Record<string, number> = {};
  for (const id of eccitazione.keys()) {
    if (eccitateOra.has(id)) eccitataDa[id] = stato.eccitataDa[id] ?? adesso;
  }
  const diseccitataDa: Record<string, number> = {};
  for (const [id, t] of diseccitazione) {
    if (eccitateOra.has(id)) continue;
    if (eccitatePrima.has(id)) diseccitataDa[id] = adesso; // ha appena perso tensione
    else if (stato.diseccitataDa[id] !== undefined && trascorso(stato.diseccitataDa[id]) < t - EPSILON) {
      diseccitataDa[id] = stato.diseccitataDa[id];
    }
  }
  // Sovraccarichi: il conteggio riparte da zero se il sovraccarico si interrompe.
  const sovraccaricoDa: Record<string, number> = {};
  for (const id of risultato.protezioniInSovraccarico) sovraccaricoDa[id] = stato.sovraccaricoDa[id] ?? adesso;

  return {
    stato: {
      tempo: adesso,
      bobineEccitate: risultato.bobineEccitate,
      eccitataDa,
      diseccitataDa,
      sovraccaricoDa,
      protezioniIntervenute: risultato.protezioniIntervenute,
      passoPassoChiusi,
      ...(cilindriDelCircuito.length > 0 ? { cilindri } : {}),
    },
    risultato,
  };
}

/**
 * Secondi mancanti al prossimo evento a tempo (fine di un ritardo o
 * intervento di un relè termico); null se non c'è niente in attesa.
 */
export function prossimoEvento(circuito: Circuito, stato: StatoImpianto): number | null {
  const { eccitazione, diseccitazione } = temporizzatoriDel(circuito);
  const attese: number[] = [];
  for (const [id, da] of Object.entries(stato.eccitataDa)) {
    const t = eccitazione.get(id);
    if (t !== undefined) attese.push(da + t - stato.tempo);
  }
  for (const [id, da] of Object.entries(stato.diseccitataDa)) {
    const t = diseccitazione.get(id);
    if (t !== undefined) attese.push(da + t - stato.tempo);
  }
  for (const da of Object.values(stato.sovraccaricoDa)) attese.push(da + TEMPO_INTERVENTO_TERMICO - stato.tempo);
  // Cilindri in movimento: quando lo stelo arriva a fine corsa i finecorsa commutano.
  for (const [id, cil] of Object.entries(stato.cilindri ?? {})) {
    const m = MODELLI_IMPIANTI[circuito.componenti.find((c) => c.id === id)?.tipo ?? ""];
    const corsa = m?.tipo === "carico" && m.cilindro ? m.cilindro.corsa : TEMPO_CORSA_CILINDRO;
    if (cil.alimentato && cil.posizione < 1) attese.push((1 - cil.posizione) * corsa);
    if (!cil.alimentato && cil.posizione > 0) attese.push(cil.posizione * corsa);
  }
  const future = attese.filter((x) => x > EPSILON);
  return future.length > 0 ? Math.min(...future) : null;
}

/**
 * Riarmo di una protezione: fusibile sostituito, magnetotermico o salvamotore
 * richiuso, relè termico riarmato. Se il guasto c'è ancora, interverrà di nuovo.
 */
export function riarma(stato: StatoImpianto, id: string): StatoImpianto {
  if (!stato.protezioniIntervenute.includes(id)) return stato;
  const sovraccaricoDa = { ...stato.sovraccaricoDa };
  delete sovraccaricoDa[id];
  return { ...stato, protezioniIntervenute: stato.protezioniIntervenute.filter((x) => x !== id), sovraccaricoDa };
}

/** Dice se un tipo di componente è una protezione che si può riarmare. */
export function eProtezione(tipo: string): boolean {
  return PROTEZIONI[tipo] !== undefined;
}
