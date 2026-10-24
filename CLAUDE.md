# Istruzioni per le sessioni di sviluppo di ElettroLab

Leggi tutto prima di iniziare. Lavori senza memoria delle sessioni precedenti: la fonte di verità è `STATO.md`.

## Procedura di ogni sessione

1. Leggi `STATO.md`: fase corrente, attività completate, prossima attività.
2. Se la fase corrente è segnata **"completata — in attesa di conferma"**, NON scrivere codice: chiudi la sessione senza modifiche.
3. Altrimenti esegui **la prossima attività non spuntata** della fase corrente (una, al massimo due se piccole).
4. Esegui i test (`npm test`, e la build se l'attività la tocca). Non lasciare il ramo `main` rotto: se non riesci a far passare i test, annulla le modifiche parziali e annota il problema in `STATO.md`.
5. Aggiorna `STATO.md`: spunta l'attività, aggiungi una riga al registro sessioni (data, cosa hai fatto, problemi).
6. Fai commit e push su `main` con messaggio in italiano.
7. Se hai completato l'ultima attività della fase: scrivi in `STATO.md` il **resoconto di fase** (cosa funziona, come provarlo, test eseguiti, limiti noti) e imposta la fase come **"completata — in attesa di conferma"**. Non iniziare la fase successiva.

## Decisioni già prese (Fase 0, confermate il 2026-10-24)

- Licenza: **GPL-3.0**.
- Desktop: **Tauri 2** + TypeScript + React; editor grafico con **Konva** (react-konva).
- Elettronica: ngspice come libreria nativa. Arduino: avr8js + avr-gcc offline. Blocchi: Blockly. Editor codice: CodeMirror 6.
- Test: Vitest (motori), Playwright (interfaccia). Build .exe: GitHub Actions su `windows-latest`.
- Usa solo librerie con licenza compatibile con GPL-3.0 e registrale in `LICENZE.txt`.

## Vincoli che non si negoziano

- Software di riferimento (CADe_SIMU, PC_SIMU, Tinkercad, Multisim): riproduci flusso di lavoro e comportamento, **mai** codice, icone, grafica o nomi loro. Simboli secondo CEI/IEC 60617, disegnati da zero in SVG.
- 100% offline: nessuna chiamata di rete nell'app, nessuna telemetria.
- Portable: se esiste `portable.txt` accanto all'.exe, dati in `./dati/`; altrimenti `%APPDATA%\ElettroLab`. Mai percorsi che richiedono privilegi.
- Leggero: Windows 10, 4 GB di RAM.
- Interfaccia e commenti nel codice **in italiano**; testi dell'interfaccia in `lingue/it.json`.
- Motori di simulazione in `src/motori/`, puri (senza interfaccia) e coperti da test.
- Se una funzione è troppo complessa, implementa una versione semplificata e annotalo nei limiti noti, non ometterla in silenzio.
