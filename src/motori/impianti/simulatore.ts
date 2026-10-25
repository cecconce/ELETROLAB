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
import { MODELLI_IMPIANTI, type ModelloComponente, type Polo } from "./modelli";

/** Componente del circuito: basta il tipo della libreria e la sigla. */
export interface ComponenteCircuito {
  id: string;
  tipo: string;
  etichetta: string;
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
}

/** Oltre questo numero di commutazioni ci si ferma comunque (protezione). */
const LIMITE_PASSI = 500;

/** Chiave univoca di un morsetto: "idComponente:morsetto". */
export function chiaveMorsetto(componente: string, morsetto: string): string {
  return `${componente}:${morsetto}`;
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
function morsettiDi(m: ModelloComponente): string[] {
  return m.tipo === "sorgente" ? m.uscite.map((u) => u.morsetto) : [...m.morsetti];
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
  for (const { c, m } of noti) for (const t of morsettiDi(m)) nodi.aggiungi(chiaveMorsetto(c.id, t));
  for (const f of circuito.fili) {
    nodi.unisci(chiaveMorsetto(f.da.componente, f.da.morsetto), chiaveMorsetto(f.a.componente, f.a.morsetto));
  }
  const nodoDi = (id: string, t: string) => nodi.radice(chiaveMorsetto(id, t));
  // Bobine raggruppate per sigla: un contatto "K1" segue la bobina "K1".
  const bobine = noti.filter((n) => n.m.tipo === "carico" && n.m.bobina);
  return { noti, ignorati, nodoDi, bobine };
}

type Preparato = ReturnType<typeof preparaCircuito>;

/** Dice se un contatto è chiuso, dati i pulsanti premuti e le bobine eccitate. */
function contattoChiuso(
  n: ComponenteNoto,
  premuti: ReadonlySet<string>,
  sigleEccitate: ReadonlySet<string>,
): boolean {
  if (n.m.tipo !== "contatto") return false;
  const azionato =
    n.m.comando.tipo === "pulsante"
      ? premuti.has(n.c.id)
      : n.c.etichetta.trim() !== "" && sigleEccitate.has(n.c.etichetta.trim());
  // Contatto NC: chiuso a riposo, si apre se azionato. NA: il contrario.
  return n.m.normalmenteChiuso ? !azionato : azionato;
}

/** Calcola tensioni e carichi alimentati per un dato stato delle bobine. */
function valuta(p: Preparato, premuti: ReadonlySet<string>, eccitate: ReadonlySet<string>) {
  const sigleEccitate = new Set(
    p.bobine.filter((b) => eccitate.has(b.c.id)).map((b) => b.c.etichetta.trim()).filter((s) => s !== ""),
  );
  // Gruppi: nodi uniti da tratti chiusi.
  const gruppi = new Insiemi();
  const contattiChiusi: string[] = [];
  for (const n of p.noti) {
    if (n.m.tipo === "conduttore") {
      gruppi.unisci(p.nodoDi(n.c.id, n.m.morsetti[0]), p.nodoDi(n.c.id, n.m.morsetti[1]));
    } else if (n.m.tipo === "contatto" && contattoChiuso(n, premuti, sigleEccitate)) {
      contattiChiusi.push(n.c.id);
      gruppi.unisci(p.nodoDi(n.c.id, n.m.morsetti[0]), p.nodoDi(n.c.id, n.m.morsetti[1]));
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
    for (const t of morsettiDi(n.m)) {
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

  // Carichi alimentati: ogni morsetto su un solo polo, tutti poli diversi.
  const carichiAlimentati: string[] = [];
  for (const n of p.noti) {
    if (n.m.tipo !== "carico") continue;
    const poli = n.m.morsetti.map((t) => poliDi(n.c.id, t));
    const ok = poli.every((x) => x.length === 1) && new Set(poli.map((x) => x[0])).size === poli.length;
    if (ok) carichiAlimentati.push(n.c.id);
  }
  return { contattiChiusi, carichiAlimentati, poliDeiMorsetti, cortocircuiti };
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
): RisultatoSimulazione {
  const p = preparaCircuito(circuito);
  const premuti = new Set(ingressi.premuti ?? []);
  const idBobine = new Set(p.bobine.map((b) => b.c.id));
  const eccitate = new Set([...bobinePrecedenti].filter((id) => idBobine.has(id)));

  const storia: string[] = [chiaveStato(eccitate)];
  const statiStoria: Set<string>[] = [new Set(eccitate)];
  let passi = 0;
  let oscillazione: RisultatoSimulazione["oscillazione"] = null;
  let v = valuta(p, premuti, eccitate);

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
      v = valuta(p, premuti, eccitate);
      break;
    }
    storia.push(chiave);
    statiStoria.push(new Set(eccitate));
    v = valuta(p, premuti, eccitate);
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
  };
}
