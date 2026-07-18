# Orchestra

An AI-integrated automation studio — an n8n alternative where you **describe an
automation in plain English** and the AI (Claude) plans a workflow, asks for the
**exact credentials** it needs, and **runs it live** in the browser. No nodes to
wire by hand.

First built-in automation: **research → report → draft email**.

## How it works

1. You type a goal (e.g. _"Research the EV market in India and draft an email to my team"_).
2. `POST /api/plan` → Claude (`claude-opus-4-8`) uses forced tool-use to turn your
   sentence into a validated **workflow plan** (a list of typed nodes).
3. Orchestra inspects the plan against its node registry and shows you exactly
   which credentials it needs — by **name only**, never asking for values in chat.
4. `POST /api/run` → the engine runs each node in order, piping each node's output
   into the next, and streams progress to the browser over Server-Sent Events.
5. You get the finished artifacts: a research briefing (with live sources if a
   search key is set), a report, and an email **draft** (Orchestra never sends).

## Architecture

```
app/
  page.tsx              chat + workflow canvas + run log (client)
  api/plan/route.ts     NL goal -> validated WorkflowPlan (+ mock when no key)
  api/run/route.ts      executes a plan, streams RunEvents as SSE
lib/
  anthropic.ts          client factory + model constants
  credentials.ts        inspects a plan -> which env vars it needs (names only)
  engine/
    types.ts            zod schema + strict JSON schema + node/run types
    planner.ts          Anthropic forced tool-use -> plan
    executor.ts         runs nodes in order, pipes outputs, emits events
    nodes/
      registry.ts       NodeType -> executor   ← the extensibility spine
      research.ts       Tavily (live) or model-knowledge fallback + synthesis
      writeReport.ts    findings -> markdown report
      draftEmail.ts     -> email draft (never sends)
scripts/smoke.ts        offline engine test (no API key needed)
```

**Adding an integration = adding one node file + registering it.** The planner
schema, executor, and credential UI all flow from the registry.

## Setup

```bash
npm install
# paste your keys into .env.local (see below), then:
npm run smoke   # offline sanity check — no key needed
npm run dev     # http://localhost:3000
```

### Keys (`.env.local`)

| Variable            | Required | Purpose                                   | Get it |
| ------------------- | -------- | ----------------------------------------- | ------ |
| `ANTHROPIC_API_KEY` | ✅       | Plans and runs every workflow             | platform.claude.com → API keys |
| `TAVILY_API_KEY`    | ⬜ opt   | Live web search in the research node      | tavily.com → API keys |

With only `ANTHROPIC_API_KEY`, the whole demo runs end-to-end (research falls back
to model knowledge, clearly flagged). Add `TAVILY_API_KEY` for live web search.

Before adding a key, the app still loads and shows an example plan so you can see
the UI and the credential flow.

## Not in v1 (by design)

No scheduling (run-now only), no real email _sending_ (draft only — safety), no
OAuth, no database / auth / multi-user. Three nodes and a registry that makes the
fourth trivial.

## Models

- Planner: `claude-opus-4-8` (forced tool-use → strict JSON plan)
- Node synthesis: `claude-sonnet-5`

## Author

Built by [Jayadev Rana](https://jayadevrana.in) — @bluealgocapital · [YouTube](https://www.youtube.com/@jayadevrana3657) · [GitHub](https://github.com/jayadevrana)
