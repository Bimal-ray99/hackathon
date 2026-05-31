'use client';

import { useEffect, useState } from 'react';
import { SiGithub, SiSentry, SiStripe, SiIntercom } from 'react-icons/si';
import { TbFlag } from 'react-icons/tb';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface GraphNode {
  id: string;
  type: string;
  label: string;
  sublabel: string;
  group: string;
}

interface GraphEdge {
  source: string;
  target: string;
  label: string;
  weight: number;
  coral_join: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  live: boolean;
}

// Fixed layout positions (in a 560×260 SVG viewport)
const NODE_POS: Record<string, { x: number; y: number }> = {
  'commit:a3f9c21':       { x: 100, y: 40 },
  'commit:b7d2e89':       { x: 420, y: 40 },
  'flag:new-upload-flow': { x: 100, y: 140 },
  'flag:auth-latency-fix':{ x: 420, y: 140 },
  'error:TypeError':      { x: 230, y: 140 },
  'customer:acme':        { x: 100, y: 240 },
  'customer:globex':      { x: 230, y: 240 },
  'ticket:silent':        { x: 420, y: 240 },
};

const GROUP_COLOR: Record<string, string> = {
  github:       '#6b7280',
  launchdarkly: '#3b82f6',
  sentry:       '#ef4444',
  stripe:       '#10b981',
  intercom:     '#8b5cf6',
};

const GROUP_ICON: Record<string, React.ReactNode> = {
  github:       <SiGithub className="w-3 h-3" />,
  launchdarkly: <TbFlag className="w-3 h-3" />,
  sentry:       <SiSentry className="w-3 h-3" />,
  stripe:       <SiStripe className="w-3 h-3" />,
  intercom:     <SiIntercom className="w-3 h-3" />,
};

const EDGE_STROKE: Record<number, string> = {
  5: 'rgba(239,68,68,0.6)',
  4: 'rgba(234,179,8,0.5)',
  3: 'rgba(59,130,246,0.4)',
  2: 'rgba(100,116,139,0.3)',
  1: 'rgba(100,116,139,0.2)',
};

function midpoint(ax: number, ay: number, bx: number, by: number) {
  return { x: (ax + bx) / 2, y: (ay + by) / 2 };
}

export function DependencyMap() {
  const [data, setData] = useState<GraphData | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<GraphEdge | null>(null);

  useEffect(() => {
    fetch(`${BASE}/api/graph`)
      .then(r => r.json())
      .then((d: GraphData) => setData(d))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
          <h2 className="text-sm font-semibold text-slate-700">Hidden Dependency Map</h2>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          {data?.live ? 'live Coral data' : 'Coral cross-source JOINs'}
        </span>
      </div>

      {!data ? (
        <div className="flex items-center gap-2 h-32 justify-center">
          <span className="w-4 h-4 border-2 border-slate-600 border-t-cyan-500 rounded-full animate-spin" />
          <span className="text-xs text-slate-500">Building dependency graph...</span>
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden">
            <svg width="100%" viewBox="0 0 560 290" className="block">
              <defs>
                <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                  <polygon points="0 0, 6 2, 0 4" fill="rgba(100,116,139,0.5)" />
                </marker>
                <marker id="arrowhead-hot" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                  <polygon points="0 0, 6 2, 0 4" fill="rgba(239,68,68,0.8)" />
                </marker>
              </defs>

              {/* Edges */}
              {data.edges.map((edge, i) => {
                const src = NODE_POS[edge.source];
                const tgt = NODE_POS[edge.target];
                if (!src || !tgt) return null;
                const mid = midpoint(src.x, src.y, tgt.x, tgt.y);
                const hot = edge.weight >= 4;
                const stroke = EDGE_STROKE[edge.weight] || EDGE_STROKE[1];
                const isHovered = hoveredEdge === edge;
                return (
                  <g key={i}>
                    <line
                      x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                      stroke={hot ? 'rgba(239,68,68,0.5)' : stroke}
                      strokeWidth={isHovered ? 2 : hot ? 1.5 : 1}
                      markerEnd={hot ? 'url(#arrowhead-hot)' : 'url(#arrowhead)'}
                      strokeDasharray={edge.weight <= 2 ? '4 3' : undefined}
                      className="transition-all"
                    />
                    <rect
                      x={mid.x - 30} y={mid.y - 8} width={60} height={14}
                      rx={3} fill="rgba(15,23,42,0.85)"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredEdge(edge)}
                      onMouseLeave={() => setHoveredEdge(null)}
                    />
                    <text
                      x={mid.x} y={mid.y + 3}
                      textAnchor="middle" fontSize={8}
                      fill={hot ? '#fca5a5' : '#64748b'}
                      style={{ cursor: 'pointer', pointerEvents: 'none' }}
                    >
                      {edge.label}
                    </text>
                  </g>
                );
              })}

              {/* Nodes */}
              {data.nodes.map(node => {
                const pos = NODE_POS[node.id];
                if (!pos) return null;
                const color = GROUP_COLOR[node.group] || '#6b7280';
                return (
                  <g key={node.id} transform={`translate(${pos.x},${pos.y})`}>
                    <circle r={22} fill="rgb(15,23,42)" stroke={color} strokeWidth={1.5} strokeOpacity={0.6} />
                    <circle r={18} fill={`${color}18`} />
                    <text y={-6} textAnchor="middle" fontSize={9} fill={color} fontWeight="600">
                      {node.label.length > 9 ? node.label.slice(0, 8) + '…' : node.label}
                    </text>
                    <text y={5} textAnchor="middle" fontSize={7.5} fill="#475569">
                      {node.sublabel.length > 10 ? node.sublabel.slice(0, 9) + '…' : node.sublabel}
                    </text>
                  </g>
                );
              })}

              {/* Row labels */}
              <text x={8} y={44} fontSize={8} fill="#334155" fontWeight="500">commits</text>
              <text x={8} y={144} fontSize={8} fill="#334155" fontWeight="500">flags · errors</text>
              <text x={8} y={244} fontSize={8} fill="#334155" fontWeight="500">customers · tickets</text>
            </svg>
          </div>

          {/* Hovered edge detail */}
          {hoveredEdge && (
            <div className="rounded-xl bg-slate-950 border border-slate-700 px-4 py-2.5">
              <p className="text-xs font-mono text-cyan-400">{hoveredEdge.coral_join}</p>
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 flex-wrap">
            {Object.entries(GROUP_COLOR).map(([group, color]) => (
              <div key={group} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <div className="text-slate-500">{GROUP_ICON[group]}</div>
                <span className="text-xs text-slate-500">{group}</span>
              </div>
            ))}
            <span className="text-xs text-slate-600 ml-auto">hover edge → Coral JOIN</span>
          </div>
        </>
      )}
    </div>
  );
}
