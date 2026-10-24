// Gestione dei testi dell'interfaccia.
// Tutti i testi visibili stanno in lingue/<lingua>.json: qui li leggiamo
// e sostituiamo i segnaposto del tipo {nome} con i valori passati.
import it from "../lingue/it.json";

export type Dizionario = Record<string, string>;

const dizionarioCorrente: Dizionario = it;

/**
 * Restituisce il testo associato alla chiave, con i segnaposto sostituiti.
 * Se la chiave manca restituisce la chiave stessa, così l'errore si vede
 * subito nell'interfaccia invece di mostrare uno spazio vuoto.
 */
export function formatta(
  dizionario: Dizionario,
  chiave: string,
  valori: Record<string, string | number> = {},
): string {
  const modello = dizionario[chiave];
  if (modello === undefined) return chiave;
  return modello.replace(/\{(\w+)\}/g, (intero, nome: string) =>
    nome in valori ? String(valori[nome]) : intero,
  );
}

/** Scorciatoia che usa il dizionario della lingua corrente. */
export function t(chiave: string, valori?: Record<string, string | number>): string {
  return formatta(dizionarioCorrente, chiave, valori);
}
