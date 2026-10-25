// Il programma deve funzionare al 100% offline, senza telemetria.
// Questi controlli impediscono di introdurre per sbaglio chiamate di rete
// nel codice dell'interfaccia o librerie di rete nella parte Rust.
import { describe, expect, it } from "vitest";
import tauriConf from "../src-tauri/tauri.conf.json";
import cargoToml from "../src-tauri/Cargo.toml?raw";
import indice from "../index.html?raw";

const sorgenti = import.meta.glob("../src/**/*.{ts,tsx}", { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;
const datiLibreria = import.meta.glob("../libreria/**/*.{json,svg}", { query: "?raw", import: "default", eager: true }) as Record<
  string,
  string
>;

/** Indirizzi ammessi nel testo: solo spazi dei nomi XML (non sono connessioni). */
const INDIRIZZI_AMMESSI = ["http://www.w3.org/2000/svg", "http://www.w3.org/1999/xlink"];

function indirizziEsterni(testo: string): string[] {
  return (testo.match(/\b(?:https?|wss?):\/\/[^\s"'`)<>]+/g) ?? []).filter((u) => !INDIRIZZI_AMMESSI.includes(u));
}

describe("nessun accesso alla rete", () => {
  it("il codice dell'interfaccia non usa funzioni di rete", () => {
    const vietate = /\b(fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|RTCPeerConnection)/;
    const trovate = Object.entries(sorgenti)
      .filter(([file]) => !file.includes(".test."))
      .filter(([, codice]) => vietate.test(codice))
      .map(([file]) => file);
    expect(Object.keys(sorgenti).length).toBeGreaterThan(10);
    expect(trovate).toEqual([]);
  });

  it("codice, pagina e libreria componenti non contengono indirizzi Internet", () => {
    const trovati: string[] = [];
    for (const [file, testo] of Object.entries({ ...sorgenti, ...datiLibreria, "index.html": indice })) {
      if (file.includes(".test.")) continue;
      for (const u of indirizziEsterni(testo)) trovati.push(`${file}: ${u}`);
    }
    expect(trovati).toEqual([]);
  });

  it("la parte Rust non usa librerie per connessioni di rete", () => {
    expect(cargoToml).not.toMatch(/^\s*(reqwest|ureq|hyper|isahc|curl|attohttpc|surf|tungstenite)\s*=/m);
    // Nemmeno funzioni di Tauri che aprono la rete (aggiornamenti automatici, plugin http).
    expect(cargoToml).not.toMatch(/tauri-plugin-(http|updater|websocket|upload)/);
    expect(JSON.stringify(tauriConf)).not.toMatch(/"updater"/);
  });

  it("la CSP permette di caricare risorse solo dal programma stesso", () => {
    const csp = tauriConf.app.security.csp;
    const direttive = Object.fromEntries(
      csp
        .split(";")
        .map((d) => d.trim().split(/\s+/))
        .filter((p) => p[0])
        .map(([nome, ...valori]) => [nome, valori]),
    ) as Record<string, string[]>;
    expect(direttive["default-src"]).toEqual(["'self'"]);
    // Connessioni: solo il canale interno fra interfaccia e parte Rust di Tauri.
    expect(direttive["connect-src"]).toEqual(["'self'", "ipc:", "http://ipc.localhost"]);
    expect(direttive["object-src"]).toEqual(["'none'"]);
    expect(direttive["frame-src"]).toEqual(["'none'"]);
    expect(direttive["form-action"]).toEqual(["'none'"]);
    // Nessun indirizzo esterno e nessun jolly in nessuna direttiva.
    for (const [nome, valori] of Object.entries(direttive)) {
      for (const v of valori) {
        expect(v, nome).not.toBe("*");
        if (/^(https?|wss?):/.test(v)) expect(v, nome).toBe("http://ipc.localhost");
      }
    }
  });
});
