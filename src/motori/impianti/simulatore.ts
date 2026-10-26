// Motore di simulazione elettromeccanica (puro: nessuna interfaccia).
//
// Come funziona, in breve:
// 1. NODI: i morsetti uniti da fili formano un nodo elettrico (stesso potenziale).
// 2. GRUPPI: i nodi uniti da un tratto chiuso (conduttore o contatto chiuso)
//    formano un gruppo; ogni gruppo "porta" i poli della rete (L1, L2, L3, N)
//    che lo raggiungono. Un gruppo con due poli diversi è un cortocircuito.
// 3. CARICHI: un utilizzatore (bobina, lampada, motore) è alimentato se ogni
//    suo morsetto raggiunge esattamente un polo e i poli sono tutti diversi
//    (es. A1 su L1 e A2 su N).
// 4. STATO STABILE: le bobine eccitate fanno commutare i contatti con la
//    stessa sigla, il che può alimentare o togliere tensione ad altre bobine.
//    Si ripete cambiando UNA bobina alla volta finché nulla cambia; se si
//    ritorna in uno stato già visto il circuito oscilla (es. una bobina che
//    apre il proprio contatto di alimentazione).
// 5. MOTORI: per i motori trifase si calcola con i fasori (numeri complessi)
//    la terna di tensioni sugli avvolgimenti: terna diretta = verso orario,
//    terna inversa = verso antiorario, terna squilibrata (manca una fase) =
//    il motore non parte. Così si riconoscono anche stella e triangolo.
// 6. PROTEZIONI: `simulaConProtezioni` fa intervenire fusibili,
//    magnetotermici e salvamotori attraversati da un cortocircuito, scegliendo
//    quello più vicino al guasto (selettività).
import {
  MODELLI_IMPIANTI,
  POLI_ALTERNATA,
  POLI_CONTINUA,
  PROTEZIONI,
  TEMPO_MASSIMO,
  TEMPO_MINIMO,
  TEMPO_PREDEFINITO,
  type ModelloComponente,
  type Polo,
} from "./modelli";

/** Componente del circuito: basta il tipo della libreria e la sigla. */
export interface ComponenteCircuito {
  id: string;
  tipo: string;
  etichetta: string;
  /** Solo per i temporizzatori: tempo di ritardo in secondi. */
  tempo?: number;
}

export interface CapoFilo {
  componente: string;
  morsetto: string;
}

export interface FiloCircuito {
  da: CapoFilo;
  a: CapoFilo;
}

/** Circuito da simulare: compatibile con lo `Schema` dell'editor. */
export interface Circuito {
  componenti: readonly ComponenteCircuito[];
  fili: readonly FiloCircuito[];
}

/** Azioni dello studente durante la simulazione. */
export interface Ingressi {
  /** Id dei pulsanti tenuti premuti in questo momento. */
  premuti?: Iterable<string>;
  /**
   * Id dei comandi a posizione mantenuta azionati (selettori, finecorsa,
   * sensori, sezionatori e salvamotori chiusi).
   */
  azionati?: Iterable<string>;
  /** Sigle dei relè termici intervenuti (F1…): i loro contatti 95-96 / 97-98 commutano. */
  termiciIntervenuti?: Iterable<string>;
  /**
   * Id delle protezioni intervenute: fusibili interrotti, magnetotermici e
   * salvamotori scattati (aperti), relè termici scattati (commutano i loro
   * contatti 95-96 / 97-98). Si azzerano con il riarmo.
   */
  protezioniIntervenute?: Iterable<string>;
  /** Id dei motori a cui lo studente ha messo un sovraccarico (es. albero frenato). */
  sovraccarichi?: Iterable<string>;
}

/**
 * Stato dei temporizzatori calcolato da tempo.ts in base al tempo trascorso.
 * Il simulatore non conta il tempo: riceve solo chi ha già finito il ritardo.
 */
export interface StatoTemporizzatori {
  /** Temporizzatori ritardati all'eccitazione alimentati da almeno il loro tempo. */
  scaduti?: Iterable<string>;
  /** Temporizzatori ritardati alla diseccitazione non più alimentati, ma ancora nel tempo di ritardo. */
  inRitardo?: Iterable<string>;
}

/** Stato di un motore che gira. */
export interface StatoMotore {
  verso: "orario" | "antiorario";
  /** Solo per il motore a 6 morsetti: come sono collegati gli avvolgimenti. */
  collegamento?: "stella" | "triangolo";
}

export interface Cortocircuito {
  /** Poli che si toccano senza un carico in mezzo (es. ["L1", "N"]). */
  poli: Polo[];
  /** Morsetti coinvolti ("id:morsetto"), per evidenziare il punto. */
  morsetti: string[];
}

export interface RisultatoSimulazione {
  /** true se il circuito ha raggiunto uno stato che non cambia più. */
  stabile: boolean;
  /** Id delle bobine eccitate (da passare al passo successivo come memoria). */
  bobineEccitate: string[];
  /** Id dei contatti (pulsanti compresi) chiusi in questo momento. */
  contattiChiusi: string[];
  /** Id dei carichi alimentati (bobine comprese). */
  carichiAlimentati: string[];
  /** Per ogni morsetto ("id:morsetto") i poli che lo raggiungono: serve a colorare i fili. */
  poliDeiMorsetti: Record<string, Polo[]>;
  cortocircuiti: Cortocircuito[];
  /** Se il circuito oscilla: le bobine che continuano a cambiare stato. */
  oscillazione: { bobine: string[] } | null;
  /** Componenti con tipo sconosciuto al motore (ignorati, come se non ci fossero). */
  ignorati: string[];
  /** Numero di commutazioni di bobine eseguite per arrivare al risultato. */
  passi: number;
  /** Motori che girano, con verso di rotazione (e collegamento stella/triangolo). */
  motori: Record<string, StatoMotore>;
  /** Id dei temporizzatori i cui contatti sono commutati in questo momento. */
  temporizzatoriCommutati: string[];
  /** Protezioni intervenute considerate in questo calcolo. */
  protezioniIntervenute: string[];
  /** Protezioni termiche che alimentano un motore in sovraccarico (scattano dopo un po'). */
  protezioniInSovraccarico: string[];
  /** Per ogni morsetto ("id:morsetto") il gruppo elettrico: morsetti con lo stesso gruppo sono allo stesso potenziale. */
  gruppoDeiMorsetti: Record<string, string>;
}

/** Oltre questo numero di commutazioni ci si ferma comunque (protezione). */
const LIMITE_PASSI = 500;

/** Chiave univoca di un morsetto: "idComponente:morsetto". */
export function chiaveMorsetto(componente: string, morsetto: string): string {
  return `${componente}:${morsetto}`;
}

/** Tempo di un temporizzatore, in secondi, entro i limiti ammessi. */
export function tempoDi(c: ComponenteCircuito): number {
  const t = typeof c.tempo === "number" && Number.isFinite(c.tempo) ? c.tempo : TEMPO_PREDEFINITO;
  return Math.min(TEMPO_MASSIMO, Math.max(TEMPO_MINIMO, t));
}

/** Union-find minimale su stringhe, per raggruppare nodi e gruppi. */
class Insiemi {
  private padre = new Map<string, string>();
  aggiungi(x: string): void {
    if (!this.padre.has(x)) this.padre.set(x, x);
  }
  radice(x: string): string {
    this.aggiungi(x);
    let r = x;
    while (this.padre.get(r) !== r) r = this.padre.get(r)!;
    // Compressione del percorso: le prossime ricerche saranno immediate.
    let y = x;
    while (y !== r) {
      const p = this.padre.get(y)!;
      this.padre.set(y, r);
      y = p;
    }
    return r;
  }
  unisci(a: string, b: string): void {
    const ra = this.radice(a);
    const rb = this.radice(b);
    if (ra !== rb) this.padre.set(ra, rb);
  }
}

interface ComponenteNoto {
  c: ComponenteCircuito;
  m: ModelloComponente;
}

/** Morsetti di un modello (quelli che il motore considera). */
export function morsettiDelModello(m: ModelloComponente): string[] {
  if (m.tipo === "sorgente") return m.uscite.map((u) => u.morsetto);
  if (m.tipo === "carico") return [...m.morsetti];
  return m.tratti.flatMap((t) => [...t]);
}

/** Prepara le strutture che non cambiano durante la simulazione. */
function preparaCircuito(circuito: Circuito) {
  const noti: ComponenteNoto[] = [];
  const ignorati: string[] = [];
  for (const c of circuito.componenti) {
    const m = MODELLI_IMPIANTI[c.tipo];
    if (m) noti.push({ c, m });
    else ignorati.push(c.id);
  }
  // Nodi: morsetti uniti dai fili.
  const nodi = new Insiemi();
  for (const { c, m } of noti) for (const t of morsettiDelModello(m)) nodi.aggiungi(chiaveMorsetto(c.id, t));
  for (const f of circuito.fili) {
    nodi.unisci(chiaveMorsetto(f.da.componente, f.da.morsetto), chiaveMorsetto(f.a.componente, f.a.morsetto));
  }
  const nodoDi = (id: string, t: string) => nodi.radice(chiaveMorsetto(id, t));
  // Bobine raggruppate per sigla: un contatto "K1" segue la bobina "K1".
  const bobine = noti.filter((n) => n.m.tipo === "carico" && n.m.bobina);
  return { noti, ignorati, nodoDi, bobine };
}

type Preparato = ReturnType<typeof preparaCircuito>;

/** Azioni dello studente e protezioni intervenute, già pronte per la ricerca. */
interface StatoComandi {
  premuti: ReadonlySet<string>;
  azionati: ReadonlySet<string>;
  /** Sigle dei relè termici intervenuti. */
  termici: ReadonlySet<string>;
  /** Id delle protezioni intervenute (aperte se fusibili, magnetotermici o salvamotori). */
  intervenute: ReadonlySet<string>;
  sovraccarichi: ReadonlySet<string>;
  scaduti: ReadonlySet<string>;
  inRitardo: ReadonlySet<string>;
  /** Bobine eccitate all'inizio del calcolo (per il ritardo alla diseccitazione). */
  precedenti: ReadonlySet<string>;
}

/** Dice se un contatto è chiuso, dati i comandi dello studente e le bobine eccitate. */
function contattoChiuso(n: ComponenteNoto, comandi: StatoComandi, sigleEccitate: ReadonlySet<string>): boolean {
  if (n.m.tipo !== "contatto") return false;
  const sigla = n.c.etichetta.trim();
  let azionato: boolean;
  switch (n.m.comando.tipo) {
    case "pulsante":
      azionato = comandi.premuti.has(n.c.id);
      break;
    case "manuale":
      // Un salvamotore scattato resta aperto finché non viene riarmato.
      if (comandi.intervenute.has(n.c.id)) return false;
      azionato = comandi.azionati.has(n.c.id);
      break;
    case "bobina":
      azionato = sigla !== "" && sigleEccitate.has(sigla);
      break;
    case "termico":
      azionato = sigla !== "" && comandi.termici.has(sigla);
      break;
  }
  // Contatto NC: chiuso a riposo, si apre se azionato. NA: il contrario.
  return n.m.normalmenteChiuso ? !azionato : azionato;
}

/** Calcola tensioni e carichi alimentati per un dato stato delle bobine. */
function valuta(p: Preparato, comandi: StatoComandi, eccitate: ReadonlySet<string>) {
  // Bobine i cui contatti sono commutati: per un temporizzatore dipende dal ritardo.
  const commutate = p.bobine.filter((b) => bobinaCommutata(b, comandi, eccitate.has(b.c.id)));
  const sigleEccitate = new Set(commutate.map((b) => b.c.etichetta.trim()).filter((s) => s !== ""));
  // Gruppi: nodi uniti da tratti chiusi.
  const gruppi = new Insiemi();
  const contattiChiusi: string[] = [];
  for (const n of p.noti) {
    if (n.m.tipo === "conduttore") {
      // Fusibile interrotto o magnetotermico scattato: il tratto è aperto.
      if (comandi.intervenute.has(n.c.id) && PROTEZIONI[n.c.tipo]?.cortocircuito) continue;
      for (const [a, b] of n.m.tratti) gruppi.unisci(p.nodoDi(n.c.id, a), p.nodoDi(n.c.id, b));
    } else if (n.m.tipo === "contatto" && contattoChiuso(n, comandi, sigleEccitate)) {
      // Tutti i poli dello stesso componente si muovono insieme.
      contattiChiusi.push(n.c.id);
      for (const [a, b] of n.m.tratti) gruppi.unisci(p.nodoDi(n.c.id, a), p.nodoDi(n.c.id, b));
    }
  }
  const gruppoDi = (id: string, t: string) => gruppi.radice(p.nodoDi(id, t));
  // Poli che raggiungono ogni gruppo.
  const poliDelGruppo = new Map<string, Set<Polo>>();
  for (const n of p.noti) {
    if (n.m.tipo !== "sorgente") continue;
    for (const u of n.m.uscite) {
      const g = gruppoDi(n.c.id, u.morsetto);
      if (!poliDelGruppo.has(g)) poliDelGruppo.set(g, new Set());
      poliDelGruppo.get(g)!.add(u.polo);
    }
  }
  const poliDi = (id: string, t: string): Polo[] => [...(poliDelGruppo.get(gruppoDi(id, t)) ?? [])].sort();

  // Poli di ogni morsetto e cortocircuiti (gruppi con più poli).
  const poliDeiMorsetti: Record<string, Polo[]> = {};
  const morsettiDelGruppo = new Map<string, string[]>();
  for (const n of p.noti) {
    for (const t of morsettiDelModello(n.m)) {
      const k = chiaveMorsetto(n.c.id, t);
      poliDeiMorsetti[k] = poliDi(n.c.id, t);
      const g = gruppoDi(n.c.id, t);
      if (!morsettiDelGruppo.has(g)) morsettiDelGruppo.set(g, []);
      morsettiDelGruppo.get(g)!.push(k);
    }
  }
  const cortocircuiti: Cortocircuito[] = [];
  for (const [g, poli] of poliDelGruppo) {
    if (poli.size > 1) cortocircuiti.push({ poli: [...poli].sort(), morsetti: morsettiDelGruppo.get(g) ?? [] });
  }

  // Carichi alimentati: ogni morsetto su un solo polo, tutti poli diversi,
  // senza mescolare alternata e continua. I motori hanno regole proprie.
  const carichiAlimentati: string[] = [];
  const motori: Record<string, StatoMotore> = {};
  for (const n of p.noti) {
    if (n.m.tipo !== "carico") continue;
    if (n.m.motore) {
      const stato = valutaMotore(n.m.motore, n.m.morsetti, (t) => poliDi(n.c.id, t), (t) => gruppoDi(n.c.id, t));
      if (stato) {
        motori[n.c.id] = stato;
        carichiAlimentati.push(n.c.id);
      }
      continue;
    }
    const poli = n.m.morsetti.map((t) => poliDi(n.c.id, t));
    if (poliSeparati(poli)) carichiAlimentati.push(n.c.id);
  }

  const gruppoDeiMorsetti: Record<string, string> = {};
  for (const n of p.noti) for (const t of morsettiDelModello(n.m)) gruppoDeiMorsetti[chiaveMorsetto(n.c.id, t)] = gruppoDi(n.c.id, t);

  // Protezioni termiche che portano corrente a un motore in sovraccarico:
  // semplificazione, basta che un loro morsetto sia nel gruppo di un morsetto del motore.
  const protezioniInSovraccarico: string[] = [];
  const gruppiSovraccarichi = new Set<string>();
  for (const id of Object.keys(motori)) {
    if (!comandi.sovraccarichi.has(id)) continue;
    const n = p.noti.find((x) => x.c.id === id)!;
    for (const t of morsettiDelModello(n.m)) gruppiSovraccarichi.add(gruppoDi(id, t));
  }
  for (const n of p.noti) {
    if (!PROTEZIONI[n.c.tipo]?.sovraccarico || comandi.intervenute.has(n.c.id)) continue;
    // Un salvamotore aperto non porta corrente.
    if (n.m.tipo === "contatto" && !contattiChiusi.includes(n.c.id)) continue;
    if (morsettiDelModello(n.m).some((t) => gruppiSovraccarichi.has(gruppoDi(n.c.id, t)))) {
      protezioniInSovraccarico.push(n.c.id);
    }
  }

  return {
    contattiChiusi,
    carichiAlimentati,
    poliDeiMorsetti,
    cortocircuiti,
    motori,
    temporizzatoriCommutati: commutate.filter((b) => b.m.tipo === "carico" && b.m.temporizzata).map((b) => b.c.id),
    protezioniInSovraccarico,
    gruppoDeiMorsetti,
  };
}

/** Contatti della bobina commutati? Per i temporizzatori conta il ritardo. */
function bobinaCommutata(b: ComponenteNoto, comandi: StatoComandi, eccitata: boolean): boolean {
  if (b.m.tipo !== "carico") return false;
  const tempo = tempoDi(b.c);
  switch (b.m.temporizzata) {
    case "eccitazione":
      // Commuta solo dopo essere rimasto alimentato per il tempo impostato.
      return eccitata && (tempo <= 0 || comandi.scaduti.has(b.c.id));
    case "diseccitazione":
      // Commuta subito; tolta tensione resta commutato per il tempo impostato
      // (anche se la tensione manca proprio da questo calcolo).
      return eccitata || (tempo > 0 && (comandi.inRitardo.has(b.c.id) || comandi.precedenti.has(b.c.id)));
    default:
      return eccitata;
  }
}

/** Ogni morsetto su un solo polo, poli tutti diversi e dello stesso tipo di corrente. */
function poliSeparati(poli: Polo[][]): boolean {
  if (!poli.every((x) => x.length === 1)) return false;
  const usati = poli.map((x) => x[0]);
  if (new Set(usati).size !== usati.length) return false;
  return usati.every((x) => POLI_ALTERNATA.includes(x)) || usati.every((x) => POLI_CONTINUA.includes(x));
}

// --- Fasori: numeri complessi [parte reale, parte immaginaria] ---
type Complesso = readonly [number, number];
const polare = (gradi: number): Complesso => [Math.cos((gradi * Math.PI) / 180), Math.sin((gradi * Math.PI) / 180)];
const somma = (a: Complesso, b: Complesso): Complesso => [a[0] + b[0], a[1] + b[1]];
const differenza = (a: Complesso, b: Complesso): Complesso => [a[0] - b[0], a[1] - b[1]];
const prodotto = (a: Complesso, b: Complesso): Complesso => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const modulo = (a: Complesso) => Math.hypot(a[0], a[1]);

/** Tensioni di fase (valore relativo: 1 = 230 V). L2 è in ritardo di 120° su L1, L3 di 240°. */
const FASORE: Partial<Record<Polo, Complesso>> = { L1: polare(0), L2: polare(-120), L3: polare(120), N: [0, 0] };
const OPERATORE_A = polare(120);
const OPERATORE_A2 = polare(240);

/**
 * Componenti simmetriche di una terna (Fortescue): diretta e inversa.
 * Terna diretta pura → campo rotante in verso orario; inversa pura → antiorario.
 */
function componentiSimmetriche(va: Complesso, vb: Complesso, vc: Complesso) {
  const diretta = somma(somma(va, prodotto(OPERATORE_A, vb)), prodotto(OPERATORE_A2, vc));
  const inversa = somma(somma(va, prodotto(OPERATORE_A2, vb)), prodotto(OPERATORE_A, vc));
  return { diretta: modulo(diretta) / 3, inversa: modulo(inversa) / 3 };
}

/** Tensione di un morsetto in alternata (undefined se manca o è ambigua). */
function fasoreDi(poli: Polo[]): Complesso | undefined {
  return poli.length === 1 ? FASORE[poli[0]] : undefined;
}

/** Dice se un motore gira e in che verso. */
function valutaMotore(
  tipo: NonNullable<Extract<ModelloComponente, { tipo: "carico" }>["motore"]>,
  morsetti: string[],
  poliDi: (morsetto: string) => Polo[],
  gruppoDi: (morsetto: string) => string,
): StatoMotore | null {
  if (tipo === "monofase") {
    const poli = morsetti.map(poliDi);
    return poliSeparati(poli) && POLI_ALTERNATA.includes(poli[0][0]) ? { verso: "orario" } : null;
  }
  if (tipo === "cc") {
    const poli = morsetti.map(poliDi);
    if (!poliSeparati(poli) || !POLI_CONTINUA.includes(poli[0][0])) return null;
    // A1 sul + → orario; invertendo la polarità si inverte il verso.
    return { verso: poli[0][0] === "+" ? "orario" : "antiorario" };
  }
  // Trifase: le tre tensioni di linea devono essere tre fasi (non il neutro).
  const linee = morsetti.slice(0, 3).map((t) => poliDi(t));
  if (!linee.every((x) => x.length === 1 && ["L1", "L2", "L3"].includes(x[0]))) return null;
  const v = linee.map((x) => FASORE[x[0]]!);
  let avvolgimenti: Complesso[];
  if (tipo === "trifase") {
    // Stella interna: il centro stella non cambia le componenti diretta e inversa.
    avvolgimenti = v;
  } else {
    const fini = morsetti.slice(3, 6);
    const fasoriFini = fini.map((t) => fasoreDi(poliDi(t)));
    const gruppiFini = new Set(fini.map(gruppoDi));
    if (fasoriFini.every((f) => f !== undefined)) {
      // Fine degli avvolgimenti collegate a fasi (triangolo) o al neutro.
      avvolgimenti = v.map((x, i) => differenza(x, fasoriFini[i]!));
    } else if (gruppiFini.size === 1 && fini.every((t) => poliDi(t).length === 0)) {
      // U2, V2, W2 unite fra loro e isolate: centro stella.
      avvolgimenti = v;
    } else return null;
  }
  const { diretta, inversa } = componentiSimmetriche(avvolgimenti[0], avvolgimenti[1], avvolgimenti[2]);
  let stato: StatoMotore;
  if (diretta > 0.5 && inversa < 0.1) stato = { verso: "orario" };
  else if (inversa > 0.5 && diretta < 0.1) stato = { verso: "antiorario" };
  else return null; // terna squilibrata: il motore ronza ma non parte
  // A stella ogni avvolgimento ha 230 V (1), a triangolo 400 V (√3 ≈ 1,73).
  if (tipo === "trifase6") stato.collegamento = Math.max(diretta, inversa) > 1.3 ? "triangolo" : "stella";
  return stato;
}

const chiaveStato = (s: ReadonlySet<string>) => [...s].sort().join("|");

/**
 * Simula il circuito fino a uno stato stabile.
 * @param bobinePrecedenti bobine eccitate al passo precedente: è la "memoria"
 *   che permette, per esempio, all'autoritenuta di tenere il contattore
 *   eccitato dopo aver rilasciato il pulsante di marcia.
 */
export function simula(
  circuito: Circuito,
  ingressi: Ingressi = {},
  bobinePrecedenti: Iterable<string> = [],
  temporizzatori: StatoTemporizzatori = {},
): RisultatoSimulazione {
  const p = preparaCircuito(circuito);
  const intervenute = new Set(ingressi.protezioniIntervenute ?? []);
  // I relè termici intervenuti fanno commutare i contatti con la loro sigla.
  const termici = new Set(ingressi.termiciIntervenuti ?? []);
  for (const n of p.noti) {
    if (n.c.tipo === "rele-termico" && intervenute.has(n.c.id) && n.c.etichetta.trim() !== "") termici.add(n.c.etichetta.trim());
  }
  const idBobine = new Set(p.bobine.map((b) => b.c.id));
  const eccitate = new Set([...bobinePrecedenti].filter((id) => idBobine.has(id)));
  const comandi: StatoComandi = {
    premuti: new Set(ingressi.premuti ?? []),
    azionati: new Set(ingressi.azionati ?? []),
    termici,
    intervenute,
    sovraccarichi: new Set(ingressi.sovraccarichi ?? []),
    scaduti: new Set(temporizzatori.scaduti ?? []),
    inRitardo: new Set(temporizzatori.inRitardo ?? []),
    precedenti: new Set(eccitate),
  };

  const storia: string[] = [chiaveStato(eccitate)];
  const statiStoria: Set<string>[] = [new Set(eccitate)];
  let passi = 0;
  let oscillazione: RisultatoSimulazione["oscillazione"] = null;
  let v = valuta(p, comandi, eccitate);

  while (passi < LIMITE_PASSI) {
    const alimentati = new Set(v.carichiAlimentati);
    // Prima bobina (nell'ordine dello schema) che deve cambiare stato.
    const daCambiare = p.bobine.find((b) => alimentati.has(b.c.id) !== eccitate.has(b.c.id));
    if (!daCambiare) break;
    if (eccitate.has(daCambiare.c.id)) eccitate.delete(daCambiare.c.id);
    else eccitate.add(daCambiare.c.id);
    passi++;
    const chiave = chiaveStato(eccitate);
    const giaVisto = storia.indexOf(chiave);
    if (giaVisto >= 0) {
      // Ciclo: le bobine che cambiano fra uno stato e l'altro sono quelle che oscillano.
      const ciclo = statiStoria.slice(giaVisto);
      const coinvolte = p.bobine
        .map((b) => b.c.id)
        .filter((id) => ciclo.some((s) => s.has(id)) && ciclo.some((s) => !s.has(id)));
      oscillazione = { bobine: coinvolte };
      v = valuta(p, comandi, eccitate);
      break;
    }
    storia.push(chiave);
    statiStoria.push(new Set(eccitate));
    v = valuta(p, comandi, eccitate);
  }
  if (!oscillazione && passi >= LIMITE_PASSI) oscillazione = { bobine: [...eccitate] };

  return {
    stabile: oscillazione === null,
    bobineEccitate: p.bobine.map((b) => b.c.id).filter((id) => eccitate.has(id)),
    contattiChiusi: v.contattiChiusi,
    carichiAlimentati: v.carichiAlimentati,
    poliDeiMorsetti: v.poliDeiMorsetti,
    cortocircuiti: v.cortocircuiti,
    oscillazione,
    ignorati: p.ignorati,
    passi,
    motori: v.motori,
    temporizzatoriCommutati: v.temporizzatoriCommutati,
    protezioniIntervenute: p.noti.map((n) => n.c.id).filter((id) => intervenute.has(id)),
    protezioniInSovraccarico: v.protezioniInSovraccarico,
    gruppoDeiMorsetti: v.gruppoDeiMorsetti,
  };
}

/** Intervento di una protezione per cortocircuito. */
export interface InterventoCortocircuito {
  /** Id della protezione intervenuta (fusibile, magnetotermico, salvamotore). */
  protezione: string;
  /** Poli che erano in cortocircuito. */
  poli: Polo[];
}

export interface RisultatoConProtezioni extends RisultatoSimulazione {
  /** Protezioni intervenute in questo calcolo a causa di un cortocircuito. */
  interventi: InterventoCortocircuito[];
}

/**
 * Come `simula`, ma se c'è un cortocircuito fa intervenire le protezioni che
 * lo interrompono (fusibile, magnetotermico, salvamotore chiuso), come
 * accade in un impianto vero. Fra più protezioni attraversate dal guasto
 * interviene quella che lascia alimentato il resto dell'impianto
 * (la più vicina al guasto: selettività). Se nessuna protezione
 * interrompe il cortocircuito, questo resta nel risultato.
 */
export function simulaConProtezioni(
  circuito: Circuito,
  ingressi: Ingressi = {},
  bobinePrecedenti: Iterable<string> = [],
  temporizzatori: StatoTemporizzatori = {},
): RisultatoConProtezioni {
  const precedenti = [...bobinePrecedenti];
  const intervenute = new Set(ingressi.protezioniIntervenute ?? []);
  const interventi: InterventoCortocircuito[] = [];
  const calcola = (aperte: Set<string>) =>
    simula(circuito, { ...ingressi, protezioniIntervenute: aperte }, precedenti, temporizzatori);
  /** Quanti morsetti sono coinvolti nei cortocircuiti (meno = guasto interrotto). */
  const inCorto = (r: RisultatoSimulazione) => r.cortocircuiti.reduce((n, c) => n + c.morsetti.length, 0);
  /**
   * Disservizio lasciato da un intervento: conta prima gli utilizzatori ancora
   * alimentati, poi i morsetti ancora in tensione (con una sola fase o polo +).
   * Più alto = intervento più selettivo.
   */
  const alimentati = (r: RisultatoSimulazione) =>
    r.carichiAlimentati.length * 100000 +
    Object.values(r.poliDeiMorsetti).filter((x) => x.length === 1 && x[0] !== "N" && x[0] !== "-").length;

  let r = calcola(intervenute);
  for (let giro = 0; giro < 50 && r.cortocircuiti.length > 0; giro++) {
    const nelGuasto = new Set(r.cortocircuiti.flatMap((c) => c.morsetti));
    const candidate = circuito.componenti.filter((c) => {
      const modello = MODELLI_IMPIANTI[c.tipo];
      if (!modello || !PROTEZIONI[c.tipo]?.cortocircuito || intervenute.has(c.id)) return false;
      // Deve condurre: un salvamotore aperto non è attraversato dal guasto.
      if (modello.tipo === "contatto" && !r.contattiChiusi.includes(c.id)) return false;
      return morsettiDelModello(modello).some((t) => nelGuasto.has(chiaveMorsetto(c.id, t)));
    });
    let migliore: { id: string; r: RisultatoSimulazione } | null = null;
    for (const c of candidate) {
      const prova = calcola(new Set([...intervenute, c.id]));
      if (inCorto(prova) >= inCorto(r)) continue; // non interrompe il guasto
      if (!migliore || alimentati(prova) > alimentati(migliore.r)) migliore = { id: c.id, r: prova };
    }
    if (!migliore) break;
    const poli = r.cortocircuiti.find((c) =>
      morsettiDelModello(MODELLI_IMPIANTI[circuito.componenti.find((x) => x.id === migliore!.id)!.tipo]).some((t) =>
        c.morsetti.includes(chiaveMorsetto(migliore!.id, t)),
      ),
    )!.poli;
    interventi.push({ protezione: migliore.id, poli });
    intervenute.add(migliore.id);
    r = migliore.r;
  }
  return { ...r, interventi };
}
