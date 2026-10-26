# Motori di simulazione

Qui stanno i motori puri (senza interfaccia), uno per modulo, ciascuno coperto da test Vitest.

- `impianti/` — motore elettromeccanico: continuità dei circuiti fra i poli della rete, contatti NA/NC, eccitazione delle bobine fino a uno stato stabile, cortocircuiti e oscillazioni. Per aggiungere un componente basta una riga in `impianti/modelli.ts`.
  - `simulatore.ts`: stato del circuito in un istante (`simula`), verso di rotazione dei motori con i fasori (terna diretta/inversa, stella/triangolo), intervento delle protezioni in cortocircuito con selettività (`simulaConProtezioni`).
  - `tempo.ts`: scorrere del tempo (`avanza`, `prossimoEvento`, `riarma`): temporizzatori ritardati all'eccitazione e alla diseccitazione, relè termico/salvamotore che intervengono dopo un sovraccarico, protezioni che restano intervenute fino al riarmo.
  - `sessione.ts`: sessione di simulazione guidata dai clic dello studente (`avviaSessione`, `clicGiu`, `clicSu`, `rilasciaTutti`, `passo`): pulsanti tenuti premuti, comandi a posizione mantenuta, riarmo delle protezioni, sovraccarico dei motori, tempo spezzato esattamente sugli eventi.
