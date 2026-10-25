// Accesso ai file dall'interfaccia. Due realizzazioni con la stessa forma:
// - nell'app desktop (Tauri): comandi Rust di src-tauri/src/lib.rs e finestre
//   di dialogo native di Windows (Apri / Salva con nome / conferme);
// - nel browser (sviluppo con `npm run dev` e prove con Playwright): un
//   archivio di prova nel localStorage, con nomi di file chiesti con prompt().
// Il resto dell'interfaccia usa solo l'interfaccia `Archivio`.
import { invoke } from "@tauri-apps/api/core";
import { ask, open, save } from "@tauri-apps/plugin-dialog";
import { t } from "../testi";
import type { IdModulo } from "../interfaccia/moduli";
import { ESTENSIONE, conEstensioneElab } from "./formato";

export interface InfoCartellaDati {
  percorso: string;
  portable: boolean;
  avviso: string | null;
}

export interface Archivio {
  /** true nell'app desktop, false nell'archivio di prova del browser. */
  readonly desktop: boolean;
  infoCartellaDati(): Promise<InfoCartellaDati>;
  /** Finestra "Apri": percorso scelto o null se lo studente annulla. */
  scegliFileDaAprire(): Promise<string | null>;
  /** Finestra "Salva con nome": percorso (sempre con .elab) o null se annulla. */
  scegliFileDaSalvare(nomeSuggerito: string): Promise<string | null>;
  leggiFile(percorso: string): Promise<string>;
  scriviFile(percorso: string, contenuto: string): Promise<void>;
  leggiImpostazioni(): Promise<string | null>;
  scriviImpostazioni(contenuto: string): Promise<void>;
  leggiAutosalvataggio(modulo: IdModulo): Promise<string | null>;
  scriviAutosalvataggio(modulo: IdModulo, contenuto: string): Promise<void>;
  /** Domanda sì/no (es. "perdere le modifiche?"). */
  conferma(domanda: string): Promise<boolean>;
}

/** Gli errori dei comandi Rust arrivano come testo già in italiano. */
function comeErrore(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

async function comando<T>(nome: string, argomenti?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(nome, argomenti);
  } catch (e) {
    throw comeErrore(e);
  }
}

const filtri = () => [{ name: t("file.filtro"), extensions: [ESTENSIONE] }];

const archivioDesktop: Archivio = {
  desktop: true,
  infoCartellaDati: () => comando("info_cartella_dati"),
  async scegliFileDaAprire() {
    const scelto = await open({ title: t("file.apriTitolo"), multiple: false, directory: false, filters: filtri() });
    return typeof scelto === "string" ? scelto : null;
  },
  async scegliFileDaSalvare(nomeSuggerito) {
    const scelto = await save({ title: t("file.salvaTitolo"), defaultPath: conEstensioneElab(nomeSuggerito), filters: filtri() });
    return scelto ? conEstensioneElab(scelto) : null;
  },
  leggiFile: (percorso) => comando("leggi_progetto", { percorso }),
  scriviFile: (percorso, contenuto) => comando("scrivi_progetto", { percorso, contenuto }),
  leggiImpostazioni: () => comando("leggi_impostazioni"),
  scriviImpostazioni: (contenuto) => comando("scrivi_impostazioni", { contenuto }),
  leggiAutosalvataggio: (modulo) => comando("leggi_autosalvataggio", { modulo }),
  scriviAutosalvataggio: (modulo, contenuto) => comando("scrivi_autosalvataggio", { modulo, contenuto }),
  conferma: (domanda) => ask(domanda, { title: t("app.titolo"), kind: "warning", okLabel: t("comune.si"), cancelLabel: t("comune.no") }),
};

// --- Archivio di prova per il browser -------------------------------------

const PREFISSO = "elettrolab:";

function memoria(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function leggiChiave(chiave: string): string | null {
  return memoria()?.getItem(PREFISSO + chiave) ?? null;
}

function scriviChiave(chiave: string, valore: string): void {
  const m = memoria();
  if (!m) throw new Error(t("file.archivioNonDisponibile"));
  m.setItem(PREFISSO + chiave, valore);
}

const archivioBrowser: Archivio = {
  desktop: false,
  infoCartellaDati: async () => ({ percorso: "localStorage", portable: false, avviso: null }),
  async scegliFileDaAprire() {
    const nome = window.prompt(t("file.provaApri"));
    return nome ? conEstensioneElab(nome.trim()) : null;
  },
  async scegliFileDaSalvare(nomeSuggerito) {
    const nome = window.prompt(t("file.provaSalva"), nomeSuggerito);
    return nome ? conEstensioneElab(nome.trim()) : null;
  },
  async leggiFile(percorso) {
    const testo = leggiChiave("file:" + percorso);
    if (testo === null) throw new Error(t("file.provaMancante", { nome: percorso }));
    return testo;
  },
  async scriviFile(percorso, contenuto) {
    scriviChiave("file:" + percorso, contenuto);
  },
  leggiImpostazioni: async () => leggiChiave("impostazioni"),
  scriviImpostazioni: async (contenuto) => scriviChiave("impostazioni", contenuto),
  leggiAutosalvataggio: async (modulo) => leggiChiave("auto:" + modulo),
  scriviAutosalvataggio: async (modulo, contenuto) => scriviChiave("auto:" + modulo, contenuto),
  conferma: async (domanda) => window.confirm(domanda),
};

/** Archivio giusto per l'ambiente in cui gira l'interfaccia. */
export function creaArchivio(): Archivio {
  const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  return inTauri ? archivioDesktop : archivioBrowser;
}
