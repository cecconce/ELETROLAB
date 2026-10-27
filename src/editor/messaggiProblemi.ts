// Testi in italiano semplice dei problemi trovati dalla diagnosi degli impianti
// (logica pura, senza Konva). Il motore (src/motori/impianti/diagnosi.ts) dice
// CHE COSA non va e DOVE; qui si compone la frase per lo studente con le sigle
// e i numeri dei morsetti che vede sul foglio. I modelli delle frasi sono in
// lingue/it.json (chiavi "problemi.*").
import type { Polo, Problema } from "../motori/impianti";
import { t } from "../testi";
import { numeroMorsetto } from "./associazioni";
import type { Libreria } from "./libreria";
import type { ComponenteSchema, Schema } from "./schema";

/** Problema pronto da mostrare: frase e punti da evidenziare. */
export interface ProblemaMostrato {
  /** Chiave stabile (per React e per ricordare quale riga è scelta). */
  chiave: string;
  gravita: Problema["gravita"];
  testo: string;
  componenti: string[];
  morsetti: string[];
}

/** "Lampada di segnalazione" → "lampada di segnalazione" (le sigle come "NA" restano). */
function minuscola(nome: string): string {
  if (nome.length > 1 && nome[1] === nome[1].toUpperCase() && nome[1] !== nome[1].toLowerCase()) return nome;
  return nome.charAt(0).toLowerCase() + nome.slice(1);
}

/** Elenco leggibile: "A", "A e B", "A, B e C". */
export function elenco(voci: readonly string[]): string {
  if (voci.length <= 1) return voci.join("");
  return `${voci.slice(0, -1).join(", ")} ${t("problemi.e")} ${voci[voci.length - 1]}`;
}

/** Poli scritti come sul foglio: "L1 e N", "+ e −". */
export function testoPoli(poli: readonly Polo[]): string {
  return elenco(poli.map((p) => (p === "-" ? "−" : p)));
}

/** Prepara le funzioni che danno un nome ai componenti e ai morsetti dello schema. */
function nomi(schema: Schema, libreria: Libreria) {
  const perId = new Map(schema.componenti.map((c) => [c.id, c]));
  const voce = (c: ComponenteSchema | undefined) => (c ? libreria.componenti.find((v) => v.id === c.tipo) : undefined);
  /** Sigla (K1, H1…) se c'è, altrimenti il nome del componente ("rete monofase"). */
  const componente = (id: string): string => {
    const c = perId.get(id);
    if (!c) return id;
    return c.etichetta.trim() || minuscola(voce(c)?.nome ?? c.tipo);
  };
  /** "X2 di H1" a partire da "H1id:X2". */
  const morsetto = (chiave: string): string => {
    const i = chiave.lastIndexOf(":");
    const id = chiave.slice(0, i);
    const c = perId.get(id);
    const numero = c ? numeroMorsetto(c, chiave.slice(i + 1)) : chiave.slice(i + 1);
    return t("problemi.morsettoDi", { morsetto: numero, componente: componente(id) });
  };
  /** "contatto ausiliario NA 33-34". */
  const contatto = (id: string): string => {
    const c = perId.get(id);
    const v = voce(c);
    if (!c || !v) return componente(id);
    const numeri = v.morsetti.map((m) => numeroMorsetto(c, m.id)).join("-");
    // Il nome della libreria contiene già i numeri del relè termico ("(95-96)").
    return v.contatto?.tipo === "termico" ? minuscola(v.nome) : `${minuscola(v.nome)} ${numeri}`;
  };
  return { componente, morsetto, contatto };
}

/** Frase in italiano di un problema. */
export function testoProblema(p: Problema, schema: Schema, libreria: Libreria): string {
  const n = nomi(schema, libreria);
  const principale = p.componenti[0] ? n.componente(p.componenti[0]) : "";
  const poli = p.poli ? testoPoli(p.poli) : "";
  switch (p.codice) {
    case "nessunaAlimentazione":
      return t("problemi.nessunaAlimentazione");
    case "contattoSenzaBobina":
      return t("problemi.contattoSenzaBobina", { contatto: n.contatto(p.componenti[0]) });
    case "contattoBobinaMancante":
      return t("problemi.contattoBobinaMancante", { contatto: n.contatto(p.componenti[0]), sigla: p.sigla ?? "" });
    case "contattoTermicoSenzaRele":
      return t("problemi.contattoTermicoSenzaRele", { contatto: n.contatto(p.componenti[0]) });
    case "circuitoAperto":
    case "bobinaSenzaAlimentazione": {
      const base = t(`problemi.${p.codice}`, {
        componente: principale,
        morsetto: p.morsettoPrincipale ? n.morsetto(p.morsettoPrincipale) : "",
      });
      // I morsetti senza filo (diversi da quello già citato) sono il punto da controllare.
      const liberi = p.morsetti.filter((k) => k !== p.morsettoPrincipale);
      return liberi.length > 0 ? `${base} ${t("problemi.morsettiLiberi", { elenco: elenco(liberi.map(n.morsetto)) })}` : base;
    }
    case "inSerie":
      return t("problemi.inSerie", { componenti: elenco(p.componenti.map(n.componente)) });
    case "stessoPolo":
      return t("problemi.stessoPolo", { componente: principale, polo: poli });
    case "cortocircuito":
      return t("problemi.cortocircuito", { poli });
    case "interventoCortocircuito":
      return t("problemi.interventoCortocircuito", { componente: principale, poli });
    case "interventoSovraccarico":
      return t("problemi.interventoSovraccarico", { componente: principale });
    case "oscillazione":
      return t(p.componenti.length > 1 ? "problemi.oscillazionePiu" : "problemi.oscillazione", {
        bobine: elenco(p.componenti.map(n.componente)),
      });
  }
}

/** Tutti i problemi pronti per il pannello "Problemi". */
export function problemiDaMostrare(problemi: readonly Problema[], schema: Schema, libreria: Libreria): ProblemaMostrato[] {
  return problemi.map((p) => ({
    chiave: `${p.codice}|${p.componenti.join(",")}|${p.morsettoPrincipale ?? ""}`,
    gravita: p.gravita,
    testo: testoProblema(p, schema, libreria),
    componenti: p.componenti,
    morsetti: p.morsetti,
  }));
}
