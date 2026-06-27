# Contributing to Sluice

Sluice is a reference build maintained by [Dust AI Labs](https://github.com/dustailabs).

## Setup

```bash
npm install
npm run build
```

## Running tests

```bash
npm test
```

Tests run fully offline — no Anthropic API key or network access needed.
`callClaude` (the only function that touches the network) is mocked in
the node tests, and the JSON-parsing/schema-validation logic in
`validation.ts` is plain TypeScript, tested directly with no n8n or
network dependency at all.

## Linking the node into a local n8n instance

```bash
npm run build
npm link
cd ~/.n8n/custom   # or wherever your n8n custom nodes directory is
npm link n8n-nodes-sluice
```

Restart n8n and "Claude Structured" should appear in the node panel.

## Adding a new bundled workflow

Drop an exported workflow JSON into `workflows/`. The test suite
(`test/workflows.test.ts`) automatically picks up every file in that
folder and checks:

- it has the required `name`/`nodes`/`connections` keys
- every connection references a node that actually exists
- any `claudeStructured` node has a valid JSON Schema string

Keep credentials out of the export (n8n excludes them by default) and
use placeholder channel names / endpoints for anything connector-specific
(Slack channels, CRM URLs) so the workflow is safe to share publicly.

## Extending the node

- **A different LLM provider**: `GenericFunctions.ts` is the only place
  the Anthropic endpoint is named — swap the URL/body shape there.
- **Different validation behavior**: `validation.ts` is framework-free;
  change `validateAgainstSchema` or `buildRetryMessage` without touching
  the node's execute loop.
- **Streaming or tool-use support**: extend `callClaude`'s request body
  and response parsing in `GenericFunctions.ts`.
