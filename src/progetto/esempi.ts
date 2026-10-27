// Catalogo degli esempi pronti (cartella esempi/ del repository).
//
// Il catalogo `esempi/esempi.json` elenca, per ogni esempio, il file `.elab`,
// il modulo, il titolo, una descrizione e le istruzioni per provarlo. I file
// sono normali progetti `.elab`: i docenti possono aggiungerne di nuovi
// disegnandoli con ElettroLab, salvandoli in esempi/ e aggiungendo una voce
// al catalogo (per ora serve ricompilare, come per la libreria).
//
// Funzioni pure (nessun accesso al disco), coperte da test in esempi.test.ts.
import { trovaModulo, type IdModulo } from "../interfaccia/moduli";
import { leggiProgetto, type EsitoLettura } from "./formato";

export const VERSIONE_CATALOGO = 1;

export interface Esempio {
  /** Nome del file nella cartella esempi/ (es. "marcia-arresto.elab"), usato anche come identificativo. */
  file: string;
  modulo: IdModulo;
  titolo: string;
  descrizione: string;
  /** Che cosa fare per vederlo funzionare (facoltativo). */
  prova: string;
  /** Contenuto del file .elab. */
  testo: string;
}

export interface EsitoCatalogo {
  esempi: Esempio[];
  /** Problemi trovati nel catalogo (per chi lo modifica; mostrati in console). */
  errori: string[];
}

type Oggetto = Record<string, unknown>;
const eOggetto = (v: unknown): v is Oggetto => typeof v === "object" && v !== null && !Array.isArray(v);
const eTestoPieno = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

/**
 * Legge il catalogo e lo abbina ai file disponibili.
 * Le voci incomplete, i doppioni e i file mancanti vengono scartati con un
 * errore descritto: un catalogo modificato a mano non deve bloccare l'app.
 * @param dati contenuto di esempi.json già trasformato da JSON
 * @param file testo dei file .elab disponibili, indicizzati per nome
 */
export function leggiCatalogo(dati: unknown, file: Readonly<Record<string, string>>): EsitoCatalogo {
  const errori: string[] = [];
  if (!eOggetto(dati) || !Array.isArray(dati.esempi)) {
    return { esempi: [], errori: ["esempi.json: manca l'elenco \"esempi\"."] };
  }
  if (dati.versione !== VERSIONE_CATALOGO) errori.push(`esempi.json: versione ${String(dati.versione)} non prevista (attesa ${VERSIONE_CATALOGO}).`);
  const esempi: Esempio[] = [];
  const visti = new Set<string>();
  dati.esempi.forEach((v, i) => {
    const dove = `esempi.json, voce ${i + 1}`;
    if (!eOggetto(v) || !eTestoPieno(v.file) || !eTestoPieno(v.titolo) || !eTestoPieno(v.modulo)) {
      errori.push(`${dove}: servono almeno "file", "modulo" e "titolo".`);
      return;
    }
    const modulo = trovaModulo(v.modulo);
    if (!modulo) {
      errori.push(`${dove}: modulo "${v.modulo}" sconosciuto.`);
      return;
    }
    if (visti.has(v.file)) {
      errori.push(`${dove}: il file ${v.file} è già nel catalogo.`);
      return;
    }
    const testo = file[v.file];
    if (testo === undefined) {
      errori.push(`${dove}: il file esempi/${v.file} non esiste.`);
      return;
    }
    visti.add(v.file);
    esempi.push({
      file: v.file,
      modulo: modulo.id,
      titolo: v.titolo.trim(),
      descrizione: eTestoPieno(v.descrizione) ? v.descrizione.trim() : "",
      prova: eTestoPieno(v.prova) ? v.prova.trim() : "",
      testo,
    });
  });
  return { esempi, errori };
}

/** Esempi di un modulo, nell'ordine del catalogo. */
export function esempiDelModulo(esempi: readonly Esempio[], modulo: IdModulo): Esempio[] {
  return esempi.filter((e) => e.modulo === modulo);
}

/**
 * Legge il progetto contenuto nell'esempio. Controlla anche che il modulo
 * scritto nel file sia quello dichiarato nel catalogo.
 */
export function apriEsempio(esempio: Esempio): EsitoLettura {
  const esito = leggiProgetto(esempio.testo);
  if (esito.ok && esito.progetto.modulo !== esempio.modulo) {
    return { ok: false, errore: `L'esempio «${esempio.titolo}» appartiene a un altro modulo.` };
  }
  return esito;
}
