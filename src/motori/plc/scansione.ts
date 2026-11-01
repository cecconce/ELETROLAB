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
// L'interfaccia chiamerà `scansione` a intervalli regolari (tempo di ciclo)
// e userà `segmenti` per colorare in tempo reale contatti e bobine.
import { leggiOperando, normalizzaOperando, operandoScrivibile } from "./operandi";
import type { Logica, ProgrammaLadder, Uscita } from "./programma";

/** Memoria del PLC fra un ciclo e il successivo. */
export interface StatoPlc {
  /** Bit a 1 delle aree I, Q, M (forma normalizzata, es. "Q0.1"); gli assenti valgono 0. */
  bit: Record<string, true>;
  /** Ultimo valore visto da ogni contatto di fronte (chiave: segmento e posizione). */
  memoriaFronti: Record<string, boolean>;
  /** Cicli eseguiti dall'avvio. */
  cicli: number;
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
  return { bit: {}, memoriaFronti: {}, cicli: 0 };
}

/** Valore di un operando a bit nello stato (operandi non validi valgono 0). */
export function valoreBit(stato: StatoPlc, operando: string): boolean {
  return stato.bit[normalizzaOperando(operando)] === true;
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
): RisultatoScansione {
  // Copie: lo stato ricevuto non viene mai modificato.
  const bit: Record<string, true> = {};
  const memoriaFronti = { ...stato.memoriaFronti };

  // 1. Lettura ingressi: l'immagine I viene rifatta da zero,
  //    Q e M conservano il valore del ciclo precedente.
  for (const [chiave, v] of Object.entries(stato.bit)) {
    if (v && leggiOperando(chiave)?.area !== "I") bit[chiave] = true;
  }
  for (const [chiave, v] of Object.entries(ingressi)) {
    const op = leggiOperando(chiave);
    if (v && op?.area === "I") bit[normalizzaOperando(chiave)] = true;
  }

  const leggi = (operando: string) => bit[normalizzaOperando(operando)] === true;
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
    for (const uscita of segmento.uscite) applicaUscita(uscita, risultato, scrivi);
    return { risultato, contattiChiusi };
  });

  // 3. Scrittura uscite: le Q a 1 alla fine del ciclo.
  const usciteAttive = Object.keys(bit)
    .filter((k) => leggiOperando(k)?.area === "Q")
    .sort(confrontaOperandi);

  return { stato: { bit, memoriaFronti, cicli: stato.cicli + 1 }, usciteAttive, segmenti };
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
