# Third-party notice

This project is a personal GUI front-end that drives the official
**Speedtest CLI by Ookla**. It does not include, link against, or redistribute
that CLI.

The Speedtest CLI is proprietary software owned by Ookla. It is used here only
as an external program installed locally by the user, subject to Ookla's own
terms (https://www.speedtest.net/about/eula). Downloading and using it is
governed by those terms, not by this repository's MIT license.

For that reason:

- At runtime the app downloads the CLI from Ookla's official URL straight into
  the user's data directory; it is never committed to this repository.
- `LICENSE` (MIT) applies to the source code in this repository only.

"Speedtest" is a trademark of Ookla. This project is not affiliated with,
endorsed by, or sponsored by Ookla.
