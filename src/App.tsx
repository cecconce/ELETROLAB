// Componente principale: decide quale schermata mostrare e gestisce il tema.
import { useEffect, useState } from "react";
import pacchetto from "../package.json";
import { t } from "./testi";
import { SchermataIniziale } from "./interfaccia/SchermataIniziale";
import { SchermataModulo } from "./interfaccia/SchermataModulo";
import { trovaModulo, type IdModulo } from "./interfaccia/moduli";
import { alternaTema, leggiTemaSalvato, salvaTema, temaIniziale, type Tema } from "./interfaccia/tema";

/** localStorage può mancare o essere bloccato: in quel caso si lavora senza. */
function archivio(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function sistemaPreferisceScuro(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export default function App() {
  const [tema, setTema] = useState<Tema>(() => temaIniziale(leggiTemaSalvato(archivio()), sistemaPreferisceScuro()));
  const [moduloAperto, setModuloAperto] = useState<IdModulo | null>(null);
  const [avviso, setAvviso] = useState<string | null>(null);

  // Il tema è applicato all'elemento <html>, così vale per tutta l'app.
  useEffect(() => {
    document.documentElement.dataset.tema = tema;
    salvaTema(archivio(), tema);
  }, [tema]);

  const modulo = moduloAperto ? trovaModulo(moduloAperto) : undefined;
  if (modulo) {
    return <SchermataModulo modulo={modulo} onIndietro={() => setModuloAperto(null)} />;
  }

  return (
    <>
      <SchermataIniziale
        tema={tema}
        versione={pacchetto.version}
        recenti={[]}
        onApriModulo={setModuloAperto}
        onApriRecente={() => setAvviso(t("home.recentiInArrivo"))}
        onApriEsempi={() => setAvviso(t("home.esempiInArrivo"))}
        onAlternaTema={() => setTema((x) => alternaTema(x))}
      />
      {avviso && (
        <div className="avviso" role="status">
          <span>{avviso}</span>
          <button type="button" className="pulsante" onClick={() => setAvviso(null)}>
            {t("comune.ok")}
          </button>
        </div>
      )}
    </>
  );
}
