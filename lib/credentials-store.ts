import fs from "fs";
import path from "path";

/**
 * Runtime credential store. Values arrive from the browser via /api/credentials
 * (a masked field) and are held in server memory + persisted to .env.local for
 * the next boot. They are NEVER sent to the LLM or exposed in chat — the engine
 * only ever reads them here, and only variable NAMES are shown to the user.
 */
const store = new Map<string, string>();

export function getCredential(name: string): string | undefined {
  const v = store.get(name);
  if (v !== undefined && v !== "") return v;
  const env = process.env[name];
  return env && env !== "" ? env : undefined;
}

export function hasCredential(name: string): boolean {
  return Boolean(getCredential(name));
}

export function setCredential(name: string, value: string): void {
  store.set(name, value);
  persist(name, value);
}

/** Best-effort persistence to .env.local so keys survive a restart. */
function persist(name: string, value: string): void {
  try {
    const file = path.join(process.cwd(), ".env.local");
    let lines: string[] = [];
    if (fs.existsSync(file)) {
      lines = fs.readFileSync(file, "utf8").split("\n");
    }
    const idx = lines.findIndex((l) => l.trim().startsWith(`${name}=`));
    const entry = `${name}=${value}`;
    if (idx >= 0) lines[idx] = entry;
    else lines.push(entry);
    fs.writeFileSync(file, lines.join("\n"));
  } catch {
    // non-fatal: the value still lives in the in-memory store for this session
  }
}
