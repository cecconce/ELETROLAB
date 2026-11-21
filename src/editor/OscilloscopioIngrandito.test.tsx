// Oscilloscopio Arduino ingrandito: misure sullo schermo e finestra disegnata.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { estremiTraccia, OscilloscopioIngrandito, scriviVolt } from "./OscilloscopioIngrandito";
import type { SessioneArduino } from "../motori/arduino";

describe("oscilloscopio Arduino ingrandito", () => {
  it("massimo e minimo delle ultime 10 divisioni (PWM: livelli alto e basso)", () => {
    // 10 ms/div → finestra di 100 ms che finisce a 200 ms.
    const campioni = [
      { t: 0, v: 3 }, // finisce a 50 ms: fuori dalla finestra
      { t: 50_000, v: 0 },
      { t: 120_000, v: 5 },
      { t: 150_000, v: 2.5, pwm: { duty: 0.5, alto: 5, basso: 0, periodoUs: 2040 } },
    ];
    expect(estremiTraccia(campioni, 200_000, 0.01)).toEqual({ max: 5, min: 0 });
    expect(estremiTraccia([{ t: 0, v: 3.3 }], 200_000, 0.01)).toEqual({ max: 3.3, min: 3.3 });
    expect(estremiTraccia([], 200_000, 0.01)).toBeNull();
    expect(scriviVolt(-0.0001)).toBe("0,00 V");
    expect(scriviVolt(4.987)).toBe("4,99 V");
  });

  it("disegna schermo, scale e misure", () => {
    const sessione = { current: { campioni: { X: [{ t: 0, v: 5 }] }, esecutore: { tempoUs: 1_000_000 } } as unknown as SessioneArduino };
    const html = renderToStaticMarkup(
      <OscilloscopioIngrandito id="X" sigla="XSC1" tempoDiv={0.2} voltDiv={2} sessione={sessione} onChiudi={() => {}} />,
    );
    expect(html).toContain("XSC1");
    expect(html).toContain("200 ms/div");
    expect(html).toContain("2 V/div");
    expect(html).toContain("<polyline");
  });
});
