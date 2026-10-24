// Schermata di un modulo: intestazione con ritorno alla schermata iniziale,
// libreria dei componenti a sinistra e area di disegno comune.
// Gli strumenti di simulazione si aggiungeranno nelle fasi successive.
import { useMemo, useState } from "react";
import { t } from "../testi";
import { AreaDisegno } from "../editor/AreaDisegno";
import { LibreriaLaterale } from "../editor/LibreriaLaterale";
import { libreriaDelModulo } from "../editor/caricaLibreria";
import { SCHEMA_VUOTO, type Schema } from "../editor/schema";
import type { DefinizioneModulo } from "./moduli";
import type { Tema } from "./tema";

export interface PropsSchermataModulo {
  modulo: DefinizioneModulo;
  tema: Tema;
  onIndietro: () => void;
}

export function SchermataModulo({ modulo, tema, onIndietro }: PropsSchermataModulo) {
  // Per ora ogni apertura del modulo parte da un foglio vuoto (salvataggio con la 1.8).
  const [schema, setSchema] = useState<Schema>(SCHEMA_VUOTO);
  const [daPosare, setDaPosare] = useState<string | null>(null);
  const libreria = useMemo(() => libreriaDelModulo(modulo.id), [modulo.id]);
  return (
    <div className="schermata-modulo" data-modulo={modulo.id}>
      <header className="intestazione intestazione-modulo" style={{ borderColor: modulo.coloreAccento }}>
        <button type="button" className="pulsante" onClick={onIndietro}>
          ← {t("comune.home")}
        </button>
        <h1>{t(modulo.chiaveTitolo)}</h1>
      </header>
      <div className="corpo-modulo">
        <LibreriaLaterale libreria={libreria} tema={tema} daPosare={daPosare} onScegli={setDaPosare} />
        <AreaDisegno
          tema={tema}
          schema={schema}
          onCambiaSchema={setSchema}
          libreria={libreria}
          daPosare={daPosare}
          onFinePosa={() => setDaPosare(null)}
        />
      </div>
    </div>
  );
}
