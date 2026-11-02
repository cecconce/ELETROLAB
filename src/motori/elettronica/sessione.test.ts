// Test della sessione del modulo Elettronica: componenti dello schema, strumenti e interazioni.
import { describe, expect, it } from "vitest";
import {
  avviaSessioneElettronica,
  clicGiuElettronica,
  clicSuElettronica,
  luminosita,
  passoElettronica,
  tensioneMorsetto,
  type ComponenteElettronico,
  type NodoDi,
} from "./sessione";
import { leggiValore, scriviValore } from "./valori";
import { analisiDC } from "./simulatore";

/**
 * Circuito descritto come elenco di collegamenti: ogni gruppo di morsetti
 * "componente.morsetto" è un nodo.
 */
function circuito(componenti: [string, string, Record<string, number | string>?][], nodi: string[][]) {
  const mappa = new Map<string, string>();
  nodi.forEach((gruppo, i) => gruppo.forEach((m) => mappa.set(m, `n${i}`)));
  const nodoDi: NodoDi = (c, m) => mappa.get(`${c}.${m}`) ?? `${c}.${m}`;
  const comp: ComponenteElettronico[] = componenti.map(([id, tipo, parametri]) => ({ id, tipo, parametri: parametri ?? {} }));
  return avviaSessioneElettronica(comp, nodoDi);
}

describe("valori con i prefissi", () => {
  it("legge i valori scritti come sugli schemi", () => {
    expect(leggiValore("4,7k")).toBeCloseTo(4700);
    expect(leggiValore("4k7")).toBeCloseTo(4700);
    expect(leggiValore("10 kΩ")).toBeCloseTo(10000);
    expect(leggiValore("100nF")).toBeCloseTo(1e-7);
    expect(leggiValore("10µ")).toBeCloseTo(1e-5);
    expect(leggiValore("2m2")).toBeCloseTo(0.0022);
    expect(leggiValore("1M")).toBeCloseTo(1e6);
    expect(leggiValore("1 kHz")).toBeCloseTo(1000);
    expect(leggiValore("-2,5 V")).toBeCloseTo(-2.5);
    expect(leggiValore("abc")).toBeNull();
    expect(leggiValore("")).toBeNull();
  });
  it("scrive i valori con il prefisso adatto", () => {
    expect(scriviValore(4700, "Ω")).toBe("4,7 kΩ");
    expect(scriviValore(1e-7, "F")).toBe("100 nF");
    expect(scriviValore(0.0123, "A")).toBe("12,3 mA");
    expect(scriviValore(5, "V")).toBe("5 V");
    expect(scriviValore(-1.5, "V")).toBe("-1,5 V");
    expect(scriviValore(0, "V")).toBe("0 V");
  });
});

describe("sessione Elettronica", () => {
  it("il voltmetro misura la tensione del partitore", () => {
    const s = circuito(
      [["V1", "generatore-dc", { tensione: 9 }], ["R1", "resistenza", { resistenza: 1000 }], ["R2", "resistenza", { resistenza: 2000 }], ["GND", "massa"], ["XMM1", "multimetro", { modalita: "V" }]],
      [["V1.+", "R1.1"], ["R1.2", "R2.1", "XMM1.+"], ["R2.2", "V1.-", "GND.0", "XMM1.COM"]],
    );
    expect(s.senzaMassa).toBe(false);
    expect(s.letture.XMM1.valore).toBeCloseTo(6, 2);
    expect(s.letture.XMM1.unita).toBe("V");
  });

  it("l'amperometro in serie misura la corrente", () => {
    const s = circuito(
      [["V1", "generatore-dc", { tensione: 10 }], ["R1", "resistenza", { resistenza: 1000 }], ["GND", "massa"], ["XMM1", "multimetro", { modalita: "A" }]],
      [["V1.+", "XMM1.+"], ["XMM1.COM", "R1.1"], ["R1.2", "V1.-", "GND.0"]],
    );
    expect(s.letture.XMM1.valore).toBeCloseTo(0.01, 4);
  });

  it("il wattmetro misura la potenza del carico (in continua e, come media, in alternata)", () => {
    const s = circuito(
      [["V1", "generatore-dc", { tensione: 10 }], ["R1", "resistenza", { resistenza: 10 }], ["GND", "massa"], ["XWM1", "wattmetro"]],
      [["V1.+", "XWM1.I+", "XWM1.V+"], ["XWM1.I-", "R1.1"], ["R1.2", "V1.-", "GND.0", "XWM1.V-"]],
    );
    passoElettronica(s, 0.05);
    expect(s.letture.XWM1.unita).toBe("W");
    expect(s.letture.XWM1.valore).toBeCloseTo(10, 1); // 10 V · 1 A
    // Sinusoide da 10 V di picco su 10 Ω: potenza media Vp² / (2R) = 5 W.
    const ac = circuito(
      [["G1", "generatore-funzioni", { forma: "sinusoide", ampiezza: 10, frequenza: 50 }], ["R1", "resistenza", { resistenza: 10 }], ["GND", "massa"], ["XWM1", "wattmetro"]],
      [["G1.+", "XWM1.I+", "XWM1.V+"], ["XWM1.I-", "R1.1"], ["R1.2", "G1.COM", "GND.0", "XWM1.V-"]],
    );
    for (let k = 0; k < 20; k++) passoElettronica(ac, 0.05);
    expect(ac.letture.XWM1.valore!).toBeGreaterThan(4.6);
    expect(ac.letture.XWM1.valore!).toBeLessThan(5.4);
  });

  it("l'ohmmetro misura le resistenze (anche in un circuito alimentato, a generatori spenti)", () => {
    const s = circuito(
      [["V1", "generatore-dc", { tensione: 10 }], ["R1", "resistenza", { resistenza: 1000 }], ["R2", "resistenza", { resistenza: 1000 }], ["GND", "massa"], ["XMM1", "multimetro", { modalita: "Ω" }]],
      [["V1.+", "R1.1", "XMM1.+"], ["R1.2", "R2.1", "XMM1.COM"], ["R2.2", "V1.-", "GND.0"]],
    );
    // Con il generatore spento R1 è in parallelo con R2 → 500 Ω.
    expect(s.letture.XMM1.valore).toBeCloseTo(500, 0);
    const aperto = circuito([["R1", "resistenza"], ["GND", "massa"], ["XMM1", "multimetro", { modalita: "Ω" }]], [["R1.1", "XMM1.+"], ["XMM1.COM", "GND.0"]]);
    expect(aperto.letture.XMM1.valore).toBeNull();
  });

  it("interruttore e LED: il LED si accende solo con l'interruttore chiuso", () => {
    const s = circuito(
      [["V1", "generatore-dc", { tensione: 5 }], ["S1", "interruttore"], ["R1", "resistenza", { resistenza: 220 }], ["D1", "led", { colore: "verde" }], ["GND", "massa"]],
      [["V1.+", "S1.1"], ["S1.2", "R1.1"], ["R1.2", "D1.a"], ["D1.k", "V1.-", "GND.0"]],
    );
    const led = s.componenti.find((c) => c.id === "D1")!;
    expect(luminosita(s, led)).toBe(0);
    clicGiuElettronica(s, "S1");
    passoElettronica(s, 0.001);
    expect(luminosita(s, led)).toBeGreaterThan(0.5);
    clicGiuElettronica(s, "S1");
    passoElettronica(s, 0.001);
    expect(luminosita(s, led)).toBe(0);
  });

  it("pulsante: conduce solo mentre è premuto", () => {
    const s = circuito(
      [["V1", "generatore-dc", { tensione: 12 }], ["S1", "pulsante"], ["H1", "lampadina", { tensione: 12, potenza: 1.2 }], ["GND", "massa"]],
      [["V1.+", "S1.1"], ["S1.2", "H1.1"], ["H1.2", "V1.-", "GND.0"]],
    );
    const h = s.componenti.find((c) => c.id === "H1")!;
    clicGiuElettronica(s, "S1");
    passoElettronica(s, 0.001);
    expect(luminosita(s, h)).toBeCloseTo(1, 2);
    clicSuElettronica(s, "S1");
    passoElettronica(s, 0.001);
    expect(luminosita(s, h)).toBeLessThan(0.01);
  });

  it("un LED senza resistenza si brucia", () => {
    const s = circuito([["V1", "generatore-dc", { tensione: 9 }], ["D1", "led"], ["GND", "massa"]], [["V1.+", "D1.a"], ["D1.k", "V1.-", "GND.0"]]);
    expect(s.bruciati.has("D1")).toBe(true);
    expect(luminosita(s, s.componenti[1])).toBe(0);
  });

  it("LED blu: soglia intorno a 3 V", () => {
    const s = circuito(
      [["V1", "generatore-dc", { tensione: 5 }], ["R1", "resistenza", { resistenza: 150 }], ["D1", "led", { colore: "blu" }], ["GND", "massa"]],
      [["V1.+", "R1.1"], ["R1.2", "D1.a"], ["D1.k", "V1.-", "GND.0"]],
    );
    const v = tensioneMorsetto(s, "D1", "a");
    expect(v).toBeGreaterThan(2.8);
    expect(v).toBeLessThan(3.4);
  });

  it("potenziometro: il cursore divide la tensione e si sposta con il clic", () => {
    const s = circuito(
      [["V1", "generatore-dc", { tensione: 10 }], ["P1", "potenziometro", { resistenza: 10000 }], ["GND", "massa"], ["XMM1", "multimetro"]],
      [["V1.+", "P1.3"], ["P1.2", "XMM1.+"], ["P1.1", "V1.-", "GND.0", "XMM1.COM"]],
    );
    expect(s.letture.XMM1.valore).toBeCloseTo(5, 1);
    clicGiuElettronica(s, "P1");
    clicGiuElettronica(s, "P1");
    passoElettronica(s, 0.001);
    expect(s.letture.XMM1.valore).toBeCloseTo(7, 1);
    clicGiuElettronica(s, "P1", true);
    passoElettronica(s, 0.001);
    expect(s.letture.XMM1.valore).toBeCloseTo(6, 1);
  });

  it("oscilloscopio: registra la sinusoide del generatore di funzioni sul canale A e il segnale filtrato sul B", () => {
    const s = circuito(
      [["XFG1", "generatore-funzioni", { forma: "sinusoide", frequenza: 1000, ampiezza: 2 }], ["R1", "resistenza", { resistenza: 1000 }], ["C1", "condensatore", { capacita: 159e-9 }], ["GND", "massa"], ["XSC1", "oscilloscopio"]],
      [["XFG1.+", "R1.1", "XSC1.A"], ["R1.2", "C1.1", "XSC1.B"], ["C1.2", "XFG1.COM", "GND.0", "XSC1.COM"]],
    );
    expect(s.dt).toBeCloseTo(1e-5);
    for (let k = 0; k < 10; k++) passoElettronica(s, 0.05);
    const st = s.oscilloscopi.XSC1;
    // Ultimo periodo: ampiezza 2 V sul canale A; su B il filtro (fc ≈ 1 kHz) attenua di circa 3 dB.
    const ultimi = st.t.length - 100;
    const maxA = Math.max(...st.canali[0].slice(ultimi));
    const maxB = Math.max(...st.canali[1].slice(ultimi));
    expect(maxA).toBeCloseTo(2, 1);
    expect(maxB / maxA).toBeGreaterThan(0.65);
    expect(maxB / maxA).toBeLessThan(0.76);
    expect(s.tempo).toBeGreaterThan(0.03);
  });

  it("regolatore 7805: 5 V in uscita con 12 V in ingresso, ingresso − 2 V se l'ingresso è troppo basso", () => {
    const reg = (vin: number) =>
      circuito(
        [["V1", "generatore-dc", { tensione: vin }], ["U1", "regolatore", { tensione: 5 }], ["RL", "resistenza", { resistenza: 100 }], ["GND", "massa"]],
        [["V1.+", "U1.in"], ["U1.out", "RL.1"], ["RL.2", "U1.gnd", "V1.-", "GND.0"]],
      );
    expect(tensioneMorsetto(reg(12), "U1", "out")).toBeCloseTo(5, 1);
    expect(tensioneMorsetto(reg(6), "U1", "out")).toBeCloseTo(4, 1);
    // La corrente del carico (50 mA) arriva dall'ingresso.
    expect(Math.abs(reg(12).soluzione!.correnti.V1)).toBeCloseTo(0.05, 2);
  });

  it("senza massa: segnalato; generatore in corto: segnalato", () => {
    const s = circuito([["V1", "generatore-dc"], ["R1", "resistenza"]], [["V1.+", "R1.1"], ["R1.2", "V1.-"]]);
    expect(s.senzaMassa).toBe(true);
    const corto = circuito([["V1", "generatore-dc", { tensione: 5 }], ["GND", "massa"], ["S1", "interruttore"]], [["V1.+", "S1.1"], ["S1.2", "V1.-", "GND.0"]]);
    clicGiuElettronica(corto, "S1");
    passoElettronica(corto, 0.001);
    expect(corto.inCorto.has("V1")).toBe(true);
  });

  it("operazionale con carico basso: l'uscita resta quella prevista", () => {
    const s = analisiDC([
      { tipo: "V", id: "VIN", p: "in", n: "0", onda: { tipo: "continua", valore: 2 } },
      { tipo: "OP", id: "U1", piu: "in", meno: "out", uscita: "out", vsat: 12 },
      { tipo: "R", id: "RL", a: "out", b: "0", ohm: 10 },
    ]);
    expect(s.tensioni.out).toBeCloseTo(2, 2);
  });
});

describe("storia degli strumenti", () => {
  it("con le basi dei tempi lunghe si usa la registrazione lenta (un campione ogni 2 ms)", async () => {
    const { registrazionePer } = await import("./sessione");
    const s = circuito(
      [["V1", "generatore-dc", { tensione: 10 }], ["R1", "resistenza", { resistenza: 10000 }], ["C1", "condensatore", { capacita: 100e-6 }], ["GND", "massa"], ["XSC1", "oscilloscopio"]],
      [["V1.+", "R1.1"], ["R1.2", "C1.1", "XSC1.A"], ["C1.2", "V1.-", "GND.0", "XSC1.COM"]],
    );
    // τ = 1 s: si simulano 3 s (i passi da 0,1 ms sono 30 000, la storia fine ne tiene 6000).
    for (let k = 0; k < 75; k++) passoElettronica(s, 0.04);
    expect(s.tempo).toBeGreaterThan(2.9);
    const fine = registrazionePer(s.oscilloscopi.XSC1, 0.005);
    expect(fine).toBe(s.oscilloscopi.XSC1);
    const lenta = registrazionePer(s.oscilloscopi.XSC1, 1);
    expect(lenta.t[0]).toBe(0);
    // Dopo τ la tensione è il 63 % di 10 V.
    const i = lenta.t.findIndex((t) => t >= 1);
    expect(lenta.canali[0][i]).toBeCloseTo(6.32, 0);
  });
});

describe("plotter di Bode", () => {
  it("filtro RC passa-basso: −3 dB a 1 kHz circa, −20 dB/decade e sfasamento fino a −90°", async () => {
    const { rispostaBode } = await import("./sessione");
    const s = circuito(
      [["XFG1", "generatore-funzioni", { frequenza: 1000, ampiezza: 1 }], ["R1", "resistenza", { resistenza: 1000 }], ["C1", "condensatore", { capacita: 159e-9 }], ["GND", "massa"], ["XBP1", "plotter-bode"]],
      [["XFG1.+", "R1.1", "XBP1.IN"], ["R1.2", "C1.1", "XBP1.OUT"], ["C1.2", "XFG1.COM", "GND.0", "XBP1.COM"]],
    );
    const r = rispostaBode(s, "XBP1")!;
    expect(r.taglio).toBeGreaterThan(900);
    expect(r.taglio).toBeLessThan(1100);
    expect(r.db[0]).toBeCloseTo(0, 1);
    const i100k = r.frequenze.findIndex((f) => f >= 1e5);
    expect(r.db[i100k]).toBeCloseTo(-40, 0);
    expect(r.fase[i100k]).toBeLessThan(-85);
  });
  it("senza generatore di funzioni non c'è risposta", async () => {
    const { rispostaBode } = await import("./sessione");
    const s = circuito([["V1", "generatore-dc"], ["GND", "massa"], ["XBP1", "plotter-bode"]], [["V1.-", "GND.0", "XBP1.COM"]]);
    expect(rispostaBode(s, "XBP1")).toBeNull();
  });
});
