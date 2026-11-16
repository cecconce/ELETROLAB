// Finestre di domanda disegnate dall'app (avviso, conferma, testo da scrivere).
// Servono a Blockly, che di suo usa window.alert / confirm / prompt: nella
// WebView di Tauri 2 queste non sono affidabili e il pulsante «Crea variabile…»
// dell'editor a blocchi non faceva niente nell'.exe. Queste finestre sono
// normali elementi della pagina: funzionano uguali nel browser e nell'.exe,
// con i colori del tema (classi .sfondo-finestra / .finestra di stile.css).
import { t } from "../testi";

type Tipo = "avviso" | "conferma" | "testo";

/**
 * Apre la finestra e risolve con: true/false (conferma), il testo scritto o
 * null se annullato (testo), sempre true (avviso). Invio = OK, Esc = Annulla.
 */
function apri(tipo: Tipo, messaggio: string, predefinito = ""): Promise<boolean | string | null> {
  return new Promise((risolvi) => {
    const sfondo = document.createElement("div");
    sfondo.className = "sfondo-finestra finestra-domanda";
    const finestra = document.createElement("div");
    finestra.className = "finestra";
    finestra.setAttribute("role", tipo === "avviso" ? "alertdialog" : "dialog");
    finestra.setAttribute("aria-modal", "true");
    const testo = document.createElement("p");
    testo.textContent = messaggio;
    testo.style.whiteSpace = "pre-wrap";
    finestra.appendChild(testo);

    let campo: HTMLInputElement | null = null;
    if (tipo === "testo") {
      campo = document.createElement("input");
      campo.type = "text";
      campo.className = "campo-domanda";
      campo.value = predefinito;
      campo.setAttribute("aria-label", messaggio);
      finestra.appendChild(campo);
    }

    const pulsanti = document.createElement("div");
    pulsanti.className = "pulsanti-finestra";
    const chiudi = (esito: boolean | string | null) => {
      document.removeEventListener("keydown", tasti, true);
      sfondo.remove();
      risolvi(esito);
    };
    const conferma = () => chiudi(tipo === "testo" ? (campo?.value ?? "") : true);
    const annulla = () => chiudi(tipo === "testo" ? null : tipo === "avviso");
    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "pulsante primario";
    ok.textContent = tipo === "conferma" ? t("comune.si") : "OK";
    ok.addEventListener("click", conferma);
    pulsanti.appendChild(ok);
    if (tipo !== "avviso") {
      const no = document.createElement("button");
      no.type = "button";
      no.className = "pulsante";
      no.textContent = tipo === "conferma" ? t("comune.no") : t("comune.annulla");
      no.addEventListener("click", annulla);
      pulsanti.appendChild(no);
    }
    finestra.appendChild(pulsanti);
    sfondo.appendChild(finestra);

    // Tasti catturati prima di tutto il resto (Blockly e l'editor non li vedono).
    const tasti = (e: KeyboardEvent) => {
      if (e.key === "Enter") conferma();
      else if (e.key === "Escape") annulla();
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener("keydown", tasti, true);
    document.body.appendChild(sfondo);
    (campo ?? ok).focus();
    campo?.select();
  });
}

export const avviso = (messaggio: string) => apri("avviso", messaggio).then(() => undefined);
export const conferma = (messaggio: string) => apri("conferma", messaggio).then((v) => v === true);
export const chiediTesto = (messaggio: string, predefinito = "") =>
  apri("testo", messaggio, predefinito).then((v) => (typeof v === "string" ? v : null));
