// Prova dell'interfaccia compilata con Playwright (verifiche finali delle Fasi 2, 3 e 5).
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
// animati), leggendo lo stato dal pannello "Ingressi e uscite". Infine il
// modulo Arduino: Blink montato da zero sulla breadboard con i blocchi, e gli
// esempi pronti (LED, pulsante, potenziometro, servo, display, ultrasuoni).
// Per ultimo il modulo Elettronica: generatore → resistenza → LED disegnato da
// zero, poi gli 8 esempi (multimetro, oscilloscopio, porte logiche, contatore,
// alimentatore, transistor, operazionale, condensatore). Infine le funzioni per
// il docente: esportazione PNG/PDF con cartiglio e modalità Esercizio con la
// verifica automatica.
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
  const pagina = await browser.newPage({ viewport: { width: 1366, height: 768 }, acceptDownloads: true });
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
  const testiFoglio = () => pagina.evaluate(() => window.Konva.stages[0].find("Text").map((t) => t.text()));
  {
    // Mentre S1 è tenuto premuto compare la scritta PREMUTO sul pulsante.
    const r = await rettangoloComponente(pagina, "S1");
    await pagina.mouse.move(r.x + r.w / 2, r.y + r.h / 2);
    await pagina.mouse.down();
    await pagina.waitForTimeout(350);
    controlla((await testiFoglio()).some((t) => t.includes("PREMUTO")), "tenendo premuto S1 compare «PREMUTO»");
    await pagina.mouse.up();
    await pagina.waitForTimeout(350);
  }
  controlla((await aspetto(pagina, "H1")) !== h1Spenta, "dopo S1 la spia H1 resta accesa (autoritenuta)");
  controlla(await inMovimento(pagina, "M1"), "dopo S1 il motore M1 gira");
  controlla((await testiFoglio()).some((t) => t.includes("IN MARCIA")), "accanto al motore compare «↻ IN MARCIA»");
  await foto("04-marcia-arresto");
  // Vista realistica: stessi collegamenti e stessa simulazione con i disegni degli apparecchi.
  await pagina.getByRole("radio", { name: /Realistica/ }).click();
  await pagina.waitForTimeout(400);
  controlla(await inMovimento(pagina, "M1"), "in vista Realistica il motore continua a girare");
  await foto("04b-marcia-arresto-realistica");
  await pagina.getByRole("radio", { name: /Simboli/ }).click();
  await pagina.waitForTimeout(300);
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

  // === Modulo Arduino ========================================================
  await provaArduino(pagina, controlla, foto, apriEsempio);

  // === Modulo Elettronica ====================================================
  await provaElettronica(pagina, controlla, foto, apriEsempio);

  // === Funzioni per il docente: esportazione e modalità Esercizio ===========
  await provaDocente(pagina, controlla, foto, apriEsempio);

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

// --- Modulo Arduino ----------------------------------------------------------

/** Vero se sul banco c'è un LED acceso del colore indicato (alone con ombra). */
async function ledAcceso(pagina, colore) {
  return pagina.evaluate((c) => window.Konva.stages[0].find("Circle").some((k) => k.fill() === c && k.shadowBlur() > 0), colore);
}
const ROSSO = "#ff3b30";
const VERDE = "#34c759";
const GIALLO = "#ffd60a";

async function provaArduino(pagina, controlla, foto, apriEsempio) {
  const ferma = async () => {
    const p = pagina.locator(".pulsante-simulazione");
    if ((await p.innerText()).includes("FERMA")) await p.click();
  };
  const avvia = async () => {
    await pagina.locator(".pulsante-simulazione").click();
    await pagina.waitForTimeout(300);
  };
  const nessunProblema = async () => (await pagina.locator(".pannello-problemi-vuoto").count()) > 0;
  const testiKonva = () => pagina.evaluate(() => window.Konva.stages[0].find("Text").map((t) => t.text()));

  // --- Blink montato da zero con i blocchi ---
  console.log("Arduino: Blink montato da zero");
  await ferma();
  await pagina.getByText("Schermata iniziale").click().catch(() => {});
  await pagina.waitForTimeout(300);
  await pagina.getByText("Arduino", { exact: true }).first().click();
  await pagina.waitForTimeout(600);
  const avviso = pagina.getByText("Ho capito");
  if (await avviso.count()) await avviso.click();
  await pagina.getByText("Nuovo", { exact: true }).click();
  await pagina.waitForTimeout(1500);
  controlla((await pagina.locator(".modo.attivo").innerText()).includes("Blocchi"), "un nuovo progetto parte in modalità Blocchi");
  controlla((await pagina.locator(".area-blocchi .blocklyDraggable").count()) >= 6, "sull'area ci sono i blocchi del Blink");
  const tela = await pagina.locator("canvas").first().boundingBox();
  const posa = async (nome, x, y) => {
    await pagina.locator(".libreria").getByPlaceholder(/Cerca/).fill(nome);
    await pagina.waitForTimeout(100);
    await pagina.locator(".libreria").getByText(nome, { exact: true }).first().click();
    await pagina.mouse.click(x, y);
    await pagina.waitForTimeout(250);
    await pagina.keyboard.press("Escape");
    await pagina.locator(".libreria").getByPlaceholder(/Cerca/).fill("");
  };
  await pagina.getByText("−", { exact: true }).click().catch(() => {});
  await posa("Arduino Uno", tela.x + 200, tela.y + 330);
  await posa("Breadboard", tela.x + 520, tela.y + 230);
  const bb = await rettangoloPerMisura(pagina, 660, 380);
  const U = await rettangoloPerMisura(pagina, 420, 300);
  const sb = bb.w / 660;
  const su = U.w / 420;
  const foro = (r, c) => ({ x: bb.x + (40 + (c - 1) * 20) * sb, y: bb.y + { a: 80, b: 100, c: 120, e: 160, Am: 40 }[r] * sb });
  const pin = (x, y) => ({ x: U.x + x * su, y: U.y + y * su });
  const a10 = foro("a", 10);
  await posa("Resistenza", a10.x + 40 * sb, a10.y);
  const e14 = foro("e", 14);
  await posa("LED rosso", e14.x + 20 * sb, e14.y - 40 * sb);
  const cavetto = async (a, b) => {
    await pagina.mouse.click(a.x, a.y);
    await pagina.waitForTimeout(150);
    await pagina.mouse.click(b.x, b.y);
    await pagina.waitForTimeout(200);
  };
  await cavetto(pin(120, 20), foro("b", 10));
  await cavetto(foro("c", 16), foro("Am", 16));
  await cavetto(foro("Am", 2), pin(100, 20));
  await avvia();
  controlla(await nessunProblema(), "Blink da zero: nessun problema");
  const acceso = await ledAcceso(pagina, ROSSO);
  await pagina.waitForTimeout(1050);
  const spento = !(await ledAcceso(pagina, ROSSO));
  controlla(acceso && spento, "il LED montato sulla breadboard lampeggia");
  await foto("15-arduino-blink");
  await ferma();

  // --- Esempi ---
  const apri = async (file) => {
    await ferma();
    await apriEsempio(pagina, file);
    await pagina.getByText("Adatta alla finestra").click();
    await pagina.waitForTimeout(200);
    await avvia();
    controlla(await nessunProblema(), `${file}: nessun problema all'avvio`);
  };

  console.log("Arduino: semaforo");
  await apri("arduino-semaforo.elab");
  await pagina.waitForTimeout(700);
  controlla((await ledAcceso(pagina, VERDE)) && !(await ledAcceso(pagina, ROSSO)), "parte il verde");

  console.log("Arduino: pulsante");
  await apri("arduino-pulsante.elab");
  controlla(!(await ledAcceso(pagina, VERDE)), "a riposo il LED è spento");
  const p = await rettangoloPerMisura(pagina, 40, 60);
  await pagina.mouse.move(p.x + p.w / 2, p.y + p.h / 2);
  await pagina.mouse.down();
  await pagina.waitForTimeout(300);
  controlla(await ledAcceso(pagina, VERDE), "tenendo premuto il pulsante il LED si accende");
  await pagina.mouse.up();
  await foto("16-arduino-pulsante");

  console.log("Arduino: potenziometro");
  await apri("arduino-potenziometro.elab");
  await pagina.waitForTimeout(500);
  controlla((await pagina.locator(".monitor-testo").innerText()).includes("Potenziometro: 511"), "il monitor seriale mostra il valore del potenziometro");
  controlla(await ledAcceso(pagina, GIALLO), "il LED è acceso a metà luminosità");

  console.log("Arduino: servo");
  await apri("arduino-servo.elab");
  await pagina.waitForTimeout(400);
  controlla((await testiKonva()).some((t) => /^\d+°$/.test(t)), "il servo mostra il suo angolo");

  console.log("Arduino: display LCD");
  await apri("arduino-lcd.elab");
  await pagina.waitForTimeout(1300);
  const lettere = (await testiKonva()).join("");
  controlla(lettere.includes("Ciao,classe!") || lettere.includes("Ciao, classe!"), "il display mostra il saluto");
  await foto("17-arduino-lcd");

  console.log("Arduino: ultrasuoni");
  await apri("arduino-ultrasuoni.elab");
  await pagina.waitForTimeout(700);
  controlla((await pagina.locator(".monitor-testo").innerText()).includes("Distanza: 50 cm"), "il monitor seriale mostra la distanza");
  await ferma();
}

// --- Modulo Elettronica --------------------------------------------------------

async function provaElettronica(pagina, controlla, foto, apriEsempio) {
  const ferma = async () => {
    const p = pagina.locator(".pulsante-simulazione");
    if ((await p.innerText()).includes("FERMA")) await p.click();
  };
  const avvia = async () => {
    await pagina.locator(".pulsante-simulazione").click();
    await pagina.waitForTimeout(400);
  };
  const nessunProblema = async () => (await pagina.locator(".pannello-problemi-vuoto").count()) > 0;
  const testiKonva = () => pagina.evaluate(() => window.Konva.stages[0].find("Text").map((t) => t.text()));
  /** Centro (pagina) del disegno del componente con la sigla data. */
  const centro = (sigla) =>
    pagina.evaluate((sigla) => {
      const st = window.Konva.stages[0];
      const t = st.find("Text").find((x) => x.text() === sigla);
      if (!t) return null;
      const comp = t.getParent().getParent();
      const r = comp.findOne(".disegno").getClientRect();
      const c = st.container().getBoundingClientRect();
      return { x: c.left + r.x + r.width / 2, y: c.top + r.y + r.height / 2 };
    }, sigla);
  const clic = async (sigla) => {
    const c = await centro(sigla);
    await pagina.mouse.click(c.x, c.y);
    await pagina.waitForTimeout(300);
  };
  /** Morsetti (pagina) entro `raggio` pixel dal punto, dal più alto al più basso. */
  const morsettiVicini = (x, y, raggio) =>
    pagina.evaluate(
      ([x, y, raggio]) => {
        const st = window.Konva.stages[0];
        const c = st.container().getBoundingClientRect();
        return st
          .find("Circle")
          .filter((k) => k.hitStrokeWidth() === 14)
          .map((k) => {
            const p = k.getAbsolutePosition();
            return { x: c.left + p.x, y: c.top + p.y };
          })
          .filter((p) => Math.hypot(p.x - x, p.y - y) <= raggio)
          .sort((a, b) => a.y - b.y || a.x - b.x);
      },
      [x, y, raggio],
    );
  const ledAcceso = (colore) => pagina.evaluate((c) => window.Konva.stages[0].find("Circle").some((k) => k.fill() === c && k.shadowBlur() > 0), colore);

  // --- Circuito disegnato da zero: generatore → resistenza → LED → massa ---
  console.log("Elettronica: circuito disegnato da zero");
  await ferma();
  await pagina.getByText("Schermata iniziale").click().catch(() => {});
  await pagina.waitForTimeout(300);
  await pagina.getByText("Elettronica", { exact: true }).first().click();
  await pagina.waitForTimeout(600);
  await pagina.getByText("Nuovo", { exact: true }).click();
  await pagina.waitForTimeout(500);
  const tela = await pagina.locator("canvas").first().boundingBox();
  const posa = async (nome, x, y) => {
    await pagina.locator(".libreria").getByPlaceholder(/Cerca/).fill(nome);
    await pagina.waitForTimeout(100);
    await pagina.locator(".libreria").getByText(nome, { exact: true }).first().click();
    await pagina.mouse.click(tela.x + x, tela.y + y);
    await pagina.waitForTimeout(250);
    await pagina.keyboard.press("Escape");
    await pagina.locator(".libreria").getByPlaceholder(/Cerca/).fill("");
    return { x: tela.x + x, y: tela.y + y };
  };
  const pV = await posa("Generatore di tensione continua", 200, 200);
  const pR = await posa("Resistenza", 360, 120);
  const pD = await posa("LED", 520, 220);
  const pG = await posa("Massa (0 V)", 200, 380);
  const mV = await morsettiVicini(pV.x, pV.y, 50);
  const mR = await morsettiVicini(pR.x, pR.y, 50);
  const mD = await morsettiVicini(pD.x, pD.y, 50);
  const mG = await morsettiVicini(pG.x, pG.y, 30);
  controlla(mV.length === 2 && mR.length === 2 && mD.length === 2 && mG.length === 1, "morsetti di generatore, resistenza, LED e massa trovati");
  await collega(pagina, mV[0], mR[0]);
  await collega(pagina, mR[1], mD[0]);
  await collega(pagina, mD[1], mG[0]);
  await collega(pagina, mV[1], mG[0]);
  await foto("22-elettronica-da-zero");
  await avvia();
  controlla(await nessunProblema(), "circuito disegnato: nessun problema");
  controlla(await ledAcceso("#ff3b30"), "il LED in serie alla resistenza si accende");
  controlla((await testiKonva()).includes("5 V") && (await testiKonva()).includes("1 kΩ"), "accanto ai simboli i valori 5 V e 1 kΩ");
  await ferma();

  // --- Esempi ---
  const apri = async (file) => {
    await ferma();
    await apriEsempio(pagina, file);
    await pagina.getByText("Adatta alla finestra").click();
    await pagina.waitForTimeout(200);
    await avvia();
    controlla(await nessunProblema(), `${file}: nessun problema all'avvio`);
  };
  const misureOsc = async () => {
    const t = await pagina.locator(".osc-misure").first().innerText();
    const m = /A: ([\d,]+) (m?)V.*B: ([\d,]+) (m?)V/.exec(t);
    const n = (v, p) => Number(v.replace(",", ".")) / (p === "m" ? 1000 : 1);
    return m ? { a: n(m[1], m[2]), b: n(m[3], m[4]) } : null;
  };

  console.log("Elettronica: partitore");
  await apri("elettronica-partitore.elab");
  controlla((await testiKonva()).includes("6 V"), "il multimetro indica 6 V");

  console.log("Elettronica: filtro RC");
  await apri("elettronica-filtro-rc.elab");
  await pagina.waitForTimeout(2500);
  const rc = await misureOsc();
  controlla(rc && rc.a > 3.8 && rc.a < 4.2 && rc.b / rc.a > 0.65 && rc.b / rc.a < 0.77, `oscilloscopio: uscita circa 71 % dell'ingresso (${JSON.stringify(rc)})`);
  await foto("23-elettronica-filtro");

  console.log("Elettronica: porte logiche");
  await apri("elettronica-porte-logiche.elab");
  await clic("S1");
  await clic("S2");
  await pagina.waitForTimeout(300);
  const livelli = (await testiKonva()).filter((t) => t === "0" || t === "1").join("");
  controlla(livelli === "11110", `con S1 = S2 = 1: AND 1, OR 1, XOR 0 (${livelli})`);
  await clic("S2");
  await pagina.waitForTimeout(300);
  const livelli2 = (await testiKonva()).filter((t) => t === "0" || t === "1").join("");
  controlla(livelli2 === "10011", `con S1 = 1 e S2 = 0: AND 0, OR 1, XOR 1 (${livelli2})`);

  console.log("Elettronica: contatore");
  await apri("elettronica-contatore.elab");
  await pagina.waitForTimeout(2800);
  const conteggio = Number((await testiKonva()).find((t) => /^\d+$/.test(t) && t !== "0") ?? 0);
  controlla(conteggio >= 1 && conteggio <= 4, `il contatore conta gli impulsi del clock (${conteggio})`);
  controlla((await pagina.locator("[data-testid='analizzatore-XLA1']").count()) === 1, "si apre la finestra dell'analizzatore logico");
  await foto("24-elettronica-contatore");

  console.log("Elettronica: transistor");
  await apri("elettronica-transistor.elab");
  controlla(!(await ledAcceso("#ff3b30")), "a S1 aperto il LED è spento");
  await clic("S1");
  await pagina.waitForTimeout(300);
  controlla(await ledAcceso("#ff3b30"), "chiudendo S1 il transistor accende il LED");

  console.log("Elettronica: multivibratore");
  await apri("elettronica-multivibratore.elab");
  let rosso = false;
  let verde = false;
  for (let k = 0; k < 16 && !(rosso && verde); k++) {
    rosso ||= (await ledAcceso("#ff3b30")) && !(await ledAcceso("#34c759"));
    verde ||= (await ledAcceso("#34c759")) && !(await ledAcceso("#ff3b30"));
    await pagina.waitForTimeout(250);
  }
  controlla(rosso && verde, "multivibratore: il LED rosso e quello verde si accendono a turno");
  await foto("26-elettronica-multivibratore");

  console.log("Elettronica: amplificatore");
  await apri("elettronica-amplificatore.elab");
  await pagina.waitForTimeout(2000);
  const amp = await misureOsc();
  controlla(amp && amp.b / amp.a > 9 && amp.b / amp.a < 11, `guadagno dell'amplificatore circa 10 (${JSON.stringify(amp)})`);

  console.log("Elettronica: alimentatore");
  await apri("elettronica-alimentatore.elab");
  await pagina.waitForTimeout(2500);
  controlla(await ledAcceso("#34c759"), "il LED verde alimentato dal 7805 è acceso");
  controlla(await nessunProblema(), "alimentatore: nessun problema dopo qualche secondo");

  console.log("Elettronica: condensatore");
  await apri("elettronica-condensatore.elab");
  await clic("S1");
  await pagina.waitForTimeout(2500);
  const v = (await testiKonva()).map((t) => /^([\d,]+) V$/.exec(t)).filter(Boolean).map((m) => Number(m[1].replace(",", ".")));
  controlla(v.some((x) => x > 3 && x < 10), `il condensatore si sta caricando (${v.join(" / ")})`);
  await foto("25-elettronica-condensatore");
  await ferma();
}

// --- Funzioni per il docente ----------------------------------------------------

async function provaDocente(pagina, controlla, foto, apriEsempio) {
  console.log("Docente: esportazione PNG e PDF");
  const ferma = async () => {
    const p = pagina.locator(".pulsante-simulazione");
    if ((await p.innerText()).includes("FERMA")) await p.click();
  };
  await ferma();
  await apriEsempio(pagina, "marcia-arresto.elab");
  for (const [testo, inizio] of [
    ["Immagine PNG", [0x89, 0x50, 0x4e, 0x47]],
    ["Documento PDF", [0x25, 0x50, 0x44, 0x46]],
  ]) {
    await pagina.getByRole("button", { name: /Esporta/ }).click();
    await pagina.getByLabel("Nome e cognome").fill("Studente di prova");
    await pagina.getByLabel("Classe").fill("4A");
    const [scaricato] = await Promise.all([pagina.waitForEvent("download"), pagina.getByRole("button", { name: testo }).click()]);
    const percorso = path.join(CARTELLA_IMMAGINI, scaricato.suggestedFilename());
    await scaricato.saveAs(percorso);
    const byte = [...fs.readFileSync(percorso).subarray(0, 4)];
    controlla(JSON.stringify(byte) === JSON.stringify(inizio) && fs.statSync(percorso).size > 20000, `esportato ${scaricato.suggestedFilename()} (${fs.statSync(percorso).size} byte)`);
  }

  console.log("Docente: modalità Esercizio");
  pagina.once("dialog", (d) => d.accept());
  await pagina.getByRole("button", { name: /Esercizio/ }).click();
  await pagina.getByLabel("Consegna per lo studente").fill("Collega il circuito: S1 avvia M1 con autoritenuta, S0 lo ferma.");
  await pagina.getByRole("button", { name: "Usa questo schema come soluzione" }).click();
  controlla((await pagina.getByTestId("stato-soluzione").innerText()).includes("Soluzione registrata"), "soluzione registrata dal docente");
  await pagina.getByRole("button", { name: "Togli tutti i fili" }).click();
  await pagina.getByRole("button", { name: "Salva la consegna" }).click();
  await pagina.waitForTimeout(300);
  controlla((await pagina.getByTestId("consegna").innerText()).includes("S1 avvia M1"), "lo studente vede la consegna sopra il foglio");
  await pagina.getByRole("button", { name: /Verifica il funzionamento/ }).click();
  await pagina.waitForTimeout(400);
  const esito1 = await pagina.getByTestId("esito-verifica").innerText();
  controlla(esito1.includes("non funziona") && esito1.includes("dovrebbe essere"), "schema incompleto: la verifica spiega cosa non va");
  await foto("27-esercizio-da-completare");
  await pagina.keyboard.press("Control+z");
  await pagina.waitForTimeout(300);
  await pagina.getByRole("button", { name: /Verifica il funzionamento/ }).click();
  await pagina.waitForTimeout(400);
  controlla((await pagina.getByTestId("esito-verifica").innerText()).includes("Bravo"), "schema completato: la verifica dice «Bravo!»");
  await foto("28-esercizio-riuscito");
}
