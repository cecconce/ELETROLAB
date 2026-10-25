// Controlli sulla configurazione di compilazione per Windows.
// La build vera gira solo su GitHub Actions (windows-latest): questi test
// verificano in locale che i punti essenziali non vengano persi per sbaglio.
import { describe, expect, it } from "vitest";
import workflow from "../.github/workflows/build-windows.yml?raw";
import tauriConf from "../src-tauri/tauri.conf.json";
import permessi from "../src-tauri/capabilities/default.json";

describe("workflow di build Windows", () => {
  it("gira su windows-latest ed esegue i test prima della build", () => {
    expect(workflow).toContain("runs-on: windows-latest");
    const posTest = workflow.indexOf("npm test");
    const posBuild = workflow.indexOf("npx tauri build");
    expect(posTest).toBeGreaterThan(-1);
    expect(posBuild).toBeGreaterThan(posTest);
  });

  it("esegue anche i test Rust (cartella dati portable/%APPDATA%, file)", () => {
    const posCargo = workflow.indexOf("cargo test");
    expect(posCargo).toBeGreaterThan(-1);
    expect(posCargo).toBeLessThan(workflow.indexOf("npx tauri build"));
  });

  it("produce lo zip portable con portable.txt", () => {
    expect(workflow).toContain("portable.txt");
    expect(workflow).toContain("ElettroLab-portable.zip");
  });

  it("carica l'installer NSIS come artefatto", () => {
    expect(workflow).toContain("bundle/nsis/*.exe");
  });
});

describe("configurazione Tauri", () => {
  it("crea l'installer NSIS", () => {
    expect(tauriConf.bundle.targets).toContain("nsis");
  });

  it("installa per l'utente corrente, senza permessi di amministratore", () => {
    expect(tauriConf.bundle.windows.nsis.installMode).toBe("currentUser");
  });

  it("non consente connessioni di rete dall'interfaccia (CSP)", () => {
    const csp = tauriConf.app.security.csp;
    expect(csp).toContain("default-src 'self'");
    expect(csp).not.toMatch(/https?:/);
  });
});

describe("permessi della finestra", () => {
  it("solo dialoghi Apri/Salva/conferma: niente accesso libero ai file, alla shell o alla rete", () => {
    for (const p of permessi.permissions) {
      expect(p).toMatch(/^(core:default|dialog:allow-(open|save|ask|message))$/);
    }
  });
});
