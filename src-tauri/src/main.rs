#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

const CLI_VERSION: &str = "1.2.0";

struct Running(Mutex<Option<Child>>);

fn bin_name() -> &'static str {
    if cfg!(windows) {
        "speedtest.exe"
    } else {
        "speedtest"
    }
}

/// The Ookla CLI is not redistributed with the app: it is found locally or
/// downloaded on first run, so it always comes straight from Ookla.
fn find_speedtest(app: &AppHandle) -> Option<PathBuf> {
    let name = bin_name();

    let mut candidates: Vec<PathBuf> = Vec::new();
    // Bundled sidecar sits next to the app executable.
    if let Ok(exe) = std::env::current_exe() {
        candidates.extend(exe.ancestors().skip(1).take(2).map(|d| d.join(name)));
    }
    // Where ensure_binary() puts it.
    if let Ok(data) = app.path().app_data_dir() {
        candidates.push(data.join("bin").join(name));
    }
    if let Some(home) = std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE")) {
        candidates.push(PathBuf::from(home).join(".local/bin").join(name));
    }
    if let Some(paths) = std::env::var_os("PATH") {
        candidates.extend(std::env::split_paths(&paths).map(|d| d.join(name)));
    }
    candidates.into_iter().find(|p| p.is_file())
}

fn archive_url() -> Result<String, String> {
    let base = "https://install.speedtest.net/app/cli";
    Ok(match (std::env::consts::OS, std::env::consts::ARCH) {
        ("linux", "x86_64") => format!("{base}/ookla-speedtest-{CLI_VERSION}-linux-x86_64.tgz"),
        ("linux", "aarch64") => format!("{base}/ookla-speedtest-{CLI_VERSION}-linux-aarch64.tgz"),
        ("macos", _) => format!("{base}/ookla-speedtest-{CLI_VERSION}-macosx-universal.tgz"),
        ("windows", _) => format!("{base}/ookla-speedtest-{CLI_VERSION}-win64.zip"),
        (os, arch) => return Err(format!("plataforma sin binario oficial: {os}/{arch}")),
    })
}

fn ensure_binary(app: &AppHandle) -> Result<PathBuf, String> {
    if let Some(found) = find_speedtest(app) {
        return Ok(found);
    }

    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("bin");
    std::fs::create_dir_all(&dir).map_err(|e| format!("no pude crear {dir:?}: {e}"))?;

    let url = archive_url()?;
    let is_zip = url.ends_with(".zip");
    let archive = dir.join(if is_zip { "cli.zip" } else { "cli.tgz" });

    let _ = app.emit("status", "Descargando el CLI de Speedtest…");
    // shortcut: relies on curl and tar from the OS (preinstalled on Linux,
    // macOS and Windows 10+); swap for a pure-Rust client if that ever breaks.
    let downloaded = Command::new("curl")
        .args(["-fsSL", "--retry", "2"])
        .arg(&url)
        .arg("-o")
        .arg(&archive)
        .status()
        .map_err(|e| format!("no pude ejecutar curl: {e}"))?
        .success();
    if !downloaded {
        return Err("la descarga del CLI falló".into());
    }

    let _ = app.emit("status", "Descomprimiendo…");
    let extracted = Command::new("tar")
        .arg(if is_zip { "-xf" } else { "-xzf" })
        .arg(&archive)
        .arg("-C")
        .arg(&dir)
        .status()
        .map_err(|e| format!("no pude ejecutar tar: {e}"))?
        .success();
    let _ = std::fs::remove_file(&archive);
    if !extracted {
        return Err("no pude descomprimir el CLI".into());
    }

    let bin = dir.join(bin_name());
    if !bin.is_file() {
        return Err("el archivo descargado no contenía el binario".into());
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&bin, std::fs::Permissions::from_mode(0o755))
            .map_err(|e| format!("no pude hacer ejecutable el CLI: {e}"))?;
    }

    Ok(bin)
}

fn stream_test(app: &AppHandle, bin: PathBuf) -> Result<(), String> {
    let mut child = Command::new(&bin)
        .args(["--accept-license", "--accept-gdpr", "-f", "jsonl"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("no pude lanzar speedtest: {e}"))?;

    let stdout = child.stdout.take().expect("piped stdout");
    let stderr = child.stderr.take().expect("piped stderr");
    app.state::<Running>().0.lock().unwrap().replace(child);

    let err_app = app.clone();
    let err_thread = std::thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            let _ = err_app.emit("stderr", line);
        }
    });

    for line in BufReader::new(stdout).lines().map_while(Result::ok) {
        let _ = app.emit("line", line);
    }

    let _ = err_thread.join();
    // The reader hit EOF, so the process is done: reap it and drop the handle.
    if let Some(mut running) = app.state::<Running>().0.lock().unwrap().take() {
        let _ = running.wait();
    }
    Ok(())
}

#[tauri::command]
fn run_test(app: AppHandle) -> Result<(), String> {
    if app.state::<Running>().0.lock().unwrap().is_some() {
        return Err("ya hay una medición en curso".into());
    }

    // Downloading and running both block, so keep them off the UI thread.
    std::thread::spawn(move || {
        let outcome = ensure_binary(&app).and_then(|bin| stream_test(&app, bin));
        if let Err(message) = outcome {
            let _ = app.emit("error", message);
        }
        let _ = app.emit("done", ());
    });

    Ok(())
}

#[tauri::command]
fn cancel_test(app: AppHandle) {
    // Keep the handle in place so the reader thread still reaps the process.
    if let Some(child) = app.state::<Running>().0.lock().unwrap().as_mut() {
        let _ = child.kill();
    }
}

fn main() {
    tauri::Builder::default()
        .manage(Running(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![run_test, cancel_test])
        .run(tauri::generate_context!())
        .expect("error while running lightningtest");
}
