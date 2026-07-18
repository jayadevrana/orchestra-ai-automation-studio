import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

/**
 * Reads the user's aerolink launcher script and returns the environment it sets
 * (HOME, ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL, CLAUDE_CONFIG_DIR, ...), with
 * `$VAR` references resolved. This lets Orchestra drive the same Claude access
 * the user's `Claude Aerolink.command` uses — WITHOUT the key ever living in
 * Orchestra's source, .env, or the chat. The key stays in the user's own file.
 *
 * NOTE: aerolink is a THIRD-PARTY Claude proxy (capi.aerolink.lat), not the
 * official Anthropic API. Everything Orchestra sends to Claude flows through it.
 */
const SCRIPT = join(homedir(), ".claude-aerolink-home", "bin", "claude-aerolink-code");

let cache: Record<string, string> | null | undefined;

export function getAerolinkEnv(): Record<string, string> | null {
  if (cache !== undefined) return cache;
  cache = parse();
  return cache;
}

function parse(): Record<string, string> | null {
  if (!existsSync(SCRIPT)) return null;
  let text: string;
  try {
    text = readFileSync(SCRIPT, "utf8");
  } catch {
    return null;
  }

  const vars: Record<string, string> = {};
  const exported = new Set<string>();

  for (const line of text.split("\n")) {
    const m = line.match(/^\s*(export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    const isExport = Boolean(m[1]);
    const key = m[2];
    let val = m[3].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    // resolve $VAR / ${VAR} using values seen so far (then process.env)
    val = val.replace(/\$\{?([A-Za-z_][A-Za-z0-9_]*)\}?/g, (_, v) => vars[v] ?? process.env[v] ?? "");
    vars[key] = val;
    if (isExport) exported.add(key);
  }

  const out: Record<string, string> = {};
  for (const k of exported) if (vars[k]) out[k] = vars[k];
  return Object.keys(out).length ? out : null;
}

/** True if an aerolink Claude backend is available. */
export function hasAerolink(): boolean {
  const e = getAerolinkEnv();
  return Boolean(e?.ANTHROPIC_API_KEY);
}
