//! Lettura e scrittura dei file: progetti `.elab`, impostazioni e salvataggi
//! automatici. Il contenuto (JSON) viene preparato e controllato dalla parte
//! TypeScript (`src/progetto/`); qui ci occupiamo solo di scriverlo sul disco
//! in modo sicuro e di spiegare gli errori in italiano.

use std::fs;
use std::path::{Path, PathBuf};

/// Dimensione massima di un file da aprire: uno schema didattico occupa pochi
/// kB; un limite evita di bloccare il programma aprendo per sbaglio un file enorme.
pub const DIMENSIONE_MASSIMA: u64 = 20 * 1024 * 1024;

/// Nome del file delle impostazioni nella cartella dei dati.
pub const FILE_IMPOSTAZIONI: &str = "impostazioni.json";
/// Sottocartella dei salvataggi automatici.
pub const CARTELLA_AUTOSALVATAGGI: &str = "autosalvataggi";
/// Moduli ammessi per i salvataggi automatici (evita nomi di file arbitrari).
pub const MODULI: [&str; 4] = ["impianti", "plc", "arduino", "elettronica"];

/// Scrive il file in modo "atomico": prima in un file temporaneo accanto,
/// poi lo rinomina. Se il PC si spegne a metà, il file vecchio resta intatto.
pub fn scrivi_atomico(percorso: &Path, contenuto: &str) -> Result<(), String> {
    if let Some(cartella) = percorso.parent() {
        if !cartella.as_os_str().is_empty() {
            fs::create_dir_all(cartella).map_err(|e| errore_scrittura(percorso, &e))?;
        }
    }
    let mut temporaneo = percorso.as_os_str().to_owned();
    temporaneo.push(".tmp");
    let temporaneo = PathBuf::from(temporaneo);
    fs::write(&temporaneo, contenuto).map_err(|e| errore_scrittura(percorso, &e))?;
    // Su Windows `rename` sostituisce il file esistente (MoveFileEx con REPLACE_EXISTING).
    fs::rename(&temporaneo, percorso).map_err(|e| {
        let _ = fs::remove_file(&temporaneo);
        errore_scrittura(percorso, &e)
    })
}

/// Legge un file di testo (UTF-8) con un limite di dimensione.
pub fn leggi_testo(percorso: &Path) -> Result<String, String> {
    let info = fs::metadata(percorso).map_err(|e| errore_lettura(percorso, &e))?;
    if info.is_dir() {
        return Err(format!(
            "\"{}\" è una cartella, non un file.",
            nome(percorso)
        ));
    }
    if info.len() > DIMENSIONE_MASSIMA {
        return Err(format!(
            "Il file \"{}\" è troppo grande per essere uno schema di ElettroLab.",
            nome(percorso)
        ));
    }
    let byte = fs::read(percorso).map_err(|e| errore_lettura(percorso, &e))?;
    String::from_utf8(byte).map_err(|_| {
        format!(
            "Il file \"{}\" non è un file di ElettroLab (contiene dati non di testo).",
            nome(percorso)
        )
    })
}

/// Come `leggi_testo`, ma un file che non esiste non è un errore (None).
pub fn leggi_se_esiste(percorso: &Path) -> Result<Option<String>, String> {
    if !percorso.exists() {
        return Ok(None);
    }
    leggi_testo(percorso).map(Some)
}

/// Percorso del salvataggio automatico di un modulo (solo moduli conosciuti).
pub fn percorso_autosalvataggio(cartella_dati: &Path, modulo: &str) -> Result<PathBuf, String> {
    if !MODULI.contains(&modulo) {
        return Err(format!("Modulo sconosciuto: \"{modulo}\"."));
    }
    Ok(cartella_dati
        .join(CARTELLA_AUTOSALVATAGGI)
        .join(format!("{modulo}.elab")))
}

fn nome(percorso: &Path) -> String {
    percorso
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| percorso.display().to_string())
}

fn errore_lettura(percorso: &Path, e: &std::io::Error) -> String {
    match e.kind() {
        std::io::ErrorKind::NotFound => format!(
            "Il file \"{}\" non esiste più: forse è stato spostato, rinominato o è su una chiavetta non inserita.",
            nome(percorso)
        ),
        std::io::ErrorKind::PermissionDenied => format!("Non hai il permesso di aprire il file \"{}\".", nome(percorso)),
        _ => format!("Non riesco ad aprire il file \"{}\": {e}", nome(percorso)),
    }
}

fn errore_scrittura(percorso: &Path, e: &std::io::Error) -> String {
    match e.kind() {
        std::io::ErrorKind::PermissionDenied => format!(
            "Non posso salvare \"{}\": la cartella è protetta o in sola lettura. Scegli un'altra cartella (per esempio Documenti).",
            nome(percorso)
        ),
        _ => format!("Non riesco a salvare il file \"{}\": {e}", nome(percorso)),
    }
}

/// Utilità per i test: cartelle temporanee nuove, una per test.
#[cfg(test)]
pub mod test_util {
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicU32, Ordering};

    static CONTATORE: AtomicU32 = AtomicU32::new(0);

    pub fn cartella_temporanea(nome: &str) -> PathBuf {
        let n = CONTATORE.fetch_add(1, Ordering::SeqCst);
        let c =
            std::env::temp_dir().join(format!("elettrolab-test-{}-{nome}-{n}", std::process::id()));
        let _ = std::fs::remove_dir_all(&c);
        std::fs::create_dir_all(&c).unwrap();
        c
    }
}

#[cfg(test)]
mod test {
    use super::test_util::cartella_temporanea;
    use super::*;

    #[test]
    fn scrive_e_rilegge_un_progetto_creando_le_cartelle() {
        let base = cartella_temporanea("scrivi");
        let file = base.join("sotto").join("marcia arresto.elab");
        scrivi_atomico(&file, "{\"formato\":\"elettrolab\"}").unwrap();
        assert_eq!(leggi_testo(&file).unwrap(), "{\"formato\":\"elettrolab\"}");
        // Nessun file temporaneo rimasto.
        assert!(!base.join("sotto").join("marcia arresto.elab.tmp").exists());
    }

    #[test]
    fn la_scrittura_sostituisce_il_file_esistente() {
        let base = cartella_temporanea("sostituisci");
        let file = base.join("a.elab");
        scrivi_atomico(&file, "vecchio").unwrap();
        scrivi_atomico(&file, "nuovo").unwrap();
        assert_eq!(leggi_testo(&file).unwrap(), "nuovo");
    }

    #[test]
    fn testi_con_accenti_restano_intatti() {
        let base = cartella_temporanea("accenti");
        let file = base.join("perché.elab");
        scrivi_atomico(&file, "Più città, è così").unwrap();
        assert_eq!(leggi_testo(&file).unwrap(), "Più città, è così");
    }

    #[test]
    fn file_mancante_spiegato_in_italiano() {
        let base = cartella_temporanea("mancante");
        let errore = leggi_testo(&base.join("sparito.elab")).unwrap_err();
        assert!(errore.contains("sparito.elab"));
        assert!(errore.contains("non esiste più"));
        assert_eq!(leggi_se_esiste(&base.join("sparito.elab")).unwrap(), None);
    }

    #[test]
    fn file_binario_rifiutato() {
        let base = cartella_temporanea("binario");
        let file = base.join("foto.elab");
        fs::write(&file, [0xff, 0xfe, 0x00, 0x80]).unwrap();
        assert!(leggi_testo(&file)
            .unwrap_err()
            .contains("non è un file di ElettroLab"));
    }

    #[test]
    fn una_cartella_non_si_apre_come_file() {
        let base = cartella_temporanea("cartella");
        assert!(leggi_testo(&base).unwrap_err().contains("cartella"));
    }

    #[test]
    fn autosalvataggi_solo_per_moduli_conosciuti() {
        let base = cartella_temporanea("auto");
        let p = percorso_autosalvataggio(&base, "plc").unwrap();
        assert_eq!(p, base.join("autosalvataggi").join("plc.elab"));
        assert!(percorso_autosalvataggio(&base, "../../windows").is_err());
        assert!(percorso_autosalvataggio(&base, "").is_err());
    }
}
