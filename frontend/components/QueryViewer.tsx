'use client';

import { useState } from 'react';

interface QueryViewerProps {
  sql: string;
  sources: string[];
}

export function QueryViewer({ sql, sources }: QueryViewerProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg overflow-hidden border border-gray-700">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-900 text-white hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-green-400 font-mono text-xs font-bold">SQL</span>
          <span className="text-sm font-medium">View Coral Query</span>
          <div className="flex items-center gap-1">
            {sources.map((s, i) => (
              <span key={s} className="text-xs text-gray-400">
                {i > 0 && <span className="text-gray-600 mx-0.5">×</span>}
                {s}
              </span>
            ))}
          </div>
        </div>
        <span className="text-gray-400 text-xs">{expanded ? '▲ hide' : '▼ show'}</span>
      </button>

      {expanded && (
        <div className="bg-gray-950 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500">Cross-source JOIN — executed by Coral</span>
            <button
              onClick={handleCopy}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded border border-gray-700 hover:border-gray-500"
            >
              {copied ? '✓ copied' : 'copy'}
            </button>
          </div>
          <pre className="text-sm text-green-400 font-mono overflow-x-auto leading-relaxed whitespace-pre">
            {sql}
          </pre>
        </div>
      )}
    </div>
  );
}
