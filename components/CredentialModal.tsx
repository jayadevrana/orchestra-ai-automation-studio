"use client";

import { useState } from "react";
import type { CredentialStatus } from "@/lib/engine/types";

export default function CredentialModal({
  credentials,
  onAdd,
  onClose,
}: {
  credentials: CredentialStatus[];
  onAdd: (name: string, value: string) => Promise<void>;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  async function save(name: string) {
    const value = (values[name] || "").trim();
    if (!value) return;
    setSaving((s) => ({ ...s, [name]: true }));
    try {
      await onAdd(name, value);
      setValues((v) => ({ ...v, [name]: "" }));
    } finally {
      setSaving((s) => ({ ...s, [name]: false }));
    }
  }

  // Missing first, then present.
  const sorted = [...credentials].sort((a, b) => Number(a.present) - Number(b.present));

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>🔑 Keys this workflow needs</h3>
        <div className="secure">
          🔒 Stored on your local server only — never sent to the AI, never shown in chat.
        </div>

        {sorted.map((c) => (
          <div className="credrow" key={c.name}>
            <div className="cn">
              <span>{c.name}</span>
              {c.present ? (
                <span className="ok">✓ added</span>
              ) : (
                <span className={`tag ${c.optional ? "opt" : "req"}`}>
                  {c.optional ? "optional" : "required"}
                </span>
              )}
            </div>
            <div className="cw">
              {c.where}
              {c.usedBy?.length ? ` · used by: ${c.usedBy.join(", ")}` : ""}
            </div>
            {!c.present && (
              <div className="cin">
                <input
                  type={c.secret === false ? "text" : "password"}
                  placeholder={
                    c.name.includes("URL")
                      ? "https://your-site.com"
                      : c.secret === false
                        ? c.name.toLowerCase().replace(/_/g, " ")
                        : "paste value"
                  }
                  value={values[c.name] || ""}
                  onChange={(e) => setValues((v) => ({ ...v, [c.name]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") save(c.name);
                  }}
                />
                <button
                  className="btn primary"
                  onClick={() => save(c.name)}
                  disabled={saving[c.name] || !(values[c.name] || "").trim()}
                >
                  {saving[c.name] ? "…" : "Save"}
                </button>
              </div>
            )}
          </div>
        ))}

        <div className="foot">
          <button className="btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
