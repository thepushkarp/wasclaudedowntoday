const API_URL = "https://status.claude.com/api/v2/summary.json";
const REFRESH_MS = 60_000;

const $ = (id) => document.getElementById(id);

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
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
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

function dotClass(status) {
  if (status === "operational") return "dot-operational";
  if (status === "degraded_performance") return "dot-degraded";
  if (status === "partial_outage") return "dot-partial";
  return "dot-down";
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
  const componentsEl = $("components");
  const incidentsEl = $("incidents");

  clearChildren(answerEl);

  if (isDown) {
    const cls = isCurrentlyDown ? "answer-yes" : "answer-yes-resolved";
    answerEl.appendChild(el("span", `answer-word ${cls}`, "YES"));
    reasonEl.textContent = isCurrentlyDown
      ? "There are ongoing issues."
      : "There were issues earlier today, now resolved.";
    document.title = "YES — Was Claude Down Today?";
  } else {
    answerEl.appendChild(el("span", "answer-word answer-no", "NO"));
    reasonEl.textContent = "All systems operational.";
    document.title = "NO — Was Claude Down Today?";
  }

  updateFavicon(isDown);

  clearChildren(componentsEl);
  (data.components || [])
    .filter((c) => !c.group_id && c.name !== "Visit https://claude.ai")
    .forEach((c) => {
      const span = el("span", "component");
      span.appendChild(el("span", `component-dot ${dotClass(c.status)}`));
      span.appendChild(document.createTextNode(c.name));
      componentsEl.appendChild(span);
    });

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

function updateFavicon(isDown) {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.fillStyle = isDown ? "#d97757" : "#788c5d";
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

async function refresh() {
  try {
    const data = await fetchStatus();
    render(deriveAnswer(data));
  } catch {
    renderError();
  }
}

function init() {
  $("date").textContent = formatDate();
  setInterval(() => {
    $("date").textContent = formatDate();
  }, 30_000);

  refresh();
  setInterval(refresh, REFRESH_MS);
}

init();
