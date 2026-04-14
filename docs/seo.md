# SEO Notes

## Target Queries

- `is claude down`
- `claude down today`
- `claude status`
- `claude api down`
- `claude code down`
- `claude 500 error`

## Canonical URLs

- Homepage: `https://wasclaudedown.today/`
- FAQ: `https://wasclaudedown.today/faq`

Legacy `.html` URLs redirect permanently to the clean versions through
`vercel.json`.

## Page Rules

- Keep the homepage `h1` visible in the initial HTML.
- Keep the homepage explainer short and factual.
- Keep local-time wording aligned between the homepage, FAQ, and API payload.
- Do not reintroduce `meta keywords`.
- Keep the FAQ focused on secondary support intents, not general blog content.
- Keep metadata and JSON-LD aligned with visible page content.

## Search Console Workflow

1. Deploy the latest site changes.
2. Submit `https://wasclaudedown.today/sitemap.xml`.
3. Inspect `/` and `/faq`.
4. Request reindexing for both canonical URLs.
5. Monitor impressions, CTR, and queries for the target keyword cluster.
