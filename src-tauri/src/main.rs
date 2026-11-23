use std::fs;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, WebviewWindow};
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
async fn export_game(app: AppHandle, window: WebviewWindow, html: String) -> Result<bool, String> {
    if window.label() != "main" || !html.starts_with("<!doctype html>") || html.len() > 8_000_000 {
        return Err("The export is not a valid Daily Puzzle HTML file.".into());
    }

    tauri::async_runtime::spawn_blocking(move || {
        let Some(file) = app
            .dialog()
            .file()
            .add_filter("HTML", &["html"])
            .set_file_name("Daily-Puzzle.html")
            .blocking_save_file()
        else {
            return Ok(false);
        };

        let mut path = file.into_path().map_err(|error| error.to_string())?;
        if path.extension().is_none() {
            path.set_extension("html");
        }
        fs::write(path, html).map_err(|error| error.to_string())?;
        Ok(true)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

fn icon_bytes(id: &str) -> Option<&'static [u8]> {
    Some(match id {
        "classic" => include_bytes!("../../frontend/assets/app-icons/classic.png"),
        "christmas" => include_bytes!("../../frontend/assets/app-icons/christmas.png"),
        "halloween" => include_bytes!("../../frontend/assets/app-icons/halloween.png"),
        "spring" => include_bytes!("../../frontend/assets/app-icons/spring.png"),
        "space" => include_bytes!("../../frontend/assets/app-icons/space.png"),
        "summer" => include_bytes!("../../frontend/assets/app-icons/summer.png"),
        "valentine" => include_bytes!("../../frontend/assets/app-icons/valentine.png"),
        "rainy" => include_bytes!("../../frontend/assets/app-icons/rainy.png"),
        "stealth" => include_bytes!("../../frontend/assets/app-icons/stealth.png"),
        _ => return None,
    })
}

/// Switch the Dock/app icon at runtime. The Finder/bundle icon stays Dino Classic.
/// Async so the command runs off the main thread while it waits for the main-thread result.
#[tauri::command]
async fn set_app_icon(app: AppHandle, id: String) -> Result<(), String> {
    let bytes = icon_bytes(&id).ok_or_else(|| format!("Unknown app icon: {id}"))?;

    #[cfg(target_os = "macos")]
    {
        let (tx, rx) = std::sync::mpsc::channel::<Result<(), String>>();
        app.run_on_main_thread(move || {
            use objc2::AnyThread;
            use objc2_app_kit::{NSApplication, NSImage};
            use objc2_foundation::{MainThreadMarker, NSData};

            let result = (|| {
                let mtm = MainThreadMarker::new()
                    .ok_or_else(|| "App icon must be set on the main thread.".to_string())?;
                let data = NSData::with_bytes(bytes);
                let image = NSImage::initWithData(NSImage::alloc(), &data)
                    .ok_or_else(|| format!("Could not decode app icon: {id}"))?;
                unsafe { NSApplication::sharedApplication(mtm).setApplicationIconImage(Some(&image)) };
                Ok(())
            })();
            let _ = tx.send(result);
        })
        .map_err(|error| error.to_string())?;

        tauri::async_runtime::spawn_blocking(move || {
            rx.recv()
                .unwrap_or_else(|_| Err("App icon change was not completed.".to_string()))
        })
        .await
        .map_err(|error| error.to_string())?
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, bytes);
        Ok(())
    }
}

fn build_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let item = |id: &str, label: &str, accel: Option<&str>| {
        MenuItem::with_id(app, id, label, true, accel)
    };

    let app_menu = Submenu::with_items(
        app,
        "Daily Puzzle",
        true,
        &[
            &PredefinedMenuItem::about(app, Some("About Daily Puzzle"), None)?,
            &PredefinedMenuItem::separator(app)?,
            &item("settings", "Settings\u{2026}", Some("CmdOrCtrl+,"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, None)?,
            &PredefinedMenuItem::hide_others(app, None)?,
            &PredefinedMenuItem::show_all(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, Some("Quit Daily Puzzle"))?,
        ],
    )?;

    let game_menu = Submenu::with_items(
        app,
        "Game",
        true,
        &[
            &item("home", "Home", Some("CmdOrCtrl+1"))?,
            &item("play", "Play", Some("CmdOrCtrl+2"))?,
            &item("new-game", "New Game", Some("CmdOrCtrl+N"))?,
            &item("themes", "Themes\u{2026}", Some("CmdOrCtrl+T"))?,
            &PredefinedMenuItem::separator(app)?,
            &item("stats", "Stats", Some("CmdOrCtrl+4"))?,
            &item("help", "How to Play", None)?,
        ],
    )?;

    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;

    let window_menu = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, Some("Zoom"))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, None)?,
        ],
    )?;

    Menu::with_items(app, &[&app_menu, &game_menu, &edit_menu, &window_menu])
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![export_game, quit_app, set_app_icon])
        .setup(|app| {
            let menu = build_menu(app.handle())?;
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            if matches!(id, "home" | "play" | "new-game" | "themes" | "settings" | "stats" | "help") {
                let _ = app.emit_to("main", "menu-action", id.to_string());
            }
        })
        .run(tauri::generate_context!())
        .expect("could not start Daily Puzzle");
}
