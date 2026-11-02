// Generatore degli esempi pronti del modulo Arduino in esempi/ (strumento per
// chi sviluppa, non fa parte dell'app). I file .elab sono la fonte da
// distribuire: si aprono, si modificano e si risalvano con ElettroLab.
// I componenti vengono posati con i piedini esattamente nei fori della
// breadboard (si collegano da soli); i cavetti hanno i colori del laboratorio.
//
// Uso: npx vite-node strumenti/genera-esempi-arduino.ts
import { writeFileSync } from "node:fs";
import { libreriaDelModulo } from "../src/editor/caricaLibreria";
import { vocePerTipo } from "../src/editor/libreria";
import { colorePropostoFilo } from "../src/editor/fili";
import { serializzaProgetto } from "../src/progetto/formato";
import type { ComponenteSchema, Filo, Schema } from "../src/editor/schema";

const libreria = libreriaDelModulo("arduino");
const ARANCIONE = "#ef6c00";
const GIALLO = "#f9a825";
const BLU = "#1565c0";

/** Posizioni: scheda a sinistra, breadboard a destra. */
const UNO = { x: 0, y: 100 };
const BB = { x: 480, y: 0 };
const Y_RIGA: Record<string, number> = { Ap: 20, Am: 40, a: 80, b: 100, c: 120, d: 140, e: 160, f: 220, g: 240, h: 260, i: 280, j: 300, Bp: 340, Bm: 360 };
/** Foro della breadboard in coordinate del foglio ("e14", "Am3"…). */
function foro(nome: string): { x: number; y: number } {
  const m = /^(Ap|Am|Bp|Bm|[a-j])(\d+)$/.exec(nome)!;
  return { x: BB.x + 40 + (Number(m[2]) - 1) * 20, y: BB.y + Y_RIGA[m[1]] };
}

function costruttore() {
  const componenti: ComponenteSchema[] = [];
  const fili: Filo[] = [];
  const conta = new Map<string, number>();
  const api = {
    posa(tipo: string, x: number, y: number, extra: Partial<ComponenteSchema> = {}): string {
      const v = vocePerTipo(libreria, tipo);
      if (!v) throw new Error(`Tipo sconosciuto ${tipo}`);
      if (x % 20 || y % 20) throw new Error(`${tipo} fuori griglia (${x}, ${y})`);
      const n = (conta.get(tipo) ?? 0) + 1;
      conta.set(tipo, n);
      const id = `${tipo}-${n}`;
      componenti.push({ id, tipo, etichetta: v.sigla ? `${v.sigla}${n}` : "", x, y, larghezza: v.larghezza, altezza: v.altezza, ...extra });
      return id;
    },
    /** LED con l'anodo nel foro indicato (il catodo cade due colonne più a destra). */
    led(colore: string, anodo: string) {
      const f = foro(anodo);
      return api.posa(`led-${colore}`, f.x, f.y - 80);
    },
    /** Resistenza col primo piedino nel foro indicato (il secondo 4 colonne più a destra). */
    resistenza(primo: string, ohm = 220) {
      const f = foro(primo);
      return api.posa("resistenza", f.x, f.y - 20, { valore: ohm });
    },
    /** Pulsante con il piedino 1a nel foro (va a cavallo del solco: 1a in riga e). */
    pulsante(primo: string) {
      const f = foro(primo);
      return api.posa("pulsante", f.x, f.y);
    },
    /** Potenziometro con il piedino 1 nel foro (cursore e piedino 2 nelle colonne seguenti). */
    potenziometro(primo: string) {
      const f = foro(primo);
      return api.posa("potenziometro", f.x, f.y - 40);
    },
    /** Cavetto: "U:D13" (pin della scheda) oppure "b10" (foro della breadboard) o "id:morsetto". */
    filo(da: string, a: string, colore?: string) {
      const estremo = (s: string) => {
        if (s.startsWith("U:")) return { componente: "arduino-uno-1", morsetto: s.slice(2) };
        if (/^(Ap|Am|Bp|Bm|[a-j])\d+$/.test(s)) return { componente: "breadboard-1", morsetto: s };
        const [c, m] = s.split(":");
        return { componente: c, morsetto: m };
      };
      const e1 = estremo(da);
      const e2 = estremo(a);
      for (const e of [e1, e2]) {
        const c = componenti.find((x) => x.id === e.componente);
        if (!c || !vocePerTipo(libreria, c.tipo)?.morsetti.some((m) => m.id === e.morsetto)) throw new Error(`Morsetto inesistente ${e.componente}:${e.morsetto}`);
      }
      fili.push({ id: `filo-${fili.length + 1}`, da: e1, a: e2, colore: colore ?? colorePropostoFilo(e1, e2) });
    },
    schema(codice: string): Schema {
      return { componenti, fili, codice };
    },
  };
  api.posa("arduino-uno", UNO.x, UNO.y);
  api.posa("breadboard", BB.x, BB.y);
  return api;
}

function scrivi(file: string, schema: Schema) {
  writeFileSync(new URL(`../esempi/${file}`, import.meta.url), serializzaProgetto({ modulo: "arduino", schema }, "0.1.0"));
  console.log(`scritto esempi/${file}: ${schema.componenti.length} componenti, ${schema.fili.length} cavetti`);
}

/** Alimentazione della breadboard: 5V sulla linea + e GND sulla linea − in alto. */
function alimenta(b: ReturnType<typeof costruttore>) {
  b.filo("U:5V", "Ap1");
  b.filo("U:GND1", "Am2");
}

// 1. Blink con un LED esterno
{
  const b = costruttore();
  b.resistenza("a10");
  b.led("rosso", "e14");
  b.filo("U:D13", "b10", ARANCIONE);
  b.filo("c16", "Am16");
  b.filo("U:GND3", "Am1");
  scrivi(
    "arduino-blink.elab",
    b.schema(`// Blink: il LED esterno sul pin 13 (e il LED «L» della scheda) lampeggiano.
// Collegamento: pin 13 → resistenza 220 Ω → LED → GND.

const int LED = 13;

void setup() {
  pinMode(LED, OUTPUT);
}

void loop() {
  digitalWrite(LED, HIGH);   // acceso
  delay(500);
  digitalWrite(LED, LOW);    // spento
  delay(500);
}
`),
  );
}

// 2. Semaforo con tre LED
{
  const b = costruttore();
  const leds: [string, number, string][] = [
    ["rosso", 5, "U:D12"],
    ["giallo", 13, "U:D11"],
    ["verde", 21, "U:D10"],
  ];
  for (const [colore, col, pin] of leds) {
    b.resistenza(`a${col}`);
    b.led(colore, `e${col + 4}`);
    b.filo(pin, `b${col}`, colore === "verde" ? "#2e7d32" : colore === "giallo" ? GIALLO : ARANCIONE);
    b.filo(`c${col + 6}`, `Am${col + 6}`);
  }
  b.filo("U:GND3", "Am1");
  scrivi(
    "arduino-semaforo.elab",
    b.schema(`// Semaforo: verde 5 s, giallo 2 s, rosso 5 s, e si ricomincia.

const int ROSSO = 12;
const int GIALLO = 11;
const int VERDE = 10;

void setup() {
  pinMode(ROSSO, OUTPUT);
  pinMode(GIALLO, OUTPUT);
  pinMode(VERDE, OUTPUT);
}

// Accende solo la luce indicata e aspetta.
void luce(int pin, int millisecondi) {
  digitalWrite(ROSSO, LOW);
  digitalWrite(GIALLO, LOW);
  digitalWrite(VERDE, LOW);
  digitalWrite(pin, HIGH);
  delay(millisecondi);
}

void loop() {
  luce(VERDE, 5000);
  luce(GIALLO, 2000);
  luce(ROSSO, 5000);
}
`),
  );
}

// 3. Pulsante che accende un LED
{
  const b = costruttore();
  b.resistenza("a5");
  b.led("verde", "e9");
  b.filo("U:D13", "b5", ARANCIONE);
  b.filo("c11", "Am11");
  b.pulsante("e20");
  b.filo("U:D2", "a20", BLU);
  b.filo("a22", "Am22");
  b.filo("U:GND3", "Am1");
  scrivi(
    "arduino-pulsante.elab",
    b.schema(`// Pulsante: tienilo premuto e il LED si accende.
// Il pulsante va dal pin 2 a GND; INPUT_PULLUP tiene il pin a HIGH quando
// il pulsante è rilasciato, quindi premuto si legge LOW.

const int PULSANTE = 2;
const int LED = 13;

void setup() {
  pinMode(PULSANTE, INPUT_PULLUP);
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  if (digitalRead(PULSANTE) == LOW) {
    digitalWrite(LED, HIGH);
  } else {
    digitalWrite(LED, LOW);
  }
}
`),
  );
}

// 4. Potenziometro → luminosità del LED
{
  const b = costruttore();
  alimenta(b);
  b.resistenza("a5");
  b.led("giallo", "e9");
  b.filo("U:D9", "b5", ARANCIONE);
  b.filo("c11", "Am11");
  b.potenziometro("e20");
  b.filo("a20", "Am20");
  b.filo("a22", "Ap22");
  b.filo("a21", "U:A0", BLU);
  scrivi(
    "arduino-potenziometro.elab",
    b.schema(`// Il potenziometro regola la luminosità del LED (PWM sul pin 9)
// e il valore letto compare sul monitor seriale.

const int LED = 9;   // pin con la tilde ~: può fare analogWrite

void setup() {
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int valore = analogRead(A0);          // 0 … 1023
  int luminosita = map(valore, 0, 1023, 0, 255);
  analogWrite(LED, luminosita);         // 0 … 255
  Serial.print("Potenziometro: ");
  Serial.print(valore);
  Serial.print("  luminosita: ");
  Serial.println(luminosita);
  delay(200);
}
`),
  );
}

// 5. Servo comandato dal potenziometro
{
  const b = costruttore();
  alimenta(b);
  b.potenziometro("e20");
  b.filo("a20", "Am20");
  b.filo("a22", "Ap22");
  b.filo("a21", "U:A0", BLU);
  b.posa("servo", 620, 440);
  b.filo("servo-1:GND", "Bm1");
  b.filo("servo-1:5V", "Bp2");
  b.filo("servo-1:SIG", "U:D9", ARANCIONE);
  b.filo("Ap30", "Bp30");
  b.filo("Am29", "Bm29");
  scrivi(
    "arduino-servo.elab",
    b.schema(`// Il servo segue la manopola del potenziometro (0 … 180 gradi).
#include <Servo.h>

Servo motore;

void setup() {
  motore.attach(9);
}

void loop() {
  int valore = analogRead(A0);
  int angolo = map(valore, 0, 1023, 0, 180);
  motore.write(angolo);
  delay(20);
}
`),
  );
}

// 6. Display LCD 16x2
{
  const b = costruttore();
  alimenta(b);
  b.posa("lcd", 520, 440);
  b.resistenza("a25");
  const L = "lcd-1";
  b.filo(`${L}:VSS`, "Bm3");
  b.filo(`${L}:RW`, "Bm8");
  b.filo(`${L}:K`, "Bm14");
  b.filo(`${L}:VDD`, "Bp4");
  b.filo(`${L}:A`, "b29");
  b.filo("Ap25", "c25");
  b.filo(`${L}:RS`, "U:D12", ARANCIONE);
  b.filo(`${L}:E`, "U:D11", GIALLO);
  b.filo(`${L}:D4`, "U:D5", BLU);
  b.filo(`${L}:D5`, "U:D4", BLU);
  b.filo(`${L}:D6`, "U:D3", BLU);
  b.filo(`${L}:D7`, "U:D2", BLU);
  b.filo("Ap30", "Bp30");
  b.filo("Am29", "Bm29");
  scrivi(
    "arduino-lcd.elab",
    b.schema(`// Display LCD 16x2: scrive un saluto e conta i secondi.
#include <LiquidCrystal.h>

// LiquidCrystal(rs, en, d4, d5, d6, d7)
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);

void setup() {
  lcd.begin(16, 2);
  lcd.print("Ciao, classe!");
}

void loop() {
  lcd.setCursor(0, 1);       // colonna 0, seconda riga
  lcd.print("Secondi: ");
  lcd.print(millis() / 1000);
  delay(200);
}
`),
  );
}

// 7. Sensore a ultrasuoni: distanza sul monitor seriale e allarme
{
  const b = costruttore();
  alimenta(b);
  b.posa("ultrasuoni", 700, 440);
  b.filo("ultrasuoni-1:VCC", "Bp10");
  b.filo("ultrasuoni-1:GND", "Bm14");
  b.filo("ultrasuoni-1:TRIG", "U:D7", GIALLO);
  b.filo("ultrasuoni-1:ECHO", "U:D8", BLU);
  b.filo("Ap30", "Bp30");
  b.filo("Am29", "Bm29");
  b.resistenza("a5");
  b.led("rosso", "e9");
  b.filo("U:D13", "b5", ARANCIONE);
  b.filo("c11", "Am11");
  scrivi(
    "arduino-ultrasuoni.elab",
    b.schema(`// Sensore a ultrasuoni: misura la distanza e accende il LED
// se un ostacolo è più vicino di 20 cm.

const int TRIG = 7;
const int ECHO = 8;
const int LED = 13;

void setup() {
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  // impulso di 10 microsecondi sul pin TRIG
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);

  long durata = pulseIn(ECHO, HIGH);   // microsecondi di andata e ritorno
  long distanza = durata / 58;         // centimetri

  Serial.print("Distanza: ");
  Serial.print(distanza);
  Serial.println(" cm");

  digitalWrite(LED, distanza < 20);
  delay(300);
}
`),
  );
}

// 8. Termometro con il sensore di temperatura
{
  const b = costruttore();
  alimenta(b);
  // Sensore con i piedini nei fori e20 (+5V), e21 (uscita), e22 (GND).
  const f = foro("e20");
  b.posa("tmp36", f.x, f.y - 60);
  b.filo("a20", "Ap20");
  b.filo("a22", "Am22");
  b.filo("b21", "U:A0", ARANCIONE);
  scrivi(
    "arduino-temperatura.elab",
    b.schema(`// Termometro: legge il sensore di temperatura, scrive i gradi sul
// monitor seriale e accende il LED «L» (pin 13) sopra i 30 °C.
// Il sensore dà 0,5 V a 0 °C e 10 mV in più per ogni grado.

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  long millivolt = analogRead(A0);       // 0…1023
  millivolt = millivolt * 5000 / 1023;   // in millivolt (0…5000)
  int gradi = (millivolt - 500 + 5) / 10;   // +5 per arrotondare al grado

  Serial.print("Temperatura: ");
  Serial.print(gradi);
  Serial.println(" C");

  digitalWrite(LED_BUILTIN, gradi > 30);
  delay(500);
}
`),
  );
}

// 9. Conteggio da 0 a 9 con il display a 7 segmenti
{
  const b = costruttore();
  alimenta(b);
  // Display a cavallo del solco: in alto g f COM a b (fori d14…d18), in basso e d COM c dp (g14…g18).
  const f = foro("d14");
  b.posa("display-sette-segmenti", f.x, f.y);
  // Una resistenza da 220 Ω per ogni segmento, fra la colonna del segmento e una colonna libera.
  b.resistenza("a10"); // g: colonne 10–14
  b.resistenza("c11"); // f: colonne 11–15
  b.resistenza("a17"); // a: colonne 17–21
  b.resistenza("c18"); // b: colonne 18–22
  b.resistenza("j10"); // e: colonne 10–14
  b.resistenza("h11"); // d: colonne 11–15
  b.resistenza("j17"); // c: colonne 17–21
  // Catodo comune al GND.
  b.filo("a16", "Am16");
  // Pin 2…8 verso i segmenti a…g.
  b.filo("U:D2", "e21", ARANCIONE); // a
  b.filo("U:D3", "e22", GIALLO); // b
  b.filo("U:D4", "f21", BLU); // c
  b.filo("U:D5", "f11", ARANCIONE); // d
  b.filo("U:D6", "f10", GIALLO); // e
  b.filo("U:D7", "e11", BLU); // f
  b.filo("U:D8", "e10", ARANCIONE); // g
  scrivi(
    "arduino-7-segmenti.elab",
    b.schema(`// Conta da 0 a 9 sul display a 7 segmenti (catodo comune al GND).
// I segmenti a, b, c, d, e, f, g sono collegati ai pin 2…8,
// ognuno con la sua resistenza da 220 Ω.
//
//    aaa
//   f   b
//    ggg
//   e   c
//    ddd

const int PRIMO_PIN = 2;

// Per ogni cifra, i segmenti da accendere: un bit per segmento
// (bit 0 = a, bit 1 = b, … bit 6 = g). Esempio: 1 → b e c → 2 + 4 = 6.
byte cifre[10] = {63, 6, 91, 79, 102, 109, 125, 7, 127, 111};

void setup() {
  for (int s = 0; s < 7; s++) {
    pinMode(PRIMO_PIN + s, OUTPUT);
  }
  Serial.begin(9600);
}

void mostra(int numero) {
  for (int s = 0; s < 7; s++) {
    int acceso = (cifre[numero] >> s) & 1;
    digitalWrite(PRIMO_PIN + s, acceso);
  }
}

void loop() {
  for (int n = 0; n <= 9; n++) {
    mostra(n);
    Serial.println(n);
    delay(1000);
  }
}
`),
  );
}

// 10. Misure con il multimetro
{
  const b = costruttore();
  b.resistenza("a8"); // colonne 8–12
  b.led("rosso", "e14");
  b.filo("U:D13", "b8", ARANCIONE);
  b.filo("c16", "Am16");
  b.filo("U:GND3", "Am1");
  // XMM1 voltmetro ai capi del LED; XMM2 amperometro in serie fra resistenza e LED.
  b.posa("multimetro", 620, -200);
  b.posa("multimetro", 800, -200, { parametri: { funzione: "A" } });
  b.filo("multimetro-1:V", "d14", "#d32f2f");
  b.filo("multimetro-1:COM", "d16", "#212121");
  b.filo("multimetro-2:A", "c12", "#d32f2f");
  b.filo("multimetro-2:COM", "b14", "#212121");
  scrivi(
    "arduino-multimetro.elab",
    b.schema(`// Misure con il multimetro: il LED sul pin 13 resta acceso.
// XMM1 (voltmetro, in parallelo al LED) misura la tensione sul LED;
// XMM2 (amperometro, in serie) misura la corrente che passa nel circuito.
// Legge di Ohm sulla resistenza: I = (5 V − tensione del LED) / 220 Ω.

void setup() {
  pinMode(13, OUTPUT);
  digitalWrite(13, HIGH);
}

void loop() {
}
`),
  );
}
