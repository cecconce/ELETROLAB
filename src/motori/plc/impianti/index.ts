// Catalogo degli impianti animati del PLC.
import { CANCELLO } from "./cancello";
import { NASTRO } from "./nastro";
import { SEMAFORO } from "./semaforo";
import { SERBATOIO } from "./serbatoio";
import { ASCENSORE } from "./ascensore";
import { PARCHEGGIO } from "./parcheggio";
import type { ModelloImpianto } from "./tipi";

export * from "./tipi";
export * from "./nastro";
export * from "./semaforo";
export * from "./cancello";
export * from "./serbatoio";
export * from "./ascensore";
export * from "./parcheggio";

/** Modelli degli impianti per tipo di componente. */
export const MODELLI_IMPIANTI_PLC: Record<string, ModelloImpianto> = {
  [NASTRO.tipo]: NASTRO as ModelloImpianto,
  [SEMAFORO.tipo]: SEMAFORO as ModelloImpianto,
  [CANCELLO.tipo]: CANCELLO as ModelloImpianto,
  [SERBATOIO.tipo]: SERBATOIO as ModelloImpianto,
  [ASCENSORE.tipo]: ASCENSORE as ModelloImpianto,
  [PARCHEGGIO.tipo]: PARCHEGGIO as ModelloImpianto,
};

/** Operandi di un impianto posato: quelli scelti dallo studente o i predefiniti. */
export function operandiImpianto(modello: ModelloImpianto, scelti: Readonly<Record<string, string>> | undefined): Record<string, string> {
  const risultato: Record<string, string> = {};
  for (const s of [...modello.sensori, ...modello.attuatori]) risultato[s.id] = scelti?.[s.id] ?? s.operandoPredefinito;
  return risultato;
}
