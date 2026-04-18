# Is Claude Down Right Now?

Live Claude status from Anthropic's official status page, for claude.ai, the Claude API, and Claude Code.

## Live status

The HTML version of this page polls `/api/status` every 60 seconds and renders a big YES/NO. For machine-readable, real-time status, call the API directly:

```
GET https://wasclaudedown.today/api/status?format=json&tz=UTC
```

Replace `tz` with any IANA timezone (e.g. `America/New_York`) to localize what "today" means.

## Response shape

```json
{
  "answer": "YES | NO",
  "checked_at": "ISO 8601 timestamp",
  "current_status": { "level": "ok|degraded|maintenance|down", "label": "..." },
  "currently_down": true,
  "down": true,
  "incidents": [
    { "name": "...", "status": "investigating|identified|monitoring|resolved|postmortem",
      "created_at": "...", "updated_at": "..." }
  ],
  "reason": "Human-readable explanation",
  "timezone": "IANA timezone"
}
```

## Discovery

- API catalog: <https://wasclaudedown.today/.well-known/api-catalog>
- OpenAPI spec: <https://wasclaudedown.today/docs/openapi.json>
- Agent skills: <https://wasclaudedown.today/.well-known/agent-skills/index.json>
- FAQ (markdown): <https://wasclaudedown.today/faq> with `Accept: text/markdown`
- Official Anthropic status: <https://status.claude.com>

## About

This site answers one question: is Claude down? It aggregates Anthropic's public status feed and presents it in plain language. It is not affiliated with Anthropic.
