import Anthropic from "@anthropic-ai/sdk";
import { getCredential, hasCredential } from "./credentials-store";
import { getAerolinkEnv } from "./providers/aerolink";

// Planner: complex reasoning (NL -> structured workflow). Sonnet handles cheap node work.
export const MODEL_PLANNER = "claude-opus-4-8";
export const MODEL_FAST = "claude-sonnet-5";

let _client: Anthropic | null = null;
let _clientKey: string | null = null;

/**
 * Returns an Anthropic client built from the current ANTHROPIC_API_KEY (from the
 * runtime credential store, falling back to env). Rebuilds if the key changes so
 * a key added at runtime takes effect without a restart.
 */
export function getAnthropic(): Anthropic {
  // key + baseURL must stay a matched pair. An explicitly-added key (secure UI
  // field) wins and talks to official Anthropic; otherwise use the aerolink pair
  // (its key ONLY works against its own proxy base URL).
  const stored = getCredential("ANTHROPIC_API_KEY");
  const aero = getAerolinkEnv();

  let key: string | undefined;
  let baseURL: string | undefined;
  if (stored) {
    key = stored;
    baseURL = process.env.ANTHROPIC_BASE_URL || undefined;
  } else if (aero?.ANTHROPIC_API_KEY) {
    key = aero.ANTHROPIC_API_KEY;
    baseURL = aero.ANTHROPIC_BASE_URL || undefined;
  }
  if (!key) {
    throw new Error("No Claude access: add ANTHROPIC_API_KEY (secure field) or set up the aerolink login.");
  }

  const cacheKey = `${key}|${baseURL ?? ""}`;
  if (!_client || _clientKey !== cacheKey) {
    _client = new Anthropic({ apiKey: key, ...(baseURL ? { baseURL } : {}) });
    _clientKey = cacheKey;
  }
  return _client;
}

export function hasAnthropicKey(): boolean {
  return hasCredential("ANTHROPIC_API_KEY") || Boolean(getAerolinkEnv()?.ANTHROPIC_API_KEY);
}

/** Minimal shape the engine needs from an Anthropic-like client (lets tests inject a mock). */
export interface LLMClient {
  messages: {
    create(params: any): Promise<{ content: any[] }>;
  };
}

/** Concatenate the text blocks of a Messages API response into a single string. */
export function textOf(msg: { content: any[] }): string {
  return (msg.content || [])
    .filter((b: any) => b?.type === "text")
    .map((b: any) => b.text)
    .join("\n")
    .trim();
}
