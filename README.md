# LightningTest

A small desktop GUI for the Ookla Speedtest CLI. Tauri v2 + Rust, static
HTML/CSS/JS front-end, no bundler and no npm dependencies.

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

## Licensing

Code: MIT (see `LICENSE`). The Ookla CLI is proprietary, is **not** part of this
repository, and is not covered by that license — see `NOTICE.md`.

## Known limits

- `bundle.active` is `false`, so there is no `.deb`/`.AppImage` yet. Enable it in
  `src-tauri/tauri.conf.json` and add `icons/` when you want one; that also
  activates `externalBin` so the sidecar travels with the installer.
- No test history, no server picker, no export. Add them when you actually miss
  them.
