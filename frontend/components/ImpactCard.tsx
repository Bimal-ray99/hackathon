'use client';

import { useState, useEffect, useRef } from 'react';
import { AffectedCustomer } from '@/lib/api';

interface ImpactCardProps {
  mrr_at_risk: number;
  affected_customers: AffectedCustomer[];
  support_ticket_count: number;
  confidence: 'high' | 'medium' | 'low';
}

function formatMRR(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0
  }).format(amount);
}

function AnimatedNumber({ target, format }: { target: number; format: (n: number) => string }) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValue(0);
    let step = 0;
    const steps = 40;
    const tick = () => {
      step++;
      setValue(Math.round((target * step) / steps));
      if (step < steps) rafRef.current = setTimeout(tick, 30);
    };
    rafRef.current = setTimeout(tick, 30);
    return () => { if (rafRef.current) clearTimeout(rafRef.current); };
  }, [target]);

  return <>{format(value)}</>;
}

export function ImpactCard({
  mrr_at_risk,
  affected_customers,
  support_ticket_count,
}: ImpactCardProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
        Business Impact
      </h2>

      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-3 rounded-xl bg-red-50 border border-red-100">
          <p className="text-xl font-bold text-red-600 tabular-nums">
            <AnimatedNumber target={mrr_at_risk} format={formatMRR} />
          </p>
          <p className="text-xs text-red-400 mt-1 font-medium">MRR at Risk</p>
        </div>
        <div className="text-center p-3 rounded-xl bg-orange-50 border border-orange-100">
          <p className="text-xl font-bold text-orange-500 tabular-nums">
            <AnimatedNumber target={affected_customers.length} format={n => String(n)} />
          </p>
          <p className="text-xs text-orange-400 mt-1 font-medium">Customers</p>
        </div>
        <div className="text-center p-3 rounded-xl bg-yellow-50 border border-yellow-100">
          <p className="text-xl font-bold text-yellow-600 tabular-nums">
            <AnimatedNumber target={support_ticket_count} format={n => String(n)} />
          </p>
          <p className="text-xs text-yellow-500 mt-1 font-medium">Tickets</p>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Affected Customers</p>
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-3 py-2 text-slate-400 font-semibold">Company</th>
                <th className="text-left px-3 py-2 text-slate-400 font-semibold">Tier</th>
                <th className="text-right px-3 py-2 text-slate-400 font-semibold">MRR</th>
              </tr>
            </thead>
            <tbody>
              {affected_customers.slice(0, 6).map((c, i) => (
                <tr key={c.id} className={`border-t border-slate-100 ${i % 2 !== 0 ? 'bg-slate-50/50' : ''}`}>
                  <td className="px-3 py-2 text-slate-800 font-medium">{c.name}</td>
                  <td className="px-3 py-2">
                    <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100">{c.tier}</span>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-500 font-mono tabular-nums">{formatMRR(c.mrr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {affected_customers.length > 6 && (
            <div className="px-3 py-2 text-xs text-slate-400 bg-slate-50 border-t border-slate-100">
              +{affected_customers.length - 6} more customers
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
