// Componente principale: decide quale schermata mostrare, gestisce il tema,
// le impostazioni (file recenti) e l'apertura dei file .elab.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import pacchetto from "../package.json";
import { t } from "./testi";
import { SchermataIniziale } from "./interfaccia/SchermataIniziale";
import { SchermataModulo, type Documento } from "./interfaccia/SchermataModulo";
import { trovaModulo, type IdModulo } from "./interfaccia/moduli";
import { alternaTema, leggiTemaSalvato, salvaTema, temaIniziale, type Tema } from "./interfaccia/tema";
import { SCHEMA_VUOTO } from "./editor/schema";
import { creaArchivio } from "./progetto/archivio";
import { leggiProgetto } from "./progetto/formato";
import { leggiAutosalvataggio } from "./progetto/autosalvataggio";
import {
  IMPOSTAZIONI_INIZIALI,
  aggiungiRecente,
  leggiImpostazioni,
  rimuoviRecente,
  serializzaImpostazioni,
  type FileRecente,
  type Impostazioni,
} from "./progetto/impostazioni";

/** localStorage può mancare o essere bloccato: in quel caso si lavora senza. */
function archivioTema(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function sistemaPreferisceScuro(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

/** Documento aperto insieme al suo modulo. */
interface Aperto {
  modulo: IdModulo;
  documento: Documento;
}

export default function App() {
  const archivio = useMemo(creaArchivio, []);
  // Il tema si legge subito dal localStorage (niente "lampo" bianco all'avvio),
  // poi viene confermato dal file delle impostazioni.
  const [tema, setTema] = useState<Tema>(() => temaIniziale(leggiTemaSalvato(archivioTema()), sistemaPreferisceScuro()));
  const [impostazioni, setImpostazioni] = useState<Impostazioni>(IMPOSTAZIONI_INIZIALI);
  const [impostazioniLette, setImpostazioniLette] = useState(false);
  const [aperto, setAperto] = useState<Aperto | null>(null);
  const [avviso, setAvviso] = useState<string | null>(null);
  const prossimoId = useRef(1);

  // Il tema è applicato all'elemento <html>, così vale per tutta l'app.
  useEffect(() => {
    document.documentElement.dataset.tema = tema;
    salvaTema(archivioTema(), tema);
  }, [tema]);

  // All'avvio: impostazioni dalla cartella dei dati (portable o %APPDATA%).
  useEffect(() => {
    let attivo = true;
    Promise.all([archivio.leggiImpostazioni().catch(() => null), archivio.infoCartellaDati().catch(() => null)]).then(
      ([testo, info]) => {
        if (!attivo) return;
        const lette = leggiImpostazioni(testo);
        setImpostazioni(lette);
        if (lette.tema) setTema(lette.tema);
        setImpostazioniLette(true);
        if (info?.avviso) setAvviso(info.avviso);
      },
    );
    return () => {
      attivo = false;
    };
  }, [archivio]);

  // Ogni cambiamento delle impostazioni viene scritto nel file (solo dopo averle lette,
  // per non cancellare i recenti con l'elenco vuoto iniziale).
  useEffect(() => {
    if (!impostazioniLette) return;
    archivio.scriviImpostazioni(serializzaImpostazioni({ ...impostazioni, tema })).catch(() => {
      // Cartella in sola lettura: si continua a lavorare, i recenti non verranno ricordati.
    });
  }, [archivio, impostazioni, impostazioniLette, tema]);

  const nuovoDocumento = useCallback((modulo: IdModulo, d: Omit<Documento, "id">) => {
    setAperto({ modulo, documento: { ...d, id: prossimoId.current++ } });
  }, []);

  /** Apre un modulo dalla tessera: riprende il salvataggio automatico, se c'è. */
  const apriModulo = useCallback(
    async (modulo: IdModulo) => {
      const auto = leggiAutosalvataggio(await archivio.leggiAutosalvataggio(modulo).catch(() => null));
      if (auto && auto.progetto.modulo === modulo) {
        nuovoDocumento(modulo, { schema: auto.progetto.schema, percorso: auto.percorso, modificato: auto.modificato });
      } else {
        nuovoDocumento(modulo, { schema: SCHEMA_VUOTO, percorso: null, modificato: false });
      }
    },
    [archivio, nuovoDocumento],
  );

  const ricordaRecente = useCallback((percorso: string, modulo: IdModulo) => {
    setImpostazioni((i) => ({ ...i, recenti: aggiungiRecente(i.recenti, percorso, modulo) }));
  }, []);

  /** Apre un file .elab; il modulo giusto viene scelto in base al contenuto del file. */
  const apriPercorso = useCallback(
    async (percorso: string) => {
      let testo: string;
      try {
        testo = await archivio.leggiFile(percorso);
      } catch (e) {
        setImpostazioni((i) => ({ ...i, recenti: rimuoviRecente(i.recenti, percorso) }));
        setAvviso((e as Error).message);
        return;
      }
      const esito = leggiProgetto(testo);
      if (!esito.ok) {
        setAvviso(esito.errore);
        return;
      }
      const { modulo, schema } = esito.progetto;
      nuovoDocumento(modulo, { schema, percorso, modificato: false });
      ricordaRecente(percorso, modulo);
      if (esito.avvisi.length > 0) setAvviso(esito.avvisi.join(" "));
    },
    [archivio, nuovoDocumento, ricordaRecente],
  );

  const apriConDialogo = useCallback(async () => {
    const scelto = await archivio.scegliFileDaAprire();
    if (scelto) await apriPercorso(scelto);
  }, [archivio, apriPercorso]);

  const finestraAvviso = avviso && (
    <div className="avviso" role="status">
      <span>{avviso}</span>
      <button type="button" className="pulsante" onClick={() => setAvviso(null)}>
        {t("comune.ok")}
      </button>
    </div>
  );

  const modulo = aperto ? trovaModulo(aperto.modulo) : undefined;
  if (aperto && modulo) {
    return (
      <>
        <SchermataModulo
          key={aperto.documento.id}
          modulo={modulo}
          tema={tema}
          documento={aperto.documento}
          archivio={archivio}
          versione={pacchetto.version}
          onIndietro={() => setAperto(null)}
          onNuovo={() => nuovoDocumento(modulo.id, { schema: SCHEMA_VUOTO, percorso: null, modificato: false })}
          onApriPercorso={(p) => void apriPercorso(p)}
          onSalvato={(p) => ricordaRecente(p, modulo.id)}
          onErrore={setAvviso}
        />
        {finestraAvviso}
      </>
    );
  }

  return (
    <>
      <SchermataIniziale
        tema={tema}
        versione={pacchetto.version}
        recenti={impostazioni.recenti}
        onApriModulo={(id) => void apriModulo(id)}
        onApriRecente={(f: FileRecente) => void apriPercorso(f.percorso)}
        onApriFile={() => void apriConDialogo()}
        onApriEsempi={() => setAvviso(t("home.esempiInArrivo"))}
        onAlternaTema={() => setTema((x) => alternaTema(x))}
      />
      {finestraAvviso}
    </>
  );
}
