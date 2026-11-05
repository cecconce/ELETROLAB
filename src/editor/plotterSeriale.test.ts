// Test del plotter seriale: lettura delle righe e scala del grafico.
import { describe, expect, it } from "vitest";
import { datiPlotter, scalaPlotter, valoriRiga } from "./plotterSeriale";

describe("righe del monitor seriale", () => {
  it("numeri soli, separati da virgole o spazi", () => {
    expect(valoriRiga("512")).toEqual([{ nome: null, valore: 512 }]);
    expect(valoriRiga("10, 20,30")).toEqual([10, 20, 30].map((valore) => ({ nome: null, valore })));
    expect(valoriRiga("1.5 -2 3e2")).toEqual([1.5, -2, 300].map((valore) => ({ nome: null, valore })));
  });

  it("coppie etichetta: valore, anche con l'unità e con le parentesi nell'etichetta", () => {
    expect(valoriRiga("Tensione: 6.00 V")).toEqual([{ nome: "Tensione", valore: 6 }]);
    expect(valoriRiga("Temperatura:21.5,Umidita:40")).toEqual([
      { nome: "Temperatura", valore: 21.5 },
      { nome: "Umidita", valore: 40 },
    ]);
    expect(valoriRiga("Velocita' (0-255): 128")).toEqual([{ nome: "Velocita' (0-255)", valore: 128 }]);
  });

  it("messaggi senza numeri: niente", () => {
    expect(valoriRiga("Movimento rilevato!")).toEqual([]);
    expect(valoriRiga("")).toEqual([]);
  });
});

describe("serie del grafico", () => {
  it("una serie per posizione, saltando i messaggi e l'ultima riga a metà", () => {
    const d = datiPlotter("Pronto\n1\n2\n3\n4");
    expect(d.serie).toEqual([{ nome: "1", valori: [1, 2, 3] }]);
    expect(d.campioni).toBe(3);
    expect(d.minimo).toBe(1);
    expect(d.massimo).toBe(3);
  });

  it("più serie con le etichette; quelle che mancano in una riga sono «buchi»", () => {
    const d = datiPlotter("A:1,B:10\nA:2\nA:3,B:30\n");
    expect(d.serie).toEqual([
      { nome: "A", valori: [1, 2, 3] },
      { nome: "B", valori: [10, null, 30] },
    ]);
  });

  it("tiene solo gli ultimi campioni", () => {
    const testo = Array.from({ length: 500 }, (_, i) => `${i}\n`).join("");
    const d = datiPlotter(testo, 200);
    expect(d.campioni).toBe(200);
    expect(d.serie[0].valori[0]).toBe(300);
    expect(d.serie[0].valori[199]).toBe(499);
  });

  it("nessun numero: grafico vuoto", () => {
    expect(datiPlotter("ciao\n").serie).toEqual([]);
  });
});

describe("scala verticale", () => {
  it("valori rotondi con le tacche", () => {
    expect(scalaPlotter(0, 1023)).toEqual({ da: 0, a: 1250, passo: 250 });
    expect(scalaPlotter(19.7, 21.3)).toEqual({ da: 19.5, a: 21.5, passo: 0.5 });
    expect(scalaPlotter(-3, 3)).toEqual({ da: -4, a: 4, passo: 2 });
  });

  it("valore costante: una fascia attorno", () => {
    const s = scalaPlotter(5, 5);
    expect(s.da).toBeLessThan(5);
    expect(s.a).toBeGreaterThan(5);
  });
});
