# Motori di simulazione

Qui stanno i motori puri (senza interfaccia), uno per modulo, ciascuno coperto da test Vitest.

- `impianti/` — motore elettromeccanico: continuità dei circuiti fra i poli della rete, contatti NA/NC, eccitazione delle bobine fino a uno stato stabile, cortocircuiti e oscillazioni. Per aggiungere un componente basta una riga in `impianti/modelli.ts`.
