// Pannello "Ingressi e uscite" del PLC durante la simulazione (sotto il foglio).
// - Ingressi: un interruttore per ogni ingresso I usato nel Ladder; un clic lo
//   porta a 1 e lo lascia così (per i pulsanti "a impulso" si tiene premuto
//   il contatto direttamente sul Ladder).
// - Uscite e merker: spia accesa/spenta per ogni Q e M scritti dalle bobine.
// Finché non c'è il quadro virtuale (attività 3.5) è il modo più semplice per
// provare un programma.
import { confrontaOperandi, leggiOperando, normalizzaOperando, valoreBit, type SessionePlc } from "../motori/plc";
import { t } from "../testi";
import type { Schema } from "./schema";

export interface PropsPannelloIngressiPlc {
  sessione: SessionePlc;
  schema: Schema;
  onCommuta: (operando: string) => void;
}

/** Operandi di un'area usati nello schema, in ordine naturale e senza doppioni. */
export function operandiUsati(schema: Schema, area: "I" | "Q" | "M"): string[] {
  const usati = new Set<string>();
  for (const c of schema.componenti) {
    const op = normalizzaOperando(c.etichetta);
    if (leggiOperando(op)?.area === area) usati.add(op);
  }
  return [...usati].sort(confrontaOperandi);
}

export function PannelloIngressiPlc({ sessione, schema, onCommuta }: PropsPannelloIngressiPlc) {
  const ingressi = operandiUsati(schema, "I");
  const uscite = [...operandiUsati(schema, "Q"), ...operandiUsati(schema, "M")];
  const attivi = new Set([...sessione.premuti, ...sessione.fissi]);
  return (
    <section className="pannello-io-plc" aria-label={t("plc.io.titolo")}>
      <div className="pannello-io-gruppo">
        <h3>{t("plc.io.ingressi")}</h3>
        {ingressi.length === 0 && <span className="pannello-io-vuoto">{t("plc.io.nessuno")}</span>}
        {ingressi.map((op) => (
          <button
            key={op}
            type="button"
            className={attivi.has(op) ? "io-plc acceso" : "io-plc"}
            data-operando={op}
            aria-pressed={sessione.fissi.includes(op)}
            title={t("plc.io.suggerimento")}
            onClick={() => onCommuta(op)}
          >
            {op} = {attivi.has(op) ? 1 : 0}
          </button>
        ))}
      </div>
      <div className="pannello-io-gruppo">
        <h3>{t("plc.io.uscite")}</h3>
        {uscite.length === 0 && <span className="pannello-io-vuoto">{t("plc.io.nessuno")}</span>}
        {uscite.map((op) => {
          const v = valoreBit(sessione.stato, op);
          return (
            <span key={op} className={v ? "io-plc spia accesa" : "io-plc spia"} data-operando={op}>
              {op} = {v ? 1 : 0}
            </span>
          );
        })}
      </div>
    </section>
  );
}
