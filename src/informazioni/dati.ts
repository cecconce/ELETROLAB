// Dati della finestra "Informazioni": autore, istituto, licenza e librerie usate.
// L'elenco delle librerie è l'unica fonte: la finestra lo mostra e i test
// controllano che corrisponda alle dipendenze vere (package.json, Cargo.toml)
// e che ogni voce sia riportata anche in LICENZE.txt.

export const AUTORE = "Pierluigi Ceccon";

/**
 * Nome dell'istituto mostrato nella finestra. Vuoto finché il docente non lo
 * indica: in quel caso la finestra mostra un testo neutro ("Istituto tecnico").
 */
export const ISTITUTO = "";

export const LICENZA_PROGRAMMA = "GPL-3.0";

export interface Libreria {
  /** Nome mostrato nella finestra e in LICENZE.txt. */
  nome: string;
  /** Licenza (identificativo SPDX), es. "MIT" o "MIT/Apache-2.0". */
  licenza: string;
  /** Titolari del copyright, come riportati nel file di licenza della libreria. */
  autori: string;
  /** A cosa serve in ElettroLab (in italiano semplice). */
  uso: string;
  /** Sito del progetto, mostrato come testo (l'app non apre connessioni). */
  sito: string;
  /** Pacchetti npm che rientrano in questa voce. */
  npm?: string[];
  /** Crate Rust che rientrano in questa voce. */
  crate?: string[];
}

export const LIBRERIE: Libreria[] = [
  {
    nome: "Tauri 2",
    licenza: "MIT/Apache-2.0",
    autori: "Tauri Apps Contributors (The Tauri Programme in the Commons Conservancy)",
    uso: "Guscio dell'applicazione desktop",
    sito: "tauri.app",
    npm: ["@tauri-apps/api"],
    crate: ["tauri", "tauri-build"],
  },
  {
    nome: "tauri-plugin-dialog",
    licenza: "MIT/Apache-2.0",
    autori: "Tauri Apps Contributors (The Tauri Programme in the Commons Conservancy)",
    uso: "Finestre Apri/Salva e conferme di Windows",
    sito: "tauri.app",
    npm: ["@tauri-apps/plugin-dialog"],
    crate: ["tauri-plugin-dialog"],
  },
  {
    nome: "React, React DOM",
    licenza: "MIT",
    autori: "Facebook, Inc. and its affiliates",
    uso: "Interfaccia",
    sito: "react.dev",
    npm: ["react", "react-dom", "scheduler", "react-reconciler"],
  },
  {
    nome: "Konva",
    licenza: "MIT",
    autori: "Eric Rowell (KineticJS), Anton Lavrenov (Konva)",
    uso: "Area di disegno su canvas",
    sito: "konvajs.org",
    npm: ["konva"],
  },
  {
    nome: "react-konva",
    licenza: "MIT",
    autori: "Anton Lavrenov",
    uso: "Collegamento fra Konva e React",
    sito: "konvajs.org",
    npm: ["react-konva", "its-fine"],
  },
  {
    nome: "Serde, serde_json",
    licenza: "MIT/Apache-2.0",
    autori: "Erick Tryzelaar, David Tolnay",
    uso: "Lettura e scrittura dei dati fra interfaccia e parte Rust",
    sito: "serde.rs",
    crate: ["serde", "serde_json"],
  },
];

/** Licenze ammesse per le librerie incluse nel programma (compatibili con la GPL-3.0). */
export const LICENZE_COMPATIBILI = ["MIT", "Apache-2.0", "MIT/Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "0BSD"];

/** true se la licenza (anche espressione SPDX tipo "MIT OR Apache-2.0") è fra quelle ammesse. */
export function licenzaCompatibile(licenza: string): boolean {
  const parti = licenza
    .replace(/[()]/g, "")
    .split(/\s+OR\s+|\//)
    .map((p) => p.trim())
    .filter(Boolean);
  // Con "OR" basta che una delle alternative sia compatibile.
  return parti.some((p) => LICENZE_COMPATIBILI.includes(p));
}

/** Testo dell'istituto da mostrare: il nome indicato oppure una dicitura neutra. */
export function istitutoDaMostrare(istituto: string, predefinito: string): string {
  const pulito = istituto.trim();
  return pulito === "" ? predefinito : pulito;
}
