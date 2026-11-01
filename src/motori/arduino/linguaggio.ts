// Interprete del linguaggio Arduino (puro: nessuna interfaccia).
//
// Esegue un sottoinsieme del C++ usato negli sketch scolastici:
// - #include (ignorati) e #define NOME valore;
// - tipi int, unsigned int, long, unsigned long, byte, char, bool/boolean,
//   float, double, String, void; const; array a una dimensione;
// - funzioni con parametri e valore di ritorno, variabili globali e locali;
// - if/else, for, while, do-while, switch/case, break, continue, return;
// - operatori aritmetici, logici, di confronto, sui bit, ++/--, +=…, ?:,
//   conversioni (int)x e int(x);
// - funzioni di Arduino: pinMode, digitalWrite/Read, analogRead/Write, delay,
//   delayMicroseconds, millis, micros, map, constrain, min, max, abs, pow,
//   sqrt, random, randomSeed, tone, noTone, pulseIn;
// - oggetti Serial, Servo e LiquidCrystal.
//
// Il programma gira come su una scheda vera, ma "a scatti": `avanza(ms)` lo
// esegue finché il suo orologio non ha raggiunto il tempo richiesto. Ogni
// istruzione costa qualche microsecondo e `delay` fa solo avanzare
// l'orologio, così l'interfaccia non si blocca mai (anche con loop vuoti o
// cicli infiniti). L'hardware (pin, seriale, servo, LCD) è fornito da chi usa
// l'interprete tramite l'interfaccia `Hardware`.
//
// Semplificazioni (annotate nei limiti noti): i calcoli intermedi fra interi
// non traboccano a 16 bit come sulla scheda (il valore viene troncato solo
// quando si salva in una variabile int); niente puntatori, struct, classi
// dell'utente, array a più dimensioni.

// ============================================================ Errori

export class ErroreArduino extends Error {
  constructor(
    public riga: number,
    messaggio: string,
  ) {
    super(messaggio);
  }
}

// ============================================================ Analisi lessicale

type Token =
  | { k: "num"; v: number; float: boolean; riga: number }
  | { k: "str"; v: string; riga: number }
  | { k: "car"; v: number; riga: number }
  | { k: "id"; v: string; riga: number }
  | { k: "op"; v: string; riga: number }
  | { k: "fine"; riga: number };

const OPERATORI = [
  "<<=", ">>=", "++", "--", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "==", "!=", "<=", ">=", "&&", "||", "<<", ">>", "::",
  "+", "-", "*", "/", "%", "=", "<", ">", "!", "~", "&", "|", "^", "?", ":", ";", ",", ".", "(", ")", "{", "}", "[", "]",
];

function analisiLessicale(testo: string): Token[] {
  const token: Token[] = [];
  const macro = new Map<string, Token[]>();
  const righe = testo.replace(/\r\n?/g, "\n").split("\n");
  let inCommento = false;
  righe.forEach((rigaTesto, i) => {
    const riga = i + 1;
    let s = rigaTesto;
    let p = 0;
    const daRiga: Token[] = [];
    // Direttive del preprocessore.
    if (!inCommento) {
      const dir = /^\s*#\s*(\w+)\s*(.*)$/.exec(s);
      if (dir) {
        if (dir[1] === "define") {
          const m = /^([A-Za-z_]\w*)\s*(.*)$/.exec(dir[2]);
          if (!m) throw new ErroreArduino(riga, "#define scritto male: serve un nome, per esempio #define LED 13");
          macro.set(m[1], analisiLessicale(m[2].replace(/\/\/.*$/, "")).filter((t) => t.k !== "fine").map((t) => ({ ...t, riga })));
        }
        // #include e le altre direttive vengono ignorate.
        return;
      }
    }
    while (p < s.length) {
      if (inCommento) {
        const fine = s.indexOf("*/", p);
        if (fine < 0) {
          p = s.length;
          break;
        }
        inCommento = false;
        p = fine + 2;
        continue;
      }
      const c = s[p];
      if (c === " " || c === "\t") {
        p++;
        continue;
      }
      if (s.startsWith("//", p)) break;
      if (s.startsWith("/*", p)) {
        inCommento = true;
        p += 2;
        continue;
      }
      // Numeri: 13, 0x1F, 0b101, 3.14, 1e3, 100L, 255U, 2.5f
      const num = /^(0[xX][0-9a-fA-F]+|0[bB][01]+|\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)([uUlLfF]*)/.exec(s.slice(p));
      if (num && /[\d.]/.test(c)) {
        const testoNum = num[1];
        let v: number;
        if (/^0[xX]/.test(testoNum)) v = parseInt(testoNum.slice(2), 16);
        else if (/^0[bB]/.test(testoNum)) v = parseInt(testoNum.slice(2), 2);
        else v = Number(testoNum);
        const float = /[.eE]/.test(testoNum) && !/^0[xX]/.test(testoNum) || /[fF]/.test(num[2]);
        daRiga.push({ k: "num", v, float, riga });
        p += num[0].length;
        continue;
      }
      if (c === '"') {
        let q = p + 1;
        let v = "";
        while (q < s.length && s[q] !== '"') {
          if (s[q] === "\\" && q + 1 < s.length) {
            v += sequenza(s[q + 1]);
            q += 2;
          } else v += s[q++];
        }
        if (q >= s.length) throw new ErroreArduino(riga, 'Testo tra virgolette non chiuso: manca il " finale.');
        daRiga.push({ k: "str", v, riga });
        p = q + 1;
        continue;
      }
      if (c === "'") {
        const m = /^'(\\.|[^'\\])'/.exec(s.slice(p));
        if (!m) throw new ErroreArduino(riga, "Carattere tra apici scritto male: usa per esempio 'A'.");
        const ch = m[1].length === 2 ? sequenza(m[1][1]) : m[1];
        daRiga.push({ k: "car", v: ch.charCodeAt(0), riga });
        p += m[0].length;
        continue;
      }
      const id = /^[A-Za-z_]\w*/.exec(s.slice(p));
      if (id) {
        const sost = macro.get(id[0]);
        if (sost) daRiga.push(...sost.map((t) => ({ ...t, riga })));
        else daRiga.push({ k: "id", v: id[0], riga });
        p += id[0].length;
        continue;
      }
      const op = OPERATORI.find((o) => s.startsWith(o, p));
      if (!op) throw new ErroreArduino(riga, `Carattere non previsto: «${c}».`);
      daRiga.push({ k: "op", v: op, riga });
      p += op.length;
    }
    token.push(...daRiga);
  });
  token.push({ k: "fine", riga: righe.length });
  return token;
}

function sequenza(c: string): string {
  return ({ n: "\n", t: "\t", r: "\r", "0": "\0", "\\": "\\", '"': '"', "'": "'" } as Record<string, string>)[c] ?? c;
}

// ============================================================ Albero del programma

/** Tipi conosciuti. */
const TIPI_NUMERICI = new Set(["int", "long", "short", "byte", "char", "bool", "boolean", "float", "double", "word", "size_t", "uint8_t", "int8_t", "uint16_t", "int16_t", "uint32_t", "int32_t"]);
const TIPI_OGGETTO = new Set(["Servo", "LiquidCrystal", "String"]);

interface Tipo {
  nome: string; // int, long, float, bool, String, Servo…
  senzaSegno: boolean;
}

type Espr =
  | { k: "num"; v: number; float: boolean; riga: number }
  | { k: "str"; v: string; riga: number }
  | { k: "id"; nome: string; riga: number }
  | { k: "bin"; op: string; a: Espr; b: Espr; riga: number }
  | { k: "un"; op: string; e: Espr; riga: number }
  | { k: "assegna"; op: string; bersaglio: Espr; valore: Espr; riga: number }
  | { k: "incr"; op: "++" | "--"; prefisso: boolean; bersaglio: Espr; riga: number }
  | { k: "ternario"; cond: Espr; si: Espr; no: Espr; riga: number }
  | { k: "chiama"; nome: string; arg: Espr[]; riga: number }
  | { k: "metodo"; oggetto: Espr; nome: string; arg: Espr[]; riga: number }
  | { k: "indice"; arr: Espr; i: Espr; riga: number }
  | { k: "cast"; tipo: Tipo; e: Espr; riga: number };

interface Dichiarato {
  nome: string;
  dimensione: Espr | null | "auto"; // null = non è un array
  init: Espr | Espr[] | null;
  costruttore: Espr[] | null;
}

type Istr =
  | { k: "blocco"; corpo: Istr[]; riga: number }
  | { k: "var"; tipo: Tipo; dich: Dichiarato[]; riga: number }
  | { k: "espr"; e: Espr; riga: number }
  | { k: "if"; cond: Espr; allora: Istr; altrimenti: Istr | null; riga: number }
  | { k: "while"; cond: Espr; corpo: Istr; riga: number }
  | { k: "do"; corpo: Istr; cond: Espr; riga: number }
  | { k: "for"; init: Istr | null; cond: Espr | null; passo: Espr | null; corpo: Istr; riga: number }
  | { k: "return"; e: Espr | null; riga: number }
  | { k: "break"; riga: number }
  | { k: "continue"; riga: number }
  | { k: "switch"; e: Espr; casi: { valore: Espr | null; corpo: Istr[] }[]; riga: number }
  | { k: "vuota"; riga: number };

interface Funzione {
  nome: string;
  tipo: Tipo;
  parametri: { tipo: Tipo; nome: string; riferimento: boolean }[];
  corpo: Istr;
  riga: number;
}

export interface Programma {
  globali: Istr[];
  funzioni: Map<string, Funzione>;
}

// ============================================================ Analisi sintattica

class Parser {
  private p = 0;
  constructor(private t: Token[]) {}

  private get cur(): Token {
    return this.t[this.p];
  }
  private guarda(n = 0): Token {
    return this.t[Math.min(this.p + n, this.t.length - 1)];
  }
  private eOp(v: string, n = 0) {
    const t = this.guarda(n);
    return t.k === "op" && t.v === v;
  }
  private eId(v?: string, n = 0) {
    const t = this.guarda(n);
    return t.k === "id" && (v === undefined || t.v === v);
  }
  private avanti(): Token {
    return this.t[this.p++];
  }
  private aspetta(v: string, cosa?: string): Token {
    if (!this.eOp(v)) {
      const riga = v === ";" && this.p > 0 ? this.t[this.p - 1].riga : this.cur.riga;
      throw new ErroreArduino(riga, cosa ?? (v === ";" ? "Manca il punto e virgola ; alla fine dell'istruzione." : `Manca «${v}».`));
    }
    return this.avanti();
  }
  private nome(cosa: string): string {
    const t = this.cur;
    if (t.k !== "id") throw new ErroreArduino(t.riga, `Qui serve ${cosa}.`);
    this.p++;
    return t.v;
  }

  /** Vero se alla posizione n inizia un tipo. */
  private iniziaTipo(n = 0): boolean {
    const t = this.guarda(n);
    if (t.k !== "id") return false;
    return t.v === "const" || t.v === "unsigned" || t.v === "signed" || t.v === "static" || t.v === "volatile" || t.v === "void" || TIPI_NUMERICI.has(t.v) || TIPI_OGGETTO.has(t.v);
  }

  private tipo(): Tipo {
    let senzaSegno = false;
    while (this.eId("const") || this.eId("static") || this.eId("volatile") || this.eId("signed") || this.eId("unsigned")) {
      if (this.eId("unsigned")) senzaSegno = true;
      this.p++;
    }
    let nome = "int";
    if (this.cur.k === "id" && (TIPI_NUMERICI.has(this.cur.v) || TIPI_OGGETTO.has(this.cur.v) || this.cur.v === "void")) {
      nome = (this.avanti() as { v: string }).v;
      // "long long", "long int", "short int"
      while (this.eId("long") || this.eId("int")) this.p++;
    } else if (!senzaSegno) throw new ErroreArduino(this.cur.riga, "Qui serve un tipo (int, float, bool…).");
    const alias: Record<string, string> = {
      boolean: "bool", double: "float", short: "int", word: "int", size_t: "int",
      uint8_t: "byte", int8_t: "char", uint16_t: "int", int16_t: "int", uint32_t: "long", int32_t: "long",
    };
    if (["uint8_t", "uint16_t", "uint32_t", "word", "size_t"].includes(nome)) senzaSegno = true;
    return { nome: alias[nome] ?? nome, senzaSegno };
  }

  programma(): Programma {
    const globali: Istr[] = [];
    const funzioni = new Map<string, Funzione>();
    while (this.cur.k !== "fine") {
      if (this.eOp(";")) {
        this.p++;
        continue;
      }
      if (!this.iniziaTipo()) throw new ErroreArduino(this.cur.riga, `Fuori dalle funzioni si possono solo dichiarare variabili e funzioni (trovato «${testoToken(this.cur)}»).`);
      const inizio = this.p;
      const riga = this.cur.riga;
      const tipo = this.tipo();
      // Funzione: nome( ) oppure nome(tipo …). Invece "LiquidCrystal lcd(12, 11…)"
      // è una variabile con gli argomenti del costruttore.
      if (this.cur.k === "id" && this.eOp("(", 1) && (this.eOp(")", 2) || this.iniziaTipo(2))) {
        const nome = (this.avanti() as { v: string }).v;
        this.avanti();
        const parametri: Funzione["parametri"] = [];
        if (this.eId("void") && this.eOp(")", 1)) this.p++;
        while (!this.eOp(")")) {
          const tp = this.tipo();
          const rif = this.eOp("&");
          if (rif) this.p++;
          parametri.push({ tipo: tp, nome: this.nome("il nome del parametro"), riferimento: rif });
          if (this.eOp("[")) {
            this.p++;
            this.aspetta("]");
          }
          if (!this.eOp(")")) this.aspetta(",", "Fra i parametri serve una virgola.");
        }
        this.aspetta(")");
        if (this.eOp(";")) {
          this.p++; // prototipo: ignorato
          continue;
        }
        if (!this.eOp("{")) throw new ErroreArduino(this.cur.riga, `Dopo l'intestazione di ${nome}() serve la graffa {.`);
        const corpo = this.blocco();
        funzioni.set(nome, { nome, tipo, parametri, corpo, riga });
      } else {
        this.p = inizio;
        globali.push(this.dichiarazione());
      }
    }
    return { globali, funzioni };
  }

  private blocco(): Istr {
    const riga = this.aspetta("{").riga;
    const corpo: Istr[] = [];
    while (!this.eOp("}")) {
      if (this.cur.k === "fine") throw new ErroreArduino(riga, "Manca la graffa di chiusura } di questo blocco.");
      corpo.push(this.istruzione());
    }
    this.avanti();
    return { k: "blocco", corpo, riga };
  }

  private dichiarazione(): Istr {
    const riga = this.cur.riga;
    const tipo = this.tipo();
    const dich: Dichiarato[] = [];
    do {
      if (dich.length > 0) this.avanti(); // virgola
      const nome = this.nome("il nome della variabile");
      let dimensione: Dichiarato["dimensione"] = null;
      let init: Dichiarato["init"] = null;
      let costruttore: Espr[] | null = null;
      if (this.eOp("[")) {
        this.p++;
        dimensione = this.eOp("]") ? "auto" : this.espressione();
        this.aspetta("]");
      }
      if (this.eOp("(")) {
        this.p++;
        costruttore = [];
        while (!this.eOp(")")) {
          costruttore.push(this.assegnazione());
          if (!this.eOp(")")) this.aspetta(",");
        }
        this.p++;
        if (this.eOp("{")) {
          throw new ErroreArduino(this.cur.riga, "Qui inizia una nuova funzione dentro un'altra: manca la graffa } che chiude la funzione precedente.");
        }
      }
      if (this.eOp("=")) {
        this.p++;
        if (this.eOp("{")) {
          this.p++;
          const valori: Espr[] = [];
          while (!this.eOp("}")) {
            valori.push(this.assegnazione());
            if (!this.eOp("}")) this.aspetta(",");
          }
          this.p++;
          init = valori;
        } else init = this.assegnazione();
      }
      dich.push({ nome, dimensione, init, costruttore });
    } while (this.eOp(","));
    this.aspetta(";");
    return { k: "var", tipo, dich, riga };
  }

  private istruzione(): Istr {
    const t = this.cur;
    const riga = t.riga;
    if (this.eOp("{")) return this.blocco();
    if (this.eOp(";")) {
      this.p++;
      return { k: "vuota", riga };
    }
    if (t.k === "id") {
      switch (t.v) {
        case "if": {
          this.p++;
          this.aspetta("(", "Dopo if serve la parentesi ( con la condizione.");
          const cond = this.espressione();
          this.aspetta(")", "Manca la parentesi ) che chiude la condizione dell'if.");
          const allora = this.istruzione();
          let altrimenti: Istr | null = null;
          if (this.eId("else")) {
            this.p++;
            altrimenti = this.istruzione();
          }
          return { k: "if", cond, allora, altrimenti, riga };
        }
        case "while": {
          this.p++;
          this.aspetta("(", "Dopo while serve la parentesi ( con la condizione.");
          const cond = this.espressione();
          this.aspetta(")");
          return { k: "while", cond, corpo: this.istruzione(), riga };
        }
        case "do": {
          this.p++;
          const corpo = this.istruzione();
          if (!this.eId("while")) throw new ErroreArduino(this.cur.riga, "Dopo il blocco do serve while (condizione);");
          this.p++;
          this.aspetta("(");
          const cond = this.espressione();
          this.aspetta(")");
          this.aspetta(";");
          return { k: "do", corpo, cond, riga };
        }
        case "for": {
          this.p++;
          this.aspetta("(", "Dopo for serve la parentesi (.");
          let init: Istr | null = null;
          if (this.eOp(";")) this.p++;
          else if (this.iniziaTipo()) init = this.dichiarazione();
          else {
            init = { k: "espr", e: this.espressione(), riga };
            this.aspetta(";", "Nel for le tre parti si separano con il punto e virgola ;");
          }
          const cond = this.eOp(";") ? null : this.espressione();
          this.aspetta(";", "Nel for le tre parti si separano con il punto e virgola ;");
          const passo = this.eOp(")") ? null : this.espressione();
          this.aspetta(")");
          return { k: "for", init, cond, passo, corpo: this.istruzione(), riga };
        }
        case "return": {
          this.p++;
          const e = this.eOp(";") ? null : this.espressione();
          this.aspetta(";");
          return { k: "return", e, riga };
        }
        case "break":
          this.p++;
          this.aspetta(";");
          return { k: "break", riga };
        case "continue":
          this.p++;
          this.aspetta(";");
          return { k: "continue", riga };
        case "switch": {
          this.p++;
          this.aspetta("(");
          const e = this.espressione();
          this.aspetta(")");
          this.aspetta("{");
          const casi: { valore: Espr | null; corpo: Istr[] }[] = [];
          while (!this.eOp("}")) {
            if (this.eId("case")) {
              this.p++;
              const valore = this.ternario();
              this.aspetta(":", "Dopo case valore serve i due punti :");
              casi.push({ valore, corpo: [] });
            } else if (this.eId("default")) {
              this.p++;
              this.aspetta(":");
              casi.push({ valore: null, corpo: [] });
            } else {
              if (casi.length === 0) throw new ErroreArduino(this.cur.riga, "Dentro uno switch le istruzioni vanno dopo case …:");
              if (this.cur.k === "fine") throw new ErroreArduino(riga, "Manca la graffa } che chiude lo switch.");
              casi[casi.length - 1].corpo.push(this.istruzione());
            }
          }
          this.p++;
          return { k: "switch", e, casi, riga };
        }
      }
      // Dichiarazione di variabile (anche Servo s; LiquidCrystal lcd(…);)
      if (this.iniziaTipo() && !(this.eId("String") && this.eOp("(", 1))) return this.dichiarazione();
    }
    const e = this.espressione();
    this.aspetta(";");
    return { k: "espr", e, riga };
  }

  // --- espressioni ---
  espressione(): Espr {
    let e = this.assegnazione();
    while (this.eOp(",")) {
      // operatore virgola (raro): valuta entrambi, resta il secondo
      const riga = this.avanti().riga;
      e = { k: "bin", op: ",", a: e, b: this.assegnazione(), riga };
    }
    return e;
  }

  private assegnazione(): Espr {
    const sinistra = this.ternario();
    const t = this.cur;
    if (t.k === "op" && ["=", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "<<=", ">>="].includes(t.v)) {
      if (sinistra.k !== "id" && sinistra.k !== "indice") throw new ErroreArduino(t.riga, "A sinistra dell'uguale serve il nome di una variabile.");
      this.p++;
      return { k: "assegna", op: t.v, bersaglio: sinistra, valore: this.assegnazione(), riga: t.riga };
    }
    return sinistra;
  }

  private ternario(): Espr {
    const cond = this.binario(0);
    if (this.eOp("?")) {
      const riga = this.avanti().riga;
      const si = this.assegnazione();
      this.aspetta(":", "Nell'operatore ? : manca i due punti.");
      return { k: "ternario", cond, si, no: this.assegnazione(), riga };
    }
    return cond;
  }

  private static LIVELLI = [["||"], ["&&"], ["|"], ["^"], ["&"], ["==", "!="], ["<", "<=", ">", ">="], ["<<", ">>"], ["+", "-"], ["*", "/", "%"]];

  private binario(livello: number): Espr {
    if (livello >= Parser.LIVELLI.length) return this.unario();
    let a = this.binario(livello + 1);
    while (this.cur.k === "op" && Parser.LIVELLI[livello].includes(this.cur.v as string)) {
      const t = this.avanti() as { v: string; riga: number };
      a = { k: "bin", op: t.v, a, b: this.binario(livello + 1), riga: t.riga };
    }
    return a;
  }

  private unario(): Espr {
    const t = this.cur;
    if (t.k === "op" && ["!", "~", "-", "+"].includes(t.v)) {
      this.p++;
      return { k: "un", op: t.v, e: this.unario(), riga: t.riga };
    }
    if (t.k === "op" && (t.v === "++" || t.v === "--")) {
      this.p++;
      return { k: "incr", op: t.v, prefisso: true, bersaglio: this.unario(), riga: t.riga };
    }
    // Conversione (int) x
    if (this.eOp("(") && this.iniziaTipo(1) && !this.eId("String", 1)) {
      let n = 1;
      while (this.guarda(n).k === "id") n++;
      if (this.eOp(")", n)) {
        this.p++;
        const tipo = this.tipo();
        this.aspetta(")");
        return { k: "cast", tipo, e: this.unario(), riga: t.riga };
      }
    }
    return this.postfisso();
  }

  private argomenti(): Espr[] {
    this.aspetta("(");
    const arg: Espr[] = [];
    while (!this.eOp(")")) {
      if (this.cur.k === "fine") throw new ErroreArduino(this.cur.riga, "Manca la parentesi ) che chiude la chiamata.");
      arg.push(this.assegnazione());
      if (!this.eOp(")")) this.aspetta(",", "Fra gli argomenti serve una virgola.");
    }
    this.p++;
    return arg;
  }

  private postfisso(): Espr {
    let e = this.primario();
    for (;;) {
      const t = this.cur;
      if (this.eOp("[")) {
        this.p++;
        const i = this.espressione();
        this.aspetta("]");
        e = { k: "indice", arr: e, i, riga: t.riga };
      } else if (this.eOp(".")) {
        this.p++;
        const nome = this.nome("il nome di una funzione dopo il punto");
        e = { k: "metodo", oggetto: e, nome, arg: this.eOp("(") ? this.argomenti() : [], riga: t.riga };
      } else if (this.eOp("++") || this.eOp("--")) {
        this.p++;
        e = { k: "incr", op: (t as { v: string }).v as "++" | "--", prefisso: false, bersaglio: e, riga: t.riga };
      } else return e;
    }
  }

  private primario(): Espr {
    const t = this.avanti();
    switch (t.k) {
      case "num":
        return { k: "num", v: t.v, float: t.float, riga: t.riga };
      case "car":
        return { k: "num", v: t.v, float: false, riga: t.riga };
      case "str": {
        // Testi consecutivi si uniscono: "ab" "cd"
        let v = t.v;
        while (this.cur.k === "str") v += (this.avanti() as { v: string }).v;
        return { k: "str", v, riga: t.riga };
      }
      case "id": {
        // Conversioni scritte come funzioni: int(x), float(x), String(x)
        if (this.eOp("(") && (TIPI_NUMERICI.has(t.v) || t.v === "String")) {
          const arg = this.argomenti();
          return { k: "chiama", nome: `__${t.v}`, arg, riga: t.riga };
        }
        if (this.eOp("(")) return { k: "chiama", nome: t.v, arg: this.argomenti(), riga: t.riga };
        return { k: "id", nome: t.v, riga: t.riga };
      }
      case "op":
        if (t.v === "(") {
          const e = this.espressione();
          this.aspetta(")", "Manca una parentesi ) di chiusura.");
          return e;
        }
        throw new ErroreArduino(t.riga, `Simbolo «${t.v}» non previsto qui.`);
      case "fine":
        throw new ErroreArduino(t.riga, "Il programma finisce a metà: forse manca una parentesi o una graffa.");
    }
  }
}

function testoToken(t: Token): string {
  return t.k === "fine" ? "fine del testo" : t.k === "str" ? `"${t.v}"` : String(t.v);
}

/** Analizza il testo dello sketch; lancia ErroreArduino con riga e spiegazione. */
export function analizzaSketch(testo: string): Programma {
  const programma = new Parser(analisiLessicale(testo)).programma();
  if (!programma.funzioni.has("setup")) throw new ErroreArduino(1, "Manca la funzione void setup() { … }: ogni sketch deve averla.");
  if (!programma.funzioni.has("loop")) throw new ErroreArduino(1, "Manca la funzione void loop() { … }: ogni sketch deve averla.");
  return programma;
}

// ============================================================ Valori

type Valore =
  | { t: "n"; v: number; float: boolean } // numero (intero o con la virgola)
  | { t: "s"; v: string } // String
  | { t: "a"; el: Cella[]; tipo: Tipo } // array
  | { t: "o"; classe: string; dati: Record<string, unknown>; nome: string } // oggetto (Servo, LiquidCrystal)
  | { t: "v" }; // void

interface Cella {
  tipo: Tipo;
  valore: Valore;
}

const VOID: Valore = { t: "v" };
const num = (v: number, float = false): Valore => ({ t: "n", v, float });

/** Porta un valore al tipo della variabile (troncamenti come su Arduino). */
function converti(v: Valore, tipo: Tipo, riga: number): Valore {
  if (tipo.nome === "String") {
    if (v.t === "s") return v;
    return { t: "s", v: testoDi(v) };
  }
  if (TIPI_OGGETTO.has(tipo.nome) || tipo.nome === "void") return v;
  if (v.t === "s") throw new ErroreArduino(riga, `Non si può mettere un testo in una variabile ${tipo.nome}.`);
  if (v.t !== "n") throw new ErroreArduino(riga, `Valore non adatto a una variabile ${tipo.nome}.`);
  const x = v.v;
  switch (tipo.nome) {
    case "float":
      return num(x, true);
    case "bool":
      return num(x !== 0 ? 1 : 0);
    case "byte":
      return num(((Math.trunc(x) % 256) + 256) % 256);
    case "char":
      return num(tipo.senzaSegno ? ((Math.trunc(x) % 256) + 256) % 256 : ((((Math.trunc(x) + 128) % 256) + 256) % 256) - 128);
    case "long": {
      const n = Math.trunc(x);
      return num(tipo.senzaSegno ? n >>> 0 : n | 0);
    }
    default: {
      // int a 16 bit come sull'ATmega328
      const n = Math.trunc(x) & 0xffff;
      return num(tipo.senzaSegno ? n : n >= 0x8000 ? n - 0x10000 : n);
    }
  }
}

function testoDi(v: Valore, base?: number): string {
  if (v.t === "s") return v.v;
  if (v.t === "n") {
    if (base === 16) return (v.v >>> 0).toString(16).toUpperCase();
    if (base === 2) return (v.v >>> 0).toString(2);
    if (base === 8) return (v.v >>> 0).toString(8);
    if (v.float) {
      // Serial.print di un float scrive 2 decimali (o quelli indicati).
      return v.v.toFixed(base !== undefined && base >= 0 && base < 10 ? base : 2);
    }
    return String(Math.trunc(v.v));
  }
  return "";
}

const vero = (v: Valore) => (v.t === "n" ? v.v !== 0 : v.t === "s" ? v.v.length > 0 : true);

// ============================================================ Hardware

/** Ciò che l'interprete chiede alla scheda simulata. */
export interface Hardware {
  pinMode(pin: string, modo: "INPUT" | "OUTPUT" | "INPUT_PULLUP"): void;
  digitalWrite(pin: string, livello: 0 | 1): void;
  digitalRead(pin: string): number;
  analogRead(pin: string): number;
  /** analogWrite: valore 0…255. */
  analogWrite(pin: string, valore: number): void;
  tone(pin: string, frequenza: number): void;
  noTone(pin: string): void;
  serialScrivi(testo: string): void;
  /** Prossimo carattere ricevuto dal monitor seriale, o -1. */
  serialLeggi(): number;
  serialDisponibili(): number;
  servo(pin: string, angolo: number): void;
  /** Il contenuto di un display LCD è cambiato. */
  lcd(nome: string, righe: string[], colonne: number): void;
  /** Durata in microsecondi dell'impulso sul pin (sensore a ultrasuoni), 0 se nessuno. */
  pulseIn(pin: string, livello: number): number;
}

// ============================================================ Esecuzione

/** Microsecondi di tempo simulato consumati da ogni istruzione. */
export const COSTO_ISTRUZIONE_US = 4;
/** Oltre questo numero di istruzioni per chiamata ad `avanza` si riprende al passo successivo. */
export const ISTRUZIONI_MASSIME_PER_PASSO = 300000;
/** Livelli massimi di chiamate annidate (ricorsione). */
const PROFONDITA_MASSIMA = 200;

type Segnale = { tipo: "break" } | { tipo: "continue" } | { tipo: "return"; valore: Valore };

/** Pausa richiesta dal programma (delay): microsecondi. */
type Pausa = number;

class Ambiente {
  private var = new Map<string, Cella>();
  constructor(public padre: Ambiente | null) {}
  cerca(nome: string): Cella | undefined {
    return this.var.get(nome) ?? this.padre?.cerca(nome);
  }
  definisci(nome: string, cella: Cella) {
    this.var.set(nome, cella);
  }
}

/** Costanti di Arduino. */
const COSTANTI: Record<string, number> = {
  HIGH: 1, LOW: 0, true: 1, false: 0, INPUT: 0, OUTPUT: 1, INPUT_PULLUP: 2, LED_BUILTIN: 13,
  A0: 14, A1: 15, A2: 16, A3: 17, A4: 18, A5: 19, DEC: 10, HEX: 16, BIN: 2, OCT: 8, NULL: 0,
  PI: Math.PI, HALF_PI: Math.PI / 2, TWO_PI: Math.PI * 2, LSBFIRST: 0, MSBFIRST: 1,
};

/** Nome del pin a partire dal numero usato nel programma (13 → D13, 14 → A0). */
export function nomePin(n: number): string | null {
  const i = Math.trunc(n);
  if (i >= 0 && i <= 13) return `D${i}`;
  if (i >= 14 && i <= 19) return `A${i - 14}`;
  return null;
}

export type StatoEsecuzione = "pronto" | "in esecuzione" | "errore";

export class Esecutore {
  /** Tempo simulato dall'accensione, in microsecondi. */
  tempoUs = 0;
  stato: StatoEsecuzione = "pronto";
  errore: ErroreArduino | null = null;
  private globali = new Ambiente(null);
  private corso: Generator<Pausa, void, void> | null = null;
  private attesaFinoA = 0;
  private profondita = 0;
  private istruzioni = 0;
  private semeCasuale = 12345;

  constructor(
    private programma: Programma,
    private hw: Hardware,
  ) {}

  /** Esegue il programma finché il suo orologio non arriva a `tempoUs + ms·1000`. */
  avanza(ms: number): void {
    if (this.stato === "errore") return;
    const traguardo = this.tempoUs + Math.max(0, ms) * 1000;
    if (!this.corso) {
      this.corso = this.principale();
      this.stato = "in esecuzione";
    }
    this.istruzioni = 0;
    try {
      while (this.tempoUs < traguardo) {
        if (this.attesaFinoA > this.tempoUs) {
          this.tempoUs = Math.min(this.attesaFinoA, traguardo);
          continue;
        }
        const passo = this.corso.next();
        if (passo.done) return;
        // Il generatore si ferma per un delay (valore > 0) oppure per dare
        // respiro all'interfaccia dopo molte istruzioni (valore 0).
        if (passo.value > 0) this.attesaFinoA = this.tempoUs + passo.value;
        if (this.istruzioni > ISTRUZIONI_MASSIME_PER_PASSO) return;
      }
    } catch (e) {
      this.stato = "errore";
      this.errore = e instanceof ErroreArduino ? e : new ErroreArduino(0, String((e as Error).message ?? e));
    }
  }

  /** Millisecondi trascorsi (come millis()). */
  get millis(): number {
    return Math.floor(this.tempoUs / 1000);
  }

  private *principale(): Generator<Pausa, void, void> {
    for (const g of this.programma.globali) yield* this.istruzione(g, this.globali);
    yield* this.chiamaUtente(this.funzione("setup", 0), [], 0);
    for (;;) {
      yield* this.chiamaUtente(this.funzione("loop", 0), [], 0);
      // Anche un loop vuoto consuma un po' di tempo.
      yield* this.costo();
    }
  }

  private funzione(nome: string, riga: number): Funzione {
    const f = this.programma.funzioni.get(nome);
    if (!f) throw new ErroreArduino(riga, `La funzione ${nome}() non esiste.`);
    return f;
  }

  /** Ogni istruzione fa avanzare l'orologio; ogni tanto si cede il controllo. */
  private *costo(): Generator<Pausa, void, void> {
    this.tempoUs += COSTO_ISTRUZIONE_US;
    this.istruzioni++;
    if (this.istruzioni % 2000 === 0) yield 0;
  }

  // --- istruzioni ---

  private *istruzione(s: Istr, amb: Ambiente): Generator<Pausa, Segnale | null, void> {
    yield* this.costo();
    switch (s.k) {
      case "vuota":
        return null;
      case "blocco": {
        const locale = new Ambiente(amb);
        for (const x of s.corpo) {
          const sg = yield* this.istruzione(x, locale);
          if (sg) return sg;
        }
        return null;
      }
      case "var":
        for (const d of s.dich) yield* this.dichiara(s.tipo, d, amb, s.riga);
        return null;
      case "espr":
        yield* this.valuta(s.e, amb);
        return null;
      case "if":
        if (vero(yield* this.valuta(s.cond, amb))) return yield* this.istruzione(s.allora, amb);
        if (s.altrimenti) return yield* this.istruzione(s.altrimenti, amb);
        return null;
      case "while":
        while (vero(yield* this.valuta(s.cond, amb))) {
          const sg = yield* this.istruzione(s.corpo, amb);
          if (sg?.tipo === "break") break;
          if (sg?.tipo === "return") return sg;
          yield* this.costo();
        }
        return null;
      case "do":
        do {
          const sg = yield* this.istruzione(s.corpo, amb);
          if (sg?.tipo === "break") break;
          if (sg?.tipo === "return") return sg;
        } while (vero(yield* this.valuta(s.cond, amb)));
        return null;
      case "for": {
        const locale = new Ambiente(amb);
        if (s.init) yield* this.istruzione(s.init, locale);
        while (!s.cond || vero(yield* this.valuta(s.cond, locale))) {
          const sg = yield* this.istruzione(s.corpo, locale);
          if (sg?.tipo === "break") break;
          if (sg?.tipo === "return") return sg;
          if (s.passo) yield* this.valuta(s.passo, locale);
        }
        return null;
      }
      case "return":
        return { tipo: "return", valore: s.e ? yield* this.valuta(s.e, amb) : VOID };
      case "break":
        return { tipo: "break" };
      case "continue":
        return { tipo: "continue" };
      case "switch": {
        const v = yield* this.valuta(s.e, amb);
        let attivo = false;
        const locale = new Ambiente(amb);
        for (const caso of s.casi) {
          if (!attivo) {
            if (caso.valore === null) attivo = true;
            else {
              const cv = yield* this.valuta(caso.valore, amb);
              attivo = v.t === "n" && cv.t === "n" && v.v === cv.v;
            }
          }
          if (!attivo) continue;
          for (const x of caso.corpo) {
            const sg = yield* this.istruzione(x, locale);
            if (sg?.tipo === "break") return null;
            if (sg) return sg;
          }
        }
        // default scritto prima di altri casi: se nessuno combacia, si entra dal default.
        return null;
      }
    }
  }

  private *dichiara(tipo: Tipo, d: Dichiarato, amb: Ambiente, riga: number): Generator<Pausa, void, void> {
    if (d.dimensione !== null) {
      const iniziali = Array.isArray(d.init) ? d.init : [];
      if (d.init !== null && !Array.isArray(d.init)) {
        // char testo[] = "ciao";
        const testo = yield* this.valuta(d.init, amb);
        if (testo.t !== "s") throw new ErroreArduino(riga, `Per riempire l'array ${d.nome} usa le graffe { … }.`);
        const el = [...testo.v].map((c) => ({ tipo, valore: num(c.charCodeAt(0)) }));
        el.push({ tipo, valore: num(0) });
        amb.definisci(d.nome, { tipo: { nome: "array", senzaSegno: false }, valore: { t: "a", el, tipo } });
        return;
      }
      let n = iniziali.length;
      if (d.dimensione !== "auto") {
        const dv = yield* this.valuta(d.dimensione, amb);
        if (dv.t !== "n" || dv.v < 0) throw new ErroreArduino(riga, `La dimensione dell'array ${d.nome} deve essere un numero.`);
        n = Math.trunc(dv.v);
      }
      if (iniziali.length > n) throw new ErroreArduino(riga, `Troppi valori per l'array ${d.nome} (al massimo ${n}).`);
      const el: Cella[] = [];
      for (let i = 0; i < n; i++) {
        const v = i < iniziali.length ? yield* this.valuta(iniziali[i], amb) : tipo.nome === "String" ? { t: "s" as const, v: "" } : num(0, tipo.nome === "float");
        el.push({ tipo, valore: converti(v, tipo, riga) });
      }
      amb.definisci(d.nome, { tipo: { nome: "array", senzaSegno: false }, valore: { t: "a", el, tipo } });
      return;
    }
    if (tipo.nome === "Servo" || tipo.nome === "LiquidCrystal") {
      const arg: number[] = [];
      for (const a of d.costruttore ?? []) {
        const v = yield* this.valuta(a, amb);
        arg.push(v.t === "n" ? v.v : 0);
      }
      const dati: Record<string, unknown> = tipo.nome === "Servo" ? { pin: null, angolo: 90 } : { pin: arg, colonne: 16, righe: 2, cx: 0, cy: 0, testo: [] as string[] };
      amb.definisci(d.nome, { tipo, valore: { t: "o", classe: tipo.nome, dati, nome: d.nome } });
      return;
    }
    let valore: Valore = tipo.nome === "String" ? { t: "s", v: "" } : num(0, tipo.nome === "float");
    if (d.costruttore && d.costruttore.length > 0) valore = yield* this.valuta(d.costruttore[0], amb);
    if (d.init !== null && !Array.isArray(d.init)) valore = yield* this.valuta(d.init, amb);
    amb.definisci(d.nome, { tipo, valore: converti(valore, tipo, riga) });
  }

  // --- espressioni ---

  private cella(e: Espr, amb: Ambiente): Generator<Pausa, Cella, void>;
  private *cella(e: Espr, amb: Ambiente): Generator<Pausa, Cella, void> {
    if (e.k === "id") {
      const c = amb.cerca(e.nome);
      if (!c) {
        if (e.nome in COSTANTI) throw new ErroreArduino(e.riga, `${e.nome} è una costante: non si può modificare.`);
        throw new ErroreArduino(e.riga, `La variabile «${e.nome}» non è stata dichiarata (scrivi per esempio int ${e.nome} = 0; prima di usarla).`);
      }
      return c;
    }
    if (e.k === "indice") {
      const arr = yield* this.cella(e.arr, amb);
      const iv = yield* this.valuta(e.i, amb);
      if (arr.valore.t === "s") throw new ErroreArduino(e.riga, "Per cambiare una lettera di una String usa setCharAt().");
      if (arr.valore.t !== "a") throw new ErroreArduino(e.riga, "Le parentesi quadre [ ] si usano solo con gli array.");
      const i = iv.t === "n" ? Math.trunc(iv.v) : -1;
      if (i < 0 || i >= arr.valore.el.length) {
        throw new ErroreArduino(e.riga, `Indice ${i} fuori dall'array (va da 0 a ${arr.valore.el.length - 1}).`);
      }
      return arr.valore.el[i];
    }
    throw new ErroreArduino(e.riga, "Qui serve il nome di una variabile.");
  }

  private *valuta(e: Espr, amb: Ambiente): Generator<Pausa, Valore, void> {
    switch (e.k) {
      case "num":
        return num(e.v, e.float);
      case "str":
        return { t: "s", v: e.v };
      case "id": {
        const c = amb.cerca(e.nome);
        if (c) return c.valore;
        if (e.nome in COSTANTI) return num(COSTANTI[e.nome], e.nome.includes("PI"));
        if (e.nome === "Serial") return { t: "o", classe: "Serial", dati: {}, nome: "Serial" };
        throw new ErroreArduino(e.riga, `La variabile «${e.nome}» non è stata dichiarata.`);
      }
      case "indice": {
        const base = yield* this.valuta(e.arr, amb);
        if (base.t === "s") {
          const iv = yield* this.valuta(e.i, amb);
          return num(base.v.charCodeAt(iv.t === "n" ? iv.v : 0) || 0);
        }
        return (yield* this.cella(e, amb)).valore;
      }
      case "assegna": {
        const c = yield* this.cella(e.bersaglio, amb);
        let v = yield* this.valuta(e.valore, amb);
        if (e.op !== "=") v = this.operazione(e.op.slice(0, -1), c.valore, v, e.riga);
        c.valore = converti(v, c.tipo, e.riga);
        return c.valore;
      }
      case "incr": {
        const c = yield* this.cella(e.bersaglio, amb);
        const prima = c.valore;
        c.valore = converti(this.operazione(e.op === "++" ? "+" : "-", prima, num(1), e.riga), c.tipo, e.riga);
        return e.prefisso ? c.valore : prima;
      }
      case "un": {
        const v = yield* this.valuta(e.e, amb);
        if (v.t !== "n") throw new ErroreArduino(e.riga, `L'operatore ${e.op} si usa con i numeri.`);
        if (e.op === "-") return num(-v.v, v.float);
        if (e.op === "+") return v;
        if (e.op === "!") return num(v.v === 0 ? 1 : 0);
        return num(~Math.trunc(v.v));
      }
      case "bin": {
        if (e.op === "&&") return num(vero(yield* this.valuta(e.a, amb)) && vero(yield* this.valuta(e.b, amb)) ? 1 : 0);
        if (e.op === "||") return num(vero(yield* this.valuta(e.a, amb)) || vero(yield* this.valuta(e.b, amb)) ? 1 : 0);
        const a = yield* this.valuta(e.a, amb);
        const b = yield* this.valuta(e.b, amb);
        if (e.op === ",") return b;
        return this.operazione(e.op, a, b, e.riga);
      }
      case "ternario":
        return vero(yield* this.valuta(e.cond, amb)) ? yield* this.valuta(e.si, amb) : yield* this.valuta(e.no, amb);
      case "cast":
        return converti(yield* this.valuta(e.e, amb), e.tipo, e.riga);
      case "chiama":
        return yield* this.chiamata(e.nome, e.arg, amb, e.riga);
      case "metodo":
        return yield* this.metodo(e, amb);
    }
  }

  private operazione(op: string, a: Valore, b: Valore, riga: number): Valore {
    if (op === "+" && (a.t === "s" || b.t === "s")) return { t: "s", v: testoDi(a) + testoDi(b) };
    if ((op === "==" || op === "!=") && a.t === "s" && b.t === "s") return num((a.v === b.v) === (op === "==") ? 1 : 0);
    if (a.t !== "n" || b.t !== "n") throw new ErroreArduino(riga, `L'operatore ${op} non si può usare fra questi valori.`);
    const float = a.float || b.float;
    const x = a.v;
    const y = b.v;
    switch (op) {
      case "+":
        return num(x + y, float);
      case "-":
        return num(x - y, float);
      case "*":
        return num(x * y, float);
      case "/":
        if (y === 0 && !float) throw new ErroreArduino(riga, "Divisione per zero fra numeri interi.");
        return float ? num(x / y, true) : num(Math.trunc(x / y));
      case "%":
        if (y === 0) throw new ErroreArduino(riga, "Resto della divisione per zero.");
        if (float) throw new ErroreArduino(riga, "L'operatore % (resto) si usa solo con i numeri interi.");
        return num(x % y);
      case "==":
        return num(x === y ? 1 : 0);
      case "!=":
        return num(x !== y ? 1 : 0);
      case "<":
        return num(x < y ? 1 : 0);
      case "<=":
        return num(x <= y ? 1 : 0);
      case ">":
        return num(x > y ? 1 : 0);
      case ">=":
        return num(x >= y ? 1 : 0);
      case "&":
        return num(Math.trunc(x) & Math.trunc(y));
      case "|":
        return num(Math.trunc(x) | Math.trunc(y));
      case "^":
        return num(Math.trunc(x) ^ Math.trunc(y));
      case "<<":
        return num(Math.trunc(x) << Math.trunc(y));
      case ">>":
        return num(Math.trunc(x) >> Math.trunc(y));
    }
    throw new ErroreArduino(riga, `Operatore ${op} sconosciuto.`);
  }

  private *argomentiNumerici(arg: Espr[], amb: Ambiente, quanti: number[], nome: string, riga: number): Generator<Pausa, number[], void> {
    if (!quanti.includes(arg.length)) {
      throw new ErroreArduino(riga, `${nome}() vuole ${quanti.join(" o ")} ${quanti.length === 1 && quanti[0] === 1 ? "valore" : "valori"} fra le parentesi (ne hai scritti ${arg.length}).`);
    }
    const out: number[] = [];
    for (const a of arg) {
      const v = yield* this.valuta(a, amb);
      if (v.t !== "n") throw new ErroreArduino(riga, `${nome}() vuole dei numeri.`);
      out.push(v.v);
    }
    return out;
  }

  private pin(n: number, riga: number, nomeFunzione: string): string {
    const p = nomePin(n);
    if (!p) throw new ErroreArduino(riga, `${nomeFunzione}: il pin ${n} non esiste sulla scheda Uno (usa 0…13 o A0…A5).`);
    return p;
  }

  private *chiamata(nome: string, arg: Espr[], amb: Ambiente, riga: number): Generator<Pausa, Valore, void> {
    yield* this.costo();
    const args = (q: number[]) => this.argomentiNumerici(arg, amb, q, nome, riga);
    switch (nome) {
      case "pinMode": {
        const [p, m] = yield* args([2]);
        this.hw.pinMode(this.pin(p, riga, nome), m === 1 ? "OUTPUT" : m === 2 ? "INPUT_PULLUP" : "INPUT");
        return VOID;
      }
      case "digitalWrite": {
        const [p, v] = yield* args([2]);
        this.hw.digitalWrite(this.pin(p, riga, nome), v !== 0 ? 1 : 0);
        return VOID;
      }
      case "digitalRead": {
        const [p] = yield* args([1]);
        return num(this.hw.digitalRead(this.pin(p, riga, nome)));
      }
      case "analogRead": {
        const [p] = yield* args([1]);
        // analogRead(0) significa A0.
        const pin = p >= 0 && p <= 5 ? `A${Math.trunc(p)}` : this.pin(p, riga, nome);
        if (!pin.startsWith("A")) throw new ErroreArduino(riga, "analogRead funziona solo sui pin A0…A5.");
        this.tempoUs += 100; // una conversione dura circa 100 µs
        return num(this.hw.analogRead(pin));
      }
      case "analogWrite": {
        const [p, v] = yield* args([2]);
        this.hw.analogWrite(this.pin(p, riga, nome), Math.min(255, Math.max(0, Math.trunc(v))));
        return VOID;
      }
      case "delay": {
        const [ms] = yield* args([1]);
        if (ms > 0) yield Math.trunc(ms) * 1000;
        return VOID;
      }
      case "delayMicroseconds": {
        const [us] = yield* args([1]);
        if (us > 0) yield Math.trunc(us);
        return VOID;
      }
      case "millis":
        yield* args([0]);
        return num(Math.floor(this.tempoUs / 1000));
      case "micros":
        yield* args([0]);
        return num(Math.floor(this.tempoUs));
      case "map": {
        const [x, a, b, c, d] = yield* args([5]);
        if (b === a) throw new ErroreArduino(riga, "map(): i due estremi di partenza non possono essere uguali.");
        return num(Math.trunc(((x - a) * (d - c)) / (b - a) + c));
      }
      case "constrain": {
        const [x, a, b] = yield* this.valoriMisti(arg, amb, 3, nome, riga);
        return num(Math.min(b.v, Math.max(a.v, x.v)), x.float || a.float || b.float);
      }
      case "min":
      case "max": {
        const [a, b] = yield* this.valoriMisti(arg, amb, 2, nome, riga);
        const r = nome === "min" ? Math.min(a.v, b.v) : Math.max(a.v, b.v);
        return num(r, a.float || b.float);
      }
      case "abs": {
        const [a] = yield* this.valoriMisti(arg, amb, 1, nome, riga);
        return num(Math.abs(a.v), a.float);
      }
      case "pow": {
        const [a, b] = yield* args([2]);
        return num(Math.pow(a, b), true);
      }
      case "sqrt":
      case "sin":
      case "cos":
      case "tan":
      case "log":
      case "exp":
      case "floor":
      case "ceil":
      case "round": {
        const [a] = yield* args([1]);
        const f = { sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, log: Math.log, exp: Math.exp, floor: Math.floor, ceil: Math.ceil, round: Math.round }[nome]!;
        return num(f(a), true);
      }
      case "random": {
        const v = yield* args([1, 2]);
        const [min, max] = v.length === 1 ? [0, v[0]] : v;
        return num(Math.floor(this.casuale() * Math.max(0, max - min)) + min);
      }
      case "randomSeed": {
        const [s] = yield* args([1]);
        this.semeCasuale = Math.trunc(s) || 1;
        return VOID;
      }
      case "tone": {
        const [p, f, durata] = yield* args([2, 3]);
        this.hw.tone(this.pin(p, riga, nome), f);
        void durata; // la durata facoltativa non viene gestita: il suono continua fino a noTone
        return VOID;
      }
      case "noTone": {
        const [p] = yield* args([1]);
        this.hw.noTone(this.pin(p, riga, nome));
        return VOID;
      }
      case "pulseIn": {
        const v = yield* args([2, 3]);
        const durata = this.hw.pulseIn(this.pin(v[0], riga, nome), v[1]);
        this.tempoUs += durata;
        return num(durata);
      }
      case "__int":
      case "__long":
      case "__byte":
      case "__char":
      case "__float":
      case "__double":
      case "__bool":
      case "__boolean":
      case "__word": {
        if (arg.length !== 1) throw new ErroreArduino(riga, `${nome.slice(2)}() vuole un valore.`);
        const v = yield* this.valuta(arg[0], amb);
        const nomeTipo = ({ double: "float", boolean: "bool", word: "int" } as Record<string, string>)[nome.slice(2)] ?? nome.slice(2);
        return converti(v, { nome: nomeTipo, senzaSegno: nome === "__word" }, riga);
      }
      case "__String": {
        if (arg.length === 0) return { t: "s", v: "" };
        const v = yield* this.valuta(arg[0], amb);
        const base = arg.length > 1 ? yield* this.valuta(arg[1], amb) : null;
        return { t: "s", v: testoDi(v, base?.t === "n" ? base.v : undefined) };
      }
    }
    const f = this.programma.funzioni.get(nome);
    if (!f) throw new ErroreArduino(riga, `La funzione ${nome}() non esiste. Controlla maiuscole e minuscole (per esempio digitalWrite, non digitalwrite).`);
    return yield* this.chiamaUtente(f, arg, riga, amb);
  }

  private *valoriMisti(arg: Espr[], amb: Ambiente, quanti: number, nome: string, riga: number): Generator<Pausa, { v: number; float: boolean }[], void> {
    if (arg.length !== quanti) throw new ErroreArduino(riga, `${nome}() vuole ${quanti} valori fra le parentesi.`);
    const out: { v: number; float: boolean }[] = [];
    for (const a of arg) {
      const v = yield* this.valuta(a, amb);
      if (v.t !== "n") throw new ErroreArduino(riga, `${nome}() vuole dei numeri.`);
      out.push(v);
    }
    return out;
  }

  private casuale(): number {
    // Generatore pseudocasuale semplice e ripetibile (come random() con lo stesso seme).
    this.semeCasuale = (this.semeCasuale * 1103515245 + 12345) & 0x7fffffff;
    return this.semeCasuale / 0x80000000;
  }

  private *chiamaUtente(f: Funzione, arg: Espr[], riga: number, chiamante?: Ambiente): Generator<Pausa, Valore, void> {
    if (arg.length !== f.parametri.length) {
      throw new ErroreArduino(riga, `${f.nome}() vuole ${f.parametri.length} valori fra le parentesi (ne hai scritti ${arg.length}).`);
    }
    if (this.profondita >= PROFONDITA_MASSIMA) throw new ErroreArduino(riga, `Troppe chiamate annidate di ${f.nome}(): la memoria della scheda finirebbe.`);
    const amb = new Ambiente(this.globali);
    for (let i = 0; i < arg.length; i++) {
      const par = f.parametri[i];
      if (par.riferimento && chiamante) {
        amb.definisci(par.nome, yield* this.cella(arg[i], chiamante));
      } else {
        const v = yield* this.valuta(arg[i], chiamante ?? this.globali);
        amb.definisci(par.nome, { tipo: par.tipo, valore: v.t === "a" ? v : converti(v, par.tipo, riga) });
      }
    }
    this.profondita++;
    try {
      const sg = yield* this.istruzione(f.corpo, amb);
      if (sg?.tipo === "return") return f.tipo.nome === "void" ? VOID : converti(sg.valore, f.tipo, riga);
      return VOID;
    } finally {
      this.profondita--;
    }
  }

  private *metodo(e: Extract<Espr, { k: "metodo" }>, amb: Ambiente): Generator<Pausa, Valore, void> {
    yield* this.costo();
    const ogg = yield* this.valuta(e.oggetto, amb);
    const riga = e.riga;
    const valori: Valore[] = [];
    for (const a of e.arg) valori.push(yield* this.valuta(a, amb));
    const n = (i: number) => {
      const v = valori[i];
      if (!v || v.t !== "n") throw new ErroreArduino(riga, `${e.nome}() vuole un numero.`);
      return v.v;
    };
    if (ogg.t === "s") {
      switch (e.nome) {
        case "length":
          return num(ogg.v.length);
        case "toInt":
          return num(parseInt(ogg.v, 10) || 0);
        case "toFloat":
          return num(parseFloat(ogg.v) || 0, true);
        case "charAt":
          return num(ogg.v.charCodeAt(n(0)) || 0);
        case "indexOf":
          return num(ogg.v.indexOf(testoDi(valori[0] ?? VOID)));
        case "substring":
          return { t: "s", v: valori.length > 1 ? ogg.v.substring(n(0), n(1)) : ogg.v.substring(n(0)) };
        case "toUpperCase":
        case "toLowerCase": {
          const c = yield* this.cella(e.oggetto, amb);
          c.valore = { t: "s", v: e.nome === "toUpperCase" ? ogg.v.toUpperCase() : ogg.v.toLowerCase() };
          return VOID;
        }
        case "trim": {
          const c = yield* this.cella(e.oggetto, amb);
          c.valore = { t: "s", v: ogg.v.trim() };
          return VOID;
        }
        case "equals":
          return num(ogg.v === testoDi(valori[0] ?? VOID) ? 1 : 0);
      }
      throw new ErroreArduino(riga, `Le String non hanno la funzione ${e.nome}().`);
    }
    if (ogg.t !== "o") throw new ErroreArduino(riga, `Il punto si usa dopo un oggetto (Serial, Servo, LiquidCrystal, String).`);
    if (ogg.classe === "Serial") {
      switch (e.nome) {
        case "begin":
          return VOID;
        case "print":
        case "println": {
          const base = valori[1]?.t === "n" ? valori[1].v : undefined;
          const testo = valori.length ? testoDi(valori[0], base) : "";
          this.hw.serialScrivi(e.nome === "println" ? testo + "\n" : testo);
          return VOID;
        }
        case "write":
          this.hw.serialScrivi(valori[0]?.t === "n" ? String.fromCharCode(valori[0].v) : testoDi(valori[0] ?? VOID));
          return VOID;
        case "available":
          return num(this.hw.serialDisponibili());
        case "read":
          return num(this.hw.serialLeggi());
        case "parseInt": {
          let testo = "";
          let c: number;
          while ((c = this.hw.serialLeggi()) >= 0) {
            const ch = String.fromCharCode(c);
            if (/[-\d]/.test(ch)) testo += ch;
            else if (testo) break;
          }
          return num(parseInt(testo, 10) || 0);
        }
        case "end":
        case "flush":
          return VOID;
      }
      throw new ErroreArduino(riga, `Serial non ha la funzione ${e.nome}().`);
    }
    if (ogg.classe === "Servo") {
      switch (e.nome) {
        case "attach":
          ogg.dati.pin = this.pin(n(0), riga, "attach");
          this.hw.servo(ogg.dati.pin as string, ogg.dati.angolo as number);
          return VOID;
        case "write": {
          const angolo = Math.min(180, Math.max(0, Math.trunc(n(0))));
          ogg.dati.angolo = angolo;
          if (ogg.dati.pin) this.hw.servo(ogg.dati.pin as string, angolo);
          return VOID;
        }
        case "read":
          return num(ogg.dati.angolo as number);
        case "detach":
          ogg.dati.pin = null;
          return VOID;
        case "attached":
          return num(ogg.dati.pin ? 1 : 0);
      }
      throw new ErroreArduino(riga, `Servo non ha la funzione ${e.nome}().`);
    }
    if (ogg.classe === "LiquidCrystal") {
      const d = ogg.dati as { colonne: number; righe: number; cx: number; cy: number; testo: string[] };
      const aggiorna = () => this.hw.lcd(ogg.nome, d.testo.slice(0, d.righe).map((r) => r.padEnd(d.colonne, " ").slice(0, d.colonne)), d.colonne);
      const vuoto = () => Array.from({ length: d.righe }, () => " ".repeat(d.colonne));
      switch (e.nome) {
        case "begin":
          d.colonne = valori.length > 0 ? n(0) : 16;
          d.righe = valori.length > 1 ? n(1) : 2;
          d.testo = vuoto();
          d.cx = 0;
          d.cy = 0;
          aggiorna();
          return VOID;
        case "clear":
          d.testo = vuoto();
          d.cx = 0;
          d.cy = 0;
          aggiorna();
          this.tempoUs += 2000; // il comando clear dell'LCD è lento
          return VOID;
        case "home":
          d.cx = 0;
          d.cy = 0;
          return VOID;
        case "setCursor":
          d.cx = Math.max(0, Math.trunc(n(0)));
          d.cy = Math.min(d.righe - 1, Math.max(0, Math.trunc(n(1))));
          return VOID;
        case "print":
        case "write": {
          if (d.testo.length === 0) d.testo = vuoto();
          const base = valori[1]?.t === "n" ? valori[1].v : undefined;
          const testo = e.nome === "write" && valori[0]?.t === "n" ? String.fromCharCode(valori[0].v) : testoDi(valori[0] ?? VOID, base);
          for (const ch of testo) {
            if (d.cx < d.colonne) {
              const r = d.testo[d.cy];
              d.testo[d.cy] = r.slice(0, d.cx) + ch + r.slice(d.cx + 1);
            }
            d.cx++;
          }
          aggiorna();
          return VOID;
        }
        case "noDisplay":
        case "display":
        case "cursor":
        case "noCursor":
        case "blink":
        case "noBlink":
        case "backlight":
        case "noBacklight":
          return VOID;
      }
      throw new ErroreArduino(riga, `LiquidCrystal non ha la funzione ${e.nome}().`);
    }
    throw new ErroreArduino(riga, `Oggetto sconosciuto.`);
  }
}

/** Analizza lo sketch e prepara l'esecutore; lancia ErroreArduino se il testo ha errori. */
export function preparaSketch(testo: string, hw: Hardware): Esecutore {
  return new Esecutore(analizzaSketch(testo), hw);
}
