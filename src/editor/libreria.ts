// Libreria dei componenti: lettura e controllo dei file JSON in libreria/,
// ricerca per nome e creazione di un componente da posare sullo schema.
// Le funzioni qui sono pure (nessuna interfaccia) e coperte da test.
//
// Formato di un file libreria/<modulo>.json (modificabile dai docenti):
// {
//   "versione": 1, "modulo": "impianti",
//   "categorie": [{ "id": "comandi", "nome": "Comandi" }],
//   "componenti": [{
//     "id": "pulsante-na", "nome": "Pulsante NA", "categoria": "comandi",
//     "sigla": "S", "descrizione": "Spiegazione per lo studente",
//     "paroleChiave": ["marcia"], "icona": "pulsante-na.svg",
//     "larghezza": 40, "altezza": 80,
//     "morsetti": [{ "id": "13", "x": 20, "y": 0 }]
//   }]
// }
// Larghezza, altezza e coordinate dei morsetti sono multipli del passo di griglia.
import { PASSO_GRIGLIA, agganciaPunto, type Punto } from "./geometria";
import type { ComponenteSchema, Schema } from "./schema";

export interface MorsettoLibreria {
  id: string;
  /** Posizione rispetto all'angolo in alto a sinistra del componente. */
  x: number;
  y: number;
}

export interface VoceLibreria {
  id: string;
  nome: string;
  categoria: string;
  /** Lettera della sigla (K, S, H, M…); vuota per alimentazioni e masse. */
  sigla: string;
  /** Breve spiegazione didattica mostrata nel tooltip. */
  descrizione: string;
  paroleChiave: string[];
  /** Nome del file SVG in libreria/icone/. */
  icona: string;
  larghezza: number;
  altezza: number;
  morsetti: MorsettoLibreria[];
}

export interface CategoriaLibreria {
  id: string;
  nome: string;
}

export interface Libreria {
  modulo: string;
  categorie: CategoriaLibreria[];
  componenti: VoceLibreria[];
}

export interface EsitoLettura {
  libreria: Libreria;
  /** Problemi trovati, in italiano semplice. Le voci errate vengono scartate. */
  errori: string[];
}

export const VERSIONE_LIBRERIA = 1;

const eOggetto = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const eTesto = (v: unknown): v is string => typeof v === "string";
const sullaGriglia = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n / PASSO_GRIGLIA);

/**
 * Legge e controlla il contenuto di un file della libreria.
 * Non lancia mai eccezioni: un errore in una voce scarta solo quella voce,
 * così un file modificato a mano non blocca il programma.
 * @param icone nomi dei file SVG disponibili, per segnalare icone mancanti
 */
export function leggiLibreria(dati: unknown, nomeFile: string, icone?: ReadonlySet<string>): EsitoLettura {
  const errori: string[] = [];
  const vuota: Libreria = { modulo: "", categorie: [], componenti: [] };
  if (!eOggetto(dati)) return { libreria: vuota, errori: [`${nomeFile}: il file non contiene un oggetto JSON.`] };
  if (dati.versione !== VERSIONE_LIBRERIA)
    errori.push(`${nomeFile}: versione ${String(dati.versione)} non riconosciuta (attesa ${VERSIONE_LIBRERIA}).`);
  const modulo = eTesto(dati.modulo) ? dati.modulo : "";
  if (!modulo) errori.push(`${nomeFile}: manca il campo "modulo".`);

  const categorie: CategoriaLibreria[] = [];
  for (const c of Array.isArray(dati.categorie) ? dati.categorie : []) {
    if (eOggetto(c) && eTesto(c.id) && eTesto(c.nome) && !categorie.some((x) => x.id === c.id))
      categorie.push({ id: c.id, nome: c.nome });
    else errori.push(`${nomeFile}: categoria non valida o ripetuta (${JSON.stringify(c)}).`);
  }

  const componenti: VoceLibreria[] = [];
  for (const v of Array.isArray(dati.componenti) ? dati.componenti : []) {
    const nome = eOggetto(v) && eTesto(v.id) ? v.id : JSON.stringify(v);
    const problema = (testo: string) => errori.push(`${nomeFile}, componente "${nome}": ${testo}`);
    if (!eOggetto(v) || !eTesto(v.id) || !v.id) {
      problema("manca l'identificativo (id).");
      continue;
    }
    if (componenti.some((x) => x.id === v.id)) {
      problema("identificativo ripetuto.");
      continue;
    }
    if (!eTesto(v.nome) || !v.nome) {
      problema("manca il nome.");
      continue;
    }
    if (!eTesto(v.categoria) || !categorie.some((c) => c.id === v.categoria)) {
      problema(`la categoria "${String(v.categoria)}" non esiste.`);
      continue;
    }
    if (!sullaGriglia(v.larghezza) || !sullaGriglia(v.altezza) || v.larghezza <= 0 || v.altezza <= 0) {
      problema(`larghezza e altezza devono essere multipli di ${PASSO_GRIGLIA} maggiori di zero.`);
      continue;
    }
    if (!eTesto(v.icona) || (icone && !icone.has(v.icona))) {
      problema(`l'icona "${String(v.icona)}" non si trova in libreria/icone/.`);
      continue;
    }
    const larghezza = v.larghezza;
    const altezza = v.altezza;
    const morsetti: MorsettoLibreria[] = [];
    let morsettiValidi = true;
    for (const m of Array.isArray(v.morsetti) ? v.morsetti : []) {
      const valido =
        eOggetto(m) &&
        eTesto(m.id) &&
        sullaGriglia(m.x) &&
        sullaGriglia(m.y) &&
        m.x >= 0 &&
        m.y >= 0 &&
        m.x <= larghezza &&
        m.y <= altezza &&
        !morsetti.some((x) => x.id === m.id);
      if (!valido) {
        problema(`morsetto non valido (${JSON.stringify(m)}): deve stare sulla griglia e dentro il componente.`);
        morsettiValidi = false;
        break;
      }
      morsetti.push({ id: m.id as string, x: m.x as number, y: m.y as number });
    }
    if (!morsettiValidi) continue;
    componenti.push({
      id: v.id,
      nome: v.nome,
      categoria: v.categoria,
      sigla: eTesto(v.sigla) ? v.sigla : "",
      descrizione: eTesto(v.descrizione) ? v.descrizione : "",
      paroleChiave: Array.isArray(v.paroleChiave) ? v.paroleChiave.filter(eTesto) : [],
      icona: v.icona,
      larghezza,
      altezza,
      morsetti,
    });
  }
  return { libreria: { modulo, categorie, componenti }, errori };
}

/** Minuscole e senza accenti: "Relè" e "rele" devono trovarsi a vicenda. */
export function normalizza(testo: string): string {
  return testo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Componenti che corrispondono alla ricerca. Ogni parola scritta deve comparire
 * nel nome, nella sigla, nelle parole chiave o nel nome della categoria.
 * Prima vengono quelli il cui nome inizia con il testo cercato.
 */
export function cercaComponenti(libreria: Libreria, ricerca: string): VoceLibreria[] {
  const parole = normalizza(ricerca).split(/\s+/).filter(Boolean);
  if (parole.length === 0) return libreria.componenti;
  const nomeCategoria = new Map(libreria.categorie.map((c) => [c.id, c.nome]));
  const trovati = libreria.componenti.filter((v) => {
    const testo = normalizza([v.nome, v.sigla, nomeCategoria.get(v.categoria) ?? "", ...v.paroleChiave].join(" "));
    return parole.every((p) => testo.includes(p));
  });
  const inizio = normalizza(ricerca);
  // sort è stabile: a parità resta l'ordine del file JSON.
  return trovati.sort(
    (a, b) => Number(normalizza(b.nome).startsWith(inizio)) - Number(normalizza(a.nome).startsWith(inizio)),
  );
}

export interface GruppoCategoria {
  categoria: CategoriaLibreria;
  voci: VoceLibreria[];
}

/** Raggruppa le voci per categoria nell'ordine del file; le categorie vuote non compaiono. */
export function raggruppaPerCategoria(libreria: Libreria, voci: readonly VoceLibreria[]): GruppoCategoria[] {
  return libreria.categorie
    .map((categoria) => ({ categoria, voci: voci.filter((v) => v.categoria === categoria.id) }))
    .filter((g) => g.voci.length > 0);
}

/** Primo identificativo libero del tipo "pulsante-na-3" nello schema. */
export function nuovoId(schema: Schema, base: string): string {
  const usati = new Set(schema.componenti.map((c) => c.id));
  let n = 1;
  while (usati.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/**
 * Sigla automatica per un nuovo componente: lettera (o lettere) della libreria
 * seguita dal primo numero libero fra quelli già usati nello schema.
 * Esempio: con K1 e K3 sul foglio il prossimo contattore è K2, poi K4.
 * Riempire i "buchi" lasciati da un componente eliminato tiene la
 * numerazione compatta, come si fa a mano sugli schemi.
 * Una sigla vuota (reti, masse) resta vuota.
 */
export function prossimaSigla(schema: Schema, lettere: string): string {
  if (!lettere) return "";
  const usati = new Set<number>();
  for (const c of schema.componenti) {
    if (!c.etichetta.startsWith(lettere)) continue;
    const resto = c.etichetta.slice(lettere.length);
    // Solo cifre dopo le lettere: "KA1" non deve occupare il numero di "K1".
    if (/^\d+$/.test(resto)) usati.add(Number(resto));
  }
  let n = 1;
  while (usati.has(n)) n++;
  return `${lettere}${n}`;
}

/**
 * Crea il componente da posare con il centro nel punto indicato (coordinate
 * del foglio, per esempio dove lo studente rilascia il mouse); l'angolo in
 * alto a sinistra viene agganciato alla griglia, quindi anche i morsetti.
 */
export function componenteDaVoce(schema: Schema, voce: VoceLibreria, centro: Punto): ComponenteSchema {
  const angolo = agganciaPunto({ x: centro.x - voce.larghezza / 2, y: centro.y - voce.altezza / 2 });
  return {
    id: nuovoId(schema, voce.id),
    tipo: voce.id,
    etichetta: prossimaSigla(schema, voce.sigla),
    x: angolo.x,
    y: angolo.y,
    larghezza: voce.larghezza,
    altezza: voce.altezza,
  };
}

/** Sostituisce currentColor nell'SVG con il colore del tema e restituisce un data URL per <img> o Konva. */
export function svgComeDataUrl(svg: string, colore: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.split("currentColor").join(colore))}`;
}
