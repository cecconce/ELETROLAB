//! Parte nativa (Rust) di ElettroLab.
//! Per ora avvia soltanto la finestra; file, cartelle portable e ngspice
//! verranno aggiunti nelle attività successive.

/// Avvia l'applicazione Tauri.
pub fn avvia() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("errore durante l'avvio di ElettroLab");
}
