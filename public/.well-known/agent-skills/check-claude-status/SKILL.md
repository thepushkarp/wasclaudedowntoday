---
name: check-claude-status
description: Check whether Claude (claude.ai, Claude API, Claude Code) is currently down and list today's incidents.
version: 1.0.0
---

# check-claude-status

Call the Was Claude Down Today status API to find out whether Claude is currently down and what incidents happened during the caller's local day.

## Endpoint

```
GET https://wasclaudedown.today/api/status
```

## Parameters

- `format` (query, optional) — `json` or `markdown`. If omitted, the `Accept` header is used.
- `tz` (query, optional) — IANA timezone name, e.g. `America/New_York`. Defaults to `UTC`. Controls what "today" means when filtering incidents.

## How to call

```
curl -H "Accept: application/json" \
  "https://wasclaudedown.today/api/status?tz=America/New_York"
```

## Response (JSON)

```json
{
  "answer": "YES | NO",
  "checked_at": "2026-04-18T12:34:56.000Z",
  "current_status": { "level": "ok|degraded|maintenance|down", "label": "..." },
  "currently_down": true,
  "down": true,
  "incidents": [
    {
      "name": "Claude API elevated error rate",
      "status": "investigating|identified|monitoring|resolved|postmortem",
      "created_at": "2026-04-18T10:00:00.000Z",
      "updated_at": "2026-04-18T10:22:00.000Z"
    }
  ],
  "reason": "Human-readable explanation of the answer.",
  "timezone": "America/New_York"
}
```

## Interpretation

- `answer: "NO"` — no incident today and all components are operational.
- `answer: "YES"` with `currently_down: true` — active incident or non-operational component right now.
- `answer: "YES"` with `currently_down: false` — there was an incident earlier today that has since been resolved.

## Upstream source

Data is aggregated from Anthropic's public status feed at <https://status.claude.com>. Responses are cached for ~60s at the edge.
