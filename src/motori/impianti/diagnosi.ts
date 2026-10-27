// Diagnosi degli errori dello schema degli impianti (pura: nessuna interfaccia).
//
// Trova i problemi più comuni degli studenti e dice DOVE sono (componenti e
// morsetti da evidenziare). I testi in italiano li compone l'interfaccia a
// partire dal `codice` (vedi src/editor/messaggiProblemi.ts), così il motore
// resta indipendente dalla lingua.
//
// Due tipi di controlli:
// 1. SCHEMA (`diagnosiSchema`), fatti una volta all'avvio della simulazione:
//    - nessuna alimentazione nello schema;
//    - contatto non legato a nessuna bobina (o a nessun relè termico);
//    - circuito aperto / bobina senza alimentazione: un morsetto di un
//      utilizzatore non può raggiungere nessun polo NEMMENO immaginando
//      chiusi tutti i contatti. È un controllo "sicuro": se fallisce così,
//      fallisce in qualunque situazione reale;
//    - utilizzatori in serie (in questo simulatore, come nella pratica dei
//      quadri, ogni utilizzatore va collegato direttamente fra due poli);
//    - utilizzatore con tutti i morsetti sullo stesso polo (es. L1 e L1).
// 2. SIMULAZIONE (`diagnosiRisultato`), a ogni istante:
//    - cortocircuito non interrotto da nessuna protezione;
//    - protezioni intervenute, con il motivo (cortocircuito o sovraccarico);
//    - oscillazione (bobine che si eccitano e diseccitano da sole).
import { MODELLI_IMPIANTI, type ModelloComponente, type Polo } from "./modelli";
import { chiaveMorsetto, morsettiDelModello, type Circuito, type RisultatoSimulazione } from "./simulatore";

export type CodiceProblema =
  | "nessunaAlimentazione"
  | "contattoSenzaBobina"
  | "contattoBobinaMancante"
  | "contattoTermicoSenzaRele"
  | "circuitoAperto"
  | "bobinaSenzaAlimentazione"
  | "inSerie"
  | "stessoPolo"
  | "cortocircuito"
  | "interventoCortocircuito"
  | "interventoSovraccarico"
  | "oscillazione";

export interface Problema {
  codice: CodiceProblema;
  /** errore = lo schema non può funzionare; avviso = va controllato. */
  gravita: "errore" | "avviso";
  /** Componenti coinvolti (il primo è quello principale). */
  componenti: string[];
  /** Morsetti da evidenziare ("id:morsetto"). */
  morsetti: string[];
  /** Morsetto dell'utilizzatore che non riceve tensione ("id:morsetto"). */
  morsettoPrincipale?: string;
  /** Poli coinvolti (cortocircuito, stesso polo, intervento). */
  poli?: Polo[];
  /** Sigla citata nel messaggio (es. la bobina che manca). */
  sigla?: string;
}

/** Motivo per cui una protezione è intervenuta (lo ricorda la sessione). */
export type MotivoIntervento = { motivo: "cortocircuito"; poli: Polo[] } | { motivo: "sovraccarico" };

/** Union-find minimale (come nel simulatore, ma qui tutti i tratti sono chiusi). */
class Insiemi {
  private padre = new Map<string, string>();
  radice(x: string): string {
    if (!this.padre.has(x)) this.padre.set(x, x);
    let r = x;
    while (this.padre.get(r) !== r) r = this.padre.get(r)!;
    this.padre.set(x, r);
    return r;
  }
  unisci(a: string, b: string): void {
    const ra = this.radice(a);
    const rb = this.radice(b);
    if (ra !== rb) this.padre.set(ra, rb);
  }
}

type Carico = Extract<ModelloComponente, { tipo: "carico" }>;

/** Controlli statici dello schema, da fare all'avvio della simulazione. */
export function diagnosiSchema(circuito: Circuito): Problema[] {
  const problemi: Problema[] = [];
  const noti = circuito.componenti
    .map((c) => ({ c, m: MODELLI_IMPIANTI[c.tipo] }))
    .filter((n): n is { c: (typeof circuito.componenti)[number]; m: ModelloComponente } => n.m !== undefined);

  // --- Contatti non associati -------------------------------------------
  const sigleBobine = new Set(
    noti.filter((n) => n.m.tipo === "carico" && n.m.bobina).map((n) => n.c.etichetta.trim()).filter((s) => s !== ""),
  );
  const sigleTermici = new Set(
    noti.filter((n) => n.c.tipo === "rele-termico").map((n) => n.c.etichetta.trim()).filter((s) => s !== ""),
  );
  for (const { c, m } of noti) {
    if (m.tipo !== "contatto") continue;
    const sigla = c.etichetta.trim();
    if (m.comando.tipo === "bobina" && !sigleBobine.has(sigla)) {
      problemi.push({
        codice: sigla === "" ? "contattoSenzaBobina" : "contattoBobinaMancante",
        gravita: "avviso",
        componenti: [c.id],
        morsetti: [],
        ...(sigla !== "" ? { sigla } : {}),
      });
    }
    if (m.comando.tipo === "termico" && !sigleTermici.has(sigla)) {
      problemi.push({ codice: "contattoTermicoSenzaRele", gravita: "avviso", componenti: [c.id], morsetti: [] });
    }
  }

  // --- Alimentazione -----------------------------------------------------
  const carichi = noti.filter((n): n is { c: (typeof noti)[number]["c"]; m: Carico } => n.m.tipo === "carico");
  const sorgenti = noti.filter((n) => n.m.tipo === "sorgente");
  if (carichi.length === 0) return problemi;
  if (sorgenti.length === 0) {
    problemi.push({ codice: "nessunaAlimentazione", gravita: "errore", componenti: [], morsetti: [] });
    return problemi;
  }

  // Nodi (fili) e gruppi con TUTTI i contatti e le protezioni chiusi.
  const gruppi = new Insiemi();
  const conFilo = new Set<string>();
  for (const f of circuito.fili) {
    const a = chiaveMorsetto(f.da.componente, f.da.morsetto);
    const b = chiaveMorsetto(f.a.componente, f.a.morsetto);
    conFilo.add(a);
    conFilo.add(b);
    gruppi.unisci(a, b);
  }
  for (const { c, m } of noti) {
    if (m.tipo === "conduttore" || m.tipo === "contatto") {
      for (const [a, b] of m.tratti) gruppi.unisci(chiaveMorsetto(c.id, a), chiaveMorsetto(c.id, b));
    }
  }
  // Poli raggiungibili da ogni gruppo e morsetti di ogni gruppo.
  const poliDelGruppo = new Map<string, Set<Polo>>();
  for (const { c, m } of noti) {
    if (m.tipo !== "sorgente") continue;
    for (const u of m.uscite) {
      const g = gruppi.radice(chiaveMorsetto(c.id, u.morsetto));
      if (!poliDelGruppo.has(g)) poliDelGruppo.set(g, new Set());
      poliDelGruppo.get(g)!.add(u.polo);
    }
  }
  const morsettiDelGruppo = new Map<string, string[]>();
  for (const { c, m } of noti) {
    for (const t of morsettiDelModello(m)) {
      const k = chiaveMorsetto(c.id, t);
      const g = gruppi.radice(k);
      if (!morsettiDelGruppo.has(g)) morsettiDelGruppo.set(g, []);
      morsettiDelGruppo.get(g)!.push(k);
    }
  }
  const poliDi = (k: string) => [...(poliDelGruppo.get(gruppi.radice(k)) ?? [])].sort();
  const proprietario = (k: string) => k.slice(0, k.lastIndexOf(":"));
  const idCarichi = new Set(carichi.map((n) => n.c.id));

  const coppieInSerie = new Set<string>();
  for (const { c, m } of carichi) {
    // Nel motore a 6 morsetti le fine U2-V2-W2 possono restare senza tensione
    // (centro stella): basta che non siano scollegate.
    const morsettiDaControllare = m.motore === "trifase6" ? m.morsetti.slice(0, 3) : m.morsetti;
    const scollegati =
      m.motore === "trifase6" ? m.morsetti.slice(3).filter((t) => !conFilo.has(chiaveMorsetto(c.id, t))) : [];
    const senzaPolo = morsettiDaControllare.filter((t) => poliDi(chiaveMorsetto(c.id, t)).length === 0);
    const daSegnalare = [...senzaPolo, ...scollegati];

    if (daSegnalare.length > 0) {
      const primo = chiaveMorsetto(c.id, daSegnalare[0]);
      // Il morsetto senza tensione arriva al morsetto di un altro utilizzatore?
      const altri = [
        ...new Set(
          daSegnalare.flatMap((t) =>
            (morsettiDelGruppo.get(gruppi.radice(chiaveMorsetto(c.id, t))) ?? [])
              .map(proprietario)
              .filter((id) => id !== c.id && idCarichi.has(id)),
          ),
        ),
      ];
      if (altri.length > 0) {
        const tutti = [c.id, ...altri];
        const chiave = [...tutti].sort().join("|");
        if (!coppieInSerie.has(chiave)) {
          coppieInSerie.add(chiave);
          problemi.push({ codice: "inSerie", gravita: "avviso", componenti: tutti, morsetti: [primo], morsettoPrincipale: primo });
        }
        continue;
      }
      // Morsetti senza filo nel tratto di circuito che parte dal morsetto senza
      // tensione: è lì che quasi sempre manca il collegamento.
      const liberi = [
        ...new Set(
          daSegnalare.flatMap((t) =>
            (morsettiDelGruppo.get(gruppi.radice(chiaveMorsetto(c.id, t))) ?? []).filter((k) => !conFilo.has(k)),
          ),
        ),
      ];
      problemi.push({
        codice: m.bobina ? "bobinaSenzaAlimentazione" : "circuitoAperto",
        gravita: "avviso",
        componenti: [c.id, ...new Set(liberi.map(proprietario).filter((id) => id !== c.id))],
        morsetti: liberi.length > 0 ? liberi : [primo],
        morsettoPrincipale: primo,
      });
      continue;
    }

    // Tutti i morsetti raggiungono soltanto lo stesso polo: mai alimentato.
    if (!m.motore) {
      const poli = new Set(m.morsetti.flatMap((t) => poliDi(chiaveMorsetto(c.id, t))));
      if (poli.size === 1) {
        problemi.push({
          codice: "stessoPolo",
          gravita: "avviso",
          componenti: [c.id],
          morsetti: m.morsetti.map((t) => chiaveMorsetto(c.id, t)),
          poli: [...poli],
        });
      }
    }
  }
  return problemi;
}

/**
 * Problemi che dipendono dall'istante della simulazione.
 * @param motivi perché ogni protezione intervenuta è intervenuta (dalla sessione).
 */
export function diagnosiRisultato(
  risultato: Pick<RisultatoSimulazione, "cortocircuiti" | "oscillazione" | "protezioniIntervenute">,
  motivi: Readonly<Record<string, MotivoIntervento>> = {},
): Problema[] {
  const problemi: Problema[] = [];
  for (const corto of risultato.cortocircuiti) {
    const componenti = [...new Set(corto.morsetti.map((k) => k.slice(0, k.lastIndexOf(":"))))];
    problemi.push({ codice: "cortocircuito", gravita: "errore", componenti, morsetti: [...corto.morsetti], poli: [...corto.poli] });
  }
  if (risultato.oscillazione && risultato.oscillazione.bobine.length > 0) {
    problemi.push({ codice: "oscillazione", gravita: "errore", componenti: [...risultato.oscillazione.bobine], morsetti: [] });
  }
  for (const id of risultato.protezioniIntervenute) {
    const motivo = motivi[id];
    if (!motivo) continue;
    problemi.push(
      motivo.motivo === "cortocircuito"
        ? { codice: "interventoCortocircuito", gravita: "avviso", componenti: [id], morsetti: [], poli: [...motivo.poli] }
        : { codice: "interventoSovraccarico", gravita: "avviso", componenti: [id], morsetti: [] },
    );
  }
  return problemi;
}

/** Prima gli errori, poi gli avvisi (l'ordine interno resta quello dello schema). */
export function ordinaProblemi(problemi: readonly Problema[]): Problema[] {
  return [...problemi.filter((p) => p.gravita === "errore"), ...problemi.filter((p) => p.gravita === "avviso")];
}
