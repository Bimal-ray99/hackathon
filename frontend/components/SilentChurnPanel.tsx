'use client';

import { useState, useEffect } from 'react';
import { TbLoader2, TbAlertCircle } from 'react-icons/tb';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface ChurnCustomer {
  customer_id: string;
  name: string;
  mrr: number;
  recent_tickets: number;
  active_errors: number;
  risk: number;
  label: string;
}

export function SilentChurnPanel() {
  const [customers, setCustomers] = useState<ChurnCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${BASE}/api/churn`)
      .then(r => r.json())
      .then(data => { setCustomers(data as ChurnCustomer[]); setLoading(false); })
      .catch(() => { setError('Failed to load churn data'); setLoading(false); });
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
          <h2 className="text-sm font-semibold text-slate-700">Silent Churn Detector</h2>
        </div>
        <span className="text-xs text-slate-400 font-mono">stripe × intercom × sentry</span>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-4 text-slate-400">
          <TbLoader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs">Running Coral JOIN...</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 py-3 text-red-400">
          <TbAlertCircle className="w-4 h-4" />
          <span className="text-xs">{error}</span>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-2">
          {customers.map(c => (
            <div
              key={c.customer_id}
              className={`rounded-xl border p-4 transition-colors ${
                c.risk >= 70
                  ? 'bg-red-950/20 border-red-800/40'
                  : c.risk >= 30
                  ? 'bg-yellow-950/10 border-yellow-800/30'
                  : 'bg-slate-900/40 border-slate-800'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-slate-200">{c.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-semibold border ${
                      c.risk >= 70
                        ? 'bg-red-500/20 text-red-400 border-red-500/30'
                        : c.risk >= 30
                        ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    }`}>
                      {c.label}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400 shrink-0">${c.mrr.toLocaleString()}/mo</span>
              </div>

              <div className="flex items-center gap-4 mb-3 text-xs text-slate-400">
                <span><span className="text-red-400 font-semibold">{c.active_errors.toLocaleString()}</span> active errors</span>
                <span><span className="text-slate-300 font-semibold">{c.recent_tickets}</span> tickets (7d)</span>
                {c.recent_tickets === 0 && c.active_errors > 5 && (
                  <span className="text-red-400 font-medium">Silent suffering</span>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Churn risk</span>
                  <span className={`font-bold tabular-nums ${c.risk >= 70 ? 'text-red-400' : c.risk >= 30 ? 'text-yellow-400' : 'text-emerald-400'}`}>{c.risk}/100</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${c.risk >= 70 ? 'bg-red-500' : c.risk >= 30 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                    style={{ width: `${c.risk}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-600 font-mono pt-1">
        Coral JOIN: stripe.customers ⋈ intercom.tickets ⋈ sentry.issues
      </p>
    </div>
  );
}
