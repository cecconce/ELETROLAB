// Test dell'interprete del linguaggio Arduino.
import { describe, expect, it } from "vitest";
import { analizzaSketch, ErroreArduino, nomePin, preparaSketch, type Hardware } from "./linguaggio";

/** Scheda finta che registra tutto quello che fa il programma. */
function schedaFinta(letture: Record<string, number> = {}) {
  const registro: string[] = [];
  const pin: Record<string, number> = {};
  const modi: Record<string, string> = {};
  let seriale = "";
  const ingresso: number[] = [];
  const lcd: Record<string, string[]> = {};
  const servo: Record<string, number> = {};
  const toni: Record<string, number> = {};
  const hw: Hardware = {
    pinMode: (p, m) => void (modi[p] = m),
    digitalWrite: (p, v) => {
      pin[p] = v;
      registro.push(`${p}=${v}`);
    },
    digitalRead: (p) => letture[p] ?? 0,
    analogRead: (p) => letture[p] ?? 0,
    analogWrite: (p, v) => void (pin[p] = v),
    tone: (p, f) => void (toni[p] = f),
    noTone: (p) => void delete toni[p],
    serialScrivi: (t) => void (seriale += t),
    serialLeggi: () => ingresso.shift() ?? -1,
    serialDisponibili: () => ingresso.length,
    servo: (p, a) => void (servo[p] = a),
    lcd: (nome, righe) => void (lcd[nome] = righe),
    pulseIn: () => 580,
  };
  return {
    hw,
    registro,
    pin,
    modi,
    get seriale() {
      return seriale;
    },
    ingresso,
    lcd,
    servo,
    toni,
    letture,
  };
}

function esegui(codice: string, ms: number, letture: Record<string, number> = {}) {
  const s = schedaFinta(letture);
  const e = preparaSketch(codice, s.hw);
  e.avanza(ms);
  if (e.errore) throw e.errore;
  return { s, e };
}

function errore(codice: string): ErroreArduino {
  try {
    analizzaSketch(codice);
  } catch (e) {
    if (e instanceof ErroreArduino) return e;
    throw e;
  }
  throw new Error("nessun errore");
}

describe("analisi del testo", () => {
  it("riconosce uno sketch con commenti, #include e #define", () => {
    const p = analizzaSketch(`
      #include <Servo.h>
      #define LED 13 // il LED della scheda
      /* commento
         su più righe */
      void setup() { pinMode(LED, OUTPUT); }
      void loop() {}
    `);
    expect([...p.funzioni.keys()]).toEqual(["setup", "loop"]);
  });

  it("errori in italiano con il numero di riga", () => {
    const e = errore("void setup() {\n  pinMode(13, OUTPUT)\n}\nvoid loop() {}");
    expect(e.riga).toBe(2);
    expect(e.message).toMatch(/punto e virgola/);
    expect(errore("void setup() {}").message).toMatch(/loop/);
    expect(errore("void setup() {\n  if (x > 1 {\n}\nvoid loop(){}").message).toMatch(/parentesi \)/);
    expect(errore('void setup() { Serial.print("ciao); }\nvoid loop(){}').message).toMatch(/virgolette/);
    expect(errore("void setup() {\nvoid loop(){}").message).toMatch(/graffa/);
  });

  it("nomi dei pin", () => {
    expect(nomePin(13)).toBe("D13");
    expect(nomePin(14)).toBe("A0");
    expect(nomePin(20)).toBeNull();
  });
});

describe("Blink e tempo", () => {
  const blink = `
    void setup() { pinMode(LED_BUILTIN, OUTPUT); }
    void loop() {
      digitalWrite(LED_BUILTIN, HIGH);
      delay(1000);
      digitalWrite(LED_BUILTIN, LOW);
      delay(1000);
    }`;

  it("accende e spegne il LED ogni secondo", () => {
    const s = schedaFinta();
    const e = preparaSketch(blink, s.hw);
    e.avanza(500);
    expect(s.modi.D13).toBe("OUTPUT");
    expect(s.pin.D13).toBe(1);
    e.avanza(1000);
    expect(s.pin.D13).toBe(0);
    e.avanza(1000);
    expect(s.pin.D13).toBe(1);
    expect(s.registro.slice(0, 3)).toEqual(["D13=1", "D13=0", "D13=1"]);
  });

  it("millis() e blink senza delay", () => {
    const { s } = esegui(
      `unsigned long prima = 0;
       int stato = LOW;
       void setup() { pinMode(8, OUTPUT); }
       void loop() {
         if (millis() - prima >= 250) {
           prima = millis();
           stato = !stato;
           digitalWrite(8, stato);
         }
       }`,
      1100,
    );
    expect(s.registro.filter((r) => r.startsWith("D8")).length).toBe(4);
  });

  it("un loop infinito senza delay non blocca l'interprete", () => {
    const s = schedaFinta();
    const e = preparaSketch("void setup(){} void loop(){ while(true){} }", s.hw);
    e.avanza(100);
    expect(e.errore).toBeNull();
  });
});

describe("linguaggio", () => {
  it("variabili, int a 16 bit, float, divisione intera", () => {
    const { s } = esegui(
      `void setup() {
         Serial.begin(9600);
         int a = 32767; a++;
         Serial.println(a);
         Serial.println(7 / 2);
         Serial.println(7 / 2.0);
         float f = 3.14159;
         Serial.println(f, 3);
         byte b = 300;
         Serial.println(b);
         long grande = 100000;
         Serial.println(grande * 2);
         Serial.println(10 % 3);
         bool acceso = 5 > 3 && !(2 == 3);
         Serial.println(acceso);
       }
       void loop() {}`,
      10,
    );
    expect(s.seriale.split("\n")).toEqual(["-32768", "3", "3.50", "3.142", "44", "200000", "1", "1", ""]);
  });

  it("for, while, do, switch, break, continue, ?: e funzioni con return", () => {
    const { s } = esegui(
      `int quadrato(int x) { return x * x; }
       void scambia(int &a, int &b) { int t = a; a = b; b = t; }
       void setup() {
         int somma = 0;
         for (int i = 0; i < 10; i++) { if (i == 3) continue; if (i == 8) break; somma += i; }
         Serial.println(somma);
         int n = 0; while (n < 5) n += 2; Serial.println(n);
         do { n--; } while (n > 0); Serial.println(n);
         switch (2) { case 1: Serial.println("uno"); break; case 2: Serial.println("due"); case 3: Serial.println("tre"); break; default: Serial.println("altro"); }
         Serial.println(quadrato(12));
         Serial.println(n > 0 ? "si" : "no");
         int x = 1, y = 2; scambia(x, y); Serial.println(x * 10 + y);
       }
       void loop() {}`,
      10,
    );
    expect(s.seriale.split("\n")).toEqual(["25", "6", "0", "due", "tre", "144", "no", "21", ""]);
  });

  it("array, String e conversioni", () => {
    const { s } = esegui(
      `int pins[] = {2, 3, 4};
       int vuoto[3];
       String nome = "LED";
       void setup() {
         for (int i = 0; i < 3; i++) Serial.print(pins[i]);
         Serial.println();
         vuoto[1] = 7; Serial.println(vuoto[0] + vuoto[1]);
         String s = nome + " " + 13;
         Serial.println(s);
         Serial.println(s.length());
         Serial.println(String(255, HEX));
         Serial.println((int)3.9);
         Serial.println(int(2.5) + 1);
         Serial.println(map(512, 0, 1023, 0, 255));
         Serial.println(constrain(300, 0, 255));
       }
       void loop() {}`,
      10,
    );
    expect(s.seriale.split("\n")).toEqual(["234", "7", "LED 13", "6", "FF", "3", "3", "127", "255", ""]);
  });

  it("errori durante l'esecuzione: variabile non dichiarata, indice fuori dall'array", () => {
    const s = schedaFinta();
    const e = preparaSketch("void setup(){ x = 3; } void loop(){}", s.hw);
    e.avanza(10);
    expect(e.stato).toBe("errore");
    expect(e.errore?.message).toMatch(/non è stata dichiarata/);
    const e2 = preparaSketch("int a[2]; void setup(){ a[5] = 1; } void loop(){}", s.hw);
    e2.avanza(10);
    expect(e2.errore?.message).toMatch(/fuori dall'array/);
    const e3 = preparaSketch("void setup(){ digitalwrite(13, HIGH); } void loop(){}", s.hw);
    e3.avanza(10);
    expect(e3.errore?.message).toMatch(/maiuscole e minuscole/);
  });
});

describe("ingressi e periferiche", () => {
  it("pulsante con digitalRead comanda il LED", () => {
    const codice = `
      const int pulsante = 2;
      void setup() { pinMode(pulsante, INPUT_PULLUP); pinMode(13, OUTPUT); }
      void loop() {
        if (digitalRead(pulsante) == LOW) digitalWrite(13, HIGH);
        else digitalWrite(13, LOW);
      }`;
    expect(esegui(codice, 50, { D2: 1 }).s.pin.D13).toBe(0);
    const { s } = esegui(codice, 50, { D2: 0 });
    expect(s.modi.D2).toBe("INPUT_PULLUP");
    expect(s.pin.D13).toBe(1);
  });

  it("potenziometro → analogWrite (luminosità)", () => {
    const { s } = esegui(
      `void setup() { pinMode(9, OUTPUT); }
       void loop() { int v = analogRead(A0); analogWrite(9, v / 4); }`,
      20,
      { A0: 1023 },
    );
    expect(s.pin.D9).toBe(255);
  });

  it("Servo, tone e LiquidCrystal", () => {
    const { s } = esegui(
      `#include <Servo.h>
       #include <LiquidCrystal.h>
       Servo motore;
       LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
       void setup() {
         motore.attach(9);
         motore.write(45);
         tone(8, 440);
         lcd.begin(16, 2);
         lcd.print("Ciao!");
         lcd.setCursor(0, 1);
         lcd.print(motore.read());
       }
       void loop() {}`,
      20,
    );
    expect(s.servo.D9).toBe(45);
    expect(s.toni.D8).toBe(440);
    expect(s.lcd.lcd).toEqual(["Ciao!           ", "45              "]);
  });

  it("monitor seriale: available, read e parseInt", () => {
    const s = schedaFinta();
    const e = preparaSketch(
      `void setup() { Serial.begin(9600); }
       void loop() { if (Serial.available() > 0) { int n = Serial.parseInt(); Serial.println(n * 2); } }`,
      s.hw,
    );
    e.avanza(10);
    s.ingresso.push(..."21\n".split("").map((c) => c.charCodeAt(0)));
    e.avanza(10);
    expect(s.seriale).toBe("42\n");
  });

  it("random ripetibile con randomSeed e pulseIn per gli ultrasuoni", () => {
    const codice = `void setup(){ randomSeed(42); Serial.println(random(1, 7)); Serial.println(pulseIn(7, HIGH) / 58); } void loop(){}`;
    const a = esegui(codice, 10).s.seriale;
    const b = esegui(codice, 10).s.seriale;
    expect(a).toBe(b);
    const [dado, cm] = a.split("\n").map(Number);
    expect(dado).toBeGreaterThanOrEqual(1);
    expect(dado).toBeLessThanOrEqual(6);
    expect(cm).toBe(10);
  });
});

describe("array a due dimensioni", () => {
  it("si dichiarano con le graffe annidate, si leggono e si scrivono con due indici", () => {
    const { s } = esegui(
      `char tasti[2][3] = {{'1','2','3'},{'4','5','6'}};
       int m[3][2];
       void setup() {
         Serial.begin(9600);
         Serial.println(tasti[1][2]);
         m[2][1] = 7;
         m[0][0] += 3;
         int somma = 0;
         for (int r = 0; r < 3; r++) for (int c = 0; c < 2; c++) somma += m[r][c];
         Serial.println(somma);
       }
       void loop() {}`,
      10,
    );
    expect(s.seriale).toBe("6\n10\n");
  });

  it("i char si stampano come caratteri, i calcoli con i char come numeri", () => {
    const { s } = esegui(
      `char c = 65;
       unsigned char u = 66;
       String parola = "";
       void setup() {
         Serial.println(c);
         Serial.println('7');
         Serial.println(c + 1);
         Serial.println(u);
         Serial.println(c, DEC);
         parola += 'o';
         parola = parola + c;
         Serial.println(parola);
       }
       void loop() {}`,
      10,
    );
    expect(s.seriale).toBe("A\n7\n66\n66\n65\noA\n");
  });

  it("errori spiegati: seconda dimensione mancante, troppi valori, assegnazione a una riga", () => {
    expect(errore("int t[2][] = {{1}};\nvoid setup(){}\nvoid loop(){}").message).toMatch(/seconda dimensione va scritta/);
    expect(() => esegui("int t[1][2] = {{1,2,3}};\nvoid setup(){}\nvoid loop(){}", 10)).toThrow(/Troppi valori nella riga 0/);
    expect(() => esegui("int t[2][2];\nvoid setup(){ t[1] = 5; }\nvoid loop(){}", 10)).toThrow(/intero array/);
  });
});

describe("libreria Keypad", () => {
  /** Scheda finta con un tastierino: il tasto (riga, colonna) collega la riga alla colonna quando questa è a LOW. */
  function schedaTastierino() {
    const s = schedaFinta();
    const premuto = { riga: -1, colonna: -1 };
    const righe = ["D9", "D8", "D7", "D6"];
    const colonne = ["D5", "D4", "D3", "D2"];
    s.hw.digitalRead = (p) => {
      const r = righe.indexOf(p);
      if (r < 0 || r !== premuto.riga) return 1;
      const c = colonne[premuto.colonna];
      return s.modi[c] === "OUTPUT" && s.pin[c] === 0 ? 0 : 1;
    };
    return { s, premuto };
  }
  const sketch = (loop: string) => `#include <Keypad.h>
    const byte R = 4;
    const byte C = 4;
    char tasti[R][C] = {{'1','2','3','A'},{'4','5','6','B'},{'7','8','9','C'},{'*','0','#','D'}};
    byte pr[R] = {9, 8, 7, 6};
    byte pc[C] = {5, 4, 3, 2};
    Keypad k = Keypad(makeKeymap(tasti), pr, pc, R, C);
    void setup() { Serial.begin(9600); }
    void loop() { ${loop} }`;

  it("getKey dà il tasto una volta sola per ogni pressione, scandendo righe e colonne", () => {
    const { s, premuto } = schedaTastierino();
    const e = preparaSketch(sketch("char t = k.getKey(); if (t) Serial.print(t);"), s.hw);
    e.avanza(50);
    expect(s.seriale).toBe("");
    Object.assign(premuto, { riga: 2, colonna: 1 }); // «8»
    e.avanza(100);
    expect(s.seriale).toBe("8");
    Object.assign(premuto, { riga: -1, colonna: -1 });
    e.avanza(50);
    Object.assign(premuto, { riga: 3, colonna: 2 }); // «#»
    e.avanza(50);
    expect(s.seriale).toBe("8#");
    expect(s.modi.D9).toBe("INPUT_PULLUP");
    expect(e.errore).toBeNull();
  });

  it("waitForKey aspetta senza bloccare la simulazione; anche con la dichiarazione a costruttore", () => {
    const { s, premuto } = schedaTastierino();
    const codice = sketch("").replace("Keypad k = Keypad(makeKeymap(tasti), pr, pc, R, C);", "Keypad k(makeKeymap(tasti), pr, pc, R, C);").replace("void loop() {  }", "void loop() { Serial.println(k.waitForKey()); }");
    const e = preparaSketch(codice, s.hw);
    e.avanza(200);
    expect(s.seriale).toBe("");
    Object.assign(premuto, { riga: 0, colonna: 3 });
    e.avanza(50);
    expect(s.seriale).toBe("A\n");
  });

  it("tabella dei tasti sbagliata: errore spiegato", () => {
    expect(() => esegui(`#include <Keypad.h>\nchar t[4] = {'1','2','3','4'};\nbyte r[4] = {9,8,7,6};\nbyte c[4] = {5,4,3,2};\nKeypad k = Keypad(makeKeymap(t), r, c, 4, 4);\nvoid setup(){}\nvoid loop(){}`, 10)).toThrow(/array a due dimensioni/);
  });
});

describe("libreria Adafruit_NeoPixel", () => {
  it("i colori arrivano alla striscia solo con show(), scalati dalla luminosità", async () => {
    const { coloreHsv } = await import("./linguaggio");
    const s = schedaFinta();
    const inviati: { pin: string; colori: number[] }[] = [];
    s.hw.neopixel = (pin, colori) => void inviati.push({ pin, colori });
    const e = preparaSketch(
      `#include <Adafruit_NeoPixel.h>
       Adafruit_NeoPixel st = Adafruit_NeoPixel(3, 6, NEO_GRB + NEO_KHZ800);
       void setup() {
         st.begin();
         st.setPixelColor(0, 255, 0, 0);
         st.setPixelColor(1, st.Color(0, 0, 255));
         Serial.println(st.numPixels());
         st.show();
         st.setBrightness(51);
         st.fill(st.Color(255, 255, 255), 2);
         st.show();
         st.clear();
       }
       void loop() {}`,
      s.hw,
    );
    e.avanza(10);
    expect(e.errore).toBeNull();
    expect(s.seriale).toBe("3\n");
    expect(inviati).toHaveLength(2);
    expect(inviati[0]).toEqual({ pin: "D6", colori: [0xff0000, 0x0000ff, 0] });
    expect(inviati[1].colori).toEqual([0x330000, 0x000033, 0x333333]);
    expect(coloreHsv(0)).toBe(0xff0000);
    expect(coloreHsv(65536 / 3)).toBe(0x00ff00);
    expect(coloreHsv(0, 0, 255)).toBe(0xffffff);
  });

  it("costruttore senza numero di LED: errore spiegato", () => {
    expect(() => esegui(`Adafruit_NeoPixel st(6);\nvoid setup(){}\nvoid loop(){}`, 10)).toThrow(/numero di LED e il pin/);
  });
});
