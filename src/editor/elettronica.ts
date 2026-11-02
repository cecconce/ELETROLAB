// Collegamento fra l'editor comune e il motore del modulo Elettronica:
// - parametri modificabili di ogni componente (per il pannello Proprietà);
// - componenti dello schema per il motore;
// - aspetto dello schema durante la simulazione (LED e lampadine accesi,
//   interruttori, potenziometri, letture degli strumenti) e problemi spiegati.
import {
  CORRENTE_LED_MASSIMA,
  luminosita,
  PARAMETRI_PREDEFINITI,
  scriviValore,
  type ComponenteElettronico,
  type SessioneElettronica,
} from "../motori/elettronica";
import { t } from "../testi";
import type { Libreria } from "./libreria";
import type { ProblemaMostrato } from "./messaggiProblemi";
import type { Schema } from "./schema";
import type { AspettoComponente, VistaSimulazione } from "./vistaSimulazione";

/** Descrizione di un parametro per il pannello Proprietà. */
export type DefinizioneParametro =
  | { id: string; nome: string; tipo: "numero"; unita: string; minimo?: number; massimo?: number }
  | { id: string; nome: string; tipo: "scelta"; scelte: { valore: string; nome: string }[] };

const numero = (id: string, nome: string, unita: string, minimo?: number, massimo?: number): DefinizioneParametro => ({ id, nome, tipo: "numero", unita, minimo, massimo });

/** Parametri modificabili per tipo di componente. */
export const PARAMETRI_ELETTRONICA: Record<string, DefinizioneParametro[]> = {
  "generatore-dc": [numero("tensione", "Tensione", "V", -1000, 1000)],
  "generatore-corrente": [numero("corrente", "Corrente", "A", -100, 100)],
  "generatore-funzioni": [
    {
      id: "forma",
      nome: "Forma d'onda",
      tipo: "scelta",
      scelte: [
        { valore: "sinusoide", nome: "∿ Sinusoide" },
        { valore: "quadra", nome: "⊓ Onda quadra" },
        { valore: "triangolare", nome: "△ Triangolare" },
      ],
    },
    numero("frequenza", "Frequenza", "Hz", 0.01, 1e6),
    numero("ampiezza", "Ampiezza (di picco)", "V", 0, 1000),
    numero("offset", "Offset", "V", -1000, 1000),
  ],
  resistenza: [numero("resistenza", "Resistenza", "Ω", 1e-3, 1e9)],
  potenziometro: [numero("resistenza", "Resistenza totale", "Ω", 1, 1e9)],
  condensatore: [numero("capacita", "Capacità", "F", 1e-15, 10)],
  induttore: [numero("induttanza", "Induttanza", "H", 1e-9, 1000)],
  lampadina: [numero("tensione", "Tensione nominale", "V", 0.1, 1000), numero("potenza", "Potenza nominale", "W", 0.001, 10000)],
  zener: [numero("tensione", "Tensione di zener", "V", 1, 200)],
  led: [
    {
      id: "colore",
      nome: "Colore",
      tipo: "scelta",
      scelte: [
        { valore: "rosso", nome: "Rosso" },
        { valore: "giallo", nome: "Giallo" },
        { valore: "verde", nome: "Verde" },
        { valore: "blu", nome: "Blu" },
      ],
    },
  ],
  "transistor-npn": [numero("beta", "Guadagno β (hFE)", "", 1, 10000)],
  "transistor-pnp": [numero("beta", "Guadagno β (hFE)", "", 1, 10000)],
  "mosfet-n": [numero("soglia", "Tensione di soglia", "V", 0, 20)],
  "mosfet-p": [numero("soglia", "Tensione di soglia", "V", 0, 20)],
  operazionale: [numero("saturazione", "Tensione di saturazione (±)", "V", 0.5, 100)],
  regolatore: [numero("tensione", "Tensione di uscita", "V", 1, 50)],
  "generatore-clock": [numero("frequenza", "Frequenza", "Hz", 0.01, 100000)],
  multimetro: [
    {
      id: "modalita",
      nome: "Funzione",
      tipo: "scelta",
      scelte: [
        { valore: "V", nome: "V — voltmetro" },
        { valore: "A", nome: "A — amperometro" },
        { valore: "Ω", nome: "Ω — ohmmetro" },
      ],
    },
  ],
};

/** Valore attuale di un parametro (quello scelto o il predefinito). */
export function valoreParametro(parametri: Record<string, number | string> | undefined, tipo: string, id: string): number | string {
  return parametri?.[id] ?? PARAMETRI_PREDEFINITI[tipo]?.[id] ?? "";
}

/** Imposta un parametro di un componente; torna lo schema invariato se il valore non cambia. */
export function impostaParametro(schema: Schema, componente: string, id: string, valore: number | string): Schema {
  const c = schema.componenti.find((x) => x.id === componente);
  if (!c || valoreParametro(c.parametri, c.tipo, id) === valore) return schema;
  return { ...schema, componenti: schema.componenti.map((x) => (x.id === componente ? { ...x, parametri: { ...x.parametri, [id]: valore } } : x)) };
}

/** Testo breve del valore principale da scrivere accanto al simbolo (come sugli schemi): "1 kΩ", "100 nF"… */
export function etichettaValore(tipo: string, parametri?: Record<string, number | string>): string {
  const v = (id: string) => valoreParametro(parametri, tipo, id);
  const n = (id: string) => Number(v(id));
  switch (tipo) {
    case "generatore-dc":
      return scriviValore(n("tensione"), "V");
    case "generatore-corrente":
      return scriviValore(n("corrente"), "A");
    case "generatore-funzioni": {
      const forma = v("forma") === "quadra" ? "⊓" : v("forma") === "triangolare" ? "△" : "∿";
      return `${forma} ${scriviValore(n("frequenza"), "Hz")} ${scriviValore(n("ampiezza"), "Vp")}`;
    }
    case "resistenza":
    case "potenziometro":
      return scriviValore(n("resistenza"), "Ω");
    case "condensatore":
      return scriviValore(n("capacita"), "F");
    case "induttore":
      return scriviValore(n("induttanza"), "H");
    case "lampadina":
      return `${scriviValore(n("tensione"), "V")} ${scriviValore(n("potenza"), "W")}`;
    case "zener":
      return scriviValore(n("tensione"), "V");
    case "generatore-clock":
      return scriviValore(n("frequenza"), "Hz");
    case "regolatore":
      return `78${String(Math.round(n("tensione"))).padStart(2, "0")}`;
    case "transistor-npn":
    case "transistor-pnp":
      return `β ${n("beta")}`;
    default:
      return "";
  }
}

/** Componenti dello schema per il motore. */
export function componentiDaSchemaElettronica(schema: Schema): ComponenteElettronico[] {
  return schema.componenti.map((c) => ({ id: c.id, tipo: c.tipo, parametri: c.parametri ?? {} }));
}

/** Lettura del multimetro da mostrare sul display. */
export function testoLettura(l: { valore: number | null; unita: string } | undefined): string {
  if (!l) return "";
  if (l.valore === null) return "OL";
  if (Math.abs(l.valore) < 1e-9) return `0 ${l.unita}`;
  return scriviValore(l.valore, l.unita);
}

/** Che cosa fa un clic durante la simulazione. */
function clicElettronica(tipo: string): AspettoComponente["clic"] {
  if (tipo === "pulsante") return "pulsante";
  if (tipo === "interruttore" || tipo === "interruttore-logico" || tipo === "potenziometro") return "manuale";
  return null;
}

/** Aspetto dello schema durante la simulazione. */
export function vistaDaSessioneElettronica(s: SessioneElettronica, schema: Schema, libreria: Libreria): VistaSimulazione {
  const componenti: Record<string, AspettoComponente> = {};
  const perId = new Map(s.componenti.map((c) => [c.id, c]));
  for (const c of schema.componenti) {
    const m = perId.get(c.id);
    const elettronica: NonNullable<AspettoComponente["elettronica"]> = {};
    if (m && (c.tipo === "led" || c.tipo === "lampadina")) elettronica.luminosita = luminosita(s, m);
    if (c.tipo === "led") elettronica.bruciato = s.bruciati.has(c.id);
    if (c.tipo === "potenziometro") elettronica.posizione = s.interazioni.posizioni[c.id] ?? 0.5;
    if (c.tipo === "multimetro" || c.tipo === "wattmetro") elettronica.lettura = testoLettura(s.letture[c.id]);
    const digitale = s.digitali[c.id];
    if (digitale) {
      elettronica.livelli = { ...digitale.ingressi, ...digitale.uscite };
      if (c.tipo === "contatore") elettronica.conteggio = digitale.memoria;
    }
    componenti[c.id] = {
      clic: clicElettronica(c.tipo),
      chiuso: s.interazioni.chiusi.has(c.id) || s.interazioni.premuti.has(c.id),
      alimentato: false,
      azionato: s.interazioni.premuti.has(c.id),
      intervenuta: false,
      sovraccarico: false,
      elettronica,
    };
  }
  return {
    poliDeiFili: {},
    componenti,
    morsettiInCorto: new Set(),
    tempo: s.tempo,
    problemi: [],
    problemiPlc: problemiElettronica(s, schema, libreria),
  };
}

/** Problemi del circuito, spiegati in italiano. */
export function problemiElettronica(s: SessioneElettronica, schema: Schema, libreria: Libreria): ProblemaMostrato[] {
  const problemi: ProblemaMostrato[] = [];
  const nome = (tipo: string) => libreria.componenti.find((v) => v.id === tipo)?.nome ?? tipo;
  const sigla = (id: string) => schema.componenti.find((c) => c.id === id)?.etichetta || nome(schema.componenti.find((c) => c.id === id)?.tipo ?? "");
  if (schema.componenti.length === 0) return problemi;
  if (s.senzaMassa) problemi.push({ chiave: "senza-massa", gravita: "errore", testo: t("elettronica.problema.senzaMassa"), componenti: [], morsetti: [] });
  if (s.nonConverge) problemi.push({ chiave: "non-converge", gravita: "avviso", testo: t("elettronica.problema.nonConverge"), componenti: [], morsetti: [] });
  for (const id of s.inCorto) problemi.push({ chiave: `corto-${id}`, gravita: "errore", testo: t("elettronica.problema.corto", { sigla: sigla(id) }), componenti: [id], morsetti: [] });
  for (const id of s.bruciati)
    problemi.push({
      chiave: `bruciato-${id}`,
      gravita: "errore",
      testo: t("elettronica.problema.ledBruciato", { sigla: sigla(id), massima: Math.round(CORRENTE_LED_MASSIMA * 1000) }),
      componenti: [id],
      morsetti: [],
    });
  for (const c of schema.componenti) {
    if (c.tipo === "oscilloscopio" && !schema.fili.some((f) => (f.da.componente === c.id || f.a.componente === c.id) && (f.da.morsetto === "COM" || f.a.morsetto === "COM"))) {
      problemi.push({ chiave: `osc-com-${c.id}`, gravita: "avviso", testo: t("elettronica.problema.oscilloscopioSenzaCom", { sigla: sigla(c.id) }), componenti: [c.id], morsetti: [] });
    }
  }
  return problemi;
}

/** Firma della vista: cambia quando cambia qualcosa di visibile. */
export function firmaElettronica(s: SessioneElettronica): string {
  return String(s.versione);
}
