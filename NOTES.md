# Orchestra — build notes (think on paper)

## What this is
AI-integrated n8n alternative. User types an automation in plain English → the AI
(Anthropic) plans a workflow of nodes → asks for exactly the credentials those nodes
need (by NAME, never the value in chat) → runs the workflow live, streaming progress →
returns the artifact. First demo automation: **research → report → draft email**.

Decision locked with the user (2026-07-12):
- Positioning: general n8n alternative (not the vertical). Flagged as the harder path (4/10 generic) — user chose it anyway; building it the smart, extensible way.
- Build form: Next.js web app (chat → run).
- First demo: generic research → report + email draft.
- Live web search: wired via Tavily (optional key). No key → research falls back to model knowledge, clearly flagged.

## Architecture
- Next.js 15 App Router + React + TypeScript. Plain CSS (no Tailwind — fewer failure modes).
- `POST /api/plan {goal}` → `{plan, credentials, mock?}`. Uses Anthropic forced tool-use (strict schema) to turn NL → a validated WorkflowPlan. If ANTHROPIC_API_KEY absent → returns a clearly-marked MOCK plan so the UI is visible before keys are pasted.
- `POST /api/run {plan}` → Server-Sent Events stream of RunEvents as each node executes.
- Engine (`lib/engine/`):
  - `types.ts` — zod `WorkflowPlanSchema` + raw JSON-Schema `PLAN_TOOL_SCHEMA` (kept in sync) + RunEvent/NodeExecutor types.
  - `planner.ts` — Anthropic (opus-4-8) forced tool-use → validated plan.
  - `executor.ts` — `runWorkflow(plan, emit, client=getAnthropic())` runs nodes in order, pipes outputs → inputs, emits events. `client` is injectable so the smoke test runs offline.
  - `nodes/registry.ts` — maps NodeType → executor + declared credential requirements. **The extensibility spine**: a new integration = one node file.
  - `nodes/{research,writeReport,draftEmail}.ts`.
- `lib/anthropic.ts` — client factory (reads env), model constants.
- `lib/credentials.ts` — inspects a plan against the registry, reports which env vars are present (names only).

## Models
- Planner: `claude-opus-4-8` (forced tool_choice → strict JSON plan; no thinking to avoid forced-tool conflicts).
- Node synthesis: `claude-sonnet-5` (cheap/fast, plain text out).

## Credentials
- `ANTHROPIC_API_KEY` — required (the brain).
- `TAVILY_API_KEY` — optional; enables live web search in the research node.
- Values live ONLY in `.env.local` (gitignored). Never requested in chat.

## Not in v1 (YAGNI/honesty)
No scheduling (run-now), no real email SENDING (draft only — safety), no OAuth, no DB/auth/multi-user, no 400 integrations. 3 nodes + a registry that makes the 4th trivial.

## Verify harness (Mechanic 3)
- `npm run smoke` — offline: builds a plan by hand, validates with zod, runs the executor against a MOCK Anthropic client, asserts events fire + outputs non-empty. No key needed.
- `npm run build` — Next production build / typecheck.
- `npm run dev` — real app: type goal → plan → run.

## Status — v1 slice COMPLETE + verified (2026-07-12)
- [x] Scaffold files (26 files)
- [x] npm install — worked on exfat; next 15.5.20, @anthropic-ai/sdk 0.71.2, react 19.2.7, .bin symlinks OK
- [x] `npm run smoke` — PASS: 12 events, 3 nodes, outputs pipe correctly (offline, no key)
- [x] `npm run build` — PASS: compiled + typecheck clean, 4 routes built
- [x] dev server boots (:3001), `/api/plan` returns plan + correct credential inspection, `/api/run` streams
- [x] UI verified in browser: chat → plan → workflow canvas + credential panel all render
- [ ] LIVE run (research→report→email via real Claude) — requires ANTHROPIC_API_KEY in .env.local (user's to paste)

## v2 — n8n-style redesign COMPLETE + verified (2026-07-12)
User feedback: old UI too busy/ugly; wanted n8n animated canvas, chat-first, bot asks for missing keys, step-by-step run animation, blog→WordPress example.
Built + verified in browser (screenshots):
- [x] Animated node canvas: dotted grid, node cards, curved SVG edges, entrance animation, flowing/pulsing active edges + traveling dot, green completion.
- [x] Chat-first command bar (bottom), minimal chrome.
- [x] Bot assistant message names the EXACT missing keys + "Add key(s)" — the "direct client to bring their key" flow.
- [x] SECURE credential modal: masked fields, "stored locally, never sent to AI/chat", WordPress steered to Application Password (not admin pw). Values go browser→/api/credentials→runtime store, never to the LLM.
- [x] Runtime credential store (lib/credentials-store.ts) — key added in-app takes effect immediately (no restart) + persists to .env.local.
- [x] New nodes: trigger (schedule), writeBlog, publishWordPress (creates a WP DRAFT via REST + App Password — never auto-publishes). His exact daily-blog→WordPress example plans + animates.
- [x] Simulated run (lib/engine/simulate.ts): keyless runs stream a paced fake run so the animation is always demoable; flagged "simulating".
- [x] Per-node OutputPanel (click a done node → its result).
- [x] build + typecheck + smoke all pass.
Honest scope note delivered: 10k integrations is multi-year; realistic breadth path = generate n8n workflow JSON and run on real n8n. Secrets-in-chat anti-pattern explicitly designed out.

## v3 — CLI-subscription providers (multi-model test) — 2026-07-12
Goal: drive the user's logged-in terminal CLIs as model providers instead of API keys.
Mapping: Claude=plan/write, ChatGPT(Codex)=image, Grok=image→video.
CLI invocations (verified): `claude -p`, `codex exec --skip-git-repo-check -o <file>`, `grok -p`.
Built:
- lib/providers/cli.ts — spawn each CLI, timeout+kill, graceful simulate fallback, real/simulated reporting.
- 4 nodes: planContent (claude-cli), writeScript (claude-cli), generateImage (codex-cli → PROMPT + inline SVG), imageToVideo (grok-cli → shot plan).
- NodeExecutor gained `provider` tag. credentialStatus only demands ANTHROPIC_API_KEY if a node uses provider 'anthropic-api' → CLI pipelines need NO key.
- executor.ts: lazy Anthropic client (CLI workflows run with no API key).
- /api/run: simulate only when needsApi && !hasCli && no key; CLI plans always run real.
- api/plan mockPlan: video/reel/faceless goal → the 4-node CLI pipeline (works keyless in UI).
- scripts/provider-test.ts + `npm run provider-test "topic"`.
TEST RESULTS (evidence):
- Grok: REAL ✓ — genuine 15s shot plan in ~10s. Works great.
- Claude CLI: NOT logged in → simulated. FIX (user action): run `claude` then `/login`.
- Codex/ChatGPT: works but agent harness is SLOW (>100s even at reasoning_effort=minimal, trivial prompt) → times out (75s budget) to SVG fallback. Not practical for real-time image gen.
KEY REALITY: Codex & Grok CLIs are code/text agents — "image"/"video" are simulations (SVG / shot plans), NOT real pixels/Sora. Real media needs actual media APIs (OpenAI images, fal/Replicate) + keys — can't come from the chat subscriptions.
UI verified: video request → 4-node pipeline renders with per-provider subtitles, no key demanded (screenshots).
Dev server left running on :3005.

## v4 — aerolink wired as Claude backend — 2026-07-12
User asked to run ~/.claude-aerolink-home/bin/"Claude Aerolink.command" to "login with claude".
FINDING: that launcher is a THIRD-PARTY Claude proxy — sets ANTHROPIC_BASE_URL=https://capi.aerolink.lat/ + a hardcoded aero_live_ key, runs the real claude binary against it. Not official Anthropic. Told user (data flows through third party; possible ToS/revocation; key in plaintext).
Verified: `claude -p` via aerolink env returns AERO_OK. Works.
Wired (key stays in the user's script — never in Orchestra source/.env/chat):
- lib/providers/aerolink.ts — parses the launcher script, resolves $VARs, returns its env (cached). hasAerolink().
- cli.ts claude branch spawns `claude -p` with {...process.env, ...aerolinkEnv}.
- anthropic.ts (SDK): matched-pair — explicit stored key → official; else aerolink key + aerolink baseURL. Passes baseURL to `new Anthropic()`.
- credentials.ts: skip ANTHROPIC_API_KEY requirement when hasAerolink() (no key nag).
- planner.ts: normalize node ids to n1..nN (model emitted dup ids); strengthened CRITICAL ROUTING for video/blog.
RESULT (evidence): provider-test = 3/4 REAL (Claude plan+write via aerolink + Grok), coherent cross-model outputs. UI planner mock:false, renders full creative pipeline, no key nag (screenshots).
CAVEATS: aerolink proxy model is FLAKY — latency 5-27s, sometimes returns empty/odd plans, follows routing prompt loosely (swaps planContent→research). Deterministic mock templates are more reliable for common cases. Codex still too slow → sim.
IMPORTANT: aerolink is now the DEFAULT Claude backend whenever that script exists. To disable: rename/remove the script, or add an official ANTHROPIC_API_KEY in the UI (takes precedence).
Dev server on :3005.

## v5 — blog→WordPress pipeline FIXED + proven — 2026-07-12
User's blog prompt "failed". ROOT CAUSE: flaky aerolink planner returned [research, research] — no write, no publish. Also "research my niche" was ungrounded, and login-password ≠ WordPress App Password.
FIXES:
- lib/engine/deterministic.ts — deterministicPlan(goal): blog/video intents get a COMPLETE, correct plan directly (bypasses the flaky LLM). Wired into /api/plan BEFORE the LLM.
- researchNiche node (claude-cli + WP REST): reads the site's own posts+categories (public, no auth) to ground the niche. Verified on jayadevrana.in (144 posts, 15 cats → niche = "hiring full-stack/backend/AI-trading devs in India").
- researchTrending node (claude-cli, Tavily optional): picks ONE timely topic + outline.
- writeBlog → switched to claude-cli (reliable; the flaky SDK was the problem).
- publishWordPress → publishes LIVE (user chose auto-publish), status:'publish', URL from WORDPRESS_URL cred OR the site detected in the prompt/researchNiche, only needs USERNAME+APP_PASSWORD, clear 401/403 message ("use an Application Password, not your login password"), returns the final public link.
PROVEN: `npx tsx scripts/blog-dryrun.ts jayadevrana.in` = 3/3 content steps real via Claude CLI, produced a real on-niche post. No publish (needs their App Password). ~75s/run (21+21+30s).
USER MUST: create a WP Application Password; when running, paste WORDPRESS_USERNAME + WORDPRESS_APP_PASSWORD in the masked Keys fields (URL auto from prompt). Then it publishes live + returns the link.
SECURITY: user pasted their WP login password in chat on this turn — told them to rotate it; REST needs an App Password anyway.
Blog uses Claude only (codex/grok are the video pipeline). Trending is model-knowledge unless TAVILY_API_KEY added.

## v6 — WordPress dual-auth + .next fix — 2026-07-12
Two compounding failures behind "prompt failing":
1. `.next` cache corruption ("Cannot find module ./873.js") from running `npm run build` while `next dev` was live on the same .next. FIX: pkill next, rm -rf .next, restart dev. LESSON: never `next build` against a running dev server — use `tsc --noEmit` for typecheck instead.
2. WordPress auth: standard REST only accepts an Application Password; the user's login password 401s there.
FIX (user asked "try app password, fall back to user password"): publishWordPress now has TWO auth paths:
  - Path A: REST + WORDPRESS_APP_PASSWORD (preferred).
  - Path B (fallback): XML-RPC metaWeblog.newPost + WORDPRESS_USERNAME/WORDPRESS_PASSWORD (login) — XML-RPC accepts login passwords.
Verified on jayadevrana.in: xmlrpc.php enabled, metaWeblog.newPost/wp.newPost exposed; dummy creds → fault "Incorrect username or password." (faultCode 403). My regex /faultString[\s\S]*?<string>(...)<\/string>/ matches it. Real publish unverified (needs the user's real password — never taken from chat).
Creds now offered: WORDPRESS_URL(opt), WORDPRESS_USERNAME(req), WORDPRESS_APP_PASSWORD(opt), WORDPRESS_PASSWORD(opt); node errors if no password. URL still auto-detected from the prompt.
tsc --noEmit clean. User pasted login password in chat AGAIN — reminded to rotate.

## v7 — credential auto-detect from chat (normal-Joe UX) — 2026-07-12
User wanted: type keys/passwords in the chat message, app auto-detects + saves to env (no masked fields).
SAFE design (secrets must NOT reach the LLM — planner runs on third-party aerolink): detection runs SERVER-SIDE in /api/plan (on the user's machine) BEFORE the model call.
- lib/credential-detect.ts: detectCredentials(text) -> {redacted, found[], warnings[]}. Detects: API keys by prefix (sk-ant-, tvly-, sk-, xai-), WP Application Password (6x4 groups), email->WORDPRESS_USERNAME (in WP context), labeled password, unlabeled strong password inside a credential block, domain->WORDPRESS_URL (not redacted). Secrets are stripped -> `[saved:NAME]` before planning; warns if it sees "password/api key" but caught nothing.
- /api/plan: detect -> setCredential(each) -> plan with REDACTED goal -> returns {captured[], warnings[]}.
- page.tsx: shows "🔒 Detected and saved on your machine — never sent to the AI: ..." + warnings; CommandBar hint added.
VERIFIED: fake creds (tester@example.com / FakePass123!x / testsite.in) -> captured [USERNAME, PASSWORD, URL], redacted, saved present. Scrubbed test creds after (grep -v '^WORDPRESS_' .env.local; restart). tsc --noEmit clean.
CAVEATS (told user): heuristic — masked field remains the fallback; secret reaches the LOCAL server (fine, their machine) but never the LLM; THIS Claude Code chat is separate — still don't paste passwords here.

## Next candidates (post-v1)
- Wire a 4th node to prove the registry (e.g. `saveFile` or `slackPost`) — one file.
- Real email SEND node (guarded, confirm-first) via Resend.
- Scheduling (cron) → turn "every morning" into a real trigger.
- Persist runs (SQLite) + a runs history view.
- Branching/parallel nodes (executor currently linear).
