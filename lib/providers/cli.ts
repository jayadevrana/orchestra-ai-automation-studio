import { spawn } from "child_process";
import { existsSync, readFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { getAerolinkEnv } from "./aerolink";

/**
 * CLI provider layer. Orchestra can drive the user's already-logged-in terminal
 * subscriptions instead of paid API keys:
 *   - Claude Code CLI  (`claude -p`)     -> planning & writing
 *   - Codex CLI        (`codex exec`)    -> ChatGPT subscription (image, as a code agent)
 *   - Grok CLI         (`grok -p`)       -> image-to-video (as a text agent)
 *
 * Each call shells out non-interactively, captures stdout with a timeout, and
 * degrades gracefully to a simulated result if the CLI is missing / not logged
 * in — so a test run always completes and clearly reports what was real.
 */

export type ProviderKind = "claude" | "codex" | "grok";

export interface ProviderResult {
  provider: string; // display name
  kind: ProviderKind;
  real: boolean; // true = the CLI actually ran and returned output
  text: string; // CLI output, or the simulated fallback
  ms: number;
  error?: string; // why it fell back (e.g. "not logged in")
}

export const PROVIDER_LABEL: Record<ProviderKind, string> = {
  claude: "Claude (subscription)",
  codex: "ChatGPT · Codex (subscription)",
  grok: "Grok (subscription)",
};

interface Captured {
  code: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

function spawnCapture(
  cmd: string,
  args: string[],
  timeoutMs: number,
  env?: NodeJS.ProcessEnv,
): Promise<Captured> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const child = spawn(cmd, args, { cwd: tmpdir(), env: env ?? process.env });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: stderr + String(e), timedOut });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr, timedOut });
    });
  });
}

async function runRaw(kind: ProviderKind, prompt: string, timeoutMs: number): Promise<string> {
  if (kind === "claude") {
    // Drive the user's aerolink Claude access (third-party proxy) if present,
    // otherwise a plain `claude -p` (which needs its own login).
    const aero = getAerolinkEnv();
    const env = aero ? { ...process.env, ...aero } : undefined;
    const r = await spawnCapture("claude", ["-p", prompt], timeoutMs, env);
    if (r.timedOut) throw new Error("claude CLI timed out");
    const out = r.stdout.trim();
    if (/not logged in|please run \/login/i.test(out + r.stderr)) {
      throw new Error("Claude CLI not logged in — run:  claude  then  /login");
    }
    if (r.code !== 0 && !out) throw new Error(r.stderr.trim() || `claude exited ${r.code}`);
    return out;
  }

  if (kind === "codex") {
    const outFile = join(tmpdir(), `codex-out-${Date.now()}-${process.pid}.txt`);
    const r = await spawnCapture(
      "codex",
      ["exec", "--skip-git-repo-check", "-s", "read-only", "-o", outFile, prompt],
      timeoutMs,
    );
    if (r.timedOut) throw new Error("codex CLI timed out");
    let out = "";
    if (existsSync(outFile)) {
      out = readFileSync(outFile, "utf8").trim();
      try {
        unlinkSync(outFile);
      } catch {
        /* ignore */
      }
    }
    if (!out) out = r.stdout.trim();
    if (r.code !== 0 && !out) throw new Error(r.stderr.trim() || `codex exited ${r.code}`);
    return out;
  }

  // grok
  const r = await spawnCapture("grok", ["-p", prompt], timeoutMs);
  if (r.timedOut) throw new Error("grok CLI timed out");
  const out = r.stdout.trim();
  if (r.code !== 0 && !out) throw new Error(r.stderr.trim() || `grok exited ${r.code}`);
  return out;
}

/** Calls a CLI provider, never throws — returns a result flagged real/simulated. */
export async function callProvider(
  kind: ProviderKind,
  prompt: string,
  opts: { timeoutMs?: number; fallback?: string } = {},
): Promise<ProviderResult> {
  const start = Date.now();
  try {
    const text = await runRaw(kind, prompt, opts.timeoutMs ?? 120_000);
    return { provider: PROVIDER_LABEL[kind], kind, real: true, text, ms: Date.now() - start };
  } catch (e: any) {
    return {
      provider: PROVIDER_LABEL[kind],
      kind,
      real: false,
      text: opts.fallback ?? "",
      ms: Date.now() - start,
      error: e?.message ?? String(e),
    };
  }
}

/** Quick presence + login probe for all three CLIs (used by the status endpoint). */
export async function probeProviders(): Promise<
  Record<ProviderKind, { installed: boolean; loggedIn: boolean; detail: string }>
> {
  const out = {} as Record<ProviderKind, { installed: boolean; loggedIn: boolean; detail: string }>;
  const kinds: ProviderKind[] = ["claude", "codex", "grok"];
  await Promise.all(
    kinds.map(async (kind) => {
      const which = await spawnCapture("command", ["-v", kind], 5000).catch(() => null);
      // `command -v` isn't an executable; probe by trying the binary's version instead.
      const ver = await spawnCapture(kind, ["--version"], 8000);
      const installed = ver.code === 0 || Boolean(ver.stdout.trim());
      void which;
      out[kind] = {
        installed,
        loggedIn: installed, // real login is only known on a full call; assumed if installed
        detail: installed ? ver.stdout.trim().split("\n")[0] : "not found",
      };
    }),
  );
  return out;
}
