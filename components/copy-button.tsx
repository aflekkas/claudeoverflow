"use client";

import { useState } from "react";

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className={`text-xs px-2.5 py-1 rounded border transition-colors ${
        copied
          ? "border-green-500/50 text-green-400 bg-green-500/10"
          : "border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 bg-zinc-800/50"
      } ${className ?? ""}`}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
