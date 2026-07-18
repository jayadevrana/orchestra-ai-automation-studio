"use client";

import { useMemo, useState } from "react";
import Canvas from "@/components/Canvas";
import CommandBar from "@/components/CommandBar";
import CredentialModal from "@/components/CredentialModal";
import OutputPanel from "@/components/OutputPanel";
import type { NodeStatus } from "@/components/NodeCard";
import type { CredentialStatus, RunEvent, WorkflowPlan } from "@/lib/engine/types";

export default function Home() {
  const [planning, setPlanning] = useState(false);
  const [plan, setPlan] = useState<WorkflowPlan | null>(null);
  const [credentials, setCredentials] = useState<CredentialStatus[]>([]);
  const [mock, setMock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captured, setCaptured] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const [running, setRunning] = useState(false);
  const [simulated, setSimulated] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, NodeStatus>>({});
  const [outputs, setOutputs] = useState<Record<string, Record<string, unknown>>>({});

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showKeys, setShowKeys] = useState(false);

  const missingRequired = useMemo(
    () => credentials.filter((c) => !c.present && !c.optional),
    [credentials],
  );

  const needsKeyIds = useMemo(() => {
    const titles = new Set(missingRequired.flatMap((c) => c.usedBy));
    const ids = new Set<string>();
    plan?.nodes.forEach((n) => {
      if (titles.has(n.title)) ids.add(n.id);
    });
    return ids;
  }, [plan, missingRequired]);

  async function handlePlan(goal: string) {
    setPlanning(true);
    setError(null);
    setPlan(null);
    setStatuses({});
    setOutputs({});
    setSelectedId(null);
    setSimulated(false);
    setCaptured([]);
    setWarnings([]);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Planning failed.");
      setPlan(data.plan);
      setCredentials(data.credentials || []);
      setMock(Boolean(data.mock));
      setCaptured(data.captured || []);
      setWarnings(data.warnings || []);
    } catch (e: any) {
      setError(e?.message ?? "Planning failed.");
    } finally {
      setPlanning(false);
    }
  }

  async function handleRun() {
    if (!plan) return;
    setRunning(true);
    setError(null);
    setOutputs({});
    setSelectedId(null);
    setSimulated(false);
    setStatuses(Object.fromEntries(plan.nodes.map((n) => [n.id, "pending" as NodeStatus])));

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (!res.body) throw new Error("No response stream.");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data: "));
          if (line) applyEvent(JSON.parse(line.slice(6)));
        }
      }
    } catch (e: any) {
      setError(e?.message ?? "Run failed.");
    } finally {
      setRunning(false);
    }
  }

  function applyEvent(evt: RunEvent) {
    if (evt.kind === "run_start") {
      setSimulated(Boolean(evt.simulated));
    } else if (evt.kind === "node_start") {
      setStatuses((s) => ({ ...s, [evt.id]: "running" }));
    } else if (evt.kind === "node_output") {
      setStatuses((s) => ({ ...s, [evt.id]: "done" }));
      setOutputs((o) => ({ ...o, [evt.id]: evt.output }));
    } else if (evt.kind === "node_error") {
      setStatuses((s) => ({ ...s, [evt.id]: "error" }));
      setOutputs((o) => ({ ...o, [evt.id]: { error: evt.message } }));
    } else if (evt.kind === "run_error") {
      setError(evt.message);
    }
  }

  async function addCredential(name: string, value: string) {
    const res = await fetch("/api/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, value }),
    });
    if (res.ok) {
      setCredentials((cs) => cs.map((c) => (c.name === name ? { ...c, present: true } : c)));
      if (name === "ANTHROPIC_API_KEY") setMock(false);
    }
  }

  const selectedNode = plan?.nodes.find((n) => n.id === selectedId) || null;

  const assistant =
    plan && (captured.length > 0 || warnings.length > 0 || missingRequired.length > 0) ? (
      <>
        {captured.length > 0 && (
          <div style={{ marginBottom: warnings.length || missingRequired.length ? 8 : 0 }}>
            🔒 Detected in your message and saved on your machine —{" "}
            <span style={{ color: "var(--green)" }}>never sent to the AI</span>:{" "}
            {captured.map((n, i) => (
              <span key={n}>
                {i > 0 ? ", " : ""}
                <span className="k">{n}</span>
              </span>
            ))}
            .
          </div>
        )}
        {warnings.map((w, i) => (
          <div key={i} style={{ color: "var(--accent)", marginBottom: 8 }}>
            ⚠ {w}
          </div>
        ))}
        {missingRequired.length > 0 && (
          <div>
            Still needs{" "}
            {missingRequired.map((c, i) => (
              <span key={c.name}>
                {i > 0 ? ", " : ""}
                <span className="k">{c.name}</span>
              </span>
            ))}
            .{" "}
            <b style={{ cursor: "pointer" }} onClick={() => setShowKeys(true)}>
              Add it →
            </b>{" "}
            <span style={{ color: "var(--faint)" }}>or just type it in your next message.</span>
          </div>
        )}
      </>
    ) : null;

  return (
    <div className="stage">
      <div className="topbar">
        <div className="brand">
          <div className="logo">O</div>
          <div>
            <b>Orchestra</b>
            <span>· chat → automate</span>
          </div>
        </div>
        <div className="spacer" />
        {running && simulated && <span className="pill sim">simulating</span>}
        {running && !simulated && <span className="pill live">running</span>}
        {plan && (
          <button className="btn keys" onClick={() => setShowKeys(true)}>
            🔑 Keys{missingRequired.length > 0 ? ` · ${missingRequired.length}` : ""}
          </button>
        )}
        {plan && (
          <button className="btn primary" onClick={handleRun} disabled={running}>
            {running ? "Running…" : "Run ▶"}
          </button>
        )}
      </div>

      {error && <div className="banner error">{error}</div>}

      <div className="canvas-wrap">
        {!plan ? (
          <div className="canvas">
            <div className="canvas-empty">
              <div>
                <div className="big">Describe an automation to build it.</div>
                <div className="small">
                  Tell the AI what you want to automate. It lays out the workflow as connected
                  nodes, asks for exactly the keys it needs, and runs it step by step — like n8n,
                  but you just chat.
                </div>
              </div>
            </div>
          </div>
        ) : (
          <Canvas
            plan={plan}
            statuses={statuses}
            needsKeyIds={needsKeyIds}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onKeyBadge={() => setShowKeys(true)}
          />
        )}

        {selectedNode && (
          <OutputPanel
            node={selectedNode}
            output={outputs[selectedNode.id]}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>

      <CommandBar
        onSubmit={handlePlan}
        planning={planning}
        assistant={assistant}
        hasPlan={Boolean(plan)}
      />

      {showKeys && (
        <CredentialModal
          credentials={credentials}
          onAdd={addCredential}
          onClose={() => setShowKeys(false)}
        />
      )}
    </div>
  );
}
