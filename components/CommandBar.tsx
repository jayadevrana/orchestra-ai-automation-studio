"use client";

import { useState } from "react";

const EXAMPLES = [
  "Every day, research a trending topic, write a blog post, and publish it as a draft to my WordPress site",
  "Research the EV market in India and draft an email to my team",
];

export default function CommandBar({
  onSubmit,
  planning,
  assistant,
  hasPlan,
}: {
  onSubmit: (goal: string) => void;
  planning: boolean;
  assistant: React.ReactNode | null;
  hasPlan: boolean;
}) {
  const [goal, setGoal] = useState("");

  function submit() {
    const g = goal.trim();
    if (g && !planning) onSubmit(g);
  }

  return (
    <div className="commandbar">
      {assistant && (
        <div className="assistant">
          <div className="av">◆</div>
          <div className="msg">{assistant}</div>
        </div>
      )}
      <div className="composer">
        <textarea
          rows={1}
          value={goal}
          placeholder="Describe what to automate…  e.g. daily blog to my WordPress site"
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button className="btn primary" onClick={submit} disabled={planning || !goal.trim()}>
          {planning ? "Planning…" : "Build →"}
        </button>
      </div>
      {!hasPlan && (
        <>
          <div className="examples">
            {EXAMPLES.map((ex) => (
              <span key={ex} className="ex" onClick={() => setGoal(ex)}>
                {ex.length > 52 ? ex.slice(0, 52) + "…" : ex}
              </span>
            ))}
          </div>
          <div
            style={{
              textAlign: "center",
              marginTop: 8,
              fontSize: 11.5,
              color: "var(--faint)",
            }}
          >
            🔒 Include your keys or passwords right in the message — saved on your machine, never sent to the AI.
          </div>
        </>
      )}
    </div>
  );
}
