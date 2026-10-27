// Prova dell'interfaccia compilata con Playwright (verifica finale della Fase 2).
//
// Uso:
//   npm run build
//   npx vite preview --port 4173 --strictPort      (in un'altra finestra)
//   node strumenti/prova-interfaccia.cjs [indirizzo]
//
// Richiede Playwright con Chromium già installati sul computer
// (non è fra le dipendenze del progetto, così la build su Windows resta leggera).
//
// Lo script fa quello che farebbe uno studente: apre la schermata iniziale,
// disegna da zero un circuito pulsante → lampada, lo simula, poi apre i
// cinque esempi pronti e li prova seguendo le istruzioni "Come provarlo".
// Lo stato di lampade, bobine e motori si legge dal disegno Konva (colori e
// rotazioni delle forme), quindi la prova non dipende dai pixel dello schermo.
// Al termine stampa l'esito di ogni controllo ed esce con codice 1 se uno fallisce.

const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const INDIRIZZO = process.argv[2] || "http://localhost:4173/";
const CARTELLA_IMMAGINI = path.join(__dirname, "..", "prova-interfaccia");

let falliti = 0;
function controlla(condizione, descrizione) {
  console.log(`${condizione ? "  OK " : "  NO "} ${descrizione}`);
  if (!condizione) falliti++;
}

/** Restituisce il rettangolo (coordinate della pagina) del simbolo che ha la sigla data. */
async function rettangoloComponente(pagina, sigla, indice = 0) {
  const r = await pagina.evaluate(
    ([sigla, indice]) => {
      const st = window.Konva.stages[0];
      const gruppi = st
        .find("Text")
        .filter((t) => t.text() === sigla)
        .map((t) => t.getParent());
      const g = gruppi[indice];
      if (!g) return null;
      // Rettangolo delle forme del simbolo, esclusa la scritta della sigla.
      const forme = g.getChildren().filter((c) => c.getClassName() !== "Text");
      const rr = forme.map((c) => c.getClientRect());
      const x1 = Math.min(...rr.map((q) => q.x));
      const y1 = Math.min(...rr.map((q) => q.y));
      const x2 = Math.max(...rr.map((q) => q.x + q.width));
      const y2 = Math.max(...rr.map((q) => q.y + q.height));
      const c = st.container().getBoundingClientRect();
      return { x: c.left + x1, y: c.top + y1, w: x2 - x1, h: y2 - y1 };
    },
    [sigla, indice],
  );
  if (!r) throw new Error(`Componente ${sigla} non trovato sul foglio`);
  return r;
}

/** "Impronta" dell'aspetto di un componente: colori, rotazioni e scritte delle sue forme. */
async function aspetto(pagina, sigla, indice = 0) {
  return pagina.evaluate(
    ([sigla, indice]) => {
      const st = window.Konva.stages[0];
      const g = st
        .find("Text")
        .filter((t) => t.text() === sigla)
        .map((t) => t.getParent())[indice];
      if (!g) return "";
      const parti = [];
      const visita = (n) => {
        const a = n.attrs;
        parti.push([n.getClassName(), a.fill, a.stroke, a.rotation, a.text, a.opacity, a.visible].join("|"));
        if (n.getChildren) n.getChildren().forEach(visita);
      };
      visita(g);
      return parti.join(";");
    },
    [sigla, indice],
  );
}

/** Vero se l'aspetto del componente cambia da solo in poco tempo (motore che gira). */
async function inMovimento(pagina, sigla) {
  const a = await aspetto(pagina, sigla);
  await pagina.waitForTimeout(400);
  const b = await aspetto(pagina, sigla);
  return a !== b;
}

async function clicSu(pagina, sigla, indice = 0) {
  const r = await rettangoloComponente(pagina, sigla, indice);
  await pagina.mouse.click(r.x + r.w / 2, r.y + r.h / 2);
  await pagina.waitForTimeout(250);
}

/** Tiene premuto un pulsante sul foglio per un attimo e poi lo rilascia. */
async function premi(pagina, sigla) {
  const r = await rettangoloComponente(pagina, sigla);
  await pagina.mouse.move(r.x + r.w / 2, r.y + r.h / 2);
  await pagina.mouse.down();
  await pagina.waitForTimeout(350);
  await pagina.mouse.up();
  await pagina.waitForTimeout(350);
}

async function nessunProblema(pagina) {
  return (await pagina.locator(".pannello-problemi-vuoto").count()) > 0;
}

async function avvia(pagina) {
  await pagina.locator(".pulsante-simulazione").click();
  await pagina.waitForTimeout(400);
}

async function apriEsempio(pagina, file) {
  await pagina.getByText("Schermata iniziale").click().catch(() => {});
  await pagina.waitForTimeout(300);
  await pagina.getByText("Sfoglia gli esempi").click();
  await pagina.click(`[data-esempio="${file}"]`);
  await pagina.waitForTimeout(500);
  const avviso = pagina.getByText("Ho capito");
  if (await avviso.count()) await avviso.click();
}

/** Morsetti (centri, coordinate della pagina) che cadono dentro il rettangolo del componente. */
async function morsettiDi(pagina, sigla) {
  // Senza sigla (es. la rete, che non ne ha): tutti i morsetti del foglio.
  const r = sigla ? await rettangoloComponente(pagina, sigla) : { x: -1e9, y: -1e9, w: 2e9, h: 2e9 };
  return pagina.evaluate((r) => {
    const st = window.Konva.stages[0];
    const c = st.container().getBoundingClientRect();
    return st
      .find("Circle")
      .filter((k) => k.hitStrokeWidth() === 14)
      .map((k) => {
        const p = k.getAbsolutePosition();
        return { x: c.left + p.x, y: c.top + p.y };
      })
      .filter((p) => p.x >= r.x - 4 && p.x <= r.x + r.w + 4 && p.y >= r.y - 4 && p.y <= r.y + r.h + 4)
      .sort((a, b) => a.y - b.y || a.x - b.x);
  }, r);
}

async function collega(pagina, a, b) {
  await pagina.mouse.click(a.x, a.y);
  await pagina.waitForTimeout(150);
  await pagina.mouse.click(b.x, b.y);
  await pagina.waitForTimeout(150);
}

(async () => {
  fs.mkdirSync(CARTELLA_IMMAGINI, { recursive: true });
  const browser = await chromium.launch();
  const pagina = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errori = [];
  pagina.on("console", (m) => m.type() === "error" && errori.push(m.text()));
  pagina.on("pageerror", (e) => errori.push(String(e)));
  const foto = (nome) => pagina.screenshot({ path: path.join(CARTELLA_IMMAGINI, `${nome}.png`) });

  // --- Schermata iniziale ---------------------------------------------------
  console.log("Schermata iniziale");
  await pagina.goto(INDIRIZZO);
  await pagina.waitForTimeout(800);
  for (const m of ["Impianti elettrici", "PLC", "Arduino", "Elettronica"]) {
    controlla((await pagina.getByText(m, { exact: true }).count()) > 0, `tessera «${m}» presente`);
  }
  await foto("01-schermata-iniziale");

  // --- Circuito disegnato da zero: rete monofase → pulsante NA → lampada ----
  console.log("Circuito disegnato da zero");
  await pagina.getByText("Impianti elettrici", { exact: true }).first().click();
  await pagina.waitForTimeout(600);
  const tela = await pagina.locator("canvas").first().boundingBox();
  const posa = async (nome, x, y) => {
    await pagina.locator(".libreria").getByText(nome, { exact: true }).first().click();
    await pagina.mouse.click(tela.x + x, tela.y + y);
    await pagina.waitForTimeout(250);
    await pagina.keyboard.press("Escape");
  };
  await posa("Rete monofase", 200, 100);
  await posa("Pulsante NA (marcia)", 200, 280);
  await posa("Lampada di segnalazione", 200, 440);
  // L → pulsante (sopra), pulsante (sotto) → lampada (sopra), lampada (sotto) → N.
  // I due morsetti più in alto del foglio sono quelli della rete (L e N).
  const rete = (await morsettiDi(pagina, null)).slice(0, 2);
  const s1 = await morsettiDi(pagina, "S1");
  const h1 = await morsettiDi(pagina, "H1");
  controlla(rete.length === 2 && s1.length === 2 && h1.length === 2, "morsetti di rete, S1 e H1 trovati");
  const [fase, neutro] = [...rete].sort((a, b) => a.x - b.x);
  await collega(pagina, fase, s1[0]);
  await collega(pagina, s1[1], h1[0]);
  await collega(pagina, h1[1], neutro);
  await foto("02-circuito-disegnato");
  await avvia(pagina);
  controlla(await nessunProblema(pagina), "nessun problema segnalato nel circuito disegnato");
  const lampadaSpenta = await aspetto(pagina, "H1");
  const r = await rettangoloComponente(pagina, "S1");
  await pagina.mouse.move(r.x + r.w / 2, r.y + r.h / 2);
  await pagina.mouse.down();
  await pagina.waitForTimeout(400);
  controlla((await aspetto(pagina, "H1")) !== lampadaSpenta, "tenendo premuto S1 la lampada H1 si accende");
  await foto("03-lampada-accesa");
  await pagina.mouse.up();
  await pagina.waitForTimeout(400);
  controlla((await aspetto(pagina, "H1")) === lampadaSpenta, "rilasciando S1 la lampada H1 si spegne");
  await avvia(pagina); // ferma

  // --- Esempio 1: marcia/arresto con autoritenuta ---------------------------
  console.log("Esempio: marcia/arresto con autoritenuta");
  await apriEsempio(pagina, "marcia-arresto.elab");
  await avvia(pagina);
  controlla(await nessunProblema(pagina), "nessun problema all'avvio");
  await clicSu(pagina, "Q1");
  const h1Spenta = await aspetto(pagina, "H1");
  controlla(!(await inMovimento(pagina, "M1")), "M1 fermo prima della marcia");
  await premi(pagina, "S1");
  controlla((await aspetto(pagina, "H1")) !== h1Spenta, "dopo S1 la spia H1 resta accesa (autoritenuta)");
  controlla(await inMovimento(pagina, "M1"), "dopo S1 il motore M1 gira");
  await foto("04-marcia-arresto");
  await premi(pagina, "S0");
  controlla((await aspetto(pagina, "H1")) === h1Spenta, "dopo S0 la spia H1 si spegne");
  controlla(!(await inMovimento(pagina, "M1")), "dopo S0 il motore M1 si ferma");

  // --- Esempio 2: comando da più punti --------------------------------------
  console.log("Esempio: comando da più punti");
  await apriEsempio(pagina, "comando-piu-punti.elab");
  await avvia(pagina);
  controlla(await nessunProblema(pagina), "nessun problema all'avvio");
  await clicSu(pagina, "Q1");
  await premi(pagina, "S3");
  controlla(await inMovimento(pagina, "M1"), "S3 avvia il motore");
  await premi(pagina, "S2");
  controlla(!(await inMovimento(pagina, "M1")), "S2 ferma il motore");
  await premi(pagina, "S1");
  controlla(await inMovimento(pagina, "M1"), "S1 avvia il motore");
  await premi(pagina, "S0");
  controlla(!(await inMovimento(pagina, "M1")), "S0 ferma il motore");

  // --- Esempio 3: teleinvertitore -------------------------------------------
  console.log("Esempio: teleinvertitore con interblocco");
  await apriEsempio(pagina, "teleinvertitore.elab");
  await avvia(pagina);
  controlla(await nessunProblema(pagina), "nessun problema all'avvio");
  await clicSu(pagina, "Q1");
  const h1Off = await aspetto(pagina, "H1");
  const h2Off = await aspetto(pagina, "H2");
  await premi(pagina, "S1");
  controlla((await aspetto(pagina, "H1")) !== h1Off && (await inMovimento(pagina, "M1")), "S1: avanti, H1 accesa e motore in moto");
  await premi(pagina, "S2");
  controlla((await aspetto(pagina, "H2")) === h2Off, "S2 con K1 eccitato non ha effetto (interblocco)");
  await premi(pagina, "S0");
  await premi(pagina, "S2");
  controlla((await aspetto(pagina, "H2")) !== h2Off && (await aspetto(pagina, "H1")) === h1Off, "dopo S0 e S2: indietro, accesa solo H2");
  controlla(await nessunProblema(pagina), "nessun cortocircuito");
  await foto("05-teleinvertitore");

  // --- Esempio 4: avviamento stella-triangolo -------------------------------
  console.log("Esempio: avviamento stella-triangolo");
  await apriEsempio(pagina, "stella-triangolo.elab");
  await avvia(pagina);
  controlla(await nessunProblema(pagina), "nessun problema all'avvio");
  await clicSu(pagina, "Q1");
  const k2Riposo = await aspetto(pagina, "K2", 0);
  const k3Riposo = await aspetto(pagina, "K3", 0);
  await premi(pagina, "S1");
  controlla(await inMovimento(pagina, "M1"), "S1: il motore parte");
  controlla((await aspetto(pagina, "K2", 0)) !== k2Riposo && (await aspetto(pagina, "K3", 0)) === k3Riposo, "subito dopo la marcia: stella (K2 eccitato, K3 a riposo)");
  await foto("06-stella");
  await pagina.waitForTimeout(4600);
  controlla((await aspetto(pagina, "K2", 0)) === k2Riposo && (await aspetto(pagina, "K3", 0)) !== k3Riposo, "dopo 4 s: triangolo (K2 a riposo, K3 eccitato)");
  controlla(await inMovimento(pagina, "M1"), "a triangolo il motore continua a girare");
  await foto("07-triangolo");
  await premi(pagina, "S0");
  controlla(!(await inMovimento(pagina, "M1")), "S0 ferma il motore");

  // --- Esempio 5: comando temporizzato --------------------------------------
  console.log("Esempio: comando temporizzato");
  await apriEsempio(pagina, "comando-temporizzato.elab");
  await avvia(pagina);
  controlla(await nessunProblema(pagina), "nessun problema all'avvio");
  await clicSu(pagina, "Q1");
  await premi(pagina, "S1");
  controlla(await inMovimento(pagina, "M1"), "S1: il motore gira");
  await pagina.waitForTimeout(8600);
  controlla(!(await inMovimento(pagina, "M1")), "dopo 8 s il motore si ferma da solo");
  controlla(await nessunProblema(pagina), "nessuna oscillazione segnalata");
  await foto("08-temporizzato");

  controlla(errori.length === 0, `nessun errore nella console${errori.length ? ": " + errori.join(" | ") : ""}`);
  await browser.close();
  console.log(falliti === 0 ? "\nTutti i controlli superati." : `\n${falliti} controlli NON superati.`);
  process.exit(falliti === 0 ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
