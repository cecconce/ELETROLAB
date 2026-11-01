// Dal Ladder disegnato sul foglio al programma del motore (puro: nessuna interfaccia).
//
// Nel modulo PLC lo studente posa sul foglio, come in un normale schema:
// - la barra di alimentazione di sinistra (e, se vuole, quella di destra);
// - contatti, bobine e blocchi (temporizzatori, contatori);
// e li collega con i fili. Qui quel disegno diventa un `ProgrammaLadder`:
//
// 1. i morsetti uniti dai fili formano i "nodi" (come in un circuito);
//    tutti i morsetti della barra di sinistra sono un unico nodo alimentato;
// 2. ogni contatto è un ponte fra due nodi;
// 3. per ogni uscita (bobina o blocco) si cercano tutti i percorsi che dalla
//    barra arrivano al suo ingresso passando per i contatti: la logica è
//    "percorso 1 OPPURE percorso 2 …", ogni percorso è "contatto E contatto…".
//    Questa forma (somma di prodotti) funziona per qualsiasi disegno, anche
//    con rami che si incrociano, ed è uguale a serie/paralleli quando il
//    disegno è fatto a serie/paralleli;
// 4. le uscite collegate allo stesso nodo formano un unico segmento (uscite
//    in parallelo); i segmenti vengono eseguiti dall'alto in basso secondo la
//    posizione sul foglio, come si legge un Ladder.
//
// Semplificazione: la corrente può attraversare un contatto in entrambi i
// versi (in un PLC vero il Ladder si legge solo da sinistra a destra); nei
// disegni normali non fa differenza.
import { leggiBlocco, normalizzaOperando, operandoContattoValido, operandoScrivibile } from "./operandi";
import type { Logica, ProgrammaLadder, Segmento, TipoContatto, Uscita } from "./programma";

/** Ruolo di un tipo di componente della libreria PLC. */
export type ModelloLadder =
  | { ruolo: "barraSinistra" }
  | { ruolo: "barraDestra" }
  | { ruolo: "contatto"; contatto: TipoContatto; morsetti: [string, string] }
  | { ruolo: "uscita"; uscita: Uscita["tipo"]; ingresso: string };

/** Modelli dei componenti della libreria PLC (chiave = id della voce in libreria/plc.json). */
export const MODELLI_LADDER: Record<string, ModelloLadder> = {
  "ladder-barra-sinistra": { ruolo: "barraSinistra" },
  "ladder-barra-destra": { ruolo: "barraDestra" },
  "ladder-contatto-na": { ruolo: "contatto", contatto: "NA", morsetti: ["in", "out"] },
  "ladder-contatto-nc": { ruolo: "contatto", contatto: "NC", morsetti: ["in", "out"] },
  "ladder-contatto-p": { ruolo: "contatto", contatto: "P", morsetti: ["in", "out"] },
  "ladder-contatto-n": { ruolo: "contatto", contatto: "N", morsetti: ["in", "out"] },
  "ladder-bobina": { ruolo: "uscita", uscita: "bobina", ingresso: "in" },
  "ladder-bobina-negata": { ruolo: "uscita", uscita: "bobinaNegata", ingresso: "in" },
  "ladder-bobina-set": { ruolo: "uscita", uscita: "set", ingresso: "in" },
  "ladder-bobina-reset": { ruolo: "uscita", uscita: "reset", ingresso: "in" },
  "ladder-ton": { ruolo: "uscita", uscita: "TON", ingresso: "IN" },
  "ladder-tof": { ruolo: "uscita", uscita: "TOF", ingresso: "IN" },
  "ladder-tp": { ruolo: "uscita", uscita: "TP", ingresso: "IN" },
  "ladder-ctu": { ruolo: "uscita", uscita: "CTU", ingresso: "CU" },
  "ladder-ctd": { ruolo: "uscita", uscita: "CTD", ingresso: "CD" },
};

/** Componente del Ladder disegnato, ridotto a ciò che serve alla conversione. */
export interface ElementoLadder {
  id: string;
  tipo: string;
  /** Operando scritto dallo studente (I0.0, Q0.1, T0…). */
  operando: string;
  /** Solo blocchi: secondi (temporizzatori) o impulsi (contatori). */
  preset?: number;
  /** Posizione sul foglio: decide l'ordine dei segmenti. */
  x: number;
  y: number;
}

export interface CollegamentoLadder {
  da: { componente: string; morsetto: string };
  a: { componente: string; morsetto: string };
}

/** Problemi trovati durante la conversione (i testi sono nell'interfaccia). */
export type CodiceProblemaLadder =
  | "senzaBarra" //            manca la barra di alimentazione di sinistra
  | "uscitaNonAlimentata" //   nessun percorso dalla barra all'uscita
  | "operandoNonValido" //     operando vuoto o scritto male
  | "bobinaSuIngresso" //      una bobina non può scrivere un ingresso I
  | "operandoBloccoErrato" //  un temporizzatore deve usare T…, un contatore C…
  | "troppiPercorsi"; //       disegno troppo intricato da convertire

export interface ProblemaLadder {
  codice: CodiceProblemaLadder;
  componenti: string[];
}

export interface RisultatoConversione {
  programma: ProgrammaLadder;
  /** Per ogni segmento, gli id dei componenti di uscita che lo compongono. */
  usciteDeiSegmenti: string[][];
  problemi: ProblemaLadder[];
}

/** Oltre questo numero di percorsi per un'uscita il disegno è considerato troppo intricato. */
export const PERCORSI_MASSIMI = 256;

/** Converte il Ladder disegnato nel programma eseguito dal motore. */
export function convertiLadder(elementi: readonly ElementoLadder[], fili: readonly CollegamentoLadder[]): RisultatoConversione {
  const problemi: ProblemaLadder[] = [];
  const perId = new Map(elementi.map((e) => [e.id, e]));

  // --- 1. Nodi: unione dei morsetti collegati (union-find) ---
  const padre = new Map<string, string>();
  const radice = (k: string): string => {
    let r = k;
    while (padre.has(r) && padre.get(r) !== r) r = padre.get(r)!;
    padre.set(k, r);
    return r;
  };
  const unisci = (a: string, b: string) => {
    const ra = radice(a);
    const rb = radice(b);
    if (ra !== rb) padre.set(ra, rb);
  };
  // Tutti i morsetti di una barra sono lo stesso conduttore.
  const chiave = (componente: string, morsetto: string) => {
    const ruolo = MODELLI_LADDER[perId.get(componente)?.tipo ?? ""]?.ruolo;
    return ruolo === "barraSinistra" || ruolo === "barraDestra" ? `${componente}/*` : `${componente}/${morsetto}`;
  };
  for (const f of fili) {
    if (!perId.has(f.da.componente) || !perId.has(f.a.componente)) continue;
    unisci(chiave(f.da.componente, f.da.morsetto), chiave(f.a.componente, f.a.morsetto));
  }
  const barre = elementi.filter((e) => MODELLI_LADDER[e.tipo]?.ruolo === "barraSinistra");
  for (let i = 1; i < barre.length; i++) unisci(`${barre[0].id}/*`, `${barre[i].id}/*`);
  const alimentato = barre.length > 0 ? radice(`${barre[0].id}/*`) : null;
  if (!alimentato) problemi.push({ codice: "senzaBarra", componenti: [] });

  // --- 2. Contatti come ponti fra nodi ---
  interface Ponte {
    elemento: ElementoLadder;
    contatto: TipoContatto;
    nodi: [string, string];
  }
  const ponti: Ponte[] = [];
  for (const e of elementi) {
    const m = MODELLI_LADDER[e.tipo];
    if (m?.ruolo !== "contatto") continue;
    if (!operandoContattoValido(e.operando)) problemi.push({ codice: "operandoNonValido", componenti: [e.id] });
    ponti.push({ elemento: e, contatto: m.contatto, nodi: [radice(chiave(e.id, m.morsetti[0])), radice(chiave(e.id, m.morsetti[1]))] });
  }
  const pontiDelNodo = new Map<string, Ponte[]>();
  for (const p of ponti) {
    for (const n of p.nodi) pontiDelNodo.set(n, [...(pontiDelNodo.get(n) ?? []), p]);
  }

  /** Tutti i percorsi semplici dalla barra al nodo `arrivo` (null se troppi). */
  const percorsi = (arrivo: string): Ponte[][] | null => {
    if (!alimentato) return [];
    const trovati: Ponte[][] = [];
    const visitati = new Set<string>([alimentato]);
    const usati: Ponte[] = [];
    let troppi = false;
    const visita = (nodo: string) => {
      if (troppi) return;
      if (nodo === arrivo) {
        trovati.push([...usati]);
        if (trovati.length > PERCORSI_MASSIMI) troppi = true;
        return;
      }
      for (const p of pontiDelNodo.get(nodo) ?? []) {
        const altro = p.nodi[0] === nodo ? p.nodi[1] : p.nodi[0];
        if (visitati.has(altro)) continue;
        visitati.add(altro);
        usati.push(p);
        visita(altro);
        usati.pop();
        visitati.delete(altro);
      }
    };
    visita(alimentato);
    return troppi ? null : trovati;
  };

  // --- 3. Uscite raggruppate per nodo d'ingresso ---
  const gruppi = new Map<string, ElementoLadder[]>();
  for (const e of elementi) {
    const m = MODELLI_LADDER[e.tipo];
    if (m?.ruolo !== "uscita") continue;
    controllaOperandoUscita(e, m.uscita, problemi);
    const nodo = radice(chiave(e.id, m.ingresso));
    gruppi.set(nodo, [...(gruppi.get(nodo) ?? []), e]);
  }

  // Ordine di lettura: dall'alto in basso, poi da sinistra a destra.
  const ordine = (a: ElementoLadder, b: ElementoLadder) => a.y - b.y || a.x - b.x;
  const elenco = [...gruppi.entries()]
    .map(([nodo, uscite]) => ({ nodo, uscite: [...uscite].sort(ordine) }))
    .sort((a, b) => ordine(a.uscite[0], b.uscite[0]));

  const segmenti: Segmento[] = [];
  const usciteDeiSegmenti: string[][] = [];
  for (const { nodo, uscite } of elenco) {
    const trovati = percorsi(nodo);
    const ids = uscite.map((u) => u.id);
    if (trovati === null) {
      problemi.push({ codice: "troppiPercorsi", componenti: ids });
      continue;
    }
    if (trovati.length === 0 && alimentato) problemi.push({ codice: "uscitaNonAlimentata", componenti: ids });
    segmenti.push({ logica: logicaDaPercorsi(trovati), uscite: uscite.map(uscitaDa) });
    usciteDeiSegmenti.push(ids);
  }
  return { programma: { segmenti }, usciteDeiSegmenti, problemi };
}

/** Somma di prodotti: OR dei percorsi, ognuno AND dei suoi contatti. */
function logicaDaPercorsi(percorsi: { elemento: ElementoLadder; contatto: TipoContatto }[][]): Logica | null {
  // Un percorso senza contatti (uscita collegata direttamente alla barra): sempre alimentata.
  if (percorsi.some((p) => p.length === 0)) return null;
  const rami: Logica[] = percorsi.map((p) => {
    const contatti: Logica[] = p.map(({ elemento, contatto }) => ({
      tipo: "contatto",
      contatto,
      operando: normalizzaOperando(elemento.operando),
      id: elemento.id,
    }));
    return contatti.length === 1 ? contatti[0] : { tipo: "serie", elementi: contatti };
  });
  return rami.length === 1 ? rami[0] : { tipo: "parallelo", rami };
}

function uscitaDa(e: ElementoLadder): Uscita {
  const m = MODELLI_LADDER[e.tipo] as Extract<ModelloLadder, { ruolo: "uscita" }>;
  const operando = normalizzaOperando(e.operando);
  if (m.uscita === "TON" || m.uscita === "TOF" || m.uscita === "TP" || m.uscita === "CTU" || m.uscita === "CTD") {
    return { tipo: m.uscita, operando, preset: e.preset ?? 0 };
  }
  return { tipo: m.uscita, operando };
}

function controllaOperandoUscita(e: ElementoLadder, tipo: Uscita["tipo"], problemi: ProblemaLadder[]) {
  const blocco = leggiBlocco(e.operando);
  if (tipo === "TON" || tipo === "TOF" || tipo === "TP") {
    if (blocco?.area !== "T") problemi.push({ codice: "operandoBloccoErrato", componenti: [e.id] });
    return;
  }
  if (tipo === "CTU" || tipo === "CTD") {
    if (blocco?.area !== "C") problemi.push({ codice: "operandoBloccoErrato", componenti: [e.id] });
    return;
  }
  // Il reset può azzerare anche temporizzatori e contatori.
  if (tipo === "reset" && blocco) return;
  if (operandoScrivibile(e.operando)) return;
  const n = normalizzaOperando(e.operando);
  problemi.push({ codice: /^I/.test(n) && operandoContattoValido(n) ? "bobinaSuIngresso" : "operandoNonValido", componenti: [e.id] });
}
