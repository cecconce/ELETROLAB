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
import { leggiBlocco, leggiOperando, normalizzaOperando, operandoContattoValido, operandoScrivibile } from "./operandi";
import type { Logica, OperatoreConfronto, ProgrammaLadder, Segmento, TipoContatto, Uscita } from "./programma";

/** Ruolo di un tipo di componente della libreria PLC. */
export type ModelloLadder =
  | { ruolo: "barraSinistra" }
  | { ruolo: "barraDestra" }
  /** Nota di testo sul foglio: non partecipa alla logica. */
  | { ruolo: "commento" }
  /**
   * Comando del quadro virtuale, legato a un ingresso I (senza fili):
   * "pulsante" = a 1 finché lo si tiene premuto; "mantenuto" = cambia stato a
   * ogni clic (interruttore, selettore, finecorsa, sensore). `nc` = cablato
   * normalmente chiuso: l'ingresso vale 1 a riposo e 0 quando è azionato.
   */
  | { ruolo: "comando"; modo: "pulsante" | "mantenuto"; nc: boolean }
  /** Attuatore del quadro virtuale, legato a un'uscita Q: si accende quando l'uscita vale 1. */
  | { ruolo: "attuatore"; attuatore: "luce" | "motore" | "suono" }
  /** Impianto animato (nastro, semaforo, cancello…): segnali in impianti/. */
  | { ruolo: "impianto" }
  | { ruolo: "contatto"; contatto: TipoContatto; morsetti: [string, string] }
  /** Blocco di confronto: nel disegno è un ponte fra due morsetti, come un contatto. */
  | { ruolo: "confronto"; operatore: OperatoreConfronto; morsetti: [string, string] }
  /** `ingressoGiu`: secondo ingresso (CD) del contatore CTUD. */
  | { ruolo: "uscita"; uscita: Uscita["tipo"]; ingresso: string; ingressoGiu?: string };

/** Modelli dei componenti della libreria PLC (chiave = id della voce in libreria/plc.json). */
export const MODELLI_LADDER: Record<string, ModelloLadder> = {
  "ladder-barra-sinistra": { ruolo: "barraSinistra" },
  "ladder-barra-destra": { ruolo: "barraDestra" },
  "ladder-commento": { ruolo: "commento" },
  "quadro-pulsante-na": { ruolo: "comando", modo: "pulsante", nc: false },
  "quadro-pulsante-nc": { ruolo: "comando", modo: "pulsante", nc: true },
  "quadro-interruttore": { ruolo: "comando", modo: "mantenuto", nc: false },
  "quadro-selettore": { ruolo: "comando", modo: "mantenuto", nc: false },
  "quadro-finecorsa": { ruolo: "comando", modo: "mantenuto", nc: false },
  "quadro-sensore": { ruolo: "comando", modo: "mantenuto", nc: false },
  "quadro-lampada": { ruolo: "attuatore", attuatore: "luce" },
  "quadro-motore": { ruolo: "attuatore", attuatore: "motore" },
  "quadro-sirena": { ruolo: "attuatore", attuatore: "suono" },
  "impianto-nastro": { ruolo: "impianto" },
  "impianto-semaforo": { ruolo: "impianto" },
  "impianto-cancello": { ruolo: "impianto" },
  "impianto-serbatoio": { ruolo: "impianto" },
  "impianto-ascensore": { ruolo: "impianto" },
  "impianto-parcheggio": { ruolo: "impianto" },
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
  "ladder-ctud": { ruolo: "uscita", uscita: "CTUD", ingresso: "CU", ingressoGiu: "CD" },
  "ladder-confronto-uguale": { ruolo: "confronto", operatore: "==", morsetti: ["in", "out"] },
  "ladder-confronto-diverso": { ruolo: "confronto", operatore: "<>", morsetti: ["in", "out"] },
  "ladder-confronto-minore": { ruolo: "confronto", operatore: "<", morsetti: ["in", "out"] },
  "ladder-confronto-maggiore": { ruolo: "confronto", operatore: ">", morsetti: ["in", "out"] },
  "ladder-confronto-minore-uguale": { ruolo: "confronto", operatore: "<=", morsetti: ["in", "out"] },
  "ladder-confronto-maggiore-uguale": { ruolo: "confronto", operatore: ">=", morsetti: ["in", "out"] },
};

/** Componente del Ladder disegnato, ridotto a ciò che serve alla conversione. */
export interface ElementoLadder {
  id: string;
  tipo: string;
  /** Operando scritto dallo studente (I0.0, Q0.1, T0…). */
  operando: string;
  /** Solo blocchi: secondi (temporizzatori), impulsi (contatori) o costante (confronti). */
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
  | "operandoConfronto" //     un blocco di confronto legge un temporizzatore T… o un contatore C…
  | "troppiPercorsi" //        disegno troppo intricato da convertire
  | "bobinaDoppia" //          due bobine normali sullo stesso operando (avviso: vale l'ultima)
  | "comandoSenzaIngresso" //  un comando del quadro deve essere collegato a un ingresso I
  | "attuatoreSenzaUscita"; // un attuatore del quadro deve essere collegato a un'uscita Q (o a un merker M)

export interface ProblemaLadder {
  codice: CodiceProblemaLadder;
  componenti: string[];
}

export interface RisultatoConversione {
  programma: ProgrammaLadder;
  /** Nodo elettrico di ogni morsetto usato ("componente/morsetto" → nodo), per colorare i fili. */
  nodi: Record<string, string>;
  /** Nodo della barra di sinistra (null se manca). */
  nodoAlimentato: string | null;
  /** Contatti come ponti fra due nodi (id del componente e nodi ai suoi capi). */
  ponti: { id: string; nodi: [string, string] }[];
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
  // Contatti e blocchi di confronto sono entrambi "ponti": cambia solo la
  // foglia della logica che li rappresenta.
  interface Ponte {
    elemento: ElementoLadder;
    foglia: Logica;
    morsetti: [string, string];
    nodi: [string, string];
  }
  const ponti: Ponte[] = [];
  for (const e of elementi) {
    const m = MODELLI_LADDER[e.tipo];
    if (m?.ruolo !== "contatto" && m?.ruolo !== "confronto") continue;
    const operando = normalizzaOperando(e.operando);
    let foglia: Logica;
    if (m.ruolo === "contatto") {
      if (!operandoContattoValido(e.operando)) problemi.push({ codice: "operandoNonValido", componenti: [e.id] });
      foglia = { tipo: "contatto", contatto: m.contatto, operando, id: e.id };
    } else {
      if (!leggiBlocco(e.operando)) problemi.push({ codice: "operandoConfronto", componenti: [e.id] });
      const valore = Number.isFinite(e.preset) ? (e.preset as number) : 0;
      foglia = { tipo: "confronto", operatore: m.operatore, operando, valore, id: e.id };
    }
    ponti.push({ elemento: e, foglia, morsetti: m.morsetti, nodi: [radice(chiave(e.id, m.morsetti[0])), radice(chiave(e.id, m.morsetti[1]))] });
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
  // Il CTUD ha due ingressi: entra nel gruppo del nodo di CU (verso "su") e
  // in quello del nodo di CD (verso "giu"). Un suo ingresso senza fili si
  // ignora (il blocco conta solo in un verso), purché l'altro sia collegato.
  const conFilo = new Set(fili.flatMap((f) => [`${f.da.componente}/${f.da.morsetto}`, `${f.a.componente}/${f.a.morsetto}`]));
  interface UscitaPosata {
    e: ElementoLadder;
    verso?: "su" | "giu";
  }
  const gruppi = new Map<string, UscitaPosata[]>();
  const aggiungi = (nodo: string, u: UscitaPosata) => gruppi.set(nodo, [...(gruppi.get(nodo) ?? []), u]);
  for (const e of elementi) {
    const m = MODELLI_LADDER[e.tipo];
    if (m?.ruolo !== "uscita") continue;
    controllaOperandoUscita(e, m.uscita, problemi);
    if (m.ingressoGiu) {
      const su = conFilo.has(`${e.id}/${m.ingresso}`);
      const giu = conFilo.has(`${e.id}/${m.ingressoGiu}`);
      if (su || !giu) aggiungi(radice(chiave(e.id, m.ingresso)), { e, verso: "su" });
      if (giu) aggiungi(radice(chiave(e.id, m.ingressoGiu)), { e, verso: "giu" });
      continue;
    }
    aggiungi(radice(chiave(e.id, m.ingresso)), { e });
  }

  // Ordine di lettura: dall'alto in basso, poi da sinistra a destra.
  const ordine = (a: UscitaPosata, b: UscitaPosata) => a.e.y - b.e.y || a.e.x - b.e.x;
  const elenco = [...gruppi.entries()]
    .map(([nodo, uscite]) => ({ nodo, uscite: [...uscite].sort(ordine) }))
    .sort((a, b) => ordine(a.uscite[0], b.uscite[0]));

  const segmenti: Segmento[] = [];
  const usciteDeiSegmenti: string[][] = [];
  for (const { nodo, uscite } of elenco) {
    const trovati = percorsi(nodo);
    const ids = [...new Set(uscite.map((u) => u.e.id))];
    if (trovati === null) {
      problemi.push({ codice: "troppiPercorsi", componenti: ids });
      continue;
    }
    if (trovati.length === 0 && alimentato) problemi.push({ codice: "uscitaNonAlimentata", componenti: ids });
    segmenti.push({ logica: logicaDaPercorsi(trovati), uscite: uscite.map((u) => uscitaDa(u.e, u.verso)) });
    usciteDeiSegmenti.push(ids);
  }
  // Quadro virtuale: i comandi leggono ingressi I, gli attuatori uscite Q o merker M.
  for (const e of elementi) {
    const m = MODELLI_LADDER[e.tipo];
    if (m?.ruolo === "comando" && leggiOperando(e.operando)?.area !== "I") {
      problemi.push({ codice: "comandoSenzaIngresso", componenti: [e.id] });
    }
    if (m?.ruolo === "attuatore" && !operandoScrivibile(e.operando)) {
      problemi.push({ codice: "attuatoreSenzaUscita", componenti: [e.id] });
    }
  }

  // Avviso: due bobine normali (non set/reset) che scrivono lo stesso
  // operando. Il PLC esegue lo stesso il programma, ma vale l'ultima.
  const perOperando = new Map<string, string[]>();
  for (const e of elementi) {
    const m = MODELLI_LADDER[e.tipo];
    if (m?.ruolo !== "uscita" || (m.uscita !== "bobina" && m.uscita !== "bobinaNegata")) continue;
    if (!operandoScrivibile(e.operando)) continue;
    const op = normalizzaOperando(e.operando);
    perOperando.set(op, [...(perOperando.get(op) ?? []), e.id]);
  }
  for (const ids of perOperando.values()) if (ids.length > 1) problemi.push({ codice: "bobinaDoppia", componenti: ids });

  // Nodo di ogni morsetto citato da un filo o da un contatto/uscita.
  const nodi: Record<string, string> = {};
  for (const f of fili) {
    for (const e of [f.da, f.a]) if (perId.has(e.componente)) nodi[`${e.componente}/${e.morsetto}`] = radice(chiave(e.componente, e.morsetto));
  }
  for (const p of ponti) {
    nodi[`${p.elemento.id}/${p.morsetti[0]}`] = p.nodi[0];
    nodi[`${p.elemento.id}/${p.morsetti[1]}`] = p.nodi[1];
  }
  return {
    programma: { segmenti },
    nodi,
    nodoAlimentato: alimentato,
    ponti: ponti.map((p) => ({ id: p.elemento.id, nodi: p.nodi })),
    usciteDeiSegmenti,
    problemi,
  };
}

/**
 * Nodi sotto tensione: quelli raggiungibili dalla barra attraversando i
 * contatti chiusi (id in `chiusi`). Serve solo a colorare i fili.
 */
export function nodiAlimentati(conversione: Pick<RisultatoConversione, "nodoAlimentato" | "ponti">, chiusi: ReadonlySet<string>): Set<string> {
  const accesi = new Set<string>();
  if (!conversione.nodoAlimentato) return accesi;
  const daVisitare = [conversione.nodoAlimentato];
  accesi.add(conversione.nodoAlimentato);
  while (daVisitare.length > 0) {
    const n = daVisitare.pop()!;
    for (const p of conversione.ponti) {
      if (!chiusi.has(p.id)) continue;
      const [a, b] = p.nodi;
      const altro = a === n ? b : b === n ? a : null;
      if (altro !== null && !accesi.has(altro)) {
        accesi.add(altro);
        daVisitare.push(altro);
      }
    }
  }
  return accesi;
}

/** Somma di prodotti: OR dei percorsi, ognuno AND dei suoi contatti. */
function logicaDaPercorsi(percorsi: { foglia: Logica }[][]): Logica | null {
  // Un percorso senza contatti (uscita collegata direttamente alla barra): sempre alimentata.
  if (percorsi.some((p) => p.length === 0)) return null;
  const rami: Logica[] = percorsi.map((p) => {
    const contatti: Logica[] = p.map(({ foglia }) => foglia);
    return contatti.length === 1 ? contatti[0] : { tipo: "serie", elementi: contatti };
  });
  return rami.length === 1 ? rami[0] : { tipo: "parallelo", rami };
}

function uscitaDa(e: ElementoLadder, verso?: "su" | "giu"): Uscita {
  const m = MODELLI_LADDER[e.tipo] as Extract<ModelloLadder, { ruolo: "uscita" }>;
  const operando = normalizzaOperando(e.operando);
  if (m.uscita === "CTUD") return { tipo: "CTUD", operando, preset: e.preset ?? 0, verso: verso ?? "su" };
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
  if (tipo === "CTU" || tipo === "CTD" || tipo === "CTUD") {
    if (blocco?.area !== "C") problemi.push({ codice: "operandoBloccoErrato", componenti: [e.id] });
    return;
  }
  // Il reset può azzerare anche temporizzatori e contatori.
  if (tipo === "reset" && blocco) return;
  if (operandoScrivibile(e.operando)) return;
  const n = normalizzaOperando(e.operando);
  problemi.push({ codice: /^I/.test(n) && operandoContattoValido(n) ? "bobinaSuIngresso" : "operandoNonValido", componenti: [e.id] });
}
