use std::path::{Path, PathBuf};
use tauri::{Emitter, Manager};

const MAX_DRAWING_BYTES: u64 = 250 * 1024 * 1024;

fn validate_drawing_path(path: &Path) -> Result<(), String> {
    let valid_extension = path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("excalidraw"));
    if !valid_extension {
        return Err("Desktop file access is limited to .excalidraw drawings.".into());
    }
    Ok(())
}

fn drawing_from_args(args: impl IntoIterator<Item = String>) -> Option<PathBuf> {
    args.into_iter()
        .skip(1)
        .map(PathBuf::from)
        .find(|path| validate_drawing_path(path).is_ok() && path.is_file())
}

#[tauri::command]
fn startup_drawing() -> Option<String> {
    drawing_from_args(std::env::args()).map(|path| path.to_string_lossy().into_owned())
}

#[tauri::command]
fn read_drawing(path: String) -> Result<String, String> {
    let path = PathBuf::from(path);
    validate_drawing_path(&path)?;
    let metadata = std::fs::metadata(&path).map_err(|error| error.to_string())?;
    if metadata.len() > MAX_DRAWING_BYTES {
        return Err("The drawing is larger than the 250 MB safety limit.".into());
    }
    std::fs::read_to_string(path).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_drawing(path: String, contents: String) -> Result<(), String> {
    let path = PathBuf::from(path);
    validate_drawing_path(&path)?;
    if contents.len() as u64 > MAX_DRAWING_BYTES {
        return Err("The drawing is larger than the 250 MB safety limit.".into());
    }
    std::fs::write(path, contents).map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder =
        tauri::Builder::default().plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(path) = drawing_from_args(argv) {
                let _ = app.emit("open-drawing", path.to_string_lossy().into_owned());
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }));

    let builder = if option_env!("TAURI_UPDATER_ENABLED") == Some("true") {
        builder.plugin(tauri_plugin_updater::Builder::new().build())
    } else {
        builder
    };

    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            startup_drawing,
            read_drawing,
            write_drawing
        ])
        .run(tauri::generate_context!())
        .expect("error while running Excalidraw Desktop");
}
