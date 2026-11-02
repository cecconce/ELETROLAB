// Parole proposte dal completamento automatico nell'editor del codice Arduino:
// funzioni e costanti del linguaggio Arduino capite dall'interprete di
// ElettroLab, con una breve spiegazione in italiano.

export interface Completamento {
  /** Testo inserito. */
  label: string;
  tipo: "function" | "constant" | "keyword" | "type";
  /** Spiegazione breve mostrata accanto. */
  info: string;
  /** Testo da inserire al posto della sola parola (es. con le parentesi). */
  apply?: string;
}

const f = (label: string, info: string, apply?: string): Completamento => ({ label, tipo: "function", info, apply });
const k = (label: string, info: string): Completamento => ({ label, tipo: "constant", info });

export const COMPLETAMENTI_ARDUINO: Completamento[] = [
  f("pinMode", "pinMode(pin, OUTPUT/INPUT/INPUT_PULLUP): sceglie se il pin è un'uscita o un ingresso", "pinMode(, OUTPUT);"),
  f("digitalWrite", "digitalWrite(pin, HIGH/LOW): accende o spegne un'uscita", "digitalWrite(, HIGH);"),
  f("digitalRead", "digitalRead(pin): legge un ingresso (HIGH o LOW)", "digitalRead()"),
  f("analogRead", "analogRead(A0…A5): legge una tensione da 0 a 1023", "analogRead(A0)"),
  f("analogWrite", "analogWrite(pin~, 0…255): uscita PWM (luminosità, velocità)", "analogWrite(, 128);"),
  f("delay", "delay(ms): aspetta un certo numero di millisecondi", "delay(1000);"),
  f("delayMicroseconds", "delayMicroseconds(µs): aspetta pochi microsecondi", "delayMicroseconds(10);"),
  f("millis", "millis(): millisecondi passati dall'accensione", "millis()"),
  f("micros", "micros(): microsecondi passati dall'accensione", "micros()"),
  f("map", "map(valore, daMin, daMax, aMin, aMax): converte da un intervallo a un altro", "map(, 0, 1023, 0, 255)"),
  f("constrain", "constrain(x, min, max): tiene x fra min e max", "constrain(, 0, 255)"),
  f("random", "random(min, max): numero a caso", "random(0, 10)"),
  f("tone", "tone(pin, frequenza): suona una nota sul buzzer", "tone(, 440);"),
  f("noTone", "noTone(pin): spegne la nota", "noTone();"),
  f("pulseIn", "pulseIn(pin, HIGH): durata di un impulso in µs (sensore a ultrasuoni)", "pulseIn(, HIGH)"),
  f("Serial.begin", "Serial.begin(9600): avvia il monitor seriale", "Serial.begin(9600);"),
  f("Serial.print", "Serial.print(x): scrive sul monitor seriale", "Serial.print();"),
  f("Serial.println", "Serial.println(x): scrive sul monitor seriale e va a capo", "Serial.println();"),
  f("Serial.available", "Serial.available(): quanti caratteri sono arrivati", "Serial.available()"),
  f("Serial.read", "Serial.read(): legge un carattere arrivato dal monitor", "Serial.read()"),
  f("abs", "abs(x): valore assoluto"),
  f("min", "min(a, b): il più piccolo"),
  f("max", "max(a, b): il più grande"),
  k("HIGH", "livello alto (5 V)"),
  k("LOW", "livello basso (0 V)"),
  k("OUTPUT", "il pin è un'uscita"),
  k("INPUT", "il pin è un ingresso"),
  k("INPUT_PULLUP", "ingresso con la resistenza interna verso 5 V (pulsante verso GND)"),
  k("LED_BUILTIN", "il pin 13, con il LED «L» della scheda"),
  k("true", "vero"),
  k("false", "falso"),
  ...["A0", "A1", "A2", "A3", "A4", "A5"].map((p) => k(p, "ingresso analogico")),
  ...["int", "long", "float", "bool", "char", "byte", "unsigned", "const", "void", "String"].map((t): Completamento => ({ label: t, tipo: "type", info: "tipo di dato" })),
  ...["if", "else", "for", "while", "do", "switch", "case", "break", "return"].map((t): Completamento => ({ label: t, tipo: "keyword", info: "istruzione" })),
  { label: "#include <Servo.h>", tipo: "keyword", info: "libreria per i servomotori" },
  { label: "#include <LiquidCrystal.h>", tipo: "keyword", info: "libreria per il display LCD 16x2" },
];

/** Proposte che iniziano con il testo scritto (senza distinguere maiuscole). */
export function proponi(parola: string): Completamento[] {
  const p = parola.toLowerCase();
  if (p.length < 1) return [];
  return COMPLETAMENTI_ARDUINO.filter((c) => c.label.toLowerCase().startsWith(p));
}
