const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

const $ = (id) => document.getElementById(id);
const CIRC = 2 * Math.PI * 120;
const SPAN = CIRC * 0.75; // the gauge spans 270°

let servers = null; // null until the CLI list has been read
let selected = null; // null = let Ookla pick the closest server
let running = false;
let currentPhase = "";

const toMbps = (bytesPerSecond) => Math.max(0, (bytesPerSecond * 8) / 1e6);
const fmt = (n) => (n >= 100 ? n.toFixed(0) : n.toFixed(1));

// Log scale so 1 Mbps and 900 Mbps are both readable on the same arc.
function drawGauge(mbps) {
  const frac = Math.min(1, Math.log10(1 + Math.max(0, mbps)) / Math.log10(1001));
  const arc = $("arc");
  arc.setAttribute("stroke-dasharray", `${SPAN * frac} ${CIRC}`);
  // A round cap still paints a dot at zero length.
  arc.style.opacity = frac > 0.002 ? 1 : 0;
}

function setPhase(text) {
  if (text === currentPhase) return;
  currentPhase = text;
  $("phase").textContent = text;
}

function showError(text) {
  $("error").textContent = text;
}

function mark(...ids) {
  for (const el of document.querySelectorAll(".card")) el.classList.remove("active");
  for (const id of ids) $(id).classList.add("active");
}

/* ---- theme ---- */
const THEME_KEY = "lt-theme";

function applyTheme(light) {
  document.body.classList.toggle("light", light);
  $("theme").setAttribute("aria-checked", String(!light));
  $("theme").setAttribute("aria-label", light ? "Cambiar a modo oscuro" : "Cambiar a modo claro");
  localStorage.setItem(THEME_KEY, light ? "light" : "dark");
}

$("theme").addEventListener("click", () => {
  applyTheme(!document.body.classList.contains("light"));
});

/* ---- server picker ---- */
function row(name, sub, isCurrent, onClick) {
  const li = document.createElement("li");
  const button = document.createElement("button");
  button.type = "button";

  const left = document.createElement("span");
  const title = document.createElement("span");
  title.className = "s-name";
  title.textContent = name;
  const meta = document.createElement("span");
  meta.className = "s-loc";
  meta.textContent = sub;
  left.append(title, document.createElement("br"), meta);
  button.append(left);

  if (isCurrent) {
    const tag = document.createElement("span");
    tag.className = "sel";
    tag.textContent = "en uso";
    button.append(tag);
  }

  button.addEventListener("click", onClick);
  li.append(button);
  return li;
}

function note(text) {
  const li = document.createElement("li");
  li.className = "s-loc";
  li.style.padding = "16px 10px";
  li.textContent = text;
  return li;
}

function renderList(filter = "") {
  const ul = $("list");
  const needle = filter.trim().toLowerCase();
  ul.replaceChildren();

  if (!needle) {
    ul.append(
      row("Automático", "El más cercano para tu conexión", selected === null, () => {
        selected = null;
        $("serverLabel").textContent = "Servidor automático";
        $("sid").textContent = "";
        closeModal();
      }),
    );
  }

  if (servers === null) {
    ul.append(note("Cargando servidores…"));
    return;
  }
  if (!servers.length) {
    ul.append(note("No pude leer la lista de servidores"));
    return;
  }

  let shown = 0;
  for (const server of servers) {
    const hay = `${server.name} ${server.location} ${server.country}`.toLowerCase();
    if (needle && !hay.includes(needle)) continue;
    shown += 1;
    ul.append(
      row(server.name, `${server.location} · ${server.country}`, selected?.id === server.id, () => {
        selected = server;
        $("serverLabel").textContent = `${server.name} · ${server.location}`;
        $("sid").textContent = `servidor ${server.id}`;
        closeModal();
      }),
    );
  }
  if (!shown) ul.append(note("Sin resultados"));
}

async function loadServers() {
  try {
    const raw = await invoke("list_servers");
    servers = JSON.parse(raw).servers ?? [];
  } catch (e) {
    servers = [];
    showError(String(e));
  }
  renderList($("q").value);
}

function openModal() {
  $("modal").hidden = false;
  $("q").value = "";
  renderList();
  $("q").focus();
  if (servers === null) loadServers();
}

function closeModal() {
  $("modal").hidden = true;
  $("serverBtn").focus();
}

$("serverBtn").addEventListener("click", openModal);
$("close").addEventListener("click", closeModal);
$("modal").addEventListener("click", (e) => {
  if (e.target === $("modal")) closeModal();
});
$("q").addEventListener("input", (e) => renderList(e.target.value));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !$("modal").hidden) closeModal();
});

/* ---- test ---- */
function reset() {
  showError("");
  setPhase("Midiendo…");
  $("num").textContent = "0";
  $("num").classList.add("dim");
  for (const id of ["ping", "jitter", "down", "up"]) $(id).textContent = "—";
  drawGauge(0);
  mark();
}

function setRunning(value) {
  running = value;
  $("go").textContent = value ? "DETENER" : "MEDIR";
  $("go").classList.toggle("running", value);
}

async function toggle() {
  if (running) {
    setPhase("Cancelado");
    invoke("cancel_test");
    return;
  }
  reset();
  setRunning(true);
  try {
    await invoke("run_test", { serverId: selected ? selected.id : null });
  } catch (e) {
    showError(String(e));
    setPhase("Error");
    setRunning(false);
  }
}

function handleEvent(ev) {
  switch (ev.type) {
    case "testStart": {
      if (ev.isp) $("isp").textContent = ev.isp;
      if (ev.interface?.externalIp) $("ip").textContent = ev.interface.externalIp;
      if (ev.server) {
        $("serverLabel").textContent = `${ev.server.name} · ${ev.server.location}`;
        $("sid").textContent = `servidor ${ev.server.id}`;
      }
      break;
    }
    case "ping": {
      if (ev.ping?.latency != null) $("ping").textContent = ev.ping.latency.toFixed(1);
      if (ev.ping?.jitter != null) $("jitter").textContent = ev.ping.jitter.toFixed(1);
      setPhase("Latencia");
      mark("card-ping", "card-jitter");
      break;
    }
    case "download": {
      const mbps = toMbps(ev.download?.bandwidth ?? 0);
      if (mbps > 0) {
        $("num").classList.remove("dim");
        $("num").textContent = fmt(mbps);
        $("down").textContent = fmt(mbps);
        drawGauge(mbps);
      }
      setPhase("Bajada");
      mark("card-down");
      break;
    }
    case "upload": {
      const mbps = toMbps(ev.upload?.bandwidth ?? 0);
      if (mbps > 0) {
        $("num").textContent = fmt(mbps);
        $("up").textContent = fmt(mbps);
        drawGauge(mbps);
      }
      setPhase("Subida");
      mark("card-up");
      break;
    }
    case "result": {
      const down = toMbps(ev.download?.bandwidth ?? 0);
      $("down").textContent = fmt(down);
      $("up").textContent = fmt(toMbps(ev.upload?.bandwidth ?? 0));
      if (ev.ping?.latency != null) $("ping").textContent = ev.ping.latency.toFixed(1);
      if (ev.ping?.jitter != null) $("jitter").textContent = ev.ping.jitter.toFixed(1);
      $("num").textContent = fmt(down);
      drawGauge(down);
      mark();
      setPhase("Listo");
      const time = new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
      $("stamp").textContent = `${time} · ${ev.server?.name ?? ""}`;
      break;
    }
    case "error":
      showError(ev.error ?? "error del test");
      setPhase("Error");
      break;
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

listen("status", (event) => {
  showError("");
  setPhase(String(event.payload));
});

listen("error", (event) => {
  showError(String(event.payload));
  setPhase("Error");
});

listen("stderr", (event) => {
  const line = String(event.payload).trim();
  if (line) showError(line);
});

listen("done", () => {
  setRunning(false);
  if (currentPhase === "Midiendo…") setPhase("Listo");
});

$("go").addEventListener("click", toggle);

applyTheme(localStorage.getItem(THEME_KEY) === "light");
drawGauge(0); // keeps the round linecap from painting a dot at zero
