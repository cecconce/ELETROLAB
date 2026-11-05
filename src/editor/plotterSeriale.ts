// Plotter seriale del modulo Arduino (come quello dell'IDE e di Tinkercad):
// dalle righe scritte con Serial.println si ricavano una o più serie di
// numeri da disegnare nel tempo. Puro: nessuna interfaccia.
//
// Formati riconosciuti in ogni riga:
// - numeri soli, separati da virgole, punti e virgola, tabulazioni o spazi:
//   «512» oppure «10, 20, 30» (serie «1», «2», «3»);
// - coppie «etichetta: valore», anche con l'unità di misura dopo il numero:
//   «Tensione: 6.00 V», «Temperatura:21.5,Umidita:40».
// Le righe senza numeri (messaggi come «Pronto») si ignorano.

/** Una serie del grafico: nome e valori (null = la riga non conteneva questa serie). */
export interface SeriePlotter {
  nome: string;
  valori: (number | null)[];
}

export interface DatiPlotter {
  serie: SeriePlotter[];
  /** Numero di campioni (righe con numeri) considerati. */
  campioni: number;
  /** Valore minimo e massimo di tutte le serie (per la scala verticale). */
  minimo: number;
  massimo: number;
}

/** Campioni mostrati al massimo (gli ultimi), come nell'IDE. */
export const CAMPIONI_PLOTTER = 200;

const NUMERO = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;
const PRIMO_NUMERO = /[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/;

/** Valori di una riga: coppie (etichetta o null, valore). */
export function valoriRiga(riga: string): { nome: string | null; valore: number }[] {
  const esito: { nome: string | null; valore: number }[] = [];
  for (const pezzo of riga.split(/[,;\t]/)) {
    const p = pezzo.trim();
    if (!p) continue;
    const duepunti = p.lastIndexOf(":");
    if (duepunti > 0) {
      // «etichetta: valore [unità]»: il primo numero dopo i due punti.
      const m = PRIMO_NUMERO.exec(p.slice(duepunti + 1));
      if (m) esito.push({ nome: p.slice(0, duepunti).trim(), valore: Number(m[0]) });
      continue;
    }
    // Numeri separati da spazi; le parole si ignorano.
    for (const parola of p.split(/\s+/)) if (NUMERO.test(parola)) esito.push({ nome: null, valore: Number(parola) });
  }
  return esito.filter((x) => Number.isFinite(x.valore));
}

/** Serie da disegnare a partire dal testo del monitor seriale. */
export function datiPlotter(seriale: string, massimo = CAMPIONI_PLOTTER): DatiPlotter {
  // L'ultima riga può essere ancora a metà (Serial.print senza «a capo»): si salta.
  const righe = seriale.split(/\r?\n/);
  if (!seriale.endsWith("\n")) righe.pop();
  const campioni: { nome: string | null; valore: number }[][] = [];
  for (let i = righe.length - 1; i >= 0 && campioni.length < massimo; i--) {
    const v = valoriRiga(righe[i]);
    if (v.length) campioni.unshift(v);
  }
  // Nomi delle serie nell'ordine in cui compaiono; i numeri senza etichetta
  // prendono il nome della loro posizione nella riga («1», «2», …).
  const nomi: string[] = [];
  const nomeDi = (x: { nome: string | null }, posizione: number) => x.nome ?? String(posizione + 1);
  for (const c of campioni) c.forEach((x, k) => nomi.includes(nomeDi(x, k)) || nomi.push(nomeDi(x, k)));
  const serie: SeriePlotter[] = nomi.map((nome) => ({ nome, valori: [] }));
  let minimo = Infinity;
  let massimoV = -Infinity;
  for (const c of campioni) {
    for (const s of serie) {
      const k = c.findIndex((x, i) => nomeDi(x, i) === s.nome);
      const v = k >= 0 ? c[k].valore : null;
      s.valori.push(v);
      if (v !== null) {
        minimo = Math.min(minimo, v);
        massimoV = Math.max(massimoV, v);
      }
    }
  }
  if (!Number.isFinite(minimo)) return { serie: [], campioni: 0, minimo: 0, massimo: 1 };
  return { serie, campioni: campioni.length, minimo, massimo: massimoV };
}

/**
 * Scala verticale "rotonda" che contiene minimo e massimo, con le tacche:
 * da 0…1023 si ottiene 0…1200 con passo 200, da 19,7…21,3 si ottiene 19,5…21,5.
 */
export function scalaPlotter(minimo: number, massimo: number): { da: number; a: number; passo: number } {
  if (massimo - minimo < 1e-9) {
    // Valore costante: una fascia attorno al valore.
    const margine = Math.max(1, Math.abs(minimo) * 0.1);
    return scalaPlotter(minimo - margine, massimo + margine);
  }
  const grezzo = (massimo - minimo) / 5;
  const potenza = Math.pow(10, Math.floor(Math.log10(grezzo)));
  const passo = [1, 2, 2.5, 5, 10].map((f) => f * potenza).find((p) => p >= grezzo) ?? 10 * potenza;
  const arrotonda = (x: number) => Math.round(x * 1e9) / 1e9;
  return { da: arrotonda(Math.floor(minimo / passo) * passo), a: arrotonda(Math.ceil(massimo / passo) * passo), passo };
}
