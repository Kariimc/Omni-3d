"use strict";
// Omni3D live dashboard — talks to the same-origin API + /live WebSocket. No deps.

const $ = (s, r = document) => r.querySelector(s);
const el = {
  prompt: $("#prompt"), engine: $("#engine"), budget: $("#budget"), rig: $("#rig"), defect: $("#defect"),
  create: $("#create"), advance: $("#advance"), run: $("#run"),
  dot: $("#dot"), jobid: $("#jobid"), log: $("#log"),
  eitlBody: $('#eitl [data-role="body"]'), engineBody: $('#engine-panel [data-role="body"]'),
};

const UE5 = [
  ["material_instance", "MI from M_Omni3D_Master (ORM packed)"],
  ["assign_maps", "BaseColor / Normal / ORM / Emissive"],
  ["place_mesh", "SkeletalMesh @ 1 unit = 1 cm"],
  ["anim_blueprint", "bind to existing AnimBlueprint"],
  ["live_link", "open Live Link"],
];
const UNITY = [
  ["material", "URP/Lit material"],
  ["assign_maps", "Albedo / Normal / MetallicSmoothness / Emissive"],
  ["lightmap_uv", "secondary lightmap UVs"],
  ["mecanim", "Humanoid avatar, no vertex tear"],
  ["live_link", "open Live Link"],
];

let jobId = null;
let ws = null;
let done = false;

const pct = (p) => Math.round((p || 0) * 100) + "%";

function logLine(kind, text) {
  const li = document.createElement("li");
  li.className = "ev ev-" + kind;
  const b = document.createElement("b");
  b.textContent = kind;
  li.appendChild(b);
  li.appendChild(document.createTextNode(" " + text));
  el.log.appendChild(li);
  el.log.scrollTop = el.log.scrollHeight;
}

function setLoop(loopKey, st) {
  if (!st) return;
  const card = document.querySelector('.phase[data-loop="' + loopKey + '"]');
  if (!card) return;
  card.querySelector('[data-role="fill"]').style.width = pct(st.progress);
  card.querySelector('[data-role="status"]').textContent = st.status;
  card.querySelector('[data-role="pct"]').textContent = pct(st.progress);
  card.querySelector('[data-role="stage"]').textContent = st.stage || "—";
  card.dataset.status = st.status;
}

function resetUI() {
  ["A_structural", "B_rigging", "C_eitl"].forEach((k) =>
    setLoop(k, { progress: 0, status: "queued", stage: "—" }),
  );
  el.log.innerHTML = "";
  el.eitlBody.textContent = "—";
  el.engineBody.textContent = "—";
}

function renderEitl(ev) {
  el.eitlBody.innerHTML =
    '<div class="kv"><span>E</span><b>' + ev.score + "</b></div>" +
    '<div class="kv"><span>threshold</span><b>' + ev.threshold + "</b></div>" +
    '<div class="verdict ' + (ev.passed ? "pass" : "fail") + '">' + (ev.passed ? "PASS" : "FAIL") + "</div>" +
    '<div class="kv"><span>repairs</span><b>' + ev.repairs + "</b></div>" +
    '<div class="kv"><span>rerun</span><b>' + (ev.rerunPhases.join(", ") || "—") + "</b></div>";
}

function renderEngine(ev) {
  const actions = ev.engine === "unity" ? UNITY : UE5;
  el.engineBody.innerHTML =
    '<div class="kv"><span>engine</span><b>' + ev.engine + "</b></div>" +
    '<div class="kv"><span>endpoint</span><b class="mono">' + ev.endpoint + "</b></div>" +
    '<ul class="actions">' +
    actions.map((a) => "<li><b>" + a[0] + "</b> " + a[1] + "</li>").join("") +
    "</ul>";
}

function handle(ev) {
  switch (ev.type) {
    case "connected":
      logLine("connected", ev.jobId);
      break;
    case "stage.completed":
      setLoop("A_structural", ev.loops.A_structural);
      setLoop("B_rigging", ev.loops.B_rigging);
      setLoop("C_eitl", ev.loops.C_eitl);
      logLine("stage", ev.stage + (ev.done ? " (final)" : ""));
      break;
    case "eitl.result":
      renderEitl(ev);
      logLine("eitl", "E=" + ev.score + (ev.passed ? " ≤ " : " > ") + "T=" + ev.threshold +
        " " + (ev.passed ? "PASS" : "FAIL") + " repairs=" + ev.repairs);
      break;
    case "asset.push":
      renderEngine(ev);
      logLine("asset", "push → " + ev.engine);
      break;
    case "pipeline.complete":
      done = true;
      el.advance.disabled = true;
      el.run.disabled = true;
      logLine("complete", ev.status);
      break;
    case "error":
      logLine("error", ev.message);
      break;
  }
}

function connect() {
  if (ws) ws.close();
  ws = new WebSocket("ws://" + location.host + "/live?jobId=" + encodeURIComponent(jobId));
  ws.onopen = () => el.dot.classList.add("on");
  ws.onclose = () => el.dot.classList.remove("on");
  ws.onmessage = (m) => handle(JSON.parse(m.data));
}

async function api(path, opts) {
  const r = await fetch(path, opts);
  if (!r.ok && r.status !== 409) throw new Error(path + " -> " + r.status);
  return r.json().catch(() => ({}));
}

async function createJob() {
  resetUI();
  const body = {
    text: el.prompt.value,
    video: { uri: "asset://uploads/clip.mp4", container: "mp4", durationSec: 12.4, fps: 30, resolution: [1920, 1080] },
    targets: { engine: el.engine.value, polyBudget: el.budget.value, rigStandard: el.rig.value },
  };
  const job = await api("/pipeline", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  jobId = job.jobId;
  done = false;
  el.jobid.textContent = jobId;
  el.advance.disabled = false;
  el.run.disabled = false;
  connect();
}

async function advance() {
  if (!jobId || done) return;
  const q = el.defect.checked ? "?defect=vertex_tear" : "";
  const res = await api("/jobs/" + jobId + "/advance" + q, { method: "POST" });
  if (res && res.done) done = true;
}

async function runToEnd() {
  if (!jobId) return;
  el.run.disabled = true;
  while (!done) {
    await advance();
    await new Promise((r) => setTimeout(r, 300));
  }
}

el.create.onclick = createJob;
el.advance.onclick = advance;
el.run.onclick = runToEnd;
resetUI();
