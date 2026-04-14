const REFRESH_MS = 60_000;
let lastFaviconState = "pending";
let isRefreshing = false;

const $ = (id) => document.getElementById(id);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text) {
    node.textContent = text;
  }
  return node;
}

function clearChildren(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function browserTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function formatTimestamp(dateString, timeZone = browserTimeZone()) {
  const date = new Date(dateString);
  const day = date.toLocaleDateString("en-US", {
    timeZone,
    weekday: "long",
  });
  const calendarDate = date.toLocaleDateString("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
  });
  const time = date.toLocaleTimeString("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return `${day}, ${calendarDate} · ${time}`;
}

function getStatusDotClass(level) {
  if (level === "down") {
    return "status-dot-down";
  }

  if (level === "maintenance") {
    return "status-dot-down";
  }

  if (level === "degraded") {
    return "status-dot-degraded";
  }

  return "status-dot-ok";
}

function incidentStatusText(status) {
  const normalized = status.replace(/_/g, " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function cssVar(name) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

function faviconColor(state) {
  if (state === "yes") {
    return cssVar("--accent");
  }

  if (state === "no") {
    return cssVar("--green");
  }

  return cssVar("--muted");
}

function updateFavicon(state) {
  lastFaviconState = state;

  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.beginPath();
  context.arc(16, 16, 14, 0, Math.PI * 2);
  context.fillStyle = faviconColor(state);
  context.fill();

  let link = document.querySelector("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }

  link.href = canvas.toDataURL("image/png");
}

async function fetchStatus() {
  const params = new URLSearchParams({
    format: "json",
    tz: browserTimeZone(),
  });
  const response = await fetch(`/api/status?${params.toString()}`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

function renderStatus(answerEl, payload) {
  clearChildren(answerEl);

  const isResolvedIncident = payload.down && !payload.currently_down;
  let answerClass = "answer-no";

  if (payload.answer === "YES") {
    answerClass = isResolvedIncident ? "answer-yes-resolved" : "answer-yes";
  }

  answerEl.appendChild(el("span", `answer-word ${answerClass}`, payload.answer));
}

function renderCurrentStatus(statusEl, payload) {
  clearChildren(statusEl);
  statusEl.appendChild(
    el("span", `status-dot ${getStatusDotClass(payload.current_status.level)}`),
  );
  statusEl.appendChild(document.createTextNode(payload.current_status.label));
}

function renderIncidents(incidentsEl, payload) {
  clearChildren(incidentsEl);

  if (payload.incidents.length === 0) {
    return;
  }

  incidentsEl.appendChild(el("p", "incidents-heading", "Today's incidents"));

  payload.incidents.forEach((incident) => {
    const isResolved =
      incident.status === "resolved" || incident.status === "postmortem";
    const incidentEl = el(
      "div",
      isResolved ? "incident incident-resolved" : "incident",
    );

    incidentEl.appendChild(el("p", "incident-name", incident.name));
    incidentEl.appendChild(
      el("p", "incident-status", incidentStatusText(incident.status)),
    );
    incidentsEl.appendChild(incidentEl);
  });
}

function render(payload) {
  $("date").textContent = formatTimestamp(payload.checked_at, payload.timezone);
  $("reason").textContent = payload.reason;
  updateFavicon(payload.answer === "YES" ? "yes" : "no");

  renderStatus($("answer"), payload);
  renderCurrentStatus($("current-status"), payload);
  renderIncidents($("incidents"), payload);
}

function renderError() {
  const answerEl = $("answer");
  const reasonEl = $("reason");
  const statusEl = $("current-status");
  const incidentsEl = $("incidents");

  $("date").textContent = "Status check failed · Local time";

  clearChildren(answerEl);
  answerEl.appendChild(el("span", "answer-word answer-yes-resolved", "?"));

  clearChildren(reasonEl);
  const message = el("span", "error-msg", "Could not reach the status API. ");
  const link = document.createElement("a");
  link.href = "https://status.claude.com";
  link.rel = "noopener";
  link.target = "_blank";
  link.textContent = "Check status.claude.com directly.";
  message.appendChild(link);
  reasonEl.appendChild(message);

  clearChildren(statusEl);
  statusEl.appendChild(el("span", "status-dot status-dot-pending"));
  statusEl.appendChild(document.createTextNode("Live status temporarily unavailable"));

  clearChildren(incidentsEl);
  updateFavicon("pending");
}

async function refresh({ spin = false } = {}) {
  if (isRefreshing) {
    return;
  }

  isRefreshing = true;
  const button = $("refresh-btn");
  const icon = $("refresh-icon");

  if (spin && button) {
    button.disabled = true;
    icon.classList.add("spinning");
  }

  try {
    const payload = await fetchStatus();
    render(payload);
  } catch {
    renderError();
  } finally {
    if (button) {
      button.disabled = false;
      icon.classList.remove("spinning");
    }

    isRefreshing = false;
  }
}

function init() {
  const button = $("refresh-btn");
  const scheme = window.matchMedia("(prefers-color-scheme: dark)");

  if (button) {
    button.addEventListener("click", () => refresh({ spin: true }));
  }

  scheme.addEventListener("change", () => updateFavicon(lastFaviconState));
  updateFavicon(lastFaviconState);
  refresh();
  setInterval(refresh, REFRESH_MS);
}

init();
