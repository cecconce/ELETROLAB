# Motori di simulazione

Qui stanno i motori puri (senza interfaccia), uno per modulo, ciascuno coperto da test Vitest.

- `impianti/` — motore elettromeccanico: continuità dei circuiti fra i poli della rete, contatti NA/NC, eccitazione delle bobine fino a uno stato stabile, cortocircuiti e oscillazioni. Per aggiungere un componente basta una riga in `impianti/modelli.ts`.
  - `simulatore.ts`: stato del circuito in un istante (`simula`), verso di rotazione dei motori con i fasori (terna diretta/inversa, stella/triangolo), intervento delle protezioni in cortocircuito con selettività (`simulaConProtezioni`).
  - `tempo.ts`: scorrere del tempo (`avanza`, `prossimoEvento`, `riarma`): temporizzatori ritardati all'eccitazione e alla diseccitazione, relè termico/salvamotore che intervengono dopo un sovraccarico, protezioni che restano intervenute fino al riarmo.
  - `impianti/`: impianti animati collegabili al PLC (nastro trasportatore, semaforo, cancello…): sensori verso gli ingressi, attuatori comandati dalle uscite.
  - `sessione.ts`: sessione di simulazione guidata dai clic dello studente (`avviaSessione`, `clicGiu`, `clicSu`, `rilasciaTutti`, `passo`): pulsanti tenuti premuti, comandi a posizione mantenuta, riarmo delle protezioni, sovraccarico dei motori, tempo spezzato esattamente sugli eventi.
- `plc/` — motore del PLC (Ladder/KOP):
  - `operandi.ts`: operandi a bit I (ingressi), Q (uscite), M (merker) nella forma byte.bit (I0.0, Q1.7…).
  - `programma.ts`: struttura del programma (segmenti con logica di contatti ad albero serie/parallelo e uscite) e costruttori brevi (`na`, `nc`, `serie`, `parallelo`, `bobina`, `set`, `reset`…).
  - `rete.ts`: conversione del Ladder disegnato sul foglio (componenti + fili) nel programma (`convertiLadder`), con i problemi trovati.
  - `impianti/`: impianti animati collegabili al PLC (nastro trasportatore, semaforo, cancello…): sensori verso gli ingressi, attuatori comandati dalle uscite.
  - `sessione.ts`: sessione di simulazione guidata dallo studente (ingressi premuti o commutati, tempo a cicli fissi).
  - `scansione.ts`: ciclo di scansione (`scansione`, `avanzaPlc`), temporizzatori TON/TOF/TP e contatori CTU/CTD: lettura ingressi → esecuzione dei segmenti in ordine → uscite; contatti di fronte con memoria propria; restituisce lo stato di ogni contatto per colorare il Ladder.
