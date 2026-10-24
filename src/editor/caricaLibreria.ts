// Caricamento dei file della cartella libreria/ (JSON dei componenti e icone SVG).
// Per ora i file vengono inclusi nell'app al momento della build: per aggiungere
// un componente basta modificare il JSON, aggiungere l'SVG e ricompilare.
// (Il caricamento di librerie aggiuntive dal disco, senza ricompilare, è
// previsto con la gestione dei file lato Rust.)
import type { IdModulo } from "../interfaccia/moduli";
import { leggiLibreria, type Libreria, type VoceLibreria } from "./libreria";

const fileJson = import.meta.glob("../../libreria/*.json", { eager: true, import: "default" }) as Record<
  string,
  unknown
>;
const fileIcone = import.meta.glob("../../libreria/icone/*.svg", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

/** Testo SVG di ogni icona, indicizzato per nome del file (es. "lampada.svg"). */
export const ICONE: ReadonlyMap<string, string> = new Map(
  Object.entries(fileIcone).map(([percorso, svg]) => [percorso.split("/").pop() ?? percorso, svg]),
);

const librerie = new Map<string, Libreria>();
/** Problemi trovati nei file della libreria (mostrati in console per chi la modifica). */
export const ERRORI_LIBRERIA: string[] = [];

for (const [percorso, dati] of Object.entries(fileJson)) {
  const nomeFile = percorso.split("/").pop() ?? percorso;
  const { libreria, errori } = leggiLibreria(dati, nomeFile, new Set(ICONE.keys()));
  ERRORI_LIBRERIA.push(...errori);
  if (libreria.modulo) librerie.set(libreria.modulo, libreria);
}
if (ERRORI_LIBRERIA.length > 0) console.warn("Problemi nella libreria dei componenti:\n" + ERRORI_LIBRERIA.join("\n"));

/** Libreria del modulo indicato (vuota se il file manca). */
export function libreriaDelModulo(modulo: IdModulo): Libreria {
  return librerie.get(modulo) ?? { modulo, categorie: [], componenti: [] };
}

/** Cerca una voce per tipo nella libreria indicata. */
export function trovaVoce(libreria: Libreria, tipo: string): VoceLibreria | undefined {
  return libreria.componenti.find((v) => v.id === tipo);
}
