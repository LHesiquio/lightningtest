#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{Emitter, Manager};

struct Running(Mutex<Option<Child>>);

fn bin_name() -> &'static str {
    if cfg!(windows) {
        "speedtest.exe"
    } else {
        "speedtest"
    }
}

/// The Ookla CLI is not redistributed with the app, so look for it where the
/// user (or the bundler) may have put it, in order of preference.
fn find_speedtest() -> Option<PathBuf> {
    let name = bin_name();

    // Bundled sidecar sits next to the app executable.
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(exe) = std::env::current_exe() {
        candidates.extend(exe.ancestors().skip(1).take(2).map(|d| d.join(name)));
    }
    if let Some(home) = std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE")) {
        candidates.push(PathBuf::from(home).join(".local/bin").join(name));
    }
    if let Some(paths) = std::env::var_os("PATH") {
        candidates.extend(std::env::split_paths(&paths).map(|d| d.join(name)));
    }
    candidates.into_iter().find(|p| p.is_file())
}

#[tauri::command]
async fn run_test(app: tauri::AppHandle) -> Result<(), String> {
    let state = app.state::<Running>();
    if state.0.lock().unwrap().is_some() {
        return Err("ya hay una medición en curso".into());
    }

    let bin = find_speedtest().ok_or("no encuentro el binario speedtest")?;
    let mut child = Command::new(&bin)
        .args(["--accept-license", "--accept-gdpr", "-f", "jsonl"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("no pude lanzar speedtest: {e}"))?;

    let stdout = child.stdout.take().expect("piped stdout");
    let stderr = child.stderr.take().expect("piped stderr");
    state.0.lock().unwrap().replace(child);

    std::thread::spawn(move || {
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
        let _ = app.emit("done", ());
    });

    Ok(())
}

#[tauri::command]
fn cancel_test(app: tauri::AppHandle) {
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
