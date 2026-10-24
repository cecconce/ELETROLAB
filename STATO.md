# Stato dei lavori

Questo file guida le sessioni di sviluppo: ogni sessione legge qui da dove ripartire e aggiorna lo stato alla fine. Le regole sono in [CLAUDE.md](CLAUDE.md).

## Fase corrente

**Fase 1 – Guscio dell'applicazione** — in corso

### Attività (una per sessione, in ordine)

- [x] 1.1 Scheletro Tauri 2 + React + TypeScript + Vite; Vitest configurato con un test di prova; `npm test` e `npm run build` funzionanti.
- [x] 1.2 Workflow GitHub Actions (`windows-latest`): test + build Tauri; artefatti scaricabili: zip portable (con `portable.txt`) e installer NSIS.
- [x] 1.3 Schermata iniziale: 4 grandi tessere (Impianti elettrici, PLC, Arduino, Elettronica), "Apri esercizio recente", "Esempi"; tema chiaro/scuro; testi da `lingue/it.json`.
- [ ] 1.4 Editor grafico comune su Konva: griglia con aggancio, zoom con rotellina, spostamento vista, selezione e trascinamento componenti.
- [ ] 1.5 Libreria laterale: componenti caricati da file JSON in `libreria/`, icone SVG originali, categorie, ricerca per nome, drag & drop nell'editor, tooltip didattico.
- [ ] 1.6 Collegamenti: clic su morsetto → clic sull'altro; fili ortogonali instradati automaticamente e spostabili; sigle automatiche (K1, S1, H1, M1…).
- [ ] 1.7 Annulla/Ripeti illimitati (con test), eliminazione, copia/incolla.
- [ ] 1.8 Formato progetto `.elab` (JSON con versione), Salva/Apri/Salva con nome, salvataggio automatico, elenco file recenti; gestione modalità portable vs `%APPDATA%` lato Rust (con test).
- [ ] 1.9 Finestra "Informazioni" (autore, istituto, versione, licenza, elenco librerie) e `LICENZE.txt`; blocco di ogni accesso di rete (CSP).
- [ ] 1.10 Verifica finale: build Actions verde, prova dell'.exe portable, resoconto di fase.

## Piano delle fasi

| Fase | Contenuto | Stato |
|---|---|---|
| 0 | Architettura, struttura, tecnologie, licenza | completata (confermata 2026-10-24) |
| 1 | Guscio app: schermata iniziale, editor, libreria, salva/apri, .exe portable | in corso |
| 2 | Impianti elettrici + esempi pronti | da fare |
| 3 | PLC Ladder + impianti virtuali animati | da fare |
| 4 | Elettronica con SPICE e strumenti virtuali | da fare |
| 5 | Arduino con breadboard ed editor codice/blocchi | da fare |
| 6 | Modalità esercizio, esportazioni, installer, README e LICENZE | da fare |

## Regola

Alla fine di ogni fase: resoconto (cosa funziona, come provarlo, test, limiti) e **stop** fino alla conferma del docente. La conferma si dà scrivendo nella riga della fase "confermata" oppure dicendolo a Claude in chat.

## Registro sessioni

- 2026-10-24 — creato il repository. Fase 0 confermata: GPL-3.0, Tauri 2 + React + Konva, sessioni notturne nel cloud alle 23, 00, 01, 02.
- 2026-10-24 — attività 1.1: scheletro Tauri 2 + React 18 + TypeScript + Vite 6, Vitest 3 con test di prova sui testi (`src/testi.ts`, `lingue/it.json`), parte Rust in `src-tauri/` (CSP restrittiva, profilo release leggero, icone provvisorie originali). `npm test` (4 test) e `npm run build` OK; `cargo check` OK su Linux. La build `.exe` vera sarà verificata su Windows con l'attività 1.2. Su richiesta di Pierluigi le sessioni notturne ora girano solo venerdì, sabato, domenica e lunedì (23, 00, 01, 02).
- 2026-10-24 — attività 1.2: workflow `.github/workflows/build-windows.yml` su `windows-latest` (push su main, PR, avvio manuale): `npm ci` → `npm test` → `npx tauri build`, poi artefatti `ElettroLab-portable` (zip con `ElettroLab.exe`, `portable.txt`, `LICENSE.txt`) e `ElettroLab-installer` (NSIS). Installer impostato per utente corrente (`installMode: currentUser`, nessun permesso di amministratore), in italiano; silenzioso con `/S`. Aggiunti 6 test di controllo sulla configurazione (`test/configurazione-build.test.ts`). In locale: `npm test` (10 test), `npm run build` e `cargo check` OK. L'esito della prima build su Windows si vedrà nella pagina Actions; da verificare nella 1.10. Nota: l'app richiede il runtime WebView2 (già presente in Windows 10/11 aggiornati); l'installer lo scarica se manca, la versione portable no.
- 2026-10-24 — attività 1.3: schermata iniziale (`src/interfaccia/SchermataIniziale.tsx`) con 4 grandi tessere in ordine fisso (Impianti elettrici, PLC, Arduino, Elettronica) e icone SVG originali (`IconeModuli.tsx`), riquadri "Apri esercizio recente" (per ora vuoto: l'elenco reale arriva con la 1.8) ed "Esempi" (avviso "in arrivo" finché non ci sono i moduli). Tema chiaro/scuro con variabili CSS: all'avvio segue Windows, la scelta dello studente viene ricordata (per ora nel localStorage della WebView, poi nel file impostazioni con la 1.8). Clic su una tessera → schermata provvisoria del modulo con "← Schermata iniziale". Tutti i testi in `lingue/it.json`; nuovo test che verifica che ogni chiave usata nel codice esista. `npm test` (24 test) e `npm run build` OK; controllo visivo con Playwright in entrambi i temi.
