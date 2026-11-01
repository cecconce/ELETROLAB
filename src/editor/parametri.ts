// Parametri dei componenti modificabili dal pannello Proprietà oltre alla
// sigla: il tempo dei temporizzatori (impianti e PLC) e il preset dei
// contatori del PLC.
import { t } from "../testi";
import { MODELLI_IMPIANTI, TEMPO_MASSIMO, TEMPO_MINIMO, TEMPO_PREDEFINITO } from "../motori/impianti/modelli";
import type { Schema } from "./schema";
import { eContatoreLadder, eTemporizzatoreLadder, PRESET_CONTATORE_PREDEFINITO } from "./ladder";

/** Dice se il tipo di componente è la bobina di un temporizzatore. */
export function eTemporizzatore(tipo: string): boolean {
  if (eTemporizzatoreLadder(tipo)) return true;
  const m = MODELLI_IMPIANTI[tipo];
  return m?.tipo === "carico" && m.temporizzata !== undefined;
}

/** Tempo da mostrare nel pannello, con la virgola come si scrive in italiano. */
export function tempoDaMostrare(tempo: number | undefined): string {
  return String(tempo ?? TEMPO_PREDEFINITO).replace(".", ",");
}

export type EsitoTempo = { ok: true; schema: Schema } | { ok: false; errore: string };

/**
 * Imposta il tempo di un temporizzatore a partire da ciò che ha scritto lo
 * studente ("5", "2,5", "0.5 s"). Lo schema resta lo stesso oggetto se il
 * valore non cambia, così Annulla non registra passi inutili.
 */
export function impostaTempo(schema: Schema, id: string, scritto: string): EsitoTempo {
  const componente = schema.componenti.find((c) => c.id === id);
  if (!componente) return { ok: false, errore: t("proprieta.componenteSparito") };
  const pulito = scritto.trim().replace(/\s*s$/i, "").replace(",", ".");
  const valore = /^\d+(\.\d+)?$/.test(pulito) ? Number(pulito) : NaN;
  if (!Number.isFinite(valore) || valore < TEMPO_MINIMO || valore > TEMPO_MASSIMO) {
    return {
      ok: false,
      errore: t("proprieta.tempoNonValido", { tempo: scritto.trim(), minimo: TEMPO_MINIMO, massimo: TEMPO_MASSIMO }),
    };
  }
  // Al massimo due decimali: basta per la didattica e evita numeri strani nel file.
  const tempo = Math.round(valore * 100) / 100;
  if ((componente.tempo ?? TEMPO_PREDEFINITO) === tempo) return { ok: true, schema };
  return {
    ok: true,
    schema: { ...schema, componenti: schema.componenti.map((c) => (c.id === id ? { ...c, tempo } : c)) },
  };
}

/** Limiti del preset dei contatori (come un contatore a 16 bit). */
export const PRESET_MINIMO = 0;
export const PRESET_MASSIMO = 32767;

/** Dice se il tipo di componente è un contatore del PLC (ha un preset). */
export function eContatore(tipo: string): boolean {
  return eContatoreLadder(tipo);
}

/** Preset da mostrare nel pannello. */
export function presetDaMostrare(preset: number | undefined): string {
  return String(preset ?? PRESET_CONTATORE_PREDEFINITO);
}

/** Imposta il preset di un contatore da ciò che ha scritto lo studente (numero intero). */
export function impostaPreset(schema: Schema, id: string, scritto: string): EsitoTempo {
  const componente = schema.componenti.find((c) => c.id === id);
  if (!componente) return { ok: false, errore: t("proprieta.componenteSparito") };
  const pulito = scritto.trim();
  const valore = /^\d+$/.test(pulito) ? Number(pulito) : NaN;
  if (!Number.isFinite(valore) || valore < PRESET_MINIMO || valore > PRESET_MASSIMO) {
    return { ok: false, errore: t("proprieta.presetNonValido", { preset: pulito, minimo: PRESET_MINIMO, massimo: PRESET_MASSIMO }) };
  }
  if ((componente.preset ?? PRESET_CONTATORE_PREDEFINITO) === valore) return { ok: true, schema };
  return {
    ok: true,
    schema: { ...schema, componenti: schema.componenti.map((c) => (c.id === id ? { ...c, preset: valore } : c)) },
  };
}
