// Scrittura di un PDF di una pagina con un'immagine JPEG a tutta pagina,
// senza librerie esterne (il formato PDF è aperto e documentato: ISO 32000).
// Serve all'esportazione degli schemi: l'immagine (schema + cartiglio) viene
// preparata su un canvas, compressa in JPEG e messa in una pagina A4.

/** Misure della pagina A4 in punti tipografici (1/72 di pollice). */
export const A4_ORIZZONTALE = { larghezza: 841.89, altezza: 595.28 };
export const A4_VERTICALE = { larghezza: 595.28, altezza: 841.89 };

const codifica = new TextEncoder();

/**
 * Crea un PDF con una pagina delle misure indicate e l'immagine JPEG
 * (larghezzaPx × altezzaPx) adattata alla pagina, centrata e con margine.
 */
export function pdfConImmagine(
  jpeg: Uint8Array,
  larghezzaPx: number,
  altezzaPx: number,
  pagina = A4_ORIZZONTALE,
  titolo = "Schema",
): Uint8Array {
  const margine = 18;
  const scala = Math.min((pagina.larghezza - 2 * margine) / larghezzaPx, (pagina.altezza - 2 * margine) / altezzaPx);
  const w = larghezzaPx * scala;
  const h = altezzaPx * scala;
  const x = (pagina.larghezza - w) / 2;
  const y = (pagina.altezza - h) / 2;
  const num = (v: number) => (Math.round(v * 100) / 100).toString();
  const contenuto = `q ${num(w)} 0 0 ${num(h)} ${num(x)} ${num(y)} cm /Im0 Do Q`;
  // Titolo nei metadati: solo caratteri ASCII stampabili (le parentesi si proteggono).
  const titoloPdf = titolo.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/([()\\])/g, "\\$1");

  const parti: Uint8Array[] = [];
  const posizioni: number[] = [];
  let lunghezza = 0;
  const aggiungi = (dati: string | Uint8Array) => {
    const b = typeof dati === "string" ? codifica.encode(dati) : dati;
    parti.push(b);
    lunghezza += b.length;
  };
  const oggetto = (n: number, corpo: string) => {
    posizioni[n] = lunghezza;
    aggiungi(`${n} 0 obj\n${corpo}\nendobj\n`);
  };

  aggiungi("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  oggetto(1, "<< /Type /Catalog /Pages 2 0 R >>");
  oggetto(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  oggetto(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(pagina.larghezza)} ${num(pagina.altezza)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  posizioni[4] = lunghezza;
  aggiungi(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${larghezzaPx} /Height ${altezzaPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  aggiungi(jpeg);
  aggiungi("\nendstream\nendobj\n");
  oggetto(5, `<< /Length ${codifica.encode(contenuto).length} >>\nstream\n${contenuto}\nendstream`);
  oggetto(6, `<< /Title (${titoloPdf}) /Producer (ElettroLab) >>`);

  const inizioXref = lunghezza;
  let xref = `xref\n0 7\n0000000000 65535 f \n`;
  for (let n = 1; n <= 6; n++) xref += `${String(posizioni[n]).padStart(10, "0")} 00000 n \n`;
  aggiungi(xref);
  aggiungi(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${inizioXref}\n%%EOF\n`);

  const risultato = new Uint8Array(lunghezza);
  let p = 0;
  for (const b of parti) {
    risultato.set(b, p);
    p += b.length;
  }
  return risultato;
}

/** Byte di un'immagine da un data URL ("data:image/jpeg;base64,…"). */
export function byteDaDataUrl(url: string): Uint8Array {
  const base64 = url.slice(url.indexOf(",") + 1);
  const testo = atob(base64);
  const b = new Uint8Array(testo.length);
  for (let i = 0; i < testo.length; i++) b[i] = testo.charCodeAt(i);
  return b;
}
