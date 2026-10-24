// Schema di prova mostrato nell'editor finché non arriva la libreria dei
// componenti (attività 1.5): tre blocchi generici da selezionare e trascinare.
import { t } from "../testi";
import { SCHEMA_VUOTO, aggiungiComponente, type Schema } from "./schema";

export function schemaProvvisorio(): Schema {
  let s = SCHEMA_VUOTO;
  const posizioni = [
    { x: 0, y: 0 },
    { x: 160, y: 0 },
    { x: 80, y: 140 },
  ];
  posizioni.forEach((p, i) => {
    s = aggiungiComponente(s, {
      id: `prova-${i + 1}`,
      tipo: "prova",
      etichetta: t("editor.bloccoProva", { n: i + 1 }),
      x: p.x,
      y: p.y,
      larghezza: 100,
      altezza: 60,
    });
  });
  return s;
}
