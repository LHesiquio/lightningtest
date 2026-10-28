# LightningTest

A small desktop GUI for the Ookla Speedtest CLI. Tauri v2 + Rust, static
HTML/CSS/JS front-end, no bundler and no npm dependencies.

## Download

Latest build: **[releases page](https://github.com/LHesiquio/lightningtest/releases/latest)**

| Platform | Direct download | How to run |
|---|---|---|
| Linux (Debian/Ubuntu) | [`lightningtest_amd64.deb`](https://github.com/LHesiquio/lightningtest/releases/latest/download/lightningtest_amd64.deb) | `sudo dpkg -i lightningtest_amd64.deb` |
| Linux (any distro) | [`lightningtest-linux-x86_64`](https://github.com/LHesiquio/lightningtest/releases/latest/download/lightningtest-linux-x86_64) | `chmod +x` it, then run |
| Windows 10+ | [`lightningtest-windows-x86_64.exe`](https://github.com/LHesiquio/lightningtest/releases/latest/download/lightningtest-windows-x86_64.exe) | double click |
| macOS (Apple Silicon) | [`lightningtest-macos-aarch64.zip`](https://github.com/LHesiquio/lightningtest/releases/latest/download/lightningtest-macos-aarch64.zip) | `unzip`, `chmod +x`, run from a terminal |

The builds are unsigned: Windows SmartScreen and macOS Gatekeeper will warn. On
macOS there is no `.app` bundle yet, so it launches from the terminal.

The Ookla CLI is not bundled — the app downloads it on first run.

## Why it looks the way it does

The CLI already speaks JSON lines (`-f jsonl`), so the Rust side just spawns it,
forwards each line to the webview, and lets JavaScript render it. No parsing
layer, no state machine, no database.

## Requirements

- Rust (stable) — `rustup` is enough
- Linux only: `sudo apt install build-essential pkg-config libwebkit2gtk-4.1-dev libssl-dev`
- The Speedtest CLI binary. If it is missing, the app downloads it from Ookla on
  first run into its own data directory (needs `curl` and `tar`, present on
  Linux, macOS and Windows 10+).

## Run

```sh
cd src-tauri
cargo run --release
```

The binary is built to `src-tauri/target/release/lightningtest`. Point a desktop
launcher at it if you want an icon in your app menu.

## Where the speedtest binary comes from

The app looks for it, in this order:

1. next to its own executable (bundled sidecar)
2. its own data dir, `~/.local/share/dev.bumbu.lightningtest/bin/speedtest`
3. `~/.local/bin/speedtest`
4. anywhere in `PATH`

If none of those exist it downloads the official archive from
`install.speedtest.net`, extracts it into (2) and keeps going.

## Build a .deb

```sh
npx @tauri-apps/cli@2 build --bundles deb
```

Output: `src-tauri/target/release/bundle/deb/lightningtest_0.1.0_amd64.deb`, install
with `sudo dpkg -i`. It ships a desktop entry and the icons from
`src-tauri/icons/`.

## Licensing

Code: MIT (see `LICENSE`). The Ookla CLI is proprietary, is **not** part of this
repository, and is not covered by that license — see `NOTICE.md`.

## Known limits

- Only the `.deb` bundle is enabled. Windows and macOS need their own packaging
  and signing; the CLI is downloaded at runtime, so no Ookla binary is bundled.
- No test history, no server picker, no export. Add them when you actually miss
  them.
