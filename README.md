# ElettroLab

Simulatore didattico gratuito per gli istituti tecnici (elettrotecnica, elettronica, automazione): **impianti elettrici, PLC Ladder, Arduino ed elettronica** in un unico programma per Windows, pensato per studenti di 14–18 anni che lo usano senza manuale.

L'avanzamento dei lavori, i resoconti di ogni fase e i limiti noti sono in [STATO.md](STATO.md).

## Moduli

| Modulo | Cosa si fa | Riferimento funzionale |
|---|---|---|
| **Impianti elettrici** | Schemi di potenza e comando con simboli CEI/IEC 60617 (rete, fusibili, sezionatori, magnetotermici, salvamotori, relè termici, contattori, temporizzatori, pulsanti, pulsante d'emergenza a fungo, selettori, finecorsa, sensori di processo (galleggiante, pressostato, termostato, fotocellula), lampade colorate, sirene, motori 3~/1~/CC). Simulazione animata: contatti che commutano, contattori che si eccitano, motori che girano con il verso, protezioni che intervengono. Vista **Simboli** o **Realistica**. **Impianti civili**: interruttori unipolare e bipolare, deviatori, invertitori, pulsante e suoneria, relè passo-passo, magnetotermico 2P e differenziale con tasto di prova. **Pneumatica** semplificata: cilindro con elettrovalvola 5/2 e finecorsa a0/a1. **PLC nello schema**: un PLC con ingressi I e uscite Q collegati con i fili, con il programma Ladder nello stesso file (scheda «Programma PLC»). | CADe_SIMU |
| **PLC** | Programmazione Ladder (contatti, bobine, set/reset, TON/TOF/TP, CTU/CTD, fronti, merker) con ciclo di scansione, quadro virtuale di pulsanti e lampade e 6 impianti animati (nastro, semaforo, cancello, serbatoio, ascensore, parcheggio); lo stesso programma si legge anche come **lista istruzioni** (IL/AWL, IEC 61131-3). | PC_SIMU |
| **Arduino** | Breadboard realistica con Arduino Uno, LED, LED RGB, resistenze, pulsanti, interruttore a slitta, potenziometro, fotoresistenza, sensore di temperatura, sensore di movimento, ultrasuoni, buzzer, servo, motore in continua, display LCD e a 7 segmenti, multimetro; programmazione a **blocchi** o in **testo** (C++ di Arduino, con colori della sintassi e completamento) con monitor seriale. | Tinkercad Circuits |
| **Elettronica** | Schemi analogici e digitali con simulatore circuitale (DC, nel tempo, in frequenza): diodi, LED, transistor, MOSFET, operazionali, regolatori, porte logiche, flip-flop, contatori, display; strumenti virtuali (multimetro, wattmetro, generatore di funzioni, oscilloscopio, plotter di Bode, analizzatore logico). | Multisim |

I programmi di riferimento servono **solo** come modello del flusso di lavoro: codice, grafica, icone e nomi di ElettroLab sono tutti originali.

**Per il docente:** modalità **Esercizio** (schema incompleto con consegna e verifica automatica del funzionamento), **esportazione PNG/PDF e stampa** con cartiglio (titolo, nome, classe, data), esempi pronti per ogni modulo.

## Principi

- **100% offline**: nessun account, nessun login, nessuna connessione a Internet, nessuna telemetria né pubblicità. I file restano sul PC o sulla chiavetta dello studente.
- **Portable**: si avvia da una cartella o da una chiavetta USB senza installazione e senza permessi di amministratore.
- **Leggero**: pensato per PC con Windows 10 e 4 GB di RAM.
- **Aperto**: libreria dei componenti ed esempi in file JSON modificabili; licenza libera GPL-3.0.

---

## Per i laboratori: scaricare e installare

Le versioni pronte si scaricano da GitHub: scheda **Actions** → ultima esecuzione verde di «Build Windows» → sezione **Artifacts**.

### Versione portable (consigliata nei laboratori)

1. Scaricare `ElettroLab-portable` ed estrarre lo zip in una cartella o su una chiavetta.
2. Avviare `ElettroLab.exe`.

Finché accanto all'eseguibile c'è il file `portable.txt`, impostazioni, salvataggi automatici e file recenti vanno nella cartella `dati\` accanto all'exe (niente viene scritto sul PC). Cancellando `portable.txt` il programma usa invece `%APPDATA%\ElettroLab`. Non servono mai permessi di amministratore.

### Installer

`ElettroLab-installer` contiene il setup NSIS. Si installa **per l'utente corrente** (senza permessi di amministratore).

Installazione **silenziosa** per il tecnico di laboratorio (nessuna finestra):

```
ElettroLab_0.1.0_x64-setup.exe /S
```

Con una cartella di destinazione diversa (il parametro `/D` va per ultimo, senza virgolette):

```
ElettroLab_0.1.0_x64-setup.exe /S /D=C:\Programmi-Scuola\ElettroLab
```

Disinstallazione silenziosa: `"%LOCALAPPDATA%\ElettroLab\uninstall.exe" /S` (o la cartella scelta con `/D`).

Il programma richiede WebView2 di Microsoft, già presente in Windows 10 aggiornato e in Windows 11.

---

## Per chi sviluppa

### Strumenti necessari

- [Node.js](https://nodejs.org) 20 o più recente
- [Rust](https://rustup.rs) stabile (solo per compilare l'.exe)
- Su Windows: «Microsoft C++ Build Tools» (richiesti da Rust)

### Comandi

```
npm ci                    # installa le dipendenze
npm run dev               # interfaccia nel browser (http://localhost:5173), archivio di prova
npm test                  # test automatici (Vitest): motori di simulazione, editor, file
npm run build             # controllo dei tipi + compilazione dell'interfaccia in dist/
npx tauri build           # compila l'.exe e l'installer (in src-tauri/target/release/)
cd src-tauri && cargo test   # test della parte nativa (cartella dati, file)
```

**Prova dell'interfaccia** (fa quello che farebbe uno studente in tutti i moduli e controlla il risultato; richiede Playwright con Chromium installati sul computer, non fra le dipendenze del progetto):

```
npm run build
npx vite preview --port 4173 --strictPort     # in un'altra finestra
npm run prova-interfaccia
```

La compilazione per Windows avviene in automatico su GitHub Actions a ogni push su `main` (`.github/workflows/build-windows.yml`): test, `tauri build`, versione portable e installer.

### Struttura delle cartelle

```
libreria/            componenti di ogni modulo (impianti.json, plc.json, arduino.json, elettronica.json)
libreria/icone/      simboli SVG (CEI/IEC) e disegni del banco Arduino
libreria/icone/realistico/   disegni della vista Realistica degli Impianti
esempi/              esempi pronti (.elab) ed elenco esempi.json
lingue/it.json       tutti i testi dell'interfaccia
src/motori/          motori di simulazione puri, senza interfaccia, coperti da test
  impianti/          continuità dei circuiti, bobine e contatti, protezioni, motori
  plc/               interprete Ladder, ciclo di scansione, impianti animati
  arduino/           circuito del banco, interprete del linguaggio Arduino
  elettronica/       simulatore circuitale (analisi nodale), parte digitale, strumenti
src/editor/          editor comune (area di disegno Konva, fili, libreria, proprietà, cronologia)
src/interfaccia/     schermate e finestre (iniziale, modulo, esempi, esporta, esercizio)
src/progetto/        file .elab, esempi, salvataggio automatico, verifica degli esercizi, PDF
src/informazioni/    dati della finestra Informazioni (autore, licenze delle librerie)
src-tauri/           parte nativa in Rust (cartella dati portable, lettura e scrittura dei file)
strumenti/           generatori di libreria/esempi/icone e prova dell'interfaccia (non vanno nell'app)
```

### Come aggiungere un componente

1. **Voce nella libreria**: aggiungere un oggetto in `libreria/<modulo>.json`:

   ```json
   {
     "id": "pulsante-fungo",
     "nome": "Pulsante a fungo (emergenza)",
     "categoria": "comandi",
     "sigla": "S",
     "descrizione": "Spiegazione breve per lo studente, mostrata nel suggerimento.",
     "paroleChiave": ["emergenza", "arresto"],
     "icona": "pulsante-fungo.svg",
     "larghezza": 40,
     "altezza": 80,
     "morsetti": [
       { "id": "11", "x": 20, "y": 0 },
       { "id": "12", "x": 20, "y": 80 }
     ]
   }
   ```

   Misure e coordinate dei morsetti sono multipli di 20 (la griglia del foglio). La `categoria` deve essere una di quelle elencate in testa al file.

2. **Simbolo**: creare `libreria/icone/<icona>.svg` con `viewBox="0 0 larghezza altezza"` e i tratti in `currentColor` (così il simbolo prende il colore del tema chiaro/scuro). Disegni originali, simbologia CEI/IEC 60617. Negli Impianti serve anche il disegno realistico in `libreria/icone/realistico/` (stesso nome e stesse misure; si possono generare con `strumenti/genera-icone-realistiche-impianti.ts`).

3. **Comportamento in simulazione**: senza questo passo il componente si disegna e si collega ma la simulazione lo ignora.
   - Impianti: una riga in `MODELLI_IMPIANTI` (`src/motori/impianti/modelli.ts`), per esempio `"pulsante-fungo": { tipo: "contatto", tratti: [["11", "12"]], normalmenteChiuso: true, comando: { tipo: "manuale" } }`.
   - PLC: `MODELLI_LADDER` in `src/motori/plc/rete.ts` (per il quadro e gli impianti animati vedi anche `src/motori/plc/impianti/`).
   - Elettronica: parametri in `PARAMETRI_PREDEFINITI` e conversione in `elementiDaComponenti` (`src/motori/elettronica/sessione.ts`), campi delle Proprietà in `PARAMETRI_ELETTRONICA` (`src/editor/elettronica.ts`); per i digitali `PIEDINI_DIGITALI` in `digitale.ts`. La libreria si rigenera con `npx vite-node strumenti/genera-libreria-elettronica.ts`.
   - Arduino: `src/motori/arduino/componenti.ts`; libreria e disegni con `strumenti/genera-libreria-arduino.ts`.

4. `npm test`: i test controllano fra l'altro che ogni voce abbia descrizione e icona con le misure giuste e che le icone siano SVG validi.

Dopo la modifica si ricompila l'app (le librerie sono incluse nell'eseguibile).

### Come aggiungere un esercizio

**Dal programma (senza toccare il codice)**: il docente disegna lo schema completo e verifica con ▶ AVVIA che funzioni, poi preme **📝 Esercizio** → «Usa questo schema come soluzione», toglie le parti da completare (per esempio «Togli tutti i fili»), scrive la consegna, preme «Salva la consegna» e salva il file con **Salva con nome**. Il file `.elab` è l'esercizio da distribuire: lo studente lo apre, vede la consegna sopra il foglio e, a lavoro finito, preme **✔ Verifica il funzionamento** (in tutti e quattro i moduli). La verifica prova lo schema dello studente e la soluzione con le stesse azioni sui comandi e confronta quello che si vede: lampade, bobine e motori (Impianti), uscite Q (PLC), LED, servo, display e monitor seriale (Arduino, eseguendo i due programmi), LED, sonde, display e multimetri (Elettronica). Le sigle dei componenti devono essere quelle della consegna. Due esercizi di esempio sono nella finestra Esempi (`strumenti/genera-esercizi.ts`).

**Fra gli esempi pronti**: copiare il file `.elab` in `esempi/` e aggiungere una voce in `esempi/esempi.json`:

```json
{
  "file": "marcia-arresto.elab",
  "modulo": "impianti",
  "titolo": "Marcia/arresto con autoritenuta",
  "descrizione": "Che cosa mostra lo schema.",
  "prova": "Come provarlo, passo per passo."
}
```

Gli esempi dei moduli PLC, Arduino ed Elettronica sono generati da script in `strumenti/` (`npx vite-node strumenti/genera-esempi-plc.ts`, …) e simulati dai test (`src/progetto/esempi*.test.ts`).

### Formato dei file `.elab`

JSON leggibile: `formato`, `versione`, `modulo`, `programma`, `salvato` e `schema` (`componenti` con posizione, sigla, rotazione e parametri; `fili` con i due morsetti ed eventuali pieghe; per Arduino `codice`/`blocchi`; per gli esercizi `esercizio` con `consegna` e `soluzioneCodificata`). Il programma legge con tolleranza i file modificati a mano e spiega in italiano cosa ha dovuto scartare.

---

## Autore

Pierluigi Ceccon — progetto realizzato per uso didattico e distribuito gratuitamente all'istituto.

## Licenza

**GPL-3.0** — vedi [LICENSE](LICENSE). Si può usare, studiare, modificare e ridistribuire liberamente; le versioni modificate devono restare libere e con il codice disponibile. Le librerie usate (tutte con licenze compatibili) sono elencate in [LICENZE.txt](LICENZE.txt) e nella finestra **Informazioni** del programma.
