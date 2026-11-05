// Elenco dei componenti di uno schema (distinta materiali, come in Tinkercad):
// componenti uguali (stesso tipo e stesso valore) raggruppati, con quantità
// e sigle; esportabile come CSV per il foglio di calcolo. Puro.
import { scriviOhm } from "./arduino";
import { etichettaValore } from "./elettronica";
import { TIPO_COMMENTO } from "./ladder";
import type { Libreria } from "./libreria";
import type { Schema } from "./schema";

export interface RigaDistinta {
  quantita: number;
  nome: string;
  valore: string;
  sigle: string[];
}

/** Ordine "naturale" delle sigle: K2 prima di K10. */
const confrontaSigle = (a: string, b: string) => a.localeCompare(b, "it", { numeric: true });

/** Valore da scrivere accanto al nome (resistenze, condensatori, tensioni…). */
function valoreDi(modulo: string, c: Schema["componenti"][number]): string {
  if (modulo === "arduino") {
    if (c.tipo === "resistenza") return scriviOhm(c.valore ?? 220);
    if (c.tipo === "alimentatore") return `${String(c.parametri?.tensione ?? 5).replace(".", ",")} V`;
    return "";
  }
  if (modulo === "elettronica") return etichettaValore(c.tipo, c.parametri);
  return "";
}

export function distintaComponenti(schema: Pick<Schema, "componenti">, libreria: Libreria): RigaDistinta[] {
  const gruppi = new Map<string, RigaDistinta>();
  for (const c of schema.componenti) {
    if (c.tipo === TIPO_COMMENTO) continue;
    const voce = libreria.componenti.find((v) => v.id === c.tipo);
    const nome = voce?.nome ?? c.tipo;
    const valore = valoreDi(libreria.modulo, c);
    const chiave = `${c.tipo}|${valore}`;
    const riga = gruppi.get(chiave) ?? { quantita: 0, nome, valore, sigle: [] };
    // I contatti dei contattori hanno la sigla della bobina: la sigla si conta una volta sola.
    riga.quantita++;
    if (c.etichetta && !riga.sigle.includes(c.etichetta)) riga.sigle.push(c.etichetta);
    gruppi.set(chiave, riga);
  }
  return [...gruppi.values()]
    .map((r) => ({ ...r, sigle: [...r.sigle].sort(confrontaSigle) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "it") || confrontaSigle(a.valore, b.valore));
}

/** CSV con il punto e virgola (lo apre direttamente Excel in italiano) e le virgolette dove servono. */
export function csvDistinta(righe: readonly RigaDistinta[], intestazioni: [string, string, string, string]): string {
  const campo = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const linee = [intestazioni.map(campo).join(";"), ...righe.map((r) => [String(r.quantita), r.nome, r.valore, r.sigle.join(", ")].map(campo).join(";"))];
  return linee.join("\r\n") + "\r\n";
}

/** Testo semplice da copiare: «3 × Resistenza 220 Ω (R1, R2, R3)». */
export function testoDistinta(righe: readonly RigaDistinta[]): string {
  return righe.map((r) => `${r.quantita} × ${r.nome}${r.valore ? ` ${r.valore}` : ""}${r.sigle.length ? ` (${r.sigle.join(", ")})` : ""}`).join("\n");
}
