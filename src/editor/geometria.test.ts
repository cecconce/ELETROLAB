// Test della geometria dell'editor: aggancio, zoom, conversioni e griglia.
import { describe, expect, it } from "vitest";
import {
  PASSO_GRIGLIA,
  VISTA_INIZIALE,
  ZOOM_MAX,
  ZOOM_MIN,
  agganciaPunto,
  agganciaValore,
  foglioASchermo,
  lineeGriglia,
  schermoAFoglio,
  spostaVista,
  vistaPerAdattare,
  vistaPerInquadrare,
  ZOOM_INQUADRA,
  vistaPizzico,
  annullaFiloAlSecondoDito,
  zoomRotellina,
  zoomVerso,
} from "./geometria";

describe("aggancio alla griglia", () => {
  it("arrotonda all'incrocio più vicino", () => {
    expect(agganciaValore(0)).toBe(0);
    expect(agganciaValore(9)).toBe(0);
    expect(agganciaValore(11)).toBe(PASSO_GRIGLIA);
    expect(agganciaValore(-11)).toBe(-PASSO_GRIGLIA);
    expect(agganciaValore(-4)).toBe(0); // niente -0
    expect(Object.is(agganciaValore(-4), -0)).toBe(false);
    expect(agganciaPunto({ x: 33, y: 47 })).toEqual({ x: 40, y: 40 });
    expect(agganciaPunto({ x: 33, y: 47 }, 10)).toEqual({ x: 30, y: 50 });
  });
});

describe("conversioni schermo ↔ foglio", () => {
  it("sono una l'inversa dell'altra", () => {
    const vista = { scala: 2.5, x: 120, y: -30 };
    const p = { x: 17, y: 42 };
    const andataRitorno = schermoAFoglio(vista, foglioASchermo(vista, p));
    expect(andataRitorno.x).toBeCloseTo(p.x);
    expect(andataRitorno.y).toBeCloseTo(p.y);
  });
});

describe("zoom", () => {
  it("tiene fermo il punto sotto il cursore", () => {
    const centro = { x: 300, y: 200 };
    const prima = schermoAFoglio(VISTA_INIZIALE, centro);
    const vista = zoomVerso(VISTA_INIZIALE, 2, centro);
    const dopo = schermoAFoglio(vista, centro);
    expect(vista.scala).toBe(2);
    expect(dopo.x).toBeCloseTo(prima.x);
    expect(dopo.y).toBeCloseTo(prima.y);
  });

  it("la rotellina in avanti ingrandisce, all'indietro rimpicciolisce", () => {
    const c = { x: 0, y: 0 };
    expect(zoomRotellina(VISTA_INIZIALE, -120, c).scala).toBeGreaterThan(1);
    expect(zoomRotellina(VISTA_INIZIALE, 3, c).scala).toBeLessThan(1);
    expect(zoomRotellina(VISTA_INIZIALE, 0, c)).toBe(VISTA_INIZIALE);
    // Mouse (±120) e touchpad (±3) danno lo stesso passo.
    expect(zoomRotellina(VISTA_INIZIALE, -120, c).scala).toBe(zoomRotellina(VISTA_INIZIALE, -3, c).scala);
  });

  it("resta entro i limiti", () => {
    let v = VISTA_INIZIALE;
    for (let i = 0; i < 100; i++) v = zoomRotellina(v, -1, { x: 0, y: 0 });
    expect(v.scala).toBe(ZOOM_MAX);
    for (let i = 0; i < 200; i++) v = zoomRotellina(v, 1, { x: 0, y: 0 });
    expect(v.scala).toBe(ZOOM_MIN);
  });
});

describe("spostamento della vista", () => {
  it("somma lo scostamento senza cambiare lo zoom", () => {
    expect(spostaVista({ scala: 2, x: 10, y: 10 }, 5, -20)).toEqual({ scala: 2, x: 15, y: -10 });
  });
});

describe("linee della griglia", () => {
  it("copre tutto il riquadro visibile", () => {
    const { verticali, orizzontali, passoVisibile } = lineeGriglia(VISTA_INIZIALE, 100, 60);
    expect(passoVisibile).toBe(PASSO_GRIGLIA);
    expect(verticali).toEqual([0, 20, 40, 60, 80, 100]);
    expect(orizzontali).toEqual([0, 20, 40, 60]);
    // Con un riquadro che non finisce su una linea si arriva alla linea successiva.
    expect(lineeGriglia(VISTA_INIZIALE, 110, 50).verticali.slice(-1)[0]).toBe(120);
  });

  it("segue lo spostamento della vista", () => {
    const { verticali } = lineeGriglia({ scala: 1, x: 30, y: 0 }, 100, 20);
    expect(verticali[0]).toBeLessThanOrEqual(-30);
    expect(verticali[verticali.length - 1]).toBeGreaterThanOrEqual(60);
  });

  it("dirada le linee quando lo zoom è basso", () => {
    const { passoVisibile, verticali } = lineeGriglia({ scala: 0.2, x: 0, y: 0 }, 1000, 10);
    expect(passoVisibile * 0.2).toBeGreaterThanOrEqual(8);
    expect(verticali.length).toBeLessThan(200);
  });
});

describe("adatta alla finestra", () => {
  it("centra lo schema e non ingrandisce oltre il 100%", () => {
    const v = vistaPerAdattare({ x: 0, y: 0, larghezza: 100, altezza: 100 }, 800, 600);
    expect(v.scala).toBe(1);
    expect(foglioASchermo(v, { x: 50, y: 50 })).toEqual({ x: 400, y: 300 });
  });

  it("rimpicciolisce uno schema grande finché ci sta", () => {
    const r = { x: -500, y: 0, larghezza: 2000, altezza: 400 };
    const v = vistaPerAdattare(r, 800, 600, 40);
    const a = foglioASchermo(v, { x: r.x, y: r.y });
    const b = foglioASchermo(v, { x: r.x + r.larghezza, y: r.y + r.altezza });
    expect(a.x).toBeGreaterThanOrEqual(39.9);
    expect(b.x).toBeLessThanOrEqual(760.1);
  });
});

describe("filo e secondo dito", () => {
  it("annulla il filo iniziato dal primo dito ancora appoggiato", () => {
    expect(annullaFiloAlSecondoDito(false, true)).toBe(true);
  });
  it("non annulla un filo iniziato prima, con un tocco già finito", () => {
    expect(annullaFiloAlSecondoDito(true, true)).toBe(false);
  });
  it("senza filo in corso non c'è niente da annullare", () => {
    expect(annullaFiloAlSecondoDito(false, false)).toBe(false);
    expect(annullaFiloAlSecondoDito(true, false)).toBe(false);
  });
});

describe("pizzico con due dita", () => {
  const v = { scala: 1, x: 0, y: 0 };
  it("allargare le dita al doppio raddoppia lo zoom tenendo fermo il punto in mezzo", () => {
    const n = vistaPizzico(v, [{ x: 90, y: 100 }, { x: 110, y: 100 }], [{ x: 80, y: 100 }, { x: 120, y: 100 }]);
    expect(n.scala).toBeCloseTo(2);
    expect(schermoAFoglio(n, { x: 100, y: 100 })).toEqual({ x: 100, y: 100 });
  });
  it("spostare le dita insieme sposta la vista senza cambiare lo zoom", () => {
    const n = vistaPizzico(v, [{ x: 0, y: 0 }, { x: 50, y: 0 }], [{ x: 30, y: 20 }, { x: 80, y: 20 }]);
    expect(n).toEqual({ scala: 1, x: 30, y: 20 });
  });
  it("lo zoom resta nei limiti", () => {
    const n = vistaPizzico(v, [{ x: 0, y: 0 }, { x: 1, y: 0 }], [{ x: 0, y: 0 }, { x: 1000, y: 0 }]);
    expect(n.scala).toBe(ZOOM_MAX);
  });
});

describe("inquadra il punto di un problema", () => {
  it("porta al centro e ingrandisce un componente piccolo fino al limite", () => {
    const v = vistaPerInquadrare({ x: 1000, y: 600, larghezza: 40, altezza: 60 }, 800, 600);
    expect(v.scala).toBe(ZOOM_INQUADRA);
    expect(foglioASchermo(v, { x: 1020, y: 630 })).toEqual({ x: 400, y: 300 });
  });

  it("rimpicciolisce se i componenti del problema sono lontani fra loro", () => {
    const r = { x: 0, y: 0, larghezza: 1600, altezza: 200 };
    const v = vistaPerInquadrare(r, 800, 600, 80);
    expect(v.scala).toBeCloseTo(640 / 1600);
    const a = foglioASchermo(v, { x: r.x, y: r.y });
    const b = foglioASchermo(v, { x: r.x + r.larghezza, y: r.y + r.altezza });
    expect(a.x).toBeCloseTo(80);
    expect(b.x).toBeCloseTo(720);
  });

  it("non scende sotto lo zoom minimo", () => {
    const v = vistaPerInquadrare({ x: 0, y: 0, larghezza: 100000, altezza: 10 }, 800, 600);
    expect(v.scala).toBe(ZOOM_MIN);
  });
});
