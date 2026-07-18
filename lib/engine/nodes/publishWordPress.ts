import { getCredential } from "../../credentials-store";
import type { NodeContext, NodeExecutor, WorkflowNode } from "../types";

function findBlog(inputs: Record<string, unknown>): any | undefined {
  return (
    Object.values(inputs).find((o: any) => o && o.blog && typeof o.content === "string") ||
    Object.values(inputs).find((o: any) => o && typeof o.report === "string")
  );
}
function fromInputs(inputs: Record<string, unknown>, key: string): string | undefined {
  const hit = Object.values(inputs).find((o: any) => o && typeof o[key] === "string");
  return (hit as any)?.[key];
}
function root(u: string): string {
  return `https://${u.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "")}`;
}
function xesc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface PubResult {
  link: string;
  id: string | number;
  via: string;
}

/** Path A: WordPress REST API + Application Password (Basic auth). */
async function viaREST(base: string, user: string, appPass: string, title: string, content: string): Promise<PubResult> {
  const auth = Buffer.from(`${user}:${appPass}`).toString("base64");
  const res = await fetch(`${base}/wp-json/wp/v2/posts`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify({ title, content, status: "publish" }),
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error(`REST rejected the Application Password (HTTP ${res.status}).`);
  }
  if (!res.ok) throw new Error(`REST error ${res.status}: ${(await res.text()).slice(0, 120)}`);
  const data: any = await res.json();
  return { link: data.link, id: data.id, via: "REST + Application Password" };
}

/** Path B: XML-RPC + login password (metaWeblog.newPost). Accepts the normal login password. */
async function viaXMLRPC(base: string, user: string, pass: string, title: string, content: string): Promise<PubResult> {
  const body = `<?xml version="1.0"?><methodCall><methodName>metaWeblog.newPost</methodName><params>` +
    `<param><value><string>1</string></value></param>` +
    `<param><value><string>${xesc(user)}</string></value></param>` +
    `<param><value><string>${xesc(pass)}</string></value></param>` +
    `<param><value><struct>` +
    `<member><name>title</name><value><string>${xesc(title)}</string></value></member>` +
    `<member><name>description</name><value><string>${xesc(content)}</string></value></member>` +
    `</struct></value></param>` +
    `<param><value><boolean>1</boolean></value></param>` +
    `</params></methodCall>`;
  const res = await fetch(`${base}/xmlrpc.php`, {
    method: "POST",
    headers: { "Content-Type": "text/xml" },
    body,
  });
  const text = await res.text();
  const fault = text.match(/faultString[\s\S]*?<string>([\s\S]*?)<\/string>/i);
  if (fault) throw new Error(`XML-RPC rejected the login (${fault[1].slice(0, 80)}).`);
  const idMatch = text.match(/<param>\s*<value>\s*<string>(\d+)<\/string>/i) || text.match(/<string>(\d+)<\/string>/);
  if (!res.ok || !idMatch) throw new Error(`XML-RPC failed (HTTP ${res.status}).`);
  const id = idMatch[1];
  return { link: `${base}/?p=${id}`, id, via: "XML-RPC + login password" };
}

/**
 * publishWordPress — publishes the post LIVE. Tries multiple auth paths so it
 * isn't limited to one credential type (the n8n-style "just make it work"):
 *   1. REST API + Application Password (WORDPRESS_APP_PASSWORD)
 *   2. XML-RPC + login password        (WORDPRESS_PASSWORD)
 * Returns the final public link from whichever succeeds.
 */
export const publishWordPress: NodeExecutor = {
  type: "publishWordPress",
  title: "Publish to WordPress",
  icon: "🌐", // 🌐
  provider: "none",
  requiredCredentials: [
    {
      name: "WORDPRESS_URL",
      where: "your site, e.g. https://jayadevrana.in (optional — taken from your request if omitted)",
      optional: true,
      secret: false,
    },
    { name: "WORDPRESS_USERNAME", where: "your WordPress username (or login email)", optional: false, secret: false },
    {
      name: "WORDPRESS_APP_PASSWORD",
      where: "PREFERRED — WP Admin -> Users -> Profile -> Application Passwords",
      optional: true,
      secret: true,
    },
    {
      name: "WORDPRESS_PASSWORD",
      where: "FALLBACK — your normal login password (used via XML-RPC if the App Password fails)",
      optional: true,
      secret: true,
    },
  ],

  async run(node: WorkflowNode, ctx: NodeContext) {
    const site = getCredential("WORDPRESS_URL") || fromInputs(ctx.inputs, "site");
    const user = getCredential("WORDPRESS_USERNAME");
    const appPass = getCredential("WORDPRESS_APP_PASSWORD");
    const loginPass = getCredential("WORDPRESS_PASSWORD");

    if (!site) throw new Error("No WordPress site URL — set WORDPRESS_URL or mention your site (e.g. jayadevrana.in).");
    if (!user) throw new Error("No WordPress username — set WORDPRESS_USERNAME.");
    if (!appPass && !loginPass) {
      throw new Error("No WordPress password — set WORDPRESS_APP_PASSWORD (preferred) and/or WORDPRESS_PASSWORD (login).");
    }

    const blog: any = findBlog(ctx.inputs);
    if (!blog) throw new Error("No blog content from the previous step to publish.");

    const base = root(site);
    const title = blog.title || node.title || "Untitled";
    const content = blog.content || blog.report || "";
    const errors: string[] = [];

    const finalize = (r: PubResult) => ({
      status: "published",
      id: r.id,
      link: r.link, // final public blog link
      title,
      via: r.via,
      note: `Published LIVE via ${r.via}. This is your final blog link.`,
      provider: "WordPress",
      real: true,
    });

    // Path 1: REST + Application Password
    if (appPass) {
      ctx.emit(`Publishing via REST + Application Password to ${base}…`);
      try {
        const r = await viaREST(base, user, appPass, title, content);
        ctx.emit(`Published live (${r.via}): ${r.link}`);
        return finalize(r);
      } catch (e: any) {
        errors.push(`App Password: ${e.message}`);
        ctx.emit(`${e.message} Falling back to the login password…`);
      }
    }

    // Path 2: XML-RPC + login password
    if (loginPass) {
      ctx.emit(`Publishing via XML-RPC + login password to ${base}…`);
      try {
        const r = await viaXMLRPC(base, user, loginPass, title, content);
        ctx.emit(`Published live (${r.via}): ${r.link}`);
        return finalize(r);
      } catch (e: any) {
        errors.push(`Login password: ${e.message}`);
      }
    }

    throw new Error(
      `Publishing failed on all paths. ${errors.join(" | ")}  Tip: create an Application Password (WP Admin -> Users -> Profile -> Application Passwords) — it's the most reliable.`,
    );
  },
};
