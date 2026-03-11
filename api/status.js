const SUMMARY_URL = "https://status.claude.com/api/v2/summary.json";
const INCIDENTS_URL = "https://status.claude.com/api/v2/incidents.json";

const QUIPS_NO = [
  "You can go back to pretending you wrote that code yourself.",
  "Your job is safe... for now.",
  "All clear. Continue taking credit for Claude's work.",
];

const QUIPS_YES_ACTIVE = [
  "Time to find out if you actually know how to code.",
  "Guess you'll have to read the docs yourself today.",
  "Hope you remember how Stack Overflow works.",
  "This is the part where you stare at your screen.",
];

const QUIPS_YES_RESOLVED = [
  "It was down, but it got back up. Unlike your motivation.",
  "There was a blip. Nobody saw you panic. Right?",
  "It's back. You can close that Stack Overflow tab now.",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isSameDayUTC(dateStr, ref) {
  const d = new Date(dateStr);
  return (
    d.getUTCFullYear() === ref.getUTCFullYear() &&
    d.getUTCMonth() === ref.getUTCMonth() &&
    d.getUTCDate() === ref.getUTCDate()
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

    const today = new Date();

    const todayIncidents = (incidents.incidents || []).filter(
      (inc) =>
        isSameDayUTC(inc.created_at, today) ||
        isSameDayUTC(inc.updated_at, today) ||
        (inc.incident_updates || []).some((u) =>
          isSameDayUTC(u.created_at, today)
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
        ? pick(QUIPS_YES_ACTIVE)
        : pick(QUIPS_YES_RESOLVED)
      : pick(QUIPS_NO);

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
