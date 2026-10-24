// Gestione del tema chiaro/scuro.
// La logica è separata dall'interfaccia e riceve l'archivio dall'esterno,
// così si può provare con i test senza browser.
// Nota: per ora la scelta è salvata nel localStorage della WebView;
// con l'attività 1.8 passerà nel file impostazioni (portable o %APPDATA%).

export type Tema = "chiaro" | "scuro";

export const CHIAVE_TEMA = "elettrolab.tema";

/** Archivio minimo compatibile con localStorage. */
export interface ArchivioChiaveValore {
  getItem(chiave: string): string | null;
  setItem(chiave: string, valore: string): void;
}

/** Converte un valore salvato in un tema valido, oppure null se non riconosciuto. */
export function interpretaTema(valore: string | null | undefined): Tema | null {
  return valore === "chiaro" || valore === "scuro" ? valore : null;
}

/**
 * Tema da usare all'avvio: la scelta salvata dallo studente ha la precedenza;
 * se non c'è, si segue l'impostazione di Windows (chiaro/scuro).
 */
export function temaIniziale(salvato: string | null | undefined, sistemaPreferisceScuro: boolean): Tema {
  return interpretaTema(salvato) ?? (sistemaPreferisceScuro ? "scuro" : "chiaro");
}

/** Restituisce il tema opposto (pulsante unico di commutazione). */
export function alternaTema(tema: Tema): Tema {
  return tema === "chiaro" ? "scuro" : "chiaro";
}

/** Legge il tema salvato senza mai far fallire l'avvio (archivio assente o bloccato). */
export function leggiTemaSalvato(archivio: ArchivioChiaveValore | undefined): string | null {
  try {
    return archivio?.getItem(CHIAVE_TEMA) ?? null;
  } catch {
    return null;
  }
}

/** Salva il tema; un errore di scrittura non deve bloccare l'interfaccia. */
export function salvaTema(archivio: ArchivioChiaveValore | undefined, tema: Tema): void {
  try {
    archivio?.setItem(CHIAVE_TEMA, tema);
  } catch {
    // Ignorato di proposito: il tema resterà quello predefinito al prossimo avvio.
  }
}
