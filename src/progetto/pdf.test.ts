// Test del PDF scritto a mano: struttura valida (tabella xref con le posizioni giuste).
import { describe, expect, it } from "vitest";
import { byteDaDataUrl, pdfConImmagine } from "./pdf";

const testo = (b: Uint8Array) => new TextDecoder("latin1").decode(b);

describe("PDF con un'immagine", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9]);
  const pdf = pdfConImmagine(jpeg, 1600, 1131, undefined, "Marcia (arresto) è");
  const t = testo(pdf);

  it("intestazione, fine file e immagine JPEG incorporata", () => {
    expect(t.startsWith("%PDF-1.4")).toBe(true);
    expect(t.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(t).toContain("/Filter /DCTDecode");
    expect(t).toContain("/Width 1600 /Height 1131");
    expect(t).toContain(`/Length ${jpeg.length}`);
    expect(t).toContain("/MediaBox [0 0 841.89 595.28]");
  });

  it("la tabella xref punta all'inizio di ogni oggetto", () => {
    const inizio = Number(/startxref\n(\d+)/.exec(t)![1]);
    expect(t.slice(inizio, inizio + 4)).toBe("xref");
    const righe = t.slice(inizio).split("\n").slice(3, 9);
    righe.forEach((r, i) => {
      const pos = Number(r.slice(0, 10));
      expect(t.slice(pos, pos + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
    });
  });

  it("titolo nei metadati senza caratteri non ASCII e con le parentesi protette", () => {
    expect(t).toContain("/Title (Marcia \\(arresto\\) e)");
  });

  it("legge i byte da un data URL", () => {
    expect([...byteDaDataUrl("data:image/png;base64,AAEC/w==")]).toEqual([0, 1, 2, 255]);
  });
});
