// Componente principale. Per ora mostra solo titolo e versione:
// la schermata iniziale con le 4 tessere arriva con l'attività 1.3.
import { t } from "./testi";
import pacchetto from "../package.json";

export default function App() {
  return (
    <main className="contenitore">
      <h1>{t("app.titolo")}</h1>
      <p>{t("app.sottotitolo")}</p>
      <p className="versione">{t("app.versione", { versione: pacchetto.version })}</p>
    </main>
  );
}
