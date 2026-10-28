# Third-party notice

This project is a personal GUI front-end that drives the official
**Speedtest CLI by Ookla**. It does not include, link against, or redistribute
that CLI.

The Speedtest CLI is proprietary software owned by Ookla. It is used here only
as an external program installed locally by the user, subject to Ookla's own
terms (https://www.speedtest.net/about/eula). Downloading and using it is
governed by those terms, not by this repository's MIT license.

For that reason:

- The binary lives in `src-tauri/binaries/`, which is git-ignored.
- At runtime the app may download the CLI from Ookla's official URL straight to
  the user's machine; it is never committed. `scripts/fetch-sidecar.sh` does the
  same thing ahead of time.
- `LICENSE` (MIT) applies to the source code in this repository only.

"Speedtest" is a trademark of Ookla. This project is not affiliated with,
endorsed by, or sponsored by Ookla.
