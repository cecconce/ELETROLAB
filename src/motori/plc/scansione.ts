// Ciclo di scansione del PLC (puro: nessuna interfaccia).
//
// Come in un PLC vero, ogni ciclo fa tre passi:
// 1. lettura degli ingressi: lo stato dei comandi del quadro viene copiato
//    nell'immagine degli ingressi (I), che resta ferma per tutto il ciclo;
// 2. esecuzione del programma: i segmenti vengono valutati dall'alto in basso;
//    una bobina scrive subito nell'immagine, quindi i segmenti successivi
//    vedono già il nuovo valore (l'ordine dei segmenti conta!);
// 3. scrittura delle uscite: l'immagine delle uscite (Q) viene copiata sulle
//    uscite fisiche (lampade, motori) solo alla fine del ciclo.
//
// L'interfaccia chiamerà `scansione` a intervalli regolari (tempo di ciclo,
// passando il tempo trascorso `dt`) e userà `segmenti` per colorare in tempo
// reale contatti e bobine; `temporizzatori` e `contatori` danno i valori da
// mostrare accanto ai blocchi.
//
// I temporizzatori contano il tempo dei cicli: il valore trascorso cresce di
// `dt` a ogni ciclo in cui il blocco viene eseguito, quindi la precisione è
// quella del tempo di ciclo (come in molti PLC didattici).
import { leggiBlocco, leggiOperando, normalizzaOperando, operandoScrivibile } from "./operandi";
import { eContatore, eTemporizzatore, type Logica, type ProgrammaLadder, type Uscita } from "./programma";

/** Tempo di ciclo predefinito del PLC simulato, in secondi. */
export const TEMPO_CICLO_PREDEFINITO = 0.05;
/** Limiti del tempo di ciclo impostabile dallo studente (secondi). */
export const TEMPO_CICLO_MINIMO = 0.01;
export const TEMPO_CICLO_MASSIMO = 1;
/** Valore massimo e minimo dei contatori (come un intero a 16 bit). */
export const CONTEGGIO_MASSIMO = 32767;
export const CONTEGGIO_MINIMO = -32768;

/** Tolleranza nei confronti fra tempi (somme di decimali non sono esatte). */
const EPSILON = 1e-9;

/** Stato di un temporizzatore. */
export interface StatoTemporizzatore {
  /** Tempo trascorso (secondi), da mostrare accanto al blocco. */
  trascorso: number;
  preset: number;
  /** Uscita del temporizzatore: è il valore letto dal contatto T…. */
  uscita: boolean;
  /** Ingresso (risultato del segmento) al ciclo precedente, per i fronti. */
  ingressoPrima: boolean;
  /** Solo TP: impulso in corso. */
  inCorso: boolean;
}

/** Stato di un contatore. */
export interface StatoContatore {
  /** Valore di conteggio attuale. */
  conteggio: number;
  preset: number;
  /** Uscita del contatore: è il valore letto dal contatto C…. */
  uscita: boolean;
  ingressoPrima: boolean;
  /**
   * "CTU" se almeno un blocco CTU usa questo contatore, altrimenti "CTD".
   * Decide l'uscita (CTU: conteggio ≥ preset; CTD: conteggio ≤ 0) e il reset
   * (CTU: torna a 0; CTD: si ricarica al preset). Così lo stesso contatore
   * può contare in avanti le auto che entrano e all'indietro quelle che
   * escono, con l'uscita che dice "parcheggio pieno".
   */
  tipo: "CTU" | "CTD";
}

/** Memoria del PLC fra un ciclo e il successivo. */
export interface StatoPlc {
  /** Bit a 1 delle aree I, Q, M (forma normalizzata, es. "Q0.1"); gli assenti valgono 0. */
  bit: Record<string, true>;
  /** Ultimo valore visto da ogni contatto di fronte (chiave: segmento e posizione). */
  memoriaFronti: Record<string, boolean>;
  /** Cicli eseguiti dall'avvio. */
  cicli: number;
  /** Secondi trascorsi dall'avvio (somma dei dt). */
  tempo: number;
  temporizzatori: Record<string, StatoTemporizzatore>;
  contatori: Record<string, StatoContatore>;
}

/** Stato di un segmento dopo la sua esecuzione, per la visualizzazione. */
export interface StatoSegmento {
  /** Vero se la "corrente" arriva alle uscite. */
  risultato: boolean;
  /** Posizioni dei contatti che conducono (vedi `percorso`). */
  contattiChiusi: string[];
}

export interface RisultatoScansione {
  stato: StatoPlc;
  /** Uscite Q a 1 alla fine del ciclo, in ordine. */
  usciteAttive: string[];
  segmenti: StatoSegmento[];
}

/** PLC appena acceso: tutte le aree a 0. */
export function statoInizialePlc(): StatoPlc {
  return { bit: {}, memoriaFronti: {}, cicli: 0, tempo: 0, temporizzatori: {}, contatori: {} };
}

/**
 * Valore di un operando come lo legge un contatto: bit I/Q/M, oppure
 * l'uscita di un temporizzatore (T…) o di un contatore (C…).
 * Operandi non validi o blocchi mai eseguiti valgono 0.
 */
export function valoreBit(stato: Pick<StatoPlc, "bit" | "temporizzatori" | "contatori">, operando: string): boolean {
  const chiave = normalizzaOperando(operando);
  const blocco = leggiBlocco(chiave);
  if (blocco?.area === "T") return stato.temporizzatori[chiave]?.uscita === true;
  if (blocco?.area === "C") return stato.contatori[chiave]?.uscita === true;
  return stato.bit[chiave] === true;
}

/**
 * Posizione di un elemento nell'albero della logica: indici separati da
 * punti a partire dalla radice ("" = radice, "1" = secondo figlio della
 * radice, "1.0" = primo figlio di quello). Serve all'editor per sapere
 * quale contatto colorare.
 */
export function percorso(padre: string, indice: number): string {
  return padre === "" ? String(indice) : `${padre}.${indice}`;
}

/** Esegue un ciclo completo di scansione. */
export function scansione(
  programma: ProgrammaLadder,
  stato: StatoPlc,
  ingressi: Record<string, boolean>,
  dt = 0,
): RisultatoScansione {
  // Copie: lo stato ricevuto non viene mai modificato.
  const bit: Record<string, true> = {};
  const memoriaFronti = { ...stato.memoriaFronti };
  const temporizzatori: Record<string, StatoTemporizzatore> = {};
  for (const [k, v] of Object.entries(stato.temporizzatori)) temporizzatori[k] = { ...v };
  const contatori: Record<string, StatoContatore> = {};
  for (const [k, v] of Object.entries(stato.contatori)) contatori[k] = { ...v };
  const passo = Math.max(0, Number.isFinite(dt) ? dt : 0);

  // 1. Lettura ingressi: l'immagine I viene rifatta da zero,
  //    Q e M conservano il valore del ciclo precedente.
  for (const [chiave, v] of Object.entries(stato.bit)) {
    if (v && leggiOperando(chiave)?.area !== "I") bit[chiave] = true;
  }
  for (const [chiave, v] of Object.entries(ingressi)) {
    const op = leggiOperando(chiave);
    if (v && op?.area === "I") bit[normalizzaOperando(chiave)] = true;
  }

  const immagine = { bit, temporizzatori, contatori };
  const leggi = (operando: string) => valoreBit(immagine, operando);
  const scrivi = (operando: string, valore: boolean) => {
    // Le bobine sugli ingressi o con operando non valido non hanno effetto
    // (la diagnosi del programma li segnalerà allo studente).
    if (!operandoScrivibile(operando)) return;
    const chiave = normalizzaOperando(operando);
    if (valore) bit[chiave] = true;
    else delete bit[chiave];
  };

  // 2. Esecuzione dei segmenti in ordine.
  const segmenti: StatoSegmento[] = programma.segmenti.map((segmento, indice) => {
    const contattiChiusi: string[] = [];

    // Valuta TUTTI gli elementi (niente scorciatoie tipo "&&"): così ogni
    // contatto di fronte aggiorna la sua memoria a ogni ciclo e l'editor
    // può mostrare lo stato di ogni contatto anche nei rami non alimentati.
    const valuta = (logica: Logica, pos: string): boolean => {
      switch (logica.tipo) {
        case "contatto": {
          const valore = leggi(logica.operando);
          let conduce: boolean;
          if (logica.contatto === "NA") conduce = valore;
          else if (logica.contatto === "NC") conduce = !valore;
          else {
            const chiave = `${indice}:${pos}`;
            const prima = memoriaFronti[chiave] ?? false;
            memoriaFronti[chiave] = valore;
            conduce = logica.contatto === "P" ? valore && !prima : !valore && prima;
          }
          if (conduce) contattiChiusi.push(pos);
          return conduce;
        }
        case "serie": {
          // Serie vuota = filo: conduce.
          const esiti = logica.elementi.map((e, i) => valuta(e, percorso(pos, i)));
          return esiti.every(Boolean);
        }
        case "parallelo": {
          // Parallelo vuoto = nessun ramo: non conduce.
          const esiti = logica.rami.map((r, i) => valuta(r, percorso(pos, i)));
          return esiti.some(Boolean);
        }
      }
    };

    const risultato = segmento.logica === null ? true : valuta(segmento.logica, "");
    for (const uscita of segmento.uscite) {
      if (eTemporizzatore(uscita)) eseguiTemporizzatore(uscita, risultato, passo, temporizzatori);
      else if (eContatore(uscita)) eseguiContatore(uscita, risultato, contatori);
      else if (uscita.tipo === "reset" && leggiBlocco(uscita.operando)) {
        if (risultato) azzeraBlocco(uscita.operando, temporizzatori, contatori);
      } else applicaUscita(uscita, risultato, scrivi);
    }
    return { risultato, contattiChiusi };
  });

  // 3. Scrittura uscite: le Q a 1 alla fine del ciclo.
  const usciteAttive = Object.keys(bit)
    .filter((k) => leggiOperando(k)?.area === "Q")
    .sort(confrontaOperandi);

  return {
    stato: { bit, memoriaFronti, cicli: stato.cicli + 1, tempo: stato.tempo + passo, temporizzatori, contatori },
    usciteAttive,
    segmenti,
  };
}

/**
 * Fa scorrere `durata` secondi eseguendo un ciclo ogni `tempoCiclo` secondi
 * con gli ingressi fermi (almeno un ciclo). Comodo per i test e per far
 * avanzare il PLC a scatti regolari dall'interfaccia.
 */
export function avanzaPlc(
  programma: ProgrammaLadder,
  stato: StatoPlc,
  ingressi: Record<string, boolean>,
  durata: number,
  tempoCiclo = TEMPO_CICLO_PREDEFINITO,
): RisultatoScansione {
  const ciclo = limitaTempoCiclo(tempoCiclo);
  const n = Math.max(1, Math.round(durata / ciclo));
  let r = scansione(programma, stato, ingressi, ciclo);
  for (let i = 1; i < n; i++) r = scansione(programma, r.stato, ingressi, ciclo);
  return r;
}

/** Riporta il tempo di ciclo scelto dallo studente fra i limiti ammessi. */
export function limitaTempoCiclo(t: number): number {
  if (!Number.isFinite(t)) return TEMPO_CICLO_PREDEFINITO;
  return Math.min(TEMPO_CICLO_MASSIMO, Math.max(TEMPO_CICLO_MINIMO, t));
}

/** Preset valido: numero finito non negativo (altrimenti 0). */
const presetValido = (p: number) => (Number.isFinite(p) && p > 0 ? p : 0);

/** Un ciclo di un temporizzatore TON/TOF/TP con ingresso `ingresso`. */
function eseguiTemporizzatore(
  uscita: { tipo: "TON" | "TOF" | "TP"; operando: string; preset: number },
  ingresso: boolean,
  dt: number,
  temporizzatori: Record<string, StatoTemporizzatore>,
) {
  const op = leggiBlocco(uscita.operando);
  if (op?.area !== "T") return; // operando sbagliato: la diagnosi lo segnalerà
  const chiave = normalizzaOperando(uscita.operando);
  const pt = presetValido(uscita.preset);
  const t = temporizzatori[chiave] ?? { trascorso: 0, preset: pt, uscita: false, ingressoPrima: false, inCorso: false };
  t.preset = pt;
  const salita = ingresso && !t.ingressoPrima;
  const discesa = !ingresso && t.ingressoPrima;
  switch (uscita.tipo) {
    case "TON":
      // Il tempo parte da 0 nel ciclo del fronte di salita e poi cresce.
      if (!ingresso) t.trascorso = 0;
      else if (salita) t.trascorso = 0;
      else t.trascorso = Math.min(pt, t.trascorso + dt);
      t.uscita = ingresso && t.trascorso >= pt - EPSILON;
      break;
    case "TOF":
      if (ingresso) {
        t.trascorso = 0;
        t.uscita = true;
      } else if (discesa) {
        t.trascorso = 0;
        t.uscita = pt > EPSILON;
      } else if (t.uscita) {
        t.trascorso = Math.min(pt, t.trascorso + dt);
        t.uscita = t.trascorso < pt - EPSILON;
      }
      break;
    case "TP":
      if (t.inCorso) {
        t.trascorso = Math.min(pt, t.trascorso + dt);
        if (t.trascorso >= pt - EPSILON) t.inCorso = false;
      } else if (salita && pt > EPSILON) {
        t.inCorso = true;
        t.trascorso = 0;
      } else if (!ingresso) t.trascorso = 0;
      t.uscita = t.inCorso;
      break;
  }
  t.ingressoPrima = ingresso;
  temporizzatori[chiave] = t;
}

/** Un ciclo di un contatore CTU/CTD: conta i fronti di salita del segmento. */
function eseguiContatore(
  uscita: { tipo: "CTU" | "CTD"; operando: string; preset: number },
  ingresso: boolean,
  contatori: Record<string, StatoContatore>,
) {
  const op = leggiBlocco(uscita.operando);
  if (op?.area !== "C") return;
  const chiave = normalizzaOperando(uscita.operando);
  const pv = Math.round(presetValido(uscita.preset));
  // Al primo uso: CTU parte da 0, CTD parte dal preset.
  const c = contatori[chiave] ?? { conteggio: uscita.tipo === "CTD" ? pv : 0, preset: pv, uscita: false, ingressoPrima: false, tipo: uscita.tipo };
  c.preset = pv;
  if (uscita.tipo === "CTU") c.tipo = "CTU";
  if (ingresso && !c.ingressoPrima) {
    c.conteggio = uscita.tipo === "CTU" ? Math.min(CONTEGGIO_MASSIMO, c.conteggio + 1) : Math.max(CONTEGGIO_MINIMO, c.conteggio - 1);
  }
  c.ingressoPrima = ingresso;
  c.uscita = c.tipo === "CTU" ? c.conteggio >= pv : c.conteggio <= 0;
  contatori[chiave] = c;
}

/** Bobina di reset su T… o C…: azzera il temporizzatore, azzera o ricarica il contatore. */
function azzeraBlocco(
  operando: string,
  temporizzatori: Record<string, StatoTemporizzatore>,
  contatori: Record<string, StatoContatore>,
) {
  const chiave = normalizzaOperando(operando);
  const t = temporizzatori[chiave];
  if (t) temporizzatori[chiave] = { ...t, trascorso: 0, uscita: false, inCorso: false };
  const c = contatori[chiave];
  if (c) {
    const conteggio = c.tipo === "CTD" ? c.preset : 0;
    contatori[chiave] = { ...c, conteggio, uscita: c.tipo === "CTU" ? conteggio >= c.preset : conteggio <= 0 };
  }
}

/** Effetto di un'uscita dato il risultato del segmento. */
function applicaUscita(uscita: Uscita, risultato: boolean, scrivi: (op: string, v: boolean) => void) {
  switch (uscita.tipo) {
    case "bobina":
      scrivi(uscita.operando, risultato);
      break;
    case "bobinaNegata":
      scrivi(uscita.operando, !risultato);
      break;
    case "set":
      if (risultato) scrivi(uscita.operando, true);
      break;
    case "reset":
      if (risultato) scrivi(uscita.operando, false);
      break;
  }
}

/** Ordine naturale degli operandi: area, byte, bit (Q0.2 prima di Q1.0). */
export function confrontaOperandi(a: string, b: string): number {
  const x = leggiOperando(a);
  const y = leggiOperando(b);
  if (!x || !y) return a.localeCompare(b);
  return x.area.localeCompare(y.area) || x.byte - y.byte || x.bit - y.bit;
}
