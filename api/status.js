const SUMMARY_URL = "https://status.claude.com/api/v2/summary.json";
const INCIDENTS_URL = "https://status.claude.com/api/v2/incidents.json";
const DEFAULT_TIMEZONE = "UTC";
const DAY_FORMATTERS = new Map();
const INVALID_DAY_KEY = null;

function normalizeTimeZone(timeZone) {
  if (typeof timeZone !== "string" || timeZone.trim() === "") {
    return DEFAULT_TIMEZONE;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function dayFormatter(timeZone) {
  if (!DAY_FORMATTERS.has(timeZone)) {
    DAY_FORMATTERS.set(
      timeZone,
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }),
    );
  }

  return DAY_FORMATTERS.get(timeZone);
}

function dayKey(dateString, timeZone) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return INVALID_DAY_KEY;
  }

  const parts = dayFormatter(timeZone).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getCurrentStatus(components) {
  const hasOutage = components.some(
    (component) =>
      component.status === "major_outage" ||
      component.status === "partial_outage",
  );
  const hasDegraded = components.some(
    (component) => component.status === "degraded_performance",
  );
  const hasMaintenance = components.some(
    (component) => component.status === "under_maintenance",
  );

  if (hasOutage) {
    return {
      level: "down",
      label: "Outage right now",
    };
  }

  if (hasMaintenance) {
    return {
      level: "maintenance",
      label: "Maintenance right now",
    };
  }

  if (hasDegraded) {
    return {
      level: "degraded",
      label: "Degraded right now",
    };
  }

  return {
    level: "ok",
    label: "All systems operational right now",
  };
}

function getReason({ isDown, isCurrentlyDown }) {
  if (!isDown) {
    return "Anthropic reports Claude as operational right now.";
  }

  if (isCurrentlyDown) {
    return "Anthropic reports an active Claude incident today.";
  }

  return "There was a Claude incident earlier today, and Anthropic has marked it resolved.";
}

function responseFormat(req) {
  const format = req.query?.format;
  if (format === "json") {
    return "json";
  }
  if (format === "markdown") {
    return "markdown";
  }

  const accept = req.headers.accept || "";
  if (accept.includes("application/json")) {
    return "json";
  }
  if (accept.includes("text/markdown")) {
    return "markdown";
  }

  return "text";
}

function formatIncidentStatus(status) {
  const normalized = status.replace(/_/g, " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function renderMarkdown(payload) {
  let md = `# ${payload.answer} — Is Claude down?\n\n`;
  md += `${payload.reason}\n\n`;
  md += `- **Current status:** ${payload.current_status.label}\n`;
  md += `- **Checked at:** ${payload.checked_at}\n`;
  md += `- **Incident day timezone:** ${payload.timezone}\n`;

  if (payload.incidents.length > 0) {
    md += `\n## Incidents today\n\n`;
    for (const incident of payload.incidents) {
      md += `- **${incident.name}** — ${formatIncidentStatus(incident.status)} (updated ${incident.updated_at})\n`;
    }
  }

  md += `\n---\n\nSource: https://status.claude.com · Docs: https://wasclaudedown.today/docs/api\n`;
  return md;
}

export default async function handler(req, res) {
  const format = responseFormat(req);
  const timeZone = normalizeTimeZone(req.query?.tz);

  try {
    const [summaryResponse, incidentsResponse] = await Promise.all([
      fetch(SUMMARY_URL),
      fetch(INCIDENTS_URL),
    ]);

    if (!summaryResponse.ok || !incidentsResponse.ok) {
      throw new Error("Failed to reach status API");
    }

    const [summary, incidentsPayload] = await Promise.all([
      summaryResponse.json(),
      incidentsResponse.json(),
    ]);

    const checkedAt = new Date();
    const incidents = incidentsPayload.incidents || [];
    const components = summary.components || [];
    const currentDay = dayKey(checkedAt.toISOString(), timeZone);
    const todayIncidents = incidents.filter(
      (incident) =>
        dayKey(incident.created_at, timeZone) === currentDay ||
        dayKey(incident.updated_at, timeZone) === currentDay ||
        (incident.incident_updates || []).some((update) =>
          dayKey(update.created_at, timeZone) === currentDay,
        ),
    );

    const hasActiveIncident = todayIncidents.some(
      (incident) =>
        incident.status !== "resolved" && incident.status !== "postmortem",
    );
    const currentStatus = getCurrentStatus(components);
    const isCurrentlyDown = hasActiveIncident || currentStatus.level !== "ok";
    const isDown = todayIncidents.length > 0 || currentStatus.level !== "ok";

    const payload = {
      answer: isDown ? "YES" : "NO",
      checked_at: checkedAt.toISOString(),
      current_status: currentStatus,
      currently_down: isCurrentlyDown,
      down: isDown,
      incidents: todayIncidents.map((incident) => ({
        created_at: incident.created_at,
        name: incident.name,
        status: incident.status,
        updated_at: incident.updated_at,
      })),
      reason: getReason({ isDown, isCurrentlyDown }),
      timezone: timeZone,
    };

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=30");

    if (format === "json") {
      res.status(200).json(payload);
      return;
    }

    if (format === "markdown") {
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.status(200).send(renderMarkdown(payload));
      return;
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    let text = `${payload.answer} — ${payload.reason}`;
    text += `\nCurrent status: ${payload.current_status.label}`;
    text += `\nIncident day: ${payload.timezone}`;

    if (payload.incidents.length > 0) {
      text += "\n\nIncidents:";
      for (const incident of payload.incidents) {
        text += `\n  - ${incident.name} (${incident.status})`;
      }
    }

    res.status(200).send(text);
  } catch {
    res.setHeader("Cache-Control", "no-store");

    if (format === "json") {
      res.status(502).json({
        error: "Failed to reach status API",
        timezone: timeZone,
      });
      return;
    }

    if (format === "markdown") {
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res
        .status(502)
        .send(
          "# Error\n\nFailed to reach status API.\n\nSource: https://status.claude.com\n",
        );
      return;
    }

    res
      .status(502)
      .send("Failed to reach status API\nCurrent status source: status.claude.com");
  }
}
