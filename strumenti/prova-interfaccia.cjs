// Prova dell'interfaccia compilata con Playwright (verifiche finali delle Fasi 2 e 3).
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
// Poi passa al modulo PLC: disegna un segmento Ladder da zero, lo simula e
// prova gli 8 esempi del PLC (quadro, temporizzatori, contatori e impianti
// animati), leggendo lo stato dal pannello "Ingressi e uscite".
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

  // === Modulo PLC ===========================================================
  await provaPlc(pagina, controlla, foto, apriEsempio);

  controlla(errori.length === 0, `nessun errore nella console${errori.length ? ": " + errori.join(" | ") : ""}`);
  await browser.close();
  console.log(falliti === 0 ? "\nTutti i controlli superati." : `\n${falliti} controlli NON superati.`);
  process.exit(falliti === 0 ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

// --- Modulo PLC --------------------------------------------------------------

/** Rettangolo (pagina) di un componente riconosciuto dalla misura della sua icona e, se serve, dalla scritta. */
async function rettangoloPerMisura(pagina, larghezza, altezza, scritta) {
  const r = await pagina.evaluate(
    ([larghezza, altezza, scritta]) => {
      const st = window.Konva.stages[0];
      const c = st.container().getBoundingClientRect();
      const gruppi = st
        .find("Image")
        .filter((im) => im.width() === larghezza && im.height() === altezza)
        .map((im) => im.getParent())
        .filter((g) => !scritta || g.find("Text").some((t) => t.text() === scritta));
      const g = gruppi[0];
      if (!g) return null;
      const im = g.find("Image")[0];
      const q = im.getClientRect();
      return { x: c.left + q.x, y: c.top + q.y, w: q.width, h: q.height, scala: im.getAbsoluteScale().x };
    },
    [larghezza, altezza, scritta],
  );
  if (!r) throw new Error(`Componente ${larghezza}×${altezza} ${scritta ?? ""} non trovato`);
  return r;
}

/** Valore 0/1 di un operando nel pannello "Ingressi e uscite". */
async function valoreIo(pagina, operando) {
  const el = pagina.locator(`.pannello-io-plc [data-operando="${operando}"]`);
  if ((await el.count()) === 0) return null;
  const testo = await el.first().innerText();
  return testo.trim().endsWith("1");
}

async function provaPlc(pagina, controlla, foto, apriEsempio) {
  const fermaSeServe = async () => {
    const p = pagina.locator(".pulsante-simulazione");
    if ((await p.innerText()).includes("FERMA")) await p.click();
  };
  const avvia = async () => {
    await pagina.locator(".pulsante-simulazione").click();
    await pagina.waitForTimeout(400);
  };
  const nessunProblema = async () => (await pagina.locator(".pannello-problemi-vuoto").count()) > 0;
  /** Tiene premuto il punto (relativo al rettangolo, 0..1) per un attimo. */
  const premiIn = async (r, fx = 0.5, fy = 0.5, durata = 300) => {
    await pagina.mouse.move(r.x + r.w * fx, r.y + r.h * fy);
    await pagina.mouse.down();
    await pagina.waitForTimeout(durata);
    await pagina.mouse.up();
    await pagina.waitForTimeout(250);
  };
  const adatta = async () => {
    await pagina.getByText("Adatta alla finestra").click();
    await pagina.waitForTimeout(200);
  };

  // --- Segmento disegnato da zero ---
  console.log("PLC: segmento disegnato da zero");
  await fermaSeServe();
  await pagina.getByText("Schermata iniziale").click().catch(() => {});
  await pagina.waitForTimeout(300);
  await pagina.getByText("PLC", { exact: true }).first().click();
  await pagina.waitForTimeout(600);
  const avviso = pagina.getByText("Ho capito");
  if (await avviso.count()) await avviso.click();
  await pagina.getByText("Nuovo", { exact: true }).click();
  await pagina.waitForTimeout(300);
  const tela = await pagina.locator("canvas").first().boundingBox();
  const posa = async (nome, x, y) => {
    await pagina.locator(".libreria").getByPlaceholder(/Cerca/).fill(nome);
    await pagina.waitForTimeout(100);
    await pagina.locator(".libreria").getByText(nome, { exact: true }).first().click();
    await pagina.mouse.click(tela.x + x, tela.y + y);
    await pagina.waitForTimeout(250);
    await pagina.keyboard.press("Escape");
    await pagina.locator(".libreria").getByPlaceholder(/Cerca/).fill("");
  };
  await posa("Barra di alimentazione sinistra", 80, 260);
  await posa("Contatto NA", 200, 80);
  await posa("Bobina", 360, 80);
  await posa("Pulsante di marcia (NA)", 560, 80);
  await posa("Lampada", 680, 80);
  const scritte = await pagina.evaluate(() => window.Konva.stages[0].find("Text").map((t) => t.text()));
  controlla(["I0.0", "Q0.0"].every((x) => scritte.includes(x)), "operandi proposti alla posa: I0.0 e Q0.0");
  const morsetti = await pagina.evaluate(() => {
    const st = window.Konva.stages[0];
    const c = st.container().getBoundingClientRect();
    return st
      .find("Circle")
      .filter((k) => k.hitStrokeWidth() === 14)
      .map((k) => {
        const q = k.getAbsolutePosition();
        return { x: Math.round(c.left + q.x), y: Math.round(c.top + q.y) };
      });
  });
  const minX = Math.min(...morsetti.map((m) => m.x));
  const barra = morsetti.filter((m) => m.x === minX).sort((a, b) => a.y - b.y);
  const riga = morsetti.filter((m) => m.x !== minX).sort((a, b) => a.x - b.x);
  const vicina = barra.reduce((m, q) => (Math.abs(q.y - riga[0].y) < Math.abs(m.y - riga[0].y) ? q : m));
  const collega2 = async (a, b) => {
    await pagina.mouse.click(a.x, a.y);
    await pagina.waitForTimeout(120);
    await pagina.mouse.click(b.x, b.y);
    await pagina.waitForTimeout(150);
  };
  await collega2(vicina, riga[0]);
  await collega2(riga[1], riga[2]);
  await avvia();
  controlla(await nessunProblema(), "nessun problema nel segmento disegnato");
  controlla((await valoreIo(pagina, "Q0.0")) === false, "a riposo Q0.0 = 0");
  const pulsante = await rettangoloPerMisura(pagina, 80, 80, "I0.0");
  await pagina.mouse.move(pulsante.x + pulsante.w / 2, pulsante.y + pulsante.h / 2);
  await pagina.mouse.down();
  await pagina.waitForTimeout(400);
  controlla((await valoreIo(pagina, "Q0.0")) === true, "tenendo premuto il pulsante del quadro Q0.0 = 1");
  await foto("09-plc-disegnato");
  await pagina.mouse.up();
  await pagina.waitForTimeout(300);
  controlla((await valoreIo(pagina, "Q0.0")) === false, "rilasciando il pulsante Q0.0 torna a 0");
  await fermaSeServe();

  // --- Esempi del PLC ---
  const apri = async (file) => {
    await fermaSeServe();
    await apriEsempio(pagina, file);
    await adatta();
    await avvia();
    controlla(await nessunProblema(), `${file}: nessun problema all'avvio`);
  };

  console.log("PLC: marcia/arresto");
  await apri("plc-marcia-arresto.elab");
  await premiIn(await rettangoloPerMisura(pagina, 80, 80, "I0.0"));
  controlla((await valoreIo(pagina, "Q0.0")) === true, "marcia: Q0.0 resta a 1 dopo il rilascio");
  await premiIn(await rettangoloPerMisura(pagina, 80, 80, "I0.1"));
  controlla((await valoreIo(pagina, "Q0.0")) === false, "arresto: Q0.0 torna a 0");

  console.log("PLC: telerruttore");
  await apri("plc-telerruttore.elab");
  await premiIn(await rettangoloPerMisura(pagina, 80, 80, "I0.0"));
  controlla((await valoreIo(pagina, "Q0.0")) === true, "prima pressione: lampada accesa");
  await premiIn(await rettangoloPerMisura(pagina, 80, 80, "I0.0"));
  controlla((await valoreIo(pagina, "Q0.0")) === false, "seconda pressione: lampada spenta");

  console.log("PLC: nastro trasportatore");
  await apri("plc-nastro.elab");
  await premiIn(await rettangoloPerMisura(pagina, 80, 80, "I0.0"));
  await premiIn(await rettangoloPerMisura(pagina, 360, 160), 0.5, 0.5, 100);
  controlla((await valoreIo(pagina, "Q0.0")) === true, "dopo la marcia il nastro gira");
  await pagina.waitForTimeout(6000);
  controlla((await valoreIo(pagina, "Q0.0")) === false && (await valoreIo(pagina, "Q0.1")) === true, "pacco in fondo: nastro fermo e lampada accesa");
  await foto("10-plc-nastro");

  console.log("PLC: semaforo");
  await apri("plc-semaforo.elab");
  await pagina.waitForTimeout(800);
  controlla((await valoreIo(pagina, "Q0.2")) === true, "all'avvio è verde");
  await pagina.waitForTimeout(5200);
  controlla((await valoreIo(pagina, "Q0.1")) === true, "dopo 5 s è giallo");
  await foto("11-plc-semaforo");

  console.log("PLC: cancello automatico");
  await apri("plc-cancello.elab");
  await premiIn(await rettangoloPerMisura(pagina, 80, 80, "I0.0"));
  controlla((await valoreIo(pagina, "Q0.0")) === true && (await valoreIo(pagina, "Q0.2")) === true, "apertura con lampeggiante");
  await pagina.waitForTimeout(5800);
  controlla((await valoreIo(pagina, "I0.3")) === true && (await valoreIo(pagina, "Q0.0")) === false, "tutto aperto: finecorsa I0.3 e motore fermo");
  await foto("12-plc-cancello");

  console.log("PLC: serbatoio con pompa");
  await apri("plc-serbatoio.elab");
  controlla((await valoreIo(pagina, "Q0.0")) === true, "serbatoio vuoto: la pompa parte");
  await pagina.waitForTimeout(9800);
  controlla((await valoreIo(pagina, "Q0.0")) === false, "al livello massimo la pompa si ferma");

  console.log("PLC: ascensore");
  await apri("plc-ascensore.elab");
  // Pulsante di chiamata del piano 2: in alto a destra nel disegno (x 130, y 45 su 160 × 300).
  await premiIn(await rettangoloPerMisura(pagina, 160, 300), 130 / 160, 45 / 300);
  await pagina.waitForTimeout(4800);
  controlla((await valoreIo(pagina, "I0.4")) === true && (await valoreIo(pagina, "Q0.0")) === false, "la cabina arriva al piano 2 e si ferma");
  await foto("13-plc-ascensore");

  console.log("PLC: parcheggio");
  await apri("plc-parcheggio.elab");
  await premiIn(await rettangoloPerMisura(pagina, 360, 180), 0.1, 0.75, 100);
  await pagina.waitForTimeout(3500);
  const testi = await pagina.evaluate(() => window.Konva.stages[0].find("Text").map((t) => t.text()));
  controlla(testi.includes("Auto: 1 / 5") && testi.includes("1 / 5"), "un'auto entrata: parcheggio e contatore segnano 1 / 5");
  await foto("14-plc-parcheggio");
  await fermaSeServe();
}
