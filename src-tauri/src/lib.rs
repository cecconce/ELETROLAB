//! Parte nativa (Rust) di ElettroLab.
//! - `percorsi`: cartella dei dati (portable accanto all'exe oppure %APPDATA%\ElettroLab);
//! - `archivio`: lettura/scrittura sicura di progetti, impostazioni e salvataggi automatici.
//! I comandi qui sotto sono chiamati dall'interfaccia (src/progetto/archivio.ts).
//! Nessun comando accede alla rete.

pub mod archivio;
pub mod percorsi;

use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::Manager;

/// Stato condiviso: la cartella dei dati scelta all'avvio.
struct Stato {
    dati: percorsi::CartellaDati,
}

/// Informazioni sulla cartella dei dati, mostrate all'interfaccia.
#[derive(Serialize)]
struct InfoCartellaDati {
    percorso: String,
    portable: bool,
    avviso: Option<String>,
}

#[tauri::command]
fn info_cartella_dati(stato: tauri::State<Stato>) -> InfoCartellaDati {
    InfoCartellaDati {
        percorso: stato.dati.percorso.display().to_string(),
        portable: stato.dati.portable,
        avviso: stato.dati.avviso.clone(),
    }
}

/// Legge un progetto scelto dallo studente (percorso dal dialogo "Apri" o dai recenti).
#[tauri::command]
fn leggi_progetto(percorso: String) -> Result<String, String> {
    archivio::leggi_testo(Path::new(&percorso))
}

/// Scrive un progetto nel percorso scelto con "Salva con nome".
#[tauri::command]
fn scrivi_progetto(percorso: String, contenuto: String) -> Result<(), String> {
    archivio::scrivi_atomico(Path::new(&percorso), &contenuto)
}

#[tauri::command]
fn leggi_impostazioni(stato: tauri::State<Stato>) -> Result<Option<String>, String> {
    archivio::leggi_se_esiste(&stato.dati.percorso.join(archivio::FILE_IMPOSTAZIONI))
}

#[tauri::command]
fn scrivi_impostazioni(stato: tauri::State<Stato>, contenuto: String) -> Result<(), String> {
    archivio::scrivi_atomico(
        &stato.dati.percorso.join(archivio::FILE_IMPOSTAZIONI),
        &contenuto,
    )
}

#[tauri::command]
fn leggi_autosalvataggio(
    stato: tauri::State<Stato>,
    modulo: String,
) -> Result<Option<String>, String> {
    archivio::leggi_se_esiste(&archivio::percorso_autosalvataggio(
        &stato.dati.percorso,
        &modulo,
    )?)
}

#[tauri::command]
fn scrivi_autosalvataggio(
    stato: tauri::State<Stato>,
    modulo: String,
    contenuto: String,
) -> Result<(), String> {
    archivio::scrivi_atomico(
        &archivio::percorso_autosalvataggio(&stato.dati.percorso, &modulo)?,
        &contenuto,
    )
}

/// Cartella che contiene l'eseguibile (dove si cerca portable.txt).
fn cartella_eseguibile() -> PathBuf {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(Path::to_path_buf))
        .unwrap_or_else(|| PathBuf::from("."))
}

/// Avvia l'applicazione Tauri.
pub fn avvia() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // %APPDATA% (Roaming) su Windows; la sottocartella ElettroLab la aggiunge percorsi.rs.
            let utente = app.path().data_dir().ok();
            let dati = percorsi::scegli_cartella_dati(&cartella_eseguibile(), utente.as_deref())?;
            app.manage(Stato { dati });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            info_cartella_dati,
            leggi_progetto,
            scrivi_progetto,
            leggi_impostazioni,
            scrivi_impostazioni,
            leggi_autosalvataggio,
            scrivi_autosalvataggio
        ])
        .run(tauri::generate_context!())
        .expect("errore durante l'avvio di ElettroLab");
}
