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
      // Sigle numerate per lettera (D1, D2… anche fra LED di colori diversi), come fa l'editor.
      const k = (conta.get(`sigla:${v.sigla}`) ?? 0) + 1;
      conta.set(`sigla:${v.sigla}`, k);
      componenti.push({ id, tipo, etichetta: v.sigla ? `${v.sigla}${k}` : "", x, y, larghezza: v.larghezza, altezza: v.altezza, ...extra });
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

// 11. Allarme con il sensore di movimento
{
  const b = costruttore();
  alimenta(b);
  // Sensore con i piedini nei fori e20 (VCC), e21 (OUT), e22 (GND).
  const f = foro("e20");
  b.posa("sensore-pir", f.x - 20, f.y - 80);
  b.filo("a20", "Ap20");
  b.filo("a22", "Am22");
  b.filo("b21", "U:D2", ARANCIONE);
  scrivi(
    "arduino-movimento.elab",
    b.schema(`// Allarme: quando il sensore PIR vede un movimento si accende il LED «L»
// (pin 13) e il monitor seriale lo scrive, una volta sola per ogni movimento.

const int SENSORE = 2;
int prima = LOW;   // stato letto al giro precedente

void setup() {
  pinMode(SENSORE, INPUT);
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(9600);
  Serial.println("Allarme pronto");
}

void loop() {
  int ora = digitalRead(SENSORE);
  digitalWrite(LED_BUILTIN, ora);
  if (ora == HIGH && prima == LOW) {
    Serial.println("Movimento rilevato!");
  }
  if (ora == LOW && prima == HIGH) {
    Serial.println("Nessun movimento");
  }
  prima = ora;
  delay(100);
}
`),
  );
}

// 12. Alimentatore da banco e LED (legge di Ohm), come in Tinkercad
{
  const b = costruttore();
  // Alimentatore sopra la breadboard: + sulla linea rossa, − sulla linea blu in alto.
  b.posa("alimentatore", 560, -180, { parametri: { tensione: 9, correnteMax: 1 } });
  b.filo("alimentatore-1:+", "Ap5", "#d32f2f");
  b.filo("alimentatore-1:-", "Am7", "#212121");
  b.resistenza("a10", 470); // colonne 10–14
  b.led("rosso", "e14");
  b.filo("Ap10", "b10", "#d32f2f");
  b.filo("c16", "Am16", "#212121");
  // Voltmetro ai capi del LED.
  b.posa("multimetro", 800, -200);
  b.filo("multimetro-1:V", "d14", "#d32f2f");
  b.filo("multimetro-1:COM", "d16", "#212121");
  scrivi(
    "arduino-alimentatore.elab",
    b.schema(`// Alimentatore da banco e LED: in questo esempio la scheda non fa niente,
// il LED è alimentato dall'alimentatore PS1 attraverso la resistenza da 470 Ω.
// Il display rosso di PS1 indica la tensione, quello verde la corrente.
// Legge di Ohm: I = (V − tensione del LED) / R.

void setup() {
}

void loop() {
}
`),
  );
}

// 13. Voltmetro con Arduino: l'alimentatore su A0 attraverso un partitore
{
  const b = costruttore();
  b.posa("alimentatore", 520, -180, { parametri: { tensione: 6, correnteMax: 0.1 } });
  b.resistenza("a20", 10000); // R1: colonne 20–24
  b.resistenza("c24", 10000); // R2: colonne 24–28
  b.filo("alimentatore-1:+", "b20", "#d32f2f");
  b.filo("alimentatore-1:-", "Am12", "#212121");
  b.filo("d28", "Am28", "#212121");
  b.filo("U:GND1", "Am2", "#212121");
  b.filo("d24", "U:A0", GIALLO);
  scrivi(
    "arduino-voltmetro.elab",
    b.schema(`// Voltmetro con Arduino: misura la tensione dell'alimentatore PS1.
// Un pin analogico legge al massimo 5 V, quindi la tensione passa da un
// partitore con due resistenze uguali (R1 = R2 = 10 kΩ): su A0 arriva metà
// della tensione. Il programma la ricalcola e la scrive sul monitor seriale.
// Il − dell'alimentatore va al GND della scheda: le tensioni si misurano
// sempre rispetto a un riferimento comune.

const float R1 = 10000.0;
const float R2 = 10000.0;

void setup() {
  Serial.begin(9600);
  Serial.println("Voltmetro pronto (massimo 10 V)");
}

void loop() {
  int lettura = analogRead(A0);              // 0…1023
  float vPin = lettura * 5.0 / 1023.0;       // tensione su A0
  float v = vPin * (R1 + R2) / R2;           // tensione dell'alimentatore
  if (lettura >= 1023) {
    Serial.println("Fuori scala: oltre 10 V!");
  } else {
    Serial.print("Tensione: ");
    Serial.print(v);
    Serial.println(" V");
  }
  delay(500);
}
`),
  );
}

// 14. Motorino comandato con il transistor, alimentato a parte (con il diodo di ricircolo)
{
  const b = costruttore();
  alimenta(b); // 5V e GND della scheda sulle linee in alto (per il potenziometro)
  // Potenziometro: piedini in e5, e6, e7.
  b.potenziometro("e5");
  b.filo("a5", "Am5");
  b.filo("a7", "Ap7");
  b.filo("a6", "U:A0", BLU);
  // Transistor con E, B, C nei fori e20, e21, e22; resistenza di base da 1 kΩ fra le colonne 17 e 21.
  const t = foro("e20");
  b.posa("transistor-npn", t.x, t.y - 60);
  b.resistenza("a17", 1000);
  b.filo("U:D9", "b17", ARANCIONE);
  b.filo("a20", "Am20"); // emettitore a GND
  // Diodo di ricircolo: anodo sul collettore (colonna 22), catodo sul + del motore (colonna 26).
  b.posa("diodo", foro("b22").x, foro("b22").y - 20);
  // Alimentatore da 9 V: + al motore e al catodo del diodo, − al GND comune.
  b.posa("alimentatore", 600, -200, { parametri: { tensione: 9, correnteMax: 1 } });
  b.posa("motore-dc", 880, -140);
  b.filo("alimentatore-1:+", "a26", "#d32f2f");
  b.filo("motore-dc-1:+", "c26", "#d32f2f");
  b.filo("motore-dc-1:-", "c22", "#212121");
  b.filo("alimentatore-1:-", "Am12", "#212121");
  scrivi(
    "arduino-motore-transistor.elab",
    b.schema(`// Motorino comandato con un transistor e alimentato a parte.
// Un pin dell'Arduino dà al massimo 20–40 mA: il motorino ne vuole molti di
// più, quindi lo alimenta l'alimentatore PS1 (9 V) e il pin 9 comanda solo
// la base del transistor Q1 attraverso la resistenza da 1 kΩ.
// Il diodo D1 (di ricircolo) protegge il transistor quando il motore si ferma.
// Il − dell'alimentatore è unito al GND della scheda (riferimento comune).
// Il potenziometro su A0 regola la velocità (PWM).

const int MOTORE = 9;   // pin con la tilde ~: può fare analogWrite

void setup() {
  pinMode(MOTORE, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int pot = analogRead(A0);       // 0…1023
  int velocita = pot / 4;         // 0…255
  analogWrite(MOTORE, velocita);
  Serial.print("Velocita' (0-255): ");
  Serial.println(velocita);
  delay(300);
}
`),
  );
}

// 15. Lampadina da 12 V comandata dal modulo relè, con un pulsante che la accende e la spegne
{
  const b = costruttore();
  alimenta(b); // 5V sulla linea +, GND sulla linea − in alto
  // Pulsante a cavallo del solco (colonne 10 e 12): un lato al pin 2, l'altro a GND.
  b.pulsante("e10");
  b.filo("a10", "U:D2", ARANCIONE);
  b.filo("a12", "Am12");
  // Modulo relè sopra la breadboard: VCC e GND dalle linee, IN dal pin 7.
  b.posa("modulo-rele", 560, -160);
  b.filo("modulo-rele-1:VCC", "Ap22", "#d32f2f");
  b.filo("modulo-rele-1:GND", "Am23", "#212121");
  b.filo("modulo-rele-1:IN", "U:D7", GIALLO);
  // Circuito della lampadina, separato dalla scheda: alimentatore 12 V → COM, NO → lampadina → −.
  b.posa("alimentatore", 780, -320, { parametri: { tensione: 12, correnteMax: 1 } });
  b.posa("lampadina", 860, -140);
  b.filo("alimentatore-1:+", "modulo-rele-1:COM", "#d32f2f");
  b.filo("modulo-rele-1:NO", "lampadina-1:1", "#f9a825");
  b.filo("lampadina-1:2", "alimentatore-1:-", "#212121");
  scrivi(
    "arduino-rele-lampadina.elab",
    b.schema(`// Lampadina da 12 V comandata da un relè.
// Il pin 7 comanda il modulo relè K1: con HIGH il relè scatta e chiude il
// contatto COM-NO, che accende la lampadina H1 alimentata da PS1 (12 V).
// Il circuito della lampadina è separato da quello dell'Arduino: il relè
// isola le due parti, come negli impianti veri.
// Ogni pressione del pulsante sul pin 2 accende o spegne la lampadina.

const int PULSANTE = 2;
const int RELE = 7;
bool accesa = false;
int prima = HIGH;   // con INPUT_PULLUP il pulsante a riposo legge HIGH

void setup() {
  pinMode(PULSANTE, INPUT_PULLUP);
  pinMode(RELE, OUTPUT);
  Serial.begin(9600);
  Serial.println("Premi il pulsante");
}

void loop() {
  int ora = digitalRead(PULSANTE);
  if (ora == LOW && prima == HIGH) {   // fronte: il pulsante è appena stato premuto
    accesa = !accesa;
    digitalWrite(RELE, accesa ? HIGH : LOW);
    Serial.println(accesa ? "Lampadina accesa" : "Lampadina spenta");
  }
  prima = ora;
  delay(20);
}
`),
  );
}

// 16. Lampione automatico con la fotoresistenza e il plotter seriale
{
  const b = costruttore();
  alimenta(b);
  // Fotoresistenza in e5–e6 verso il 5V, resistenza da 10 kΩ (a6–a10) verso GND: partitore su A0.
  const f = foro("e5");
  b.posa("fotoresistenza", f.x, f.y - 40);
  b.resistenza("a6", 10000);
  b.filo("b5", "Ap5");
  b.filo("b10", "Am10");
  b.filo("b6", "U:A0", BLU);
  // LED con la sua resistenza sul pin 9.
  b.resistenza("a20");
  b.led("giallo", "e24");
  b.filo("U:D9", "b20", ARANCIONE);
  b.filo("c26", "Am26");
  scrivi(
    "arduino-lampione.elab",
    b.schema(`// Lampione automatico: quando fa buio il LED si accende da solo.
// La fotoresistenza e la resistenza da 10 kΩ formano un partitore: con tanta
// luce su A0 arrivano quasi 5 V, al buio poca tensione.
// Il programma scrive «Luce:valore,Soglia:valore»: apri il Grafico del monitor
// seriale per vedere le due linee (plotter seriale).

const int LED = 9;
const int SOGLIA = 500;   // sotto questo valore è «buio»

void setup() {
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int luce = analogRead(A0);          // 0 (buio) … 1023 (tanta luce)
  if (luce < SOGLIA) {
    digitalWrite(LED, HIGH);          // buio: lampione acceso
  } else {
    digitalWrite(LED, LOW);
  }
  Serial.print("Luce:");
  Serial.print(luce);
  Serial.print(",Soglia:");
  Serial.println(SOGLIA);
  delay(100);
}
`),
  );
}

// 17. Allarme antifurto con il sensore di inclinazione e il buzzer
{
  const b = costruttore();
  alimenta(b);
  const f = foro("e5");
  b.posa("sensore-inclinazione", f.x, f.y - 40); // piedini in e5 ed e6
  b.filo("b5", "Am5");
  b.filo("b6", "U:D2", ARANCIONE);
  const z = foro("e14");
  b.posa("buzzer", z.x, z.y - 40); // + in e14, − in e16
  b.filo("U:D8", "b14", GIALLO);
  b.filo("c16", "Am16");
  scrivi(
    "arduino-inclinazione.elab",
    b.schema(`// Antifurto: se qualcuno sposta l'oggetto, il sensore di inclinazione si
// apre e il buzzer suona. Il sensore è collegato come un pulsante, con la
// resistenza di pull-up interna: dritto (chiuso) legge LOW, inclinato HIGH.

const int SENSORE = 2;
const int BUZZER = 8;

void setup() {
  pinMode(SENSORE, INPUT_PULLUP);
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(9600);
  Serial.println("Antifurto inserito");
}

void loop() {
  if (digitalRead(SENSORE) == HIGH) {
    tone(BUZZER, 2000);              // allarme!
    digitalWrite(LED_BUILTIN, HIGH);
    Serial.println("ALLARME: oggetto spostato!");
    delay(500);
  } else {
    noTone(BUZZER);
    digitalWrite(LED_BUILTIN, LOW);
  }
  delay(50);
}
`),
  );
}

// 18. Sensore di forza: la pressione regola la luminosità del LED (e il plotter la disegna)
{
  const b = costruttore();
  alimenta(b);
  const f = foro("e5");
  b.posa("sensore-forza", f.x, f.y - 80); // piedini in e5 ed e7
  b.resistenza("a7", 10000); // a7–a11 verso GND
  b.filo("b5", "Ap5");
  b.filo("b11", "Am11");
  b.filo("c7", "U:A0", BLU);
  b.resistenza("a20");
  b.led("rosso", "e24");
  b.filo("U:D9", "b20", ARANCIONE);
  b.filo("c26", "Am26");
  scrivi(
    "arduino-forza.elab",
    b.schema(`// Sensore di forza (FSR): più premi, più il LED è luminoso.
// L'FSR e la resistenza da 10 kΩ formano un partitore su A0: senza pressione
// A0 legge quasi 0, premendo a fondo quasi 1023.
// map() trasforma 0…1023 in 0…255 per analogWrite.

const int LED = 9;

void setup() {
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int forza = analogRead(A0);
  int luminosita = map(forza, 0, 1023, 0, 255);
  analogWrite(LED, luminosita);
  Serial.print("Forza:");
  Serial.println(forza);
  delay(100);
}
`),
  );
}

// 19. Annaffiatoio automatico: sensore di umidità, relè e pompa (motorino) a pile
{
  const b = costruttore();
  alimenta(b);
  // Sonda sopra la breadboard: VCC, GND, SIG dalle linee e da A1.
  b.posa("sensore-umidita", 520, -200);
  b.filo("sensore-umidita-1:VCC", "Ap6", "#d32f2f");
  b.filo("sensore-umidita-1:GND", "Am7", "#212121");
  b.filo("sensore-umidita-1:SIG", "U:A1", BLU);
  // Modulo relè comandato dal pin 7; la pompa è un motorino alimentato dal portapile.
  b.posa("modulo-rele", 700, -160);
  b.filo("modulo-rele-1:VCC", "Ap20", "#d32f2f");
  b.filo("modulo-rele-1:GND", "Am21", "#212121");
  b.filo("modulo-rele-1:IN", "U:D7", GIALLO);
  b.posa("portapile-4aa", 900, -320);
  b.posa("motore-dc", 940, -160);
  b.filo("portapile-4aa-1:+", "modulo-rele-1:COM", "#d32f2f");
  b.filo("modulo-rele-1:NO", "motore-dc-1:+", "#f9a825");
  b.filo("motore-dc-1:-", "portapile-4aa-1:-", "#212121");
  scrivi(
    "arduino-annaffiatoio.elab",
    b.schema(`// Annaffiatoio automatico: quando il terreno è secco, il relè accende la
// pompa (il motorino M1, alimentato dal portapile da 6 V); quando il terreno
// è abbastanza bagnato la spegne. Due soglie diverse (isteresi) evitano che
// la pompa si accenda e si spenga di continuo vicino al valore limite.

const int SONDA = A1;
const int POMPA = 7;
const int SECCO = 300;     // sotto: annaffia
const int BAGNATO = 600;   // sopra: smetti
bool pompaAccesa = false;

void setup() {
  pinMode(POMPA, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int umidita = analogRead(SONDA);
  if (umidita < SECCO) {
    pompaAccesa = true;
  }
  if (umidita > BAGNATO) {
    pompaAccesa = false;
  }
  digitalWrite(POMPA, pompaAccesa ? HIGH : LOW);
  Serial.print("Umidita:");
  Serial.print(umidita);
  Serial.print(",Secco:");
  Serial.print(SECCO);
  Serial.print(",Bagnato:");
  Serial.println(BAGNATO);
  delay(200);
}
`),
  );
}

// 20. Rilevatore di gas: soglia, LED rosso e buzzer
{
  const b = costruttore();
  alimenta(b);
  const g = foro("e20");
  b.posa("sensore-gas", g.x - 20, g.y - 80); // VCC e20, GND e21, AO e22
  b.filo("a20", "Ap20");
  b.filo("a21", "Am21");
  b.filo("b22", "U:A2", BLU);
  b.resistenza("a5");
  b.led("rosso", "e9");
  b.filo("U:D10", "b5", ARANCIONE);
  b.filo("c11", "Am11");
  const z = foro("e30");
  b.posa("buzzer", z.x - 40, z.y - 40); // + in e28, − in e30
  b.filo("U:D8", "b28", GIALLO);
  b.filo("c30", "Am30");
  scrivi(
    "arduino-gas.elab",
    b.schema(`// Rilevatore di gas: in aria pulita il sensore dà circa 0,4 V (A2 ≈ 80);
// con il gas la tensione sale. Sopra la soglia si accendono il LED rosso
// e il buzzer.

const int SENSORE = A2;
const int LED = 10;
const int BUZZER = 8;
const int SOGLIA = 400;

void setup() {
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
  Serial.println("Rilevatore di gas pronto");
}

void loop() {
  int gas = analogRead(SENSORE);
  Serial.print("Gas:");
  Serial.print(gas);
  Serial.print(",Soglia:");
  Serial.println(SOGLIA);
  if (gas > SOGLIA) {
    digitalWrite(LED, HIGH);
    tone(BUZZER, 1500);
  } else {
    digitalWrite(LED, LOW);
    noTone(BUZZER);
  }
  delay(200);
}
`),
  );
}

// 21. Motore avanti e indietro con il ponte H L293D
{
  const b = costruttore();
  alimenta(b);
  b.filo("Am30", "Bm30"); // GND anche sulla linea blu in basso
  // L293D a cavallo del solco: piedini 16…9 in e10…e17, piedini 1…8 in f10…f17.
  const p = foro("e10");
  b.posa("l293d", p.x, p.y);
  b.filo("a10", "Ap10", "#d32f2f"); // VSS (16) = 5 V
  b.filo("a13", "Am13"); // GND (13)
  b.filo("j13", "Bm13"); // GND (4)
  b.filo("U:D9", "j10", ARANCIONE); // EN1,2 (1): PWM per la velocità
  b.filo("U:D8", "j11", GIALLO); // IN1 (2)
  b.filo("U:D7", "j16", BLU); // IN2 (7)
  // Motore fra OUT1 (3) e OUT2 (6); VS (8) dall'alimentatore a 9 V.
  b.posa("motore-dc", 700, 440);
  b.filo("i12", "motore-dc-1:+", "#d32f2f");
  b.filo("i15", "motore-dc-1:-", "#212121");
  b.posa("alimentatore", 1200, 180, { parametri: { tensione: 9, correnteMax: 1 } });
  b.filo("alimentatore-1:+", "i17", "#d32f2f");
  b.filo("alimentatore-1:-", "Bm24", "#212121");
  scrivi(
    "arduino-ponte-h.elab",
    b.schema(`// Motore avanti e indietro con il ponte H L293D.
// IN1 e IN2 decidono il verso: (HIGH, LOW) avanti, (LOW, HIGH) indietro,
// uguali fermo. EN1,2 con analogWrite regola la velocità (0…255).
// Il motore è alimentato da PS1 (9 V) sul piedino VS; la logica del L293D
// prende i 5 V dell'Arduino (VSS). I GND sono tutti in comune.

const int EN = 9;
const int IN1 = 8;
const int IN2 = 7;

void motore(int velocita, int verso) {
  if (verso > 0) {
    digitalWrite(IN1, HIGH);
    digitalWrite(IN2, LOW);
  } else if (verso < 0) {
    digitalWrite(IN1, LOW);
    digitalWrite(IN2, HIGH);
  } else {
    digitalWrite(IN1, LOW);
    digitalWrite(IN2, LOW);
  }
  analogWrite(EN, velocita);
}

void setup() {
  pinMode(EN, OUTPUT);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  Serial.println("Avanti veloce");
  motore(255, 1);
  delay(2000);
  Serial.println("Avanti piano");
  motore(120, 1);
  delay(2000);
  Serial.println("Fermo");
  motore(0, 0);
  delay(1000);
  Serial.println("Indietro");
  motore(255, -1);
  delay(2000);
  Serial.println("Fermo");
  motore(0, 0);
  delay(1000);
}
`),
  );
}
