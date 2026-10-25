//! Scelta della cartella dei dati (impostazioni, salvataggi automatici).
//!
//! - Modalità **portable**: se accanto all'eseguibile c'è il file `portable.txt`,
//!   i dati vanno in `.\dati\` accanto all'eseguibile (chiavetta USB, cartella
//!   condivisa del laboratorio).
//! - Altrimenti: cartella dell'utente, `%APPDATA%\ElettroLab` su Windows.
//!
//! Mai percorsi che richiedono privilegi di amministratore. Se la cartella
//! portable non è scrivibile (es. chiavetta protetta da scrittura) si ripiega
//! sulla cartella dell'utente invece di bloccare il programma.

use std::fs;
use std::path::{Path, PathBuf};

/// Nome del file che attiva la modalità portable.
pub const FILE_PORTABLE: &str = "portable.txt";
/// Sottocartella dei dati in modalità portable.
pub const CARTELLA_PORTABLE: &str = "dati";
/// Sottocartella dentro `%APPDATA%`.
pub const CARTELLA_UTENTE: &str = "ElettroLab";

/// Cartella dei dati scelta all'avvio.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CartellaDati {
    pub percorso: PathBuf,
    /// true se si sta usando la cartella accanto all'eseguibile.
    pub portable: bool,
    /// Spiegazione in italiano se si è dovuto ripiegare sulla cartella utente.
    pub avviso: Option<String>,
}

/// true se accanto all'eseguibile c'è `portable.txt`.
pub fn modalita_portable(cartella_exe: &Path) -> bool {
    cartella_exe.join(FILE_PORTABLE).is_file()
}

/// Crea la cartella (se manca) e verifica che si possa scrivere davvero,
/// scrivendo e cancellando un piccolo file di prova.
fn prepara_e_verifica(cartella: &Path) -> std::io::Result<()> {
    fs::create_dir_all(cartella)?;
    let prova = cartella.join(".prova-scrittura");
    fs::write(&prova, b"ok")?;
    fs::remove_file(&prova)
}

/// Sceglie e prepara la cartella dei dati.
/// `cartella_utente` è la cartella dati dell'utente fornita dal sistema
/// (`%APPDATA%` su Windows); può mancare in casi molto particolari.
pub fn scegli_cartella_dati(
    cartella_exe: &Path,
    cartella_utente: Option<&Path>,
) -> Result<CartellaDati, String> {
    let utente = cartella_utente.map(|c| c.join(CARTELLA_UTENTE));
    let mut avviso = None;
    if modalita_portable(cartella_exe) {
        let portable = cartella_exe.join(CARTELLA_PORTABLE);
        match prepara_e_verifica(&portable) {
            Ok(()) => {
                return Ok(CartellaDati {
                    percorso: portable,
                    portable: true,
                    avviso: None,
                })
            }
            Err(_) => {
                avviso = Some(format!(
                    "Modalità portable: non riesco a scrivere nella cartella \"{}\" (chiavetta protetta o cartella in sola lettura). Uso la cartella dell'utente.",
                    portable.display()
                ));
            }
        }
    }
    let utente = utente.ok_or_else(|| "Non trovo la cartella dei dati dell'utente.".to_string())?;
    prepara_e_verifica(&utente).map_err(|e| {
        format!(
            "Non riesco a preparare la cartella dei dati \"{}\": {e}",
            utente.display()
        )
    })?;
    Ok(CartellaDati {
        percorso: utente,
        portable: false,
        avviso,
    })
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::archivio::test_util::cartella_temporanea;

    #[test]
    fn senza_portable_txt_usa_la_cartella_utente() {
        let base = cartella_temporanea("percorsi-utente");
        let exe = base.join("programma");
        let appdata = base.join("appdata");
        fs::create_dir_all(&exe).unwrap();
        let c = scegli_cartella_dati(&exe, Some(&appdata)).unwrap();
        assert!(!c.portable);
        assert_eq!(c.percorso, appdata.join("ElettroLab"));
        assert!(c.percorso.is_dir());
        assert!(c.avviso.is_none());
        // Nessun file creato accanto all'eseguibile.
        assert!(!exe.join("dati").exists());
    }

    #[test]
    fn con_portable_txt_usa_dati_accanto_all_eseguibile() {
        let base = cartella_temporanea("percorsi-portable");
        let exe = base.join("chiavetta");
        let appdata = base.join("appdata");
        fs::create_dir_all(&exe).unwrap();
        fs::write(exe.join("portable.txt"), "portable").unwrap();
        let c = scegli_cartella_dati(&exe, Some(&appdata)).unwrap();
        assert!(c.portable);
        assert_eq!(c.percorso, exe.join("dati"));
        assert!(c.percorso.is_dir());
        // In modalità portable non si tocca la cartella dell'utente.
        assert!(!appdata.exists());
    }

    #[test]
    fn una_cartella_di_nome_portable_txt_non_attiva_la_modalita() {
        let base = cartella_temporanea("percorsi-finto");
        let exe = base.join("programma");
        fs::create_dir_all(exe.join("portable.txt")).unwrap();
        assert!(!modalita_portable(&exe));
    }

    #[test]
    fn se_dati_non_e_creabile_ripiega_sulla_cartella_utente() {
        let base = cartella_temporanea("percorsi-ripiego");
        let exe = base.join("chiavetta");
        let appdata = base.join("appdata");
        fs::create_dir_all(&exe).unwrap();
        fs::write(exe.join("portable.txt"), "portable").unwrap();
        // Un FILE chiamato "dati" impedisce di creare la cartella: simula una
        // chiavetta in sola lettura in modo uguale su Windows e Linux.
        fs::write(exe.join("dati"), "occupato").unwrap();
        let c = scegli_cartella_dati(&exe, Some(&appdata)).unwrap();
        assert!(!c.portable);
        assert_eq!(c.percorso, appdata.join("ElettroLab"));
        assert!(c.avviso.unwrap().contains("portable"));
    }

    #[test]
    fn senza_cartella_utente_e_senza_portable_spiega_l_errore() {
        let base = cartella_temporanea("percorsi-nessuna");
        let errore = scegli_cartella_dati(&base, None).unwrap_err();
        assert!(errore.contains("cartella dei dati"));
    }
}
