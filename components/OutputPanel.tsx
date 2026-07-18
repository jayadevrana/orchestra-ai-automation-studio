"use client";

import type { WorkflowNode } from "@/lib/engine/types";

const ICONS: Record<string, string> = {
  trigger: "⏰",
  research: "🔎",
  researchNiche: "🧭",
  researchTrending: "📈",
  writeBlog: "✍️",
  writeReport: "📝",
  draftEmail: "✉️",
  publishWordPress: "🌐",
  planContent: "🧠",
  writeScript: "🖋️",
  generateImage: "🎨",
  imageToVideo: "🎬",
};

function ProviderBadge({ output }: { output: Record<string, unknown> }) {
  if (!output.provider) return null;
  const real = Boolean(output.real);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
      <span className={`pill ${real ? "live" : "sim"}`}>{real ? "● real call" : "○ simulated"}</span>
      <span style={{ fontSize: 12.5, color: "var(--muted)" }}>{String(output.provider)}</span>
    </div>
  );
}

function Body({ output }: { output: Record<string, unknown> }) {
  // Generated image (from the ChatGPT / Codex CLI) — rendered as SVG.
  if (output.image && typeof output.svg === "string") {
    return (
      <>
        <ProviderBadge output={output} />
        <h4>Generated image</h4>
        <div
          style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", background: "#000" }}
          dangerouslySetInnerHTML={{ __html: String(output.svg) }}
        />
        <h4 style={{ marginTop: 14 }}>Image prompt</h4>
        <pre className="doc">{String(output.imagePrompt || "")}</pre>
        {output.simulatedAs ? <div className="note">Simulated as {String(output.simulatedAs)}.</div> : null}
      </>
    );
  }
  // Image → video shot plan (from the Grok CLI)
  if (typeof output.videoPlan === "string") {
    return (
      <>
        <ProviderBadge output={output} />
        <h4>Video shot plan</h4>
        <pre className="doc">{output.videoPlan as string}</pre>
        {output.simulatedAs ? <div className="note">Simulated as {String(output.simulatedAs)}.</div> : null}
      </>
    );
  }
  // Plan (Claude CLI)
  if (typeof output.plan === "string") {
    return (
      <>
        <ProviderBadge output={output} />
        <h4>Plan</h4>
        <pre className="doc">{output.plan as string}</pre>
      </>
    );
  }
  // Script (Claude CLI)
  if (typeof output.script === "string") {
    return (
      <>
        <ProviderBadge output={output} />
        <h4>Voiceover script</h4>
        <pre className="doc">{output.script as string}</pre>
      </>
    );
  }
  // WordPress publish/draft — the final blog link
  if ((output.status === "published" || output.status === "draft") && (output.link || output.editLink)) {
    const live = output.status === "published";
    const finalLink = String(output.link || output.editLink);
    return (
      <div className="wp-ok">
        <h4>{live ? "✅ Published live" : "WordPress draft created"}</h4>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>{String(output.title || "")}</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Final blog link:</div>
        <a href={finalLink} target="_blank" rel="noreferrer" style={{ wordBreak: "break-all", fontWeight: 600 }}>
          {finalLink}
        </a>
        {output.editLink && output.status === "draft" ? (
          <div style={{ marginTop: 8 }}>
            <a href={String(output.editLink)} target="_blank" rel="noreferrer">
              Open in WordPress editor →
            </a>
          </div>
        ) : null}
        <div className="note">{String(output.note || "")}</div>
      </div>
    );
  }
  // Niche (from reading the site)
  if (typeof output.niche === "string") {
    const titles = (output.sampleTitles as string[]) || [];
    return (
      <>
        <ProviderBadge output={output} />
        <h4>Your niche{output.site ? ` · ${String(output.site)}` : ""}</h4>
        <pre className="doc">{output.niche as string}</pre>
        {titles.length > 0 && (
          <>
            <h4 style={{ marginTop: 12 }}>Read from your posts</h4>
            <ul className="srclist">
              {titles.slice(0, 8).map((t, i) => (
                <li key={i}>
                  <span className="b">·</span> {t}
                </li>
              ))}
            </ul>
          </>
        )}
      </>
    );
  }
  // Trending angle
  if (typeof output.angle === "string") {
    return (
      <>
        <ProviderBadge output={output} />
        <h4>Trending angle {output.live ? "· live" : "· model knowledge"}</h4>
        <pre className="doc">{output.angle as string}</pre>
        {output.note ? <div className="note">{String(output.note)}</div> : null}
      </>
    );
  }
  // Blog post
  if (output.blog && typeof output.content === "string") {
    return (
      <>
        <h4>{String(output.title || "Blog post")}</h4>
        <div className="blogview" dangerouslySetInnerHTML={{ __html: String(output.content) }} />
      </>
    );
  }
  // Research briefing
  if (typeof output.briefing === "string") {
    const sources = (output.sources as { title: string; url: string }[]) || [];
    return (
      <>
        <h4>Briefing {output.live ? "· live search" : "· model knowledge"}</h4>
        <pre className="doc">{output.briefing as string}</pre>
        {sources.length > 0 && (
          <ul className="srclist">
            {sources.map((s, i) => (
              <li key={i}>
                <span className="b">[{i + 1}]</span>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.title || s.url}
                </a>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }
  // Report
  if (typeof output.report === "string") {
    return (
      <>
        <h4>Report</h4>
        <pre className="doc">{output.report as string}</pre>
      </>
    );
  }
  // Email draft
  if (typeof output.draft === "string") {
    return (
      <>
        <h4>Email draft · never sent</h4>
        <pre className="doc">{output.draft as string}</pre>
      </>
    );
  }
  // Trigger / fallback
  return (
    <>
      <h4>Result</h4>
      <pre className="doc">{JSON.stringify(output, null, 2)}</pre>
    </>
  );
}

export default function OutputPanel({
  node,
  output,
  onClose,
}: {
  node: WorkflowNode;
  output: Record<string, unknown> | undefined;
  onClose: () => void;
}) {
  return (
    <div className="outpanel">
      <div className="ohead">
        <div className="ico">{ICONS[node.type] || "⚙️"}</div>
        <b>{node.title}</b>
        <span className="x" onClick={onClose}>
          ×
        </span>
      </div>
      <div className="obody">
        {output ? <Body output={output} /> : <div className="note">No output yet — run the workflow.</div>}
      </div>
    </div>
  );
}
