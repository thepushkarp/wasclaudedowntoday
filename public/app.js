const SUMMARY_URL = "https://status.claude.com/api/v2/summary.json";
const INCIDENTS_URL = "https://status.claude.com/api/v2/incidents.json";
const REFRESH_MS = 60_000;

const $ = (id) => document.getElementById(id);

const QUIPS_NO = [
  "You can go back to pretending you wrote that code yourself.",
  "Your job is safe... for now.",
  "All clear. Continue taking credit for Claude's work.",
  "Still up. Nobody has to discover your fallback plan was 'guessing'.",
  "No outage today. Your impostor syndrome lives to fight another day.",
  "Crisis averted. You may resume outsourcing your thoughts.",
];

const QUIPS_YES_ACTIVE = [
  "Time to find out if you actually know how to code.",
  "Guess you'll have to read the docs yourself today.",
  "Hope you remember how Stack Overflow works.",
  "This is the part where you stare at your screen.",
  "Looks like it's just you and your raw problem-solving skills now.",
  "Claude is down. Time to cosplay as a competent engineer.",
  "Hope you weren't too emotionally attached to AI writing your code.",
  "You're on your own for a bit. Terrifying, I know.",
  "Time to interact directly with the codebase. Condolences.",
  "Claude is unavailable, which makes this a very hands-on learning experience.",
];

const QUIPS_YES_RESOLVED = [
  "It was down, but it got back up. Unlike your motivation.",
  "There was a blip. Nobody saw you panic. Right?",
  "It's back. You can close that Stack Overflow tab now.",
  "It broke, you spiraled, and now it's back. Beautiful arc.",
  "Claude recovered. Pretend you were calm the whole time.",
  "Everything's working again. That was a rough time for your confidence.",
  "Resolved. Your temporary career in manual thinking is over.",
];

const lastPicked = new WeakMap();

function pick(arr) {
  const last = lastPicked.get(arr);
  let idx;
  do {
    idx = Math.floor(Math.random() * arr.length);
  } while (arr.length > 1 && idx === last);
  lastPicked.set(arr, idx);
  return arr[idx];
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function formatDate() {
  const now = new Date();
  const day = now.toLocaleDateString("en-US", { weekday: "long" });
  const date = now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const time = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  return `${day}, ${date} · ${time}`;
}

async function fetchStatus() {
  const [summaryRes, incidentsRes] = await Promise.all([
    fetch(SUMMARY_URL),
    fetch(INCIDENTS_URL),
  ]);
  if (!summaryRes.ok) throw new Error(`HTTP ${summaryRes.status}`);
  if (!incidentsRes.ok) throw new Error(`HTTP ${incidentsRes.status}`);
  const summary = await summaryRes.json();
  const incidents = await incidentsRes.json();
  return { ...summary, incidents: incidents.incidents || [] };
}

function isToday(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function deriveAnswer(data) {
  const todayIncidents = (data.incidents || []).filter(
    (inc) =>
      isToday(inc.created_at) ||
      isToday(inc.updated_at) ||
      (inc.incident_updates || []).some((u) => isToday(u.created_at))
  );

  const hasActiveIncident = todayIncidents.some(
    (inc) => inc.status !== "resolved" && inc.status !== "postmortem"
  );

  const hasNonOperational = (data.components || []).some(
    (c) => c.status !== "operational"
  );

  const isDown = todayIncidents.length > 0 || hasNonOperational;
  const isCurrentlyDown = hasActiveIncident || hasNonOperational;

  return { isDown, isCurrentlyDown, todayIncidents, data };
}

function currentStatusDot(data) {
  const hasMajor = (data.components || []).some(
    (c) =>
      c.status === "major_outage" || c.status === "partial_outage"
  );
  const hasDegraded = (data.components || []).some(
    (c) => c.status === "degraded_performance"
  );

  if (hasMajor) return { cls: "status-dot-down", label: "Outage right now" };
  if (hasDegraded)
    return { cls: "status-dot-degraded", label: "Degraded right now" };
  return { cls: "status-dot-ok", label: "All systems operational right now" };
}

function incidentStatusText(inc) {
  const status = inc.status.replace(/_/g, " ");
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function clearChildren(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function render({ isDown, isCurrentlyDown, todayIncidents, data }) {
  const answerEl = $("answer");
  const reasonEl = $("reason");
  const statusEl = $("current-status");
  const incidentsEl = $("incidents");

  clearChildren(answerEl);

  if (isDown) {
    const cls = isCurrentlyDown ? "answer-yes" : "answer-yes-resolved";
    answerEl.appendChild(el("span", `answer-word ${cls}`, "YES"));
    reasonEl.textContent = isCurrentlyDown
      ? pick(QUIPS_YES_ACTIVE)
      : pick(QUIPS_YES_RESOLVED);
    document.title = "YES — Was Claude Down Today?";
  } else {
    answerEl.appendChild(el("span", "answer-word answer-no", "NO"));
    reasonEl.textContent = pick(QUIPS_NO);
    document.title = "NO — Was Claude Down Today?";
  }

  lastIsDown = isDown;
  updateFavicon(isDown);

  clearChildren(statusEl);
  const status = currentStatusDot(data);
  statusEl.appendChild(el("span", `status-dot ${status.cls}`));
  statusEl.appendChild(document.createTextNode(status.label));

  clearChildren(incidentsEl);
  if (todayIncidents.length > 0) {
    incidentsEl.appendChild(
      el("p", "incidents-heading", "Today's incidents")
    );
    todayIncidents.forEach((inc) => {
      const resolved =
        inc.status === "resolved" || inc.status === "postmortem";
      const div = el(
        "div",
        resolved ? "incident incident-resolved" : "incident"
      );
      div.appendChild(el("p", "incident-name", inc.name));
      div.appendChild(
        el("p", "incident-status", incidentStatusText(inc))
      );
      incidentsEl.appendChild(div);
    });
  }
}

function cssVar(name) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

function updateFavicon(isDown) {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.fillStyle = isDown ? cssVar("--accent") : cssVar("--green");
  ctx.fill();

  let link = document.querySelector("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = canvas.toDataURL("image/png");
}

function renderError() {
  const answerEl = $("answer");
  const reasonEl = $("reason");

  clearChildren(answerEl);
  const q = el("span", "answer-word");
  q.style.color = "var(--muted)";
  q.textContent = "?";
  answerEl.appendChild(q);

  clearChildren(reasonEl);
  const msg = el("span", "error-msg", "Could not reach status API. ");
  const link = document.createElement("a");
  link.href = "https://status.claude.com";
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "Check status.claude.com directly.";
  msg.appendChild(link);
  reasonEl.appendChild(msg);

  document.title = "Was Claude Down Today?";
}

async function refresh({ spin = false } = {}) {
  const btn = $("refresh-btn");
  const icon = $("refresh-icon");

  if (spin && btn) {
    btn.disabled = true;
    icon.classList.add("spinning");
  }

  try {
    const data = await fetchStatus();
    render(deriveAnswer(data));
  } catch {
    renderError();
  } finally {
    if (btn) {
      btn.disabled = false;
      icon.classList.remove("spinning");
    }
  }
}

let lastIsDown = false;

function init() {
  $("date").textContent = formatDate();
  setInterval(() => {
    $("date").textContent = formatDate();
  }, 30_000);

  const btn = $("refresh-btn");
  if (btn) {
    btn.addEventListener("click", () => refresh({ spin: true }));
  }

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => updateFavicon(lastIsDown));

  refresh();
  setInterval(refresh, REFRESH_MS);
}

init();
