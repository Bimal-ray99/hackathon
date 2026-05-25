'use client';

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
        <div className="text-center p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-2xl font-bold text-red-600">{formatMRR(mrr_at_risk)}</p>
          <p className="text-xs text-red-500 mt-1 font-medium">MRR at Risk</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-orange-50 border border-orange-200">
          <p className="text-2xl font-bold text-orange-600">{affected_customers.length}</p>
          <p className="text-xs text-orange-500 mt-1 font-medium">Enterprise Customers</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-yellow-50 border border-yellow-200">
          <p className="text-2xl font-bold text-yellow-600">{support_ticket_count}</p>
          <p className="text-xs text-yellow-500 mt-1 font-medium">Support Tickets</p>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-2">Affected Customers</p>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Company</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Tier</th>
                <th className="text-right px-3 py-2 text-gray-500 font-medium">MRR</th>
              </tr>
            </thead>
            <tbody>
              {affected_customers.slice(0, 6).map((c, i) => (
                <tr key={c.id} className={`border-t ${i % 2 !== 0 ? 'bg-gray-50' : ''}`}>
                  <td className="px-3 py-2 text-gray-900 font-medium">{c.name}</td>
                  <td className="px-3 py-2">
                    <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">{c.tier}</span>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600 font-mono">{formatMRR(c.mrr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {affected_customers.length > 6 && (
            <div className="px-3 py-2 text-xs text-gray-400 bg-gray-50 border-t">
              +{affected_customers.length - 6} more customers
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
