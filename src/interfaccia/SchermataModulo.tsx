// Schermata di un modulo: intestazione con ritorno alla schermata iniziale
// e area di disegno comune. Gli strumenti specifici di ogni modulo
// (libreria, simulazione) si aggiungeranno nelle attività successive.
import { useState } from "react";
import { t } from "../testi";
import { AreaDisegno } from "../editor/AreaDisegno";
import { schemaProvvisorio } from "../editor/schemaProvvisorio";
import type { DefinizioneModulo } from "./moduli";
import type { Tema } from "./tema";

export interface PropsSchermataModulo {
  modulo: DefinizioneModulo;
  tema: Tema;
  onIndietro: () => void;
}

export function SchermataModulo({ modulo, tema, onIndietro }: PropsSchermataModulo) {
  // Per ora ogni apertura del modulo parte dallo schema di prova.
  const [schema, setSchema] = useState(schemaProvvisorio);
  return (
    <div className="schermata-modulo" data-modulo={modulo.id}>
      <header className="intestazione intestazione-modulo" style={{ borderColor: modulo.coloreAccento }}>
        <button type="button" className="pulsante" onClick={onIndietro}>
          ← {t("comune.home")}
        </button>
        <h1>{t(modulo.chiaveTitolo)}</h1>
      </header>
      <AreaDisegno tema={tema} schema={schema} onCambiaSchema={setSchema} />
    </div>
  );
}
