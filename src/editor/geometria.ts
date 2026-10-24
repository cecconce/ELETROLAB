// Geometria dell'editor grafico: griglia, aggancio, zoom e conversione
// tra coordinate dello schermo e coordinate del foglio di disegno.
// Funzioni pure (nessuna dipendenza da Konva o React), coperte da test.

/** Passo della griglia in unità del foglio (1 unità = 1 pixel a zoom 100%). */
export const PASSO_GRIGLIA = 20;

/** Limiti dello zoom: sotto il 20% non si legge più nulla, sopra il 400% si perde il contesto. */
export const ZOOM_MIN = 0.2;
export const ZOOM_MAX = 4;

/** Fattore di ingrandimento per ogni scatto della rotellina o clic su +/−. */
export const FATTORE_ZOOM = 1.1;

export interface Punto {
  x: number;
  y: number;
}

/**
 * Vista corrente dell'editor: `scala` è lo zoom (1 = 100%),
 * `x` e `y` sono lo spostamento in pixel dello schermo dell'origine del foglio.
 */
export interface Vista {
  scala: number;
  x: number;
  y: number;
}

export const VISTA_INIZIALE: Vista = { scala: 1, x: 0, y: 0 };

/** Arrotonda un valore al multiplo più vicino del passo di griglia. */
export function agganciaValore(valore: number, passo: number = PASSO_GRIGLIA): number {
  // "+ 0" evita di restituire -0, che nei confronti dei test dà fastidio.
  return Math.round(valore / passo) * passo + 0;
}

/** Aggancia un punto del foglio all'incrocio di griglia più vicino. */
export function agganciaPunto(p: Punto, passo: number = PASSO_GRIGLIA): Punto {
  return { x: agganciaValore(p.x, passo), y: agganciaValore(p.y, passo) };
}

/** Mantiene lo zoom entro i limiti ammessi. */
export function limitaScala(scala: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scala));
}

/** Converte un punto dello schermo (pixel nel riquadro dell'editor) in coordinate del foglio. */
export function schermoAFoglio(vista: Vista, p: Punto): Punto {
  return { x: (p.x - vista.x) / vista.scala, y: (p.y - vista.y) / vista.scala };
}

/** Converte un punto del foglio in pixel dello schermo. */
export function foglioASchermo(vista: Vista, p: Punto): Punto {
  return { x: p.x * vista.scala + vista.x, y: p.y * vista.scala + vista.y };
}

/**
 * Cambia lo zoom tenendo fermo il punto dello schermo `centro`
 * (di solito la posizione del mouse): ciò che sta sotto il cursore
 * resta sotto il cursore, come in tutti i programmi di disegno.
 */
export function zoomVerso(vista: Vista, nuovaScala: number, centro: Punto): Vista {
  const scala = limitaScala(nuovaScala);
  const sottoIlCursore = schermoAFoglio(vista, centro);
  return {
    scala,
    x: centro.x - sottoIlCursore.x * scala,
    y: centro.y - sottoIlCursore.y * scala,
  };
}

/**
 * Zoom con la rotellina: `deltaY` negativo (rotellina in avanti) ingrandisce,
 * positivo rimpicciolisce. Si usa solo il segno, così mouse e touchpad
 * danno lo stesso passo.
 */
export function zoomRotellina(vista: Vista, deltaY: number, centro: Punto): Vista {
  if (deltaY === 0) return vista;
  const fattore = deltaY < 0 ? FATTORE_ZOOM : 1 / FATTORE_ZOOM;
  return zoomVerso(vista, vista.scala * fattore, centro);
}

/** Sposta la vista di (dx, dy) pixel dello schermo. */
export function spostaVista(vista: Vista, dx: number, dy: number): Vista {
  return { ...vista, x: vista.x + dx, y: vista.y + dy };
}

/**
 * Linee della griglia visibili nel riquadro largo `larghezza` × `altezza` pixel.
 * Restituisce le coordinate sul foglio delle linee verticali (x) e orizzontali (y).
 * Se lo zoom è molto basso si disegna una linea ogni N per non riempire lo schermo.
 */
export function lineeGriglia(
  vista: Vista,
  larghezza: number,
  altezza: number,
  passo: number = PASSO_GRIGLIA,
): { verticali: number[]; orizzontali: number[]; passoVisibile: number } {
  // Almeno 8 pixel di schermo tra due linee.
  let passoVisibile = passo;
  while (passoVisibile * vista.scala < 8) passoVisibile *= 2;

  const alto = schermoAFoglio(vista, { x: 0, y: 0 });
  const basso = schermoAFoglio(vista, { x: larghezza, y: altezza });
  const da = (v: number) => Math.floor(v / passoVisibile) * passoVisibile;

  const verticali: number[] = [];
  // Si arriva fino alla prima linea oltre il bordo, così la griglia copre tutto il riquadro.
  for (let x = da(alto.x); x < basso.x + passoVisibile; x += passoVisibile) verticali.push(x + 0);
  const orizzontali: number[] = [];
  for (let y = da(alto.y); y < basso.y + passoVisibile; y += passoVisibile) orizzontali.push(y + 0);
  return { verticali, orizzontali, passoVisibile };
}

/**
 * Vista che mostra per intero il rettangolo indicato (coordinate del foglio)
 * dentro un riquadro di `larghezza` × `altezza` pixel, centrato e con un margine.
 * Lo zoom non supera il 100%: uno schema piccolo non viene ingrandito a dismisura.
 */
export function vistaPerAdattare(
  r: { x: number; y: number; larghezza: number; altezza: number },
  larghezza: number,
  altezza: number,
  margine = 40,
): Vista {
  const utileL = Math.max(1, larghezza - 2 * margine);
  const utileA = Math.max(1, altezza - 2 * margine);
  const scala = limitaScala(Math.min(1, utileL / Math.max(1, r.larghezza), utileA / Math.max(1, r.altezza)));
  const centro = { x: r.x + r.larghezza / 2, y: r.y + r.altezza / 2 };
  return { scala, x: larghezza / 2 - centro.x * scala, y: altezza / 2 - centro.y * scala };
}
