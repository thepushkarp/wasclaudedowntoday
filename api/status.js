const SUMMARY_URL = "https://status.claude.com/api/v2/summary.json";
const INCIDENTS_URL = "https://status.claude.com/api/v2/incidents.json";

function isSameDay(dateStr, ref) {
  const d = new Date(dateStr);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

export default async function handler(req, res) {
  try {
    const [summaryRes, incidentsRes] = await Promise.all([
      fetch(SUMMARY_URL),
      fetch(INCIDENTS_URL),
    ]);

    if (!summaryRes.ok || !incidentsRes.ok) {
      res.status(502).json({ error: "Failed to reach status API" });
      return;
    }

    const summary = await summaryRes.json();
    const incidents = await incidentsRes.json();

    const dateParam = req.query.date;
    const today = dateParam
      ? new Date(dateParam + "T12:00:00")
      : new Date();

    const todayIncidents = (incidents.incidents || []).filter(
      (inc) =>
        isSameDay(inc.created_at, today) ||
        isSameDay(inc.updated_at, today) ||
        (inc.incident_updates || []).some((u) =>
          isSameDay(u.created_at, today)
        )
    );

    const hasActive = todayIncidents.some(
      (inc) => inc.status !== "resolved" && inc.status !== "postmortem"
    );

    const hasNonOperational = (summary.components || []).some(
      (c) => c.status !== "operational"
    );

    const isDown = todayIncidents.length > 0 || hasNonOperational;
    const isCurrentlyDown = hasActive || hasNonOperational;

    const answer = isDown ? "YES" : "NO";
    const reason = isDown
      ? isCurrentlyDown
        ? "There are ongoing issues."
        : "There were issues earlier today, now resolved."
      : "No incidents today.";

    const payload = {
      down: isDown,
      currently_down: isCurrentlyDown,
      answer,
      reason,
      incidents: todayIncidents.map((inc) => ({
        name: inc.name,
        status: inc.status,
        created_at: inc.created_at,
        updated_at: inc.updated_at,
      })),
    };

    const wantsJson =
      req.query.format === "json" ||
      (req.headers.accept || "").includes("application/json");

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=30");

    if (wantsJson) {
      res.setHeader("Content-Type", "application/json");
      res.status(200).json(payload);
    } else {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      let text = `${answer} — ${reason}`;
      if (todayIncidents.length > 0) {
        text += "\n\nIncidents:";
        for (const inc of todayIncidents) {
          text += `\n  - ${inc.name} (${inc.status})`;
        }
      }
      res.status(200).send(text);
    }
  } catch {
    res.status(502).send("Failed to reach status API");
  }
}
