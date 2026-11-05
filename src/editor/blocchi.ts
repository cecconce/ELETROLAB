// Editor a blocchi del modulo Arduino: definizione dei blocchi in italiano,
// cassetta degli attrezzi e generatore del codice Arduino.
//
// Lo studente compone il programma con i blocchi "all'avvio" e "ripeti
// sempre"; ad ogni modifica il generatore scrive il codice C++ corrispondente
// (quello che poi esegue l'interprete), aggiungendo da solo le parti
// "noiose": pinMode dei pin usati, Serial.begin, oggetti Servo,
// LiquidCrystal e Adafruit_NeoPixel, funzione per il sensore a ultrasuoni,
// variabili globali.
//
// Blockly (licenza Apache-2.0) viene caricato solo quando serve, così l'avvio
// del programma resta leggero.
import type * as BlocklyTipo from "blockly/core";

type Blockly = typeof BlocklyTipo;

const PIN_DIGITALI: [string, string][] = Array.from({ length: 14 }, (_, i) => [String(i), String(i)]);
const PIN_ANALOGICI: [string, string][] = Array.from({ length: 6 }, (_, i) => [`A${i}`, `A${i}`]);
const PIN_PWM: [string, string][] = ["3", "5", "6", "9", "10", "11"].map((p) => [`~${p}`, p]);

const COLORE_USCITE = 20;
const COLORE_INGRESSI = 190;
const COLORE_TEMPO = 120;
const COLORE_PROGRAMMA = 45;
const COLORE_DISPOSITIVI = 290;

/** Definizioni JSON dei blocchi propri (tipo "ard_…"). */
const DEFINIZIONI = [
  { type: "ard_avvio", message0: "all'avvio %1 %2", args0: [{ type: "input_dummy" }, { type: "input_statement", name: "CORPO" }], colour: COLORE_PROGRAMMA, tooltip: "Questi blocchi vengono eseguiti una volta sola, quando la scheda si accende (setup)." },
  { type: "ard_ripeti", message0: "ripeti sempre %1 %2", args0: [{ type: "input_dummy" }, { type: "input_statement", name: "CORPO" }], colour: COLORE_PROGRAMMA, tooltip: "Questi blocchi vengono ripetuti all'infinito (loop)." },
  {
    type: "ard_scrivi_digitale",
    message0: "imposta pin %1 a %2",
    args0: [
      { type: "field_dropdown", name: "PIN", options: PIN_DIGITALI },
      { type: "field_dropdown", name: "STATO", options: [["ALTO", "HIGH"], ["BASSO", "LOW"]] },
    ],
    previousStatement: null,
    nextStatement: null,
    colour: COLORE_USCITE,
    tooltip: "Accende (ALTO = 5 V) o spegne (BASSO = 0 V) un pin digitale: digitalWrite.",
  },
  {
    type: "ard_scrivi_pwm",
    message0: "imposta pin %1 al valore %2 (0–255)",
    args0: [
      { type: "field_dropdown", name: "PIN", options: PIN_PWM },
      { type: "input_value", name: "VALORE", check: "Number" },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: COLORE_USCITE,
    tooltip: "Uscita PWM (solo pin con ~): 0 = spento, 255 = acceso pieno. Regola la luminosità di un LED: analogWrite.",
  },
  {
    type: "ard_tono",
    message0: "suona sul pin %1 la nota %2 Hz",
    args0: [
      { type: "field_dropdown", name: "PIN", options: PIN_DIGITALI },
      { type: "input_value", name: "FREQ", check: "Number" },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: COLORE_USCITE,
    tooltip: "Il buzzer collegato al pin suona alla frequenza indicata (440 Hz = La): tone.",
  },
  { type: "ard_silenzio", message0: "spegni il suono sul pin %1", args0: [{ type: "field_dropdown", name: "PIN", options: PIN_DIGITALI }], previousStatement: null, nextStatement: null, colour: COLORE_USCITE, tooltip: "noTone" },
  {
    type: "ard_servo",
    message0: "ruota il servo sul pin %1 a %2 gradi",
    args0: [
      { type: "field_dropdown", name: "PIN", options: PIN_DIGITALI },
      { type: "input_value", name: "ANGOLO", check: "Number" },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: COLORE_DISPOSITIVI,
    tooltip: "Porta il braccio del servomotore all'angolo indicato (0–180°).",
  },
  {
    type: "ard_seriale",
    message0: "scrivi sul monitor seriale %1 %2",
    args0: [
      { type: "input_value", name: "TESTO" },
      { type: "field_dropdown", name: "A_CAPO", options: [["e vai a capo", "SI"], ["senza andare a capo", "NO"]] },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: COLORE_DISPOSITIVI,
    tooltip: "Scrive un testo o un numero sul monitor seriale: Serial.print / println.",
  },
  {
    type: "ard_lcd",
    message0: "scrivi sul display %1 riga %2 colonna %3",
    args0: [
      { type: "input_value", name: "TESTO" },
      { type: "field_dropdown", name: "RIGA", options: [["1", "0"], ["2", "1"]] },
      { type: "field_number", name: "COLONNA", value: 1, min: 1, max: 16, precision: 1 },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: COLORE_DISPOSITIVI,
    tooltip: "Display LCD collegato come negli esempi: RS 12, E 11, D4–D7 ai pin 5, 4, 3, 2.",
  },
  {
    type: "ard_neopixel_colore",
    message0: "striscia LED sul pin %1: LED n° %2 rosso %3 verde %4 blu %5",
    args0: [
      { type: "field_dropdown", name: "PIN", options: PIN_DIGITALI },
      { type: "input_value", name: "LED", check: "Number" },
      { type: "input_value", name: "R", check: "Number" },
      { type: "input_value", name: "G", check: "Number" },
      { type: "input_value", name: "B", check: "Number" },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: COLORE_DISPOSITIVI,
    tooltip: "Sceglie il colore di un LED della striscia NeoPixel (8 LED, numerati da 1): rosso, verde e blu da 0 a 255. Il colore compare con il blocco «mostra i colori».",
  },
  { type: "ard_neopixel_mostra", message0: "mostra i colori della striscia LED sul pin %1", args0: [{ type: "field_dropdown", name: "PIN", options: PIN_DIGITALI }], previousStatement: null, nextStatement: null, colour: COLORE_DISPOSITIVI, tooltip: "Manda i colori scelti alla striscia NeoPixel: striscia.show()." },
  {
    type: "ard_registro",
    message0: "scrivi %1 sul registro 74HC595: dato pin %2 clock pin %3 latch pin %4",
    args0: [
      { type: "input_value", name: "VALORE", check: "Number" },
      { type: "field_dropdown", name: "DATI", options: PIN_DIGITALI },
      { type: "field_dropdown", name: "CLOCK", options: PIN_DIGITALI },
      { type: "field_dropdown", name: "LATCH", options: PIN_DIGITALI },
    ],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: COLORE_DISPOSITIVI,
    tooltip: "Manda un numero da 0 a 255 al registro a scorrimento: ogni bit accende o spegne una delle uscite Q0…Q7 (shiftOut e impulso sul latch).",
  },
  { type: "ard_lcd_pulisci", message0: "cancella il display", previousStatement: null, nextStatement: null, colour: COLORE_DISPOSITIVI, tooltip: "lcd.clear()" },
  {
    type: "ard_attendi",
    message0: "attendi %1 secondi",
    args0: [{ type: "input_value", name: "SECONDI", check: "Number" }],
    inputsInline: true,
    previousStatement: null,
    nextStatement: null,
    colour: COLORE_TEMPO,
    tooltip: "Aspetta il tempo indicato prima di passare al blocco successivo: delay.",
  },
  { type: "ard_tempo", message0: "secondi dall'accensione", output: "Number", colour: COLORE_TEMPO, tooltip: "millis() / 1000" },
  { type: "ard_leggi_digitale", message0: "leggi pin digitale %1", args0: [{ type: "field_dropdown", name: "PIN", options: PIN_DIGITALI }], output: "Number", colour: COLORE_INGRESSI, tooltip: "1 se sul pin ci sono 5 V, 0 se ci sono 0 V: digitalRead." },
  { type: "ard_pulsante", message0: "pulsante sul pin %1 premuto", args0: [{ type: "field_dropdown", name: "PIN", options: PIN_DIGITALI }], output: "Boolean", colour: COLORE_INGRESSI, tooltip: "Vero mentre il pulsante (collegato fra il pin e GND) è premuto. Usa il pull-up interno." },
  { type: "ard_leggi_analogico", message0: "leggi pin analogico %1", args0: [{ type: "field_dropdown", name: "PIN", options: PIN_ANALOGICI }], output: "Number", colour: COLORE_INGRESSI, tooltip: "Tensione sul pin da 0 (0 V) a 1023 (5 V): analogRead." },
  {
    type: "ard_distanza",
    message0: "distanza in cm (TRIG %1 ECHO %2)",
    args0: [
      { type: "field_dropdown", name: "TRIG", options: PIN_DIGITALI },
      { type: "field_dropdown", name: "ECHO", options: PIN_DIGITALI },
    ],
    output: "Number",
    colour: COLORE_INGRESSI,
    tooltip: "Distanza misurata dal sensore a ultrasuoni.",
  },
  {
    type: "ard_mappa",
    message0: "mappa %1 da %2 – %3 a %4 – %5",
    args0: [
      { type: "input_value", name: "VALORE", check: "Number" },
      { type: "input_value", name: "DA_MIN", check: "Number" },
      { type: "input_value", name: "DA_MAX", check: "Number" },
      { type: "input_value", name: "A_MIN", check: "Number" },
      { type: "input_value", name: "A_MAX", check: "Number" },
    ],
    inputsInline: true,
    output: "Number",
    colour: 230,
    tooltip: "Trasforma un valore da un intervallo a un altro, per esempio 0–1023 in 0–180: map.",
  },
];

/** Cassetta degli attrezzi: le categorie a sinistra dell'editor a blocchi. */
export const CASSETTA = {
  kind: "categoryToolbox",
  contents: [
    {
      kind: "category",
      name: "Uscite",
      colour: String(COLORE_USCITE),
      contents: [
        { kind: "block", type: "ard_scrivi_digitale" },
        { kind: "block", type: "ard_scrivi_pwm", inputs: { VALORE: { shadow: { type: "math_number", fields: { NUM: 128 } } } } },
        { kind: "block", type: "ard_tono", inputs: { FREQ: { shadow: { type: "math_number", fields: { NUM: 440 } } } } },
        { kind: "block", type: "ard_silenzio" },
      ],
    },
    {
      kind: "category",
      name: "Ingressi",
      colour: String(COLORE_INGRESSI),
      contents: [
        { kind: "block", type: "ard_pulsante" },
        { kind: "block", type: "ard_leggi_digitale" },
        { kind: "block", type: "ard_leggi_analogico" },
        { kind: "block", type: "ard_distanza" },
      ],
    },
    {
      kind: "category",
      name: "Dispositivi",
      colour: String(COLORE_DISPOSITIVI),
      contents: [
        { kind: "block", type: "ard_servo", inputs: { ANGOLO: { shadow: { type: "math_number", fields: { NUM: 90 } } } } },
        { kind: "block", type: "ard_seriale", inputs: { TESTO: { shadow: { type: "text", fields: { TEXT: "ciao" } } } } },
        { kind: "block", type: "ard_lcd", inputs: { TESTO: { shadow: { type: "text", fields: { TEXT: "Ciao!" } } } } },
        { kind: "block", type: "ard_lcd_pulisci" },
        {
          kind: "block",
          type: "ard_neopixel_colore",
          fields: { PIN: "6" },
          inputs: { LED: { shadow: { type: "math_number", fields: { NUM: 1 } } }, R: { shadow: { type: "math_number", fields: { NUM: 255 } } }, G: { shadow: { type: "math_number", fields: { NUM: 0 } } }, B: { shadow: { type: "math_number", fields: { NUM: 0 } } } },
        },
        { kind: "block", type: "ard_neopixel_mostra", fields: { PIN: "6" } },
        { kind: "block", type: "ard_registro", fields: { DATI: "11", CLOCK: "12", LATCH: "8" }, inputs: { VALORE: { shadow: { type: "math_number", fields: { NUM: 5 } } } } },
      ],
    },
    {
      kind: "category",
      name: "Tempo",
      colour: String(COLORE_TEMPO),
      contents: [
        { kind: "block", type: "ard_attendi", inputs: { SECONDI: { shadow: { type: "math_number", fields: { NUM: 1 } } } } },
        { kind: "block", type: "ard_tempo" },
      ],
    },
    {
      kind: "category",
      name: "Controllo",
      colour: "210",
      contents: [
        { kind: "block", type: "controls_if" },
        { kind: "block", type: "controls_if", extraState: { hasElse: true } },
        { kind: "block", type: "controls_repeat_ext", inputs: { TIMES: { shadow: { type: "math_number", fields: { NUM: 10 } } } } },
        { kind: "block", type: "controls_whileUntil" },
      ],
    },
    {
      kind: "category",
      name: "Logica",
      colour: "210",
      contents: [
        { kind: "block", type: "logic_compare" },
        { kind: "block", type: "logic_operation" },
        { kind: "block", type: "logic_negate" },
        { kind: "block", type: "logic_boolean" },
      ],
    },
    {
      kind: "category",
      name: "Matematica",
      colour: "230",
      contents: [
        { kind: "block", type: "math_number" },
        { kind: "block", type: "math_arithmetic" },
        { kind: "block", type: "math_random_int", inputs: { FROM: { shadow: { type: "math_number", fields: { NUM: 1 } } }, TO: { shadow: { type: "math_number", fields: { NUM: 6 } } } } },
        {
          kind: "block",
          type: "ard_mappa",
          inputs: {
            DA_MIN: { shadow: { type: "math_number", fields: { NUM: 0 } } },
            DA_MAX: { shadow: { type: "math_number", fields: { NUM: 1023 } } },
            A_MIN: { shadow: { type: "math_number", fields: { NUM: 0 } } },
            A_MAX: { shadow: { type: "math_number", fields: { NUM: 255 } } },
          },
        },
        { kind: "block", type: "text" },
      ],
    },
    { kind: "category", name: "Variabili", colour: "330", custom: "VARIABLE" },
  ],
};

/** Programma a blocchi proposto: il LED della scheda che lampeggia. */
export const BLOCCHI_INIZIALI = {
  blocks: {
    languageVersion: 0,
    blocks: [
      { type: "ard_avvio", x: 20, y: 20 },
      {
        type: "ard_ripeti",
        x: 20,
        y: 110,
        inputs: {
          CORPO: {
            block: {
              type: "ard_scrivi_digitale",
              fields: { PIN: "13", STATO: "HIGH" },
              next: {
                block: {
                  type: "ard_attendi",
                  inputs: { SECONDI: { shadow: { type: "math_number", fields: { NUM: 1 } } } },
                  next: {
                    block: {
                      type: "ard_scrivi_digitale",
                      fields: { PIN: "13", STATO: "LOW" },
                      next: { block: { type: "ard_attendi", inputs: { SECONDI: { shadow: { type: "math_number", fields: { NUM: 1 } } } } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    ],
  },
};

// ---------------------------------------------------------------- Generatore

/** Precedenze degli operatori (dalla più forte alla più debole), come nel C. */
const ORDINE = { ATOMICO: 0, CHIAMATA: 2, UNARIO: 3, MOLTIPLICATIVO: 5, ADDITIVO: 6, RELAZIONALE: 8, UGUAGLIANZA: 9, AND: 13, OR: 14, NESSUNO: 99 };

/** Ciò che il programma usa: serve a scrivere setup() e le dichiarazioni. */
interface Necessita {
  modi: Map<string, "OUTPUT" | "INPUT" | "INPUT_PULLUP">;
  seriale: boolean;
  servi: Set<string>;
  lcd: boolean;
  distanza: boolean;
  /** Pin delle strisce NeoPixel usate. */
  neopixel: Set<string>;
}

let caricato: Promise<Blockly> | null = null;

/** Carica Blockly in italiano e registra i blocchi (una volta sola). */
export function caricaBlockly(): Promise<Blockly> {
  if (!caricato) {
    caricato = (async () => {
      const Blockly = await import("blockly/core");
      await import("blockly/blocks");
      const it = (await import("blockly/msg/it")) as unknown as Record<string, string> & { default?: Record<string, string> };
      Blockly.setLocale((it.default ?? it) as Record<string, string>);
      Blockly.common.defineBlocksWithJsonArray(DEFINIZIONI);
      return Blockly;
    })();
  }
  return caricato;
}

/** Scrive il codice Arduino del programma a blocchi presente nell'area di lavoro. */
export function codiceDaBlocchi(Blockly: Blockly, ws: BlocklyTipo.Workspace): string {
  const gen = new Blockly.CodeGenerator("Arduino");
  gen.INDENT = "  ";
  const nomi = new Blockly.Names("setup,loop,int,long,float,bool,void,if,else,for,while,do,return,break,continue,switch,case,default,true,false,HIGH,LOW,INPUT,OUTPUT,lcd,distanzaCm,Serial,delay,millis");
  nomi.setVariableMap(ws.getVariableMap());
  const necessita: Necessita = { modi: new Map(), seriale: false, servi: new Set(), lcd: false, distanza: false, neopixel: new Set() };
  const modo = (pin: string, m: "OUTPUT" | "INPUT" | "INPUT_PULLUP") => {
    if (!necessita.modi.has(pin) || m === "OUTPUT") necessita.modi.set(pin, m);
  };
  // I blocchi uniti sotto a un altro vengono generati di seguito.
  gen.scrub_ = function (blocco, codice, soloQuesto) {
    const prossimo = blocco.nextConnection?.targetBlock();
    return codice + (soloQuesto || !prossimo ? "" : (this.blockToCode(prossimo) as string));
  };
  const valore = (b: BlocklyTipo.Block, nome: string, ordine: number, predefinito = "0") => gen.valueToCode(b, nome, ordine) || predefinito;
  const variabile = (b: BlocklyTipo.Block) => nomi.getName(b.getFieldValue("VAR"), Blockly.Names.NameType.VARIABLE);
  const f = gen.forBlock;

  f["ard_avvio"] = () => "";
  f["ard_ripeti"] = () => "";
  f["ard_scrivi_digitale"] = (b) => {
    const pin = b.getFieldValue("PIN");
    modo(pin, "OUTPUT");
    return `digitalWrite(${pin}, ${b.getFieldValue("STATO")});\n`;
  };
  f["ard_scrivi_pwm"] = (b) => {
    const pin = b.getFieldValue("PIN");
    modo(pin, "OUTPUT");
    return `analogWrite(${pin}, ${valore(b, "VALORE", ORDINE.NESSUNO)});\n`;
  };
  f["ard_tono"] = (b) => `tone(${b.getFieldValue("PIN")}, ${valore(b, "FREQ", ORDINE.NESSUNO, "440")});\n`;
  f["ard_silenzio"] = (b) => `noTone(${b.getFieldValue("PIN")});\n`;
  f["ard_servo"] = (b) => {
    const pin = b.getFieldValue("PIN");
    necessita.servi.add(pin);
    return `servo${pin}.write(${valore(b, "ANGOLO", ORDINE.NESSUNO, "90")});\n`;
  };
  f["ard_seriale"] = (b) => {
    necessita.seriale = true;
    return `Serial.${b.getFieldValue("A_CAPO") === "SI" ? "println" : "print"}(${valore(b, "TESTO", ORDINE.NESSUNO, '""')});\n`;
  };
  f["ard_lcd"] = (b) => {
    necessita.lcd = true;
    const colonna = Math.max(1, Math.min(16, Number(b.getFieldValue("COLONNA")) || 1)) - 1;
    return `lcd.setCursor(${colonna}, ${b.getFieldValue("RIGA")});\nlcd.print(${valore(b, "TESTO", ORDINE.NESSUNO, '""')});\n`;
  };
  f["ard_neopixel_colore"] = (b) => {
    const pin = b.getFieldValue("PIN");
    necessita.neopixel.add(pin);
    const led = valore(b, "LED", ORDINE.ADDITIVO, "1");
    const indice = /^\d+$/.test(led) ? String(Number(led) - 1) : `${led} - 1`;
    return `striscia${pin}.setPixelColor(${indice}, ${valore(b, "R", ORDINE.NESSUNO)}, ${valore(b, "G", ORDINE.NESSUNO)}, ${valore(b, "B", ORDINE.NESSUNO)});\n`;
  };
  f["ard_neopixel_mostra"] = (b) => {
    const pin = b.getFieldValue("PIN");
    necessita.neopixel.add(pin);
    return `striscia${pin}.show();\n`;
  };
  f["ard_registro"] = (b) => {
    const [dati, clock, latch] = ["DATI", "CLOCK", "LATCH"].map((k) => b.getFieldValue(k) as string);
    for (const p of [dati, clock, latch]) modo(p, "OUTPUT");
    return `digitalWrite(${latch}, LOW);\nshiftOut(${dati}, ${clock}, MSBFIRST, ${valore(b, "VALORE", ORDINE.NESSUNO)});\ndigitalWrite(${latch}, HIGH);\n`;
  };
  f["ard_lcd_pulisci"] = () => {
    necessita.lcd = true;
    return "lcd.clear();\n";
  };
  f["ard_attendi"] = (b) => {
    const s = valore(b, "SECONDI", ORDINE.MOLTIPLICATIVO, "1");
    return /^\d+(\.\d+)?$/.test(s) ? `delay(${Math.round(Number(s) * 1000)});\n` : `delay(${s} * 1000);\n`;
  };
  f["ard_tempo"] = () => ["millis() / 1000.0", ORDINE.MOLTIPLICATIVO];
  f["ard_leggi_digitale"] = (b) => {
    const pin = b.getFieldValue("PIN");
    modo(pin, "INPUT");
    return [`digitalRead(${pin})`, ORDINE.CHIAMATA];
  };
  f["ard_pulsante"] = (b) => {
    const pin = b.getFieldValue("PIN");
    modo(pin, "INPUT_PULLUP");
    return [`digitalRead(${pin}) == LOW`, ORDINE.UGUAGLIANZA];
  };
  f["ard_leggi_analogico"] = (b) => [`analogRead(${b.getFieldValue("PIN")})`, ORDINE.CHIAMATA];
  f["ard_distanza"] = (b) => {
    necessita.distanza = true;
    modo(b.getFieldValue("TRIG"), "OUTPUT");
    modo(b.getFieldValue("ECHO"), "INPUT");
    return [`distanzaCm(${b.getFieldValue("TRIG")}, ${b.getFieldValue("ECHO")})`, ORDINE.CHIAMATA];
  };
  f["ard_mappa"] = (b) => [
    `map(${valore(b, "VALORE", ORDINE.NESSUNO)}, ${valore(b, "DA_MIN", ORDINE.NESSUNO)}, ${valore(b, "DA_MAX", ORDINE.NESSUNO, "1023")}, ${valore(b, "A_MIN", ORDINE.NESSUNO)}, ${valore(b, "A_MAX", ORDINE.NESSUNO, "255")})`,
    ORDINE.CHIAMATA,
  ];

  // --- blocchi standard di Blockly, tradotti in C ---
  f["controls_if"] = (b) => {
    let codice = "";
    let n = 0;
    while (b.getInput(`IF${n}`)) {
      const cond = valore(b, `IF${n}`, ORDINE.NESSUNO, "false");
      codice += `${n === 0 ? "if" : " else if"} (${cond}) {\n${gen.statementToCode(b, `DO${n}`)}}`;
      n++;
    }
    if (b.getInput("ELSE")) codice += ` else {\n${gen.statementToCode(b, "ELSE")}}`;
    return `${codice}\n`;
  };
  let contatoriCicli = 0;
  f["controls_repeat_ext"] = (b) => {
    const i = `i${++contatoriCicli}`;
    return `for (int ${i} = 0; ${i} < ${valore(b, "TIMES", ORDINE.RELAZIONALE)}; ${i}++) {\n${gen.statementToCode(b, "DO")}}\n`;
  };
  f["controls_whileUntil"] = (b) => {
    const cond = valore(b, "BOOL", b.getFieldValue("MODE") === "UNTIL" ? ORDINE.UNARIO : ORDINE.NESSUNO, "false");
    return `while (${b.getFieldValue("MODE") === "UNTIL" ? `!(${cond})` : cond}) {\n${gen.statementToCode(b, "DO")}}\n`;
  };
  f["logic_compare"] = (b) => {
    const op = { EQ: "==", NEQ: "!=", LT: "<", LTE: "<=", GT: ">", GTE: ">=" }[b.getFieldValue("OP") as string] ?? "==";
    const ordine = op === "==" || op === "!=" ? ORDINE.UGUAGLIANZA : ORDINE.RELAZIONALE;
    return [`${valore(b, "A", ordine)} ${op} ${valore(b, "B", ordine)}`, ordine];
  };
  f["logic_operation"] = (b) => {
    const and = b.getFieldValue("OP") === "AND";
    const ordine = and ? ORDINE.AND : ORDINE.OR;
    return [`${valore(b, "A", ordine, "false")} ${and ? "&&" : "||"} ${valore(b, "B", ordine, "false")}`, ordine];
  };
  f["logic_negate"] = (b) => [`!${valore(b, "BOOL", ORDINE.UNARIO, "true")}`, ORDINE.UNARIO];
  f["logic_boolean"] = (b) => [b.getFieldValue("BOOL") === "TRUE" ? "true" : "false", ORDINE.ATOMICO];
  f["math_number"] = (b) => {
    const n = Number(b.getFieldValue("NUM"));
    return [String(n), n < 0 ? ORDINE.UNARIO : ORDINE.ATOMICO];
  };
  f["math_arithmetic"] = (b) => {
    const op = b.getFieldValue("OP") as string;
    if (op === "POWER") return [`pow(${valore(b, "A", ORDINE.NESSUNO)}, ${valore(b, "B", ORDINE.NESSUNO)})`, ORDINE.CHIAMATA];
    const [simbolo, ordine] = ({ ADD: ["+", ORDINE.ADDITIVO], MINUS: ["-", ORDINE.ADDITIVO], MULTIPLY: ["*", ORDINE.MOLTIPLICATIVO], DIVIDE: ["/", ORDINE.MOLTIPLICATIVO] } as Record<string, [string, number]>)[op];
    return [`${valore(b, "A", ordine)} ${simbolo} ${valore(b, "B", ordine + 0.5)}`, ordine];
  };
  f["math_random_int"] = (b) => [`random(${valore(b, "FROM", ORDINE.NESSUNO)}, ${valore(b, "TO", ORDINE.ADDITIVO)} + 1)`, ORDINE.CHIAMATA];
  f["text"] = (b) => [JSON.stringify(String(b.getFieldValue("TEXT"))), ORDINE.ATOMICO];
  f["variables_get"] = (b) => [variabile(b), ORDINE.ATOMICO];
  f["variables_set"] = (b) => `${variabile(b)} = ${valore(b, "VALUE", ORDINE.NESSUNO)};\n`;
  f["math_change"] = (b) => `${variabile(b)} += ${valore(b, "DELTA", ORDINE.ADDITIVO, "1")};\n`;

  gen.init(ws);
  const primo = (tipo: string) => ws.getTopBlocks(true).find((b) => b.type === tipo);
  const avvio = primo("ard_avvio");
  const ripeti = primo("ard_ripeti");
  const corpoAvvio = avvio ? gen.statementToCode(avvio, "CORPO") : "";
  const corpoRipeti = ripeti ? gen.statementToCode(ripeti, "CORPO") : "";

  // --- composizione dello sketch ---
  const righe: string[] = ["// Programma scritto con i blocchi di ElettroLab.", ""];
  if (necessita.servi.size) righe.push("#include <Servo.h>");
  if (necessita.lcd) righe.push("#include <LiquidCrystal.h>");
  if (necessita.neopixel.size) righe.push("#include <Adafruit_NeoPixel.h>");
  if (necessita.servi.size || necessita.lcd || necessita.neopixel.size) righe.push("");
  for (const p of necessita.servi) righe.push(`Servo servo${p};`);
  for (const p of necessita.neopixel) righe.push(`Adafruit_NeoPixel striscia${p}(8, ${p}, NEO_GRB + NEO_KHZ800);`);
  if (necessita.lcd) righe.push("LiquidCrystal lcd(12, 11, 5, 4, 3, 2);");
  for (const v of ws.getVariableMap().getAllVariables()) righe.push(`int ${nomi.getName(v.getId(), Blockly.Names.NameType.VARIABLE)} = 0;`);
  if (righe[righe.length - 1] !== "") righe.push("");
  if (necessita.distanza) {
    righe.push(
      "// Distanza misurata dal sensore a ultrasuoni, in centimetri.",
      "long distanzaCm(int trig, int echo) {",
      "  digitalWrite(trig, LOW);",
      "  delayMicroseconds(2);",
      "  digitalWrite(trig, HIGH);",
      "  delayMicroseconds(10);",
      "  digitalWrite(trig, LOW);",
      "  return pulseIn(echo, HIGH) / 58;",
      "}",
      "",
    );
  }
  righe.push("void setup() {");
  for (const [pin, m] of necessita.modi) righe.push(`  pinMode(${pin}, ${m});`);
  if (necessita.seriale) righe.push("  Serial.begin(9600);");
  for (const p of necessita.servi) righe.push(`  servo${p}.attach(${p});`);
  if (necessita.lcd) righe.push("  lcd.begin(16, 2);");
  for (const p of necessita.neopixel) righe.push(`  striscia${p}.begin();`);
  righe.push(corpoAvvio.replace(/\n$/, ""), "}", "", "void loop() {", corpoRipeti.replace(/\n$/, ""), "}", "");
  return righe.filter((r, i, a) => !(r === "" && a[i - 1] === "")).join("\n").replace(/\{\n\n/g, "{\n");
}
