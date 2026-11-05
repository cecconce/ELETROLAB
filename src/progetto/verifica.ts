// Verifica automatica degli esercizi (tutti e quattro i moduli).
//
// Idea: lo schema dello studente "funziona" se si comporta come la soluzione
// del docente. Il programma prova i due schemi con la stessa sequenza di
// azioni sui comandi (chiude i sezionatori, preme i pulsanti uno alla volta,
// poi una lunga serie di azioni pseudo-casuali sempre uguali, con attese per i
// temporizzatori) e dopo ogni azione confronta ciò che si vede: bobine
// eccitate, lampade accese, motori fermi o in rotazione (con il verso); nel
// PLC le uscite Q; nell'Elettronica LED, lampadine, sonde, display e letture
// dei multimetri (arrotondate a due cifre). Comandi e utilizzatori si riconoscono dalla sigla (S1, K1,
// M1… / I0.0, Q0.1…), quindi lo studente deve usare le sigle della consegna.
// Non conta come sono disegnati i fili: conta solo il funzionamento.
import { MODELLI_IMPIANTI, avviaSessione, azioneClic, clicGiu, clicSu, passo, type SessioneImpianto } from "../motori/impianti";
import { avviaSessionePlc, commutaIngresso, passoPlc, valoreBit, type SessionePlc } from "../motori/plc";
import { impiantiDaSchema, programmaDaSchema } from "../editor/ladder";
import {
  avviaSessioneElettronica,
  clicGiuElettronica,
  clicSuElettronica,
  luminosita,
  passoElettronica,
  scriviValore,
  type SessioneElettronica,
} from "../motori/elettronica";
import { componentiDaSchema, nodiDaSchema, SKETCH_PREDEFINITO, vistaDaSessioneArduino } from "../editor/arduino";
import { avviaSessioneArduino, clicGiuArduino, clicSuArduino, passoArduino, type SessioneArduino } from "../motori/arduino";
import { SEGMENTI_DISPLAY } from "../motori/arduino/componenti";
import { componentiDaSchemaElettronica } from "../editor/elettronica";
import { libreriaDelModulo } from "../editor/caricaLibreria";
import { vocePerTipo } from "../editor/libreria";
import { tipoUtilizzatore } from "../editor/vistaSimulazione";
import type { Schema } from "../editor/schema";
import { t } from "../testi";

export interface EsitoVerifica {
  riuscito: boolean;
  /** Spiegazioni in italiano (le prime differenze trovate o i componenti mancanti). */
  righe: string[];
  /** Quante situazioni sono state confrontate. */
  prove: number;
}

/** Generatore pseudo-casuale con seme fisso: la sequenza è sempre la stessa. */
function casuale(seme: number) {
  let x = seme >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

type Azione = { tipo: "premi" | "commuta"; sigla: string } | { tipo: "attendi"; secondi: number };

/** Sequenza di prova: prima i comandi a posizione mantenuta, poi ogni pulsante da solo, poi azioni miste. */
function sequenza(pulsanti: string[], manuali: string[], passi = 60): Azione[] {
  const a: Azione[] = [];
  for (const m of manuali) a.push({ tipo: "commuta", sigla: m });
  for (const p of pulsanti) a.push({ tipo: "premi", sigla: p });
  const r = casuale(12345);
  const tutti = [...pulsanti.map((s) => ({ tipo: "premi" as const, sigla: s })), ...manuali.map((s) => ({ tipo: "commuta" as const, sigla: s }))];
  if (tutti.length === 0) return [{ tipo: "attendi", secondi: 6 }];
  for (let i = 0; i < passi; i++) {
    if (r() < 0.15) a.push({ tipo: "attendi", secondi: 6 });
    else a.push(tutti[Math.floor(r() * tutti.length)]);
  }
  a.push({ tipo: "attendi", secondi: 6 });
  return a;
}

function descrivi(azione: Azione): string {
  if (azione.tipo === "attendi") return t("verifica.attendi", { secondi: azione.secondi });
  return t(azione.tipo === "premi" ? "verifica.premi" : "verifica.commuta", { sigla: azione.sigla });
}

/** Confronta due serie di osservazioni; restituisce le spiegazioni delle prime differenze. */
function confronta(
  azioni: Azione[],
  attese: Record<string, string>[],
  ottenute: Record<string, string>[],
): string[] {
  const righe: string[] = [];
  const giaDette = new Set<string>();
  for (let i = 0; i < attese.length && righe.length < 3; i++) {
    // Tutte le differenze nuove dello stesso momento vanno in una sola frase.
    const dettagli: string[] = [];
    for (const [chi, valore] of Object.entries(attese[i])) {
      const suo = ottenute[i][chi];
      if (suo === valore || giaDette.has(chi)) continue;
      giaDette.add(chi);
      dettagli.push(t("verifica.dettaglio", { chi, atteso: valore, ottenuto: suo ?? "?" }));
    }
    if (dettagli.length === 0) continue;
    const storia = azioni
      .slice(Math.max(0, i - 2), i + 1)
      .map(descrivi)
      .join(" → ");
    righe.push(t("verifica.differenza", { storia, dettagli: dettagli.join("; ") }));
  }
  return righe;
}

// ---------------------------------------------------------------- Impianti

function statoCarico(tipo: string, acceso: boolean, motore?: { verso: string; collegamento?: string }): string {
  const u = tipoUtilizzatore(tipo);
  if (u === "motore") {
    if (!motore) return t("verifica.fermo");
    return `${t(motore.verso === "orario" ? "verifica.giraOrario" : "verifica.giraAntiorario")}${motore.collegamento ? ` (${motore.collegamento})` : ""}`;
  }
  if (u === "bobina") return acceso ? t("verifica.eccitata") : t("verifica.diseccitata");
  if (u === "suono") return acceso ? t("verifica.suona") : t("verifica.muta");
  return acceso ? t("verifica.accesa") : t("verifica.spenta");
}

function osservaImpianto(s: SessioneImpianto, carichi: { sigla: string; tipo: string }[], idPerSigla: Map<string, string>): Record<string, string> {
  const accesi = new Set(s.risultato.carichiAlimentati);
  const o: Record<string, string> = {};
  for (const c of carichi) {
    const id = idPerSigla.get(`${c.sigla}|${c.tipo}`);
    if (!id) continue;
    o[c.sigla] = statoCarico(c.tipo, accesi.has(id), s.risultato.motori[id]);
  }
  return o;
}

export function verificaImpianto(studente: Schema, soluzione: Pick<Schema, "componenti" | "fili">): EsitoVerifica {
  const chiave = (c: { etichetta: string; tipo: string }) => `${c.etichetta}|${c.tipo}`;
  const comandi = soluzione.componenti.filter((c) => c.etichetta && (azioneClic(c.tipo) === "pulsante" || azioneClic(c.tipo) === "manuale"));
  const carichi = soluzione.componenti.filter((c) => c.etichetta && MODELLI_IMPIANTI[c.tipo]?.tipo === "carico").map((c) => ({ sigla: c.etichetta, tipo: c.tipo }));
  const delloStudente = new Map(studente.componenti.map((c) => [chiave(c), c.id]));
  const dellaSoluzione = new Map(soluzione.componenti.map((c) => [chiave(c), c.id]));
  const mancanti = [...comandi.map((c) => ({ sigla: c.etichetta, tipo: c.tipo })), ...carichi].filter((c) => !delloStudente.has(`${c.sigla}|${c.tipo}`));
  if (mancanti.length > 0) {
    return { riuscito: false, prove: 0, righe: [...new Set(mancanti.map((m) => t("verifica.manca", { sigla: m.sigla })))] };
  }
  const pulsanti = [...new Set(comandi.filter((c) => azioneClic(c.tipo) === "pulsante").map((c) => c.etichetta))];
  const manuali = [...new Set(comandi.filter((c) => azioneClic(c.tipo) === "manuale").map((c) => c.etichetta))];
  const azioni = sequenza(pulsanti, manuali);
  const esegui = (schema: Pick<Schema, "componenti" | "fili">, ids: Map<string, string>) => {
    let s = avviaSessione(schema);
    const idDi = (sigla: string) => schema.componenti.filter((c) => c.etichetta === sigla && comandi.some((k) => k.etichetta === sigla && k.tipo === c.tipo)).map((c) => c.id);
    const osservazioni: Record<string, string>[] = [];
    for (const a of azioni) {
      if (a.tipo === "attendi") s = passo(s, a.secondi);
      else if (a.tipo === "commuta") {
        for (const id of idDi(a.sigla)) s = clicGiu(s, id);
        s = passo(s, 0.3);
      } else {
        for (const id of idDi(a.sigla)) s = clicGiu(s, id);
        s = passo(s, 0.3);
        for (const id of idDi(a.sigla)) s = clicSu(s, id);
        s = passo(s, 0.3);
      }
      osservazioni.push(osservaImpianto(s, carichi, ids));
    }
    return osservazioni;
  };
  const attese = esegui(soluzione, dellaSoluzione);
  const ottenute = esegui(studente, delloStudente);
  const righe = confronta(azioni, attese, ottenute);
  return { riuscito: righe.length === 0, righe: righe.length ? righe : [t("verifica.tutteUguali", { prove: azioni.length })], prove: azioni.length };
}

// ---------------------------------------------------------------- PLC

const OPERANDO_I = /^I\d+\.[0-7]$/i;
const OPERANDO_Q = /^Q\d+\.[0-7]$/i;

function sessionePlc(schema: Schema): SessionePlc {
  return avviaSessionePlc(
    programmaDaSchema(schema),
    Object.fromEntries(schema.componenti.map((c) => [c.id, c.etichetta])),
    undefined,
    Object.fromEntries(schema.componenti.map((c) => [c.id, c.tipo])),
    impiantiDaSchema(schema),
  );
}

export function verificaPlc(studente: Schema, soluzione: Pick<Schema, "componenti" | "fili">): EsitoVerifica {
  const sol: Schema = { componenti: soluzione.componenti, fili: soluzione.fili };
  const operandi = (re: RegExp) => [...new Set([...sol.componenti, ...studente.componenti].map((c) => c.etichetta.toUpperCase()).filter((e) => re.test(e)))].sort();
  const ingressi = operandi(OPERANDO_I);
  const uscite = [...new Set(sol.componenti.map((c) => c.etichetta.toUpperCase()).filter((e) => OPERANDO_Q.test(e)))].sort();
  if (uscite.length === 0) return { riuscito: false, prove: 0, righe: [t("verifica.senzaUscite")] };
  // Gli ingressi del PLC si commutano (1/0): come un pulsante tenuto premuto e poi rilasciato.
  const azioni = sequenza([], ingressi);
  const esegui = (schema: Schema) => {
    let s = sessionePlc(schema);
    const osservazioni: Record<string, string>[] = [];
    for (const a of azioni) {
      if (a.tipo === "attendi") s = passoPlc(s, a.secondi);
      else {
        s = commutaIngresso(s, a.sigla);
        s = passoPlc(s, 0.3);
      }
      osservazioni.push(Object.fromEntries(uscite.map((q) => [q, valoreBit(s.stato, q) ? "1" : "0"])));
    }
    return osservazioni;
  };
  const attese = esegui(sol);
  const ottenute = esegui(studente);
  const righe = confronta(azioni, attese, ottenute);
  return { riuscito: righe.length === 0, righe: righe.length ? righe : [t("verifica.tutteUguali", { prove: azioni.length })], prove: azioni.length };
}

// ---------------------------------------------------------------- Elettronica

/** Fa scorrere `secondi` di tempo simulato (a pezzi, come fa l'interfaccia). */
function avanzaElettronica(s: SessioneElettronica, secondi: number) {
  const fine = s.tempo + secondi;
  for (let k = 0; k < 2000 && s.tempo < fine - 1e-9; k++) passoElettronica(s, Math.min(fine - s.tempo, 400 * s.dt));
}

/** Valore misurato arrotondato a due cifre significative (piccole differenze di calcolo non contano). */
const circa = (v: number | null, unita: string) => (v === null ? "OL" : Math.abs(v) < 1e-6 ? `0 ${unita}` : scriviValore(Number(v.toPrecision(2)), unita));

function osservaElettronica(s: SessioneElettronica, osservati: { sigla: string; tipo: string }[], idDi: (sigla: string, tipo: string) => string | undefined): Record<string, string> {
  const o: Record<string, string> = {};
  for (const { sigla, tipo } of osservati) {
    const id = idDi(sigla, tipo);
    const c = s.componenti.find((x) => x.id === id);
    if (!c || !id) continue;
    if (tipo === "led" || tipo === "lampadina") o[sigla] = s.bruciati.has(id) ? t("verifica.bruciato") : luminosita(s, c) > 0.1 ? t("verifica.acceso") : t("verifica.spento");
    else if (tipo === "sonda-logica") o[sigla] = String(s.digitali[id]?.ingressi.in ?? 0);
    else if (tipo === "display-7-segmenti") {
      const accesi = Object.entries(s.digitali[id]?.ingressi ?? {}).filter(([, v]) => v === 1).map(([k]) => k).join("");
      o[sigla] = accesi ? t("verifica.segmenti", { segmenti: accesi }) : t("verifica.spento");
    } else if (tipo === "multimetro" || tipo === "wattmetro") {
      const l = s.letture[id];
      o[sigla] = l ? circa(l.valore, l.unita) : "?";
    }
  }
  return o;
}

const COMANDI_ELETTRONICA = new Set(["interruttore", "pulsante", "interruttore-logico"]);
const OSSERVATI_ELETTRONICA = new Set(["led", "lampadina", "sonda-logica", "display-7-segmenti", "multimetro", "wattmetro"]);

export function verificaElettronica(studente: Schema, soluzione: Pick<Schema, "componenti" | "fili">): EsitoVerifica {
  const libreria = libreriaDelModulo("elettronica");
  const morsettiDi = (tipo: string) => vocePerTipo(libreria, tipo)?.morsetti;
  const comandi = soluzione.componenti.filter((c) => c.etichetta && COMANDI_ELETTRONICA.has(c.tipo));
  const osservati = soluzione.componenti.filter((c) => c.etichetta && OSSERVATI_ELETTRONICA.has(c.tipo)).map((c) => ({ sigla: c.etichetta, tipo: c.tipo }));
  if (osservati.length === 0) return { riuscito: false, prove: 0, righe: [t("verifica.senzaOsservati")] };
  const trova = (schema: Pick<Schema, "componenti">) => (sigla: string, tipo: string) => schema.componenti.find((c) => c.etichetta === sigla && c.tipo === tipo)?.id;
  const mancanti = [...comandi.map((c) => ({ sigla: c.etichetta, tipo: c.tipo })), ...osservati].filter((c) => !trova(studente)(c.sigla, c.tipo));
  if (mancanti.length > 0) return { riuscito: false, prove: 0, righe: [...new Set(mancanti.map((m) => t("verifica.manca", { sigla: m.sigla })))] };
  const pulsanti = comandi.filter((c) => c.tipo === "pulsante").map((c) => c.etichetta);
  const manuali = comandi.filter((c) => c.tipo !== "pulsante").map((c) => c.etichetta);
  // Meno passi che negli altri moduli: il calcolo circuitale è più pesante.
  const azioni = sequenza(pulsanti, manuali, 16).map((a) => (a.tipo === "attendi" ? { ...a, secondi: 1 } : a));
  const esegui = (schema: Pick<Schema, "componenti" | "fili">) => {
    const completo: Schema = { componenti: schema.componenti, fili: schema.fili };
    const s = avviaSessioneElettronica(componentiDaSchemaElettronica(completo), nodiDaSchema(completo, morsettiDi));
    const idDi = trova(schema);
    const idComando = (sigla: string) => comandi.filter((c) => c.etichetta === sigla).map((c) => idDi(sigla, c.tipo)).filter((x): x is string => !!x);
    avanzaElettronica(s, 0.2);
    const osservazioni: Record<string, string>[] = [];
    for (const a of azioni) {
      if (a.tipo === "attendi") avanzaElettronica(s, a.secondi);
      else if (a.tipo === "commuta") {
        for (const id of idComando(a.sigla)) clicGiuElettronica(s, id);
        avanzaElettronica(s, 0.2);
      } else {
        for (const id of idComando(a.sigla)) clicGiuElettronica(s, id);
        avanzaElettronica(s, 0.2);
        osservazioni.push(osservaElettronica(s, osservati, idDi));
        for (const id of idComando(a.sigla)) clicSuElettronica(s, id);
        avanzaElettronica(s, 0.2);
        // Per un pulsante conta soprattutto cosa succede mentre è premuto: si confronta quello.
        continue;
      }
      osservazioni.push(osservaElettronica(s, osservati, idDi));
    }
    return osservazioni;
  };
  const attese = esegui(soluzione);
  const ottenute = esegui(studente);
  const righe = confronta(azioni, attese, ottenute);
  return { riuscito: righe.length === 0, righe: righe.length ? righe : [t("verifica.tutteUguali", { prove: azioni.length })], prove: azioni.length };
}

// ---------------------------------------------------------------- Arduino

/**
 * Colore di un LED NeoPixel arrotondato (ogni canale a 0, metà o pieno), così
 * piccole differenze di luminosità non rendono "sbagliato" un esercizio.
 */
function coloreApprossimato(c: number): string {
  const livello = (x: number) => (x < 43 ? "0" : x < 170 ? "½" : "1");
  if (c === 0) return "–";
  return `(${livello((c >> 16) & 255)},${livello((c >> 8) & 255)},${livello(c & 255)})`;
}

/**
 * Arduino: si eseguono i due programmi sui due banchi per 1 s, poi si preme
 * ogni pulsante (0,6 s premuto, 0,6 s rilasciato) e si guardano ogni 0,25 s
 * LED (spento / acceso, con quattro livelli di luminosità per il PWM), LED «L»
 * della scheda, servo (a 10° di precisione), buzzer, display e monitor seriale.
 */
export function verificaArduino(studente: Schema, soluzione: NonNullable<NonNullable<Schema["esercizio"]>["soluzione"]>): EsitoVerifica {
  const libreria = libreriaDelModulo("arduino");
  const morsettiDi = (tipo: string) => vocePerTipo(libreria, tipo)?.morsetti;
  const OSSERVATI = (tipo: string) => tipo.startsWith("led-") || tipo === "servo" || tipo === "buzzer" || tipo === "lcd" || tipo === "arduino-uno" || tipo === "motore-dc" || tipo === "display-sette-segmenti" || tipo === "multimetro" || tipo === "lampadina" || tipo === "modulo-rele" || tipo === "striscia-neopixel";
  const nome = (c: { etichetta: string; tipo: string; id: string }) => c.etichetta || c.id;
  const osservati = soluzione.componenti.filter((c) => OSSERVATI(c.tipo));
  const pulsanti = soluzione.componenti.filter((c) => c.tipo === "pulsante").map(nome);
  const trova = (schema: Pick<Schema, "componenti">, n: string, tipo: string) => schema.componenti.find((c) => nome(c) === n && c.tipo === tipo)?.id;
  const mancanti = [...osservati, ...soluzione.componenti.filter((c) => c.tipo === "pulsante")].filter((c) => !trova(studente, nome(c), c.tipo));
  if (mancanti.length > 0) return { riuscito: false, prove: 0, righe: [...new Set(mancanti.map((m) => t("verifica.manca", { sigla: nome(m) })))] };
  const azioni: Azione[] = [{ tipo: "attendi", secondi: 1 }, ...pulsanti.map((p) => ({ tipo: "premi" as const, sigla: p })), { tipo: "attendi", secondi: 1 }];
  const esegui = (schema: Schema, codice: string) => {
    const s: SessioneArduino = avviaSessioneArduino(codice, componentiDaSchema(schema), nodiDaSchema(schema, morsettiDi));
    const osservazioni: Record<string, string>[] = [];
    const descrittori: Azione[] = [];
    const osserva = () => {
      const v = vistaDaSessioneArduino(s, schema, libreria).componenti;
      const o: Record<string, string> = {};
      for (const c of osservati) {
        const id = trova(schema, nome(c), c.tipo);
        const a = id ? v[id]?.arduino : undefined;
        if (!a) continue;
        const n = nome(c);
        if (c.tipo === "led-rgb") o[n] = a.bruciato ? t("verifica.bruciato") : (a.rgb ?? [0, 0, 0]).map((x, k) => `${"RGB"[k]} ${Math.round(x * 4) * 25}%`).join(" ");
        else if (c.tipo === "display-sette-segmenti") {
          const accesi = SEGMENTI_DISPLAY.filter((_, k) => (a.segmenti?.[k] ?? 0) >= 0.1);
          o[n] = a.bruciato ? t("verifica.bruciato") : accesi.length ? t("verifica.segmenti", { segmenti: accesi.join(" ") }) : t("verifica.spento");
        } else if (c.tipo === "multimetro") o[n] = a.lettura ?? "–";
        else if (c.tipo === "motore-dc") o[n] = !a.velocita ? t("verifica.fermo") : `${t(a.velocita > 0 ? "verifica.giraOrario" : "verifica.giraAntiorario")} ${Math.round(Math.abs(a.velocita) * 4) * 25}%`;
        else if (c.tipo === "modulo-rele") o[n] = a.eccitato ? t("verifica.eccitato") : t("verifica.riposo");
        else if (c.tipo === "striscia-neopixel") o[n] = (a.neopixel ?? []).length ? (a.neopixel ?? []).map((x) => coloreApprossimato(x)).join(" ") : t("verifica.spento");
        else if (c.tipo.startsWith("led-") || c.tipo === "lampadina") o[n] = a.bruciato ? t("verifica.bruciato") : (a.luminosita ?? 0) < 0.1 ? t("verifica.spento") : `${t("verifica.acceso")} ${Math.round((a.luminosita ?? 0) * 4) * 25}%`;
        else if (c.tipo === "servo") o[n] = a.angolo === undefined ? "–" : `${Math.round(a.angolo / 10) * 10}°`;
        else if (c.tipo === "buzzer") o[n] = a.suona ? t("verifica.suona") : t("verifica.muta");
        else if (c.tipo === "lcd") o[n] = `«${(a.righe ?? []).join(" / ").trim()}»`;
        else if (c.tipo === "arduino-uno") o[`LED L (${n})`] = a.ledL ? t("verifica.acceso") : t("verifica.spento");
      }
      o[t("verifica.monitorSeriale")] = `«${s.seriale.trim().split("\n").slice(-1)[0] ?? ""}»`;
      return o;
    };
    const scorri = (ms: number, azione: Azione) => {
      for (let tempo = 0; tempo < ms; tempo += 250) {
        for (let k = 0; k < 5; k++) passoArduino(s, 50);
        osservazioni.push(osserva());
        descrittori.push(azione);
      }
    };
    for (const a of azioni) {
      if (a.tipo === "attendi") scorri(a.secondi * 1000, a);
      else {
        const id = trova(schema, a.sigla, "pulsante");
        if (id) clicGiuArduino(s, id);
        scorri(600, a);
        if (id) clicSuArduino(s, id);
        scorri(600, { tipo: "attendi", secondi: 0.6 });
      }
    }
    if (s.errore) osservazioni.push({ [t("verifica.programma")]: s.errore.message });
    return { osservazioni, descrittori };
  };
  const attese = esegui({ componenti: soluzione.componenti, fili: soluzione.fili }, soluzione.codice ?? SKETCH_PREDEFINITO);
  const ottenute = esegui(studente, studente.codice ?? SKETCH_PREDEFINITO);
  const righe = confronta(attese.descrittori, attese.osservazioni, ottenute.osservazioni);
  return { riuscito: righe.length === 0, righe: righe.length ? righe : [t("verifica.tutteUguali", { prove: attese.osservazioni.length })], prove: attese.osservazioni.length };
}

/** Moduli in cui la verifica automatica è disponibile. */
export const MODULI_VERIFICABILI = new Set(["impianti", "plc", "elettronica", "arduino"]);

export function verificaEsercizio(modulo: string, studente: Schema): EsitoVerifica | null {
  const soluzione = studente.esercizio?.soluzione;
  if (!soluzione) return null;
  if (modulo === "impianti") return verificaImpianto(studente, soluzione);
  if (modulo === "plc") return verificaPlc(studente, soluzione);
  if (modulo === "elettronica") return verificaElettronica(studente, soluzione);
  if (modulo === "arduino") return verificaArduino(studente, soluzione);
  return null;
}
