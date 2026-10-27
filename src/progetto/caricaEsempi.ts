// Caricamento degli esempi pronti dalla cartella esempi/. Come la libreria,
// i file vengono inclusi nell'app al momento della build (nessun accesso al
// disco o alla rete): per aggiungere un esempio si salva il file .elab in
// esempi/, si aggiunge la voce a esempi/esempi.json e si ricompila.
import { leggiCatalogo, type Esempio } from "./esempi";

const catalogo = import.meta.glob("../../esempi/esempi.json", { eager: true, import: "default" }) as Record<string, unknown>;
const fileElab = import.meta.glob("../../esempi/*.elab", { eager: true, query: "?raw", import: "default" }) as Record<
  string,
  string
>;

const perNome = Object.fromEntries(Object.entries(fileElab).map(([p, testo]) => [p.split("/").pop() ?? p, testo]));
const esito = leggiCatalogo(Object.values(catalogo)[0], perNome);
if (esito.errori.length > 0) console.warn("Problemi negli esempi:\n" + esito.errori.join("\n"));

/** Tutti gli esempi validi, nell'ordine del catalogo. */
export const ESEMPI: readonly Esempio[] = esito.esempi;
/** Problemi del catalogo (usati dai test per accorgersi di un catalogo rotto). */
export const ERRORI_ESEMPI: readonly string[] = esito.errori;
