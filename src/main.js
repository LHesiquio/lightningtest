const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

const $ = (id) => document.getElementById(id);
const toMbps = (bytesPerSecond) => Math.max(0, (bytesPerSecond * 8) / 1e6);
const fmt = (n) => n.toFixed(n >= 100 ? 0 : 1);

// Log scale so 1 Mbps and 900 Mbps are both readable on the same bar.
const gaugeWidth = (mbps) =>
  Math.min(100, (100 * Math.log10(1 + mbps)) / Math.log10(1001));

let running = false;

function setPhase(text) {
  $("phase").textContent = text;
}

function showError(text) {
  $("error").textContent = text;
}

function reset() {
  showError("");
  setPhase("Midiendo…");
  $("speed").textContent = "—";
  $("ping").textContent = "—";
  $("down").textContent = "—";
  $("up").textContent = "—";
  $("fill").style.width = "0%";
}

function handleEvent(ev) {
  switch (ev.type) {
    case "testStart": {
      const { name, location } = ev.server ?? {};
      $("server").textContent = [name, location].filter(Boolean).join(" · ");
      if (ev.isp) showError("");
      break;
    }
    case "ping": {
      if (ev.ping?.latency != null) $("ping").textContent = ev.ping.latency.toFixed(1);
      setPhase("Latencia");
      break;
    }
    case "download": {
      if (ev.download?.bandwidth) {
        const mbps = toMbps(ev.download.bandwidth);
        $("speed").textContent = fmt(mbps);
        $("fill").style.width = `${gaugeWidth(mbps)}%`;
      }
      setPhase("Bajada");
      break;
    }
    case "upload": {
      if (ev.upload?.bandwidth) {
        const mbps = toMbps(ev.upload.bandwidth);
        $("speed").textContent = fmt(mbps);
        $("fill").style.width = `${gaugeWidth(mbps)}%`;
      }
      setPhase("Subida");
      break;
    }
    case "result": {
      $("down").textContent = fmt(toMbps(ev.download?.bandwidth ?? 0));
      $("up").textContent = fmt(toMbps(ev.upload?.bandwidth ?? 0));
      if (ev.ping?.latency != null) $("ping").textContent = ev.ping.latency.toFixed(1);
      $("speed").textContent = $("down").textContent;
      $("fill").style.width = `${gaugeWidth(toMbps(ev.download?.bandwidth ?? 0))}%`;
      setPhase("Listo");
      break;
    }
    case "error":
      showError(ev.error ?? "error del test");
      setPhase("Error");
      break;
  }
}

function setRunning(value) {
  running = value;
  const button = $("go");
  button.textContent = value ? "Cancelar" : "Medir";
  button.classList.toggle("running", value);
}

async function toggle() {
  if (running) {
    invoke("cancel_test");
    return;
  }
  reset();
  setRunning(true);
  try {
    await invoke("run_test");
  } catch (e) {
    showError(String(e));
    setPhase("Error");
    setRunning(false);
  }
}

listen("line", (event) => {
  let parsed;
  try {
    parsed = JSON.parse(event.payload);
  } catch {
    return; // non-JSON line, nothing useful to show
  }
  handleEvent(parsed);
});

listen("stderr", (event) => {
  const line = String(event.payload).trim();
  if (line) showError(line);
});

listen("done", () => {
  setRunning(false);
  if ($("phase").textContent === "Midiendo…") setPhase("Listo");
});

$("go").addEventListener("click", toggle);
