// Schermata provvisoria di un modulo: l'editor grafico arriva con l'attività 1.4.
// Serve già ora per poter tornare alla schermata iniziale.
import { t } from "../testi";
import type { DefinizioneModulo } from "./moduli";

export function SchermataModulo({ modulo, onIndietro }: { modulo: DefinizioneModulo; onIndietro: () => void }) {
  return (
    <div className="schermata-modulo">
      <header className="intestazione">
        <button type="button" className="pulsante" onClick={onIndietro}>
          ← {t("comune.home")}
        </button>
        <h1>{t(modulo.chiaveTitolo)}</h1>
      </header>
      <p className="vuoto">{t("modulo.inCostruzione")}</p>
    </div>
  );
}
