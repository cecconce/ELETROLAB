// Scelta del colore di un filo: pallini colorati, uno per colore.
// Usata nel pannello Proprietà e nella barra che compare sopra il foglio
// quando si seleziona un filo (come l'ispettore di Tinkercad: non serve
// cercare la scheda Proprietà).
import { t } from "../testi";
import { coloreDisegnoFilo, GIALLO_VERDE, tavolozzaFili } from "./fili";
import type { Filo, Schema } from "./schema";

export interface PropsTavolozzaFilo {
  modulo: string;
  schema: Schema;
  filo: Filo;
  onCambiaSchema: (schema: Schema) => void;
}

/** Sfondo del pallino: il giallo-verde è a strisce, "nessun colore" usa il colore del tema. */
function sfondo(valore: string | undefined): string {
  if (valore === GIALLO_VERDE) return "repeating-linear-gradient(135deg, #fdd835 0 6px, #43a047 6px 12px)";
  return valore ?? "var(--testo)";
}

/** Nuovo schema con il colore del filo cambiato (undefined = colore predefinito). */
export function conColoreFilo(schema: Schema, id: string, colore: string | undefined): Schema {
  return {
    ...schema,
    fili: schema.fili.map((f) => {
      if (f.id !== id) return f;
      const { colore: _vecchio, ...resto } = f;
      return colore === undefined ? resto : { ...resto, colore };
    }),
  };
}

export function TavolozzaFilo({ modulo, schema, filo, onCambiaSchema }: PropsTavolozzaFilo) {
  const attuale = coloreDisegnoFilo(modulo, filo);
  return (
    <div className="tavolozza-fili" role="radiogroup" aria-label={t("proprieta.coloreCavetto")}>
      {tavolozzaFili(modulo).map((c) => (
        <button
          key={c.nome}
          type="button"
          role="radio"
          aria-checked={attuale === c.valore}
          className={attuale === c.valore ? "colore-filo scelto" : "colore-filo"}
          style={{ background: sfondo(c.valore) }}
          title={c.nome}
          aria-label={c.nome}
          data-colore={c.nome}
          onClick={() => onCambiaSchema(conColoreFilo(schema, filo.id, c.valore))}
        />
      ))}
    </div>
  );
}
