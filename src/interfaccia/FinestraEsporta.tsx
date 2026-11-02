// Finestra "Esporta e stampa": dati del cartiglio (titolo, nome, classe, data)
// e tre pulsanti: immagine PNG, documento PDF, stampa. Nome e classe vengono
// ricordati su questo computer, così lo studente non li riscrive ogni volta.
import { useEffect, useRef, useState } from "react";
import { t } from "../testi";
import { dataDiOggi, type Cartiglio } from "../editor/esportazione";

const CHIAVE = "elettrolab.cartiglio";

function ricordati(): { nome: string; classe: string } {
  try {
    const v = JSON.parse(window.localStorage.getItem(CHIAVE) ?? "{}") as { nome?: unknown; classe?: unknown };
    return { nome: typeof v.nome === "string" ? v.nome : "", classe: typeof v.classe === "string" ? v.classe : "" };
  } catch {
    return { nome: "", classe: "" };
  }
}

export interface PropsFinestraEsporta {
  titoloIniziale: string;
  modulo: string;
  onEsporta: (formato: "png" | "pdf" | "stampa", cartiglio: Cartiglio) => void;
  onChiudi: () => void;
  /** Lo schema è vuoto: niente da esportare. */
  vuoto: boolean;
}

export function FinestraEsporta({ titoloIniziale, modulo, onEsporta, onChiudi, vuoto }: PropsFinestraEsporta) {
  const [titolo, setTitolo] = useState(titoloIniziale);
  const [{ nome, classe }, setDati] = useState(ricordati);
  const [data, setData] = useState(dataDiOggi());
  const primo = useRef<HTMLInputElement>(null);
  useEffect(() => {
    primo.current?.focus();
    const tasto = (e: KeyboardEvent) => {
      if (e.key === "Escape") onChiudi();
    };
    window.addEventListener("keydown", tasto);
    return () => window.removeEventListener("keydown", tasto);
  }, [onChiudi]);
  const esegui = (formato: "png" | "pdf" | "stampa") => {
    try {
      window.localStorage.setItem(CHIAVE, JSON.stringify({ nome, classe }));
    } catch {
      // senza memoria del browser si riscrivono la prossima volta
    }
    onEsporta(formato, { titolo, nome, classe, data, modulo });
  };
  const campo = (etichetta: string, valore: string, cambia: (v: string) => void, rif?: React.RefObject<HTMLInputElement>) => (
    <label className="proprieta-campo">
      <span>{etichetta}</span>
      <input ref={rif} type="text" value={valore} maxLength={60} onChange={(e) => cambia(e.target.value)} />
    </label>
  );
  return (
    <div className="sfondo-finestra" onClick={onChiudi}>
      <div className="finestra finestra-esporta" role="dialog" aria-modal="true" aria-labelledby="titolo-esporta" onClick={(e) => e.stopPropagation()}>
        <h2 id="titolo-esporta">{t("esporta.titolo")}</h2>
        <p className="tenue">{t("esporta.introduzione")}</p>
        {campo(t("esporta.titoloSchema"), titolo, setTitolo, primo)}
        {campo(t("esporta.nome"), nome, (v) => setDati((d) => ({ ...d, nome: v })))}
        {campo(t("esporta.classe"), classe, (v) => setDati((d) => ({ ...d, classe: v })))}
        {campo(t("esporta.data"), data, setData)}
        {vuoto && <p className="proprieta-avviso">{t("esporta.vuoto")}</p>}
        <div className="pulsanti-finestra">
          <button type="button" className="pulsante" disabled={vuoto} onClick={() => esegui("png")}>
            🖼 {t("esporta.png")}
          </button>
          <button type="button" className="pulsante" disabled={vuoto} onClick={() => esegui("pdf")}>
            📄 {t("esporta.pdf")}
          </button>
          <button type="button" className="pulsante" disabled={vuoto} onClick={() => esegui("stampa")}>
            🖨 {t("esporta.stampa")}
          </button>
          <button type="button" className="pulsante" onClick={onChiudi}>
            {t("comune.chiudi")}
          </button>
        </div>
      </div>
    </div>
  );
}
