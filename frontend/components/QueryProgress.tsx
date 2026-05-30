'use client';

const SOURCES = ['launchdarkly', 'github', 'sentry', 'slack'] as const;

const SOURCE_COLORS: Record<string, string> = {
  launchdarkly: 'text-blue-400',
  github: 'text-gray-300',
  sentry: 'text-red-400',
  slack: 'text-purple-400',
};

interface SourceResult {
  rows: number;
  live: boolean;
}

interface QueryProgressProps {
  activeSource: string | null;
  doneSources: Record<string, SourceResult>;
  phase: 'idle' | 'querying' | 'gemini' | 'done';
}

export function QueryProgress({ activeSource, doneSources, phase }: QueryProgressProps) {
  if (phase === 'idle') return null;

  return (
    <div className="p-4 rounded-lg bg-gray-950 border border-gray-800 space-y-3">
      <p className="text-xs text-gray-500 font-mono">
        {phase === 'gemini' ? 'Gemini analyzing cross-source data...' :
         phase === 'done'   ? 'Analysis complete' :
                              'Executing Coral SQL JOINs...'}
      </p>

      <div className="space-y-2">
        {SOURCES.map(source => {
          const isActive = activeSource === source;
          const isDone = source in doneSources;
          const result = doneSources[source];

          return (
            <div key={source} className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full shrink-0 transition-all duration-300 ${
                isActive ? 'bg-green-400 animate-pulse scale-125' :
                isDone   ? (result.live ? 'bg-green-500' : 'bg-yellow-500') :
                           'bg-gray-700'
              }`} />

              <span className={`text-xs font-mono w-28 ${
                isActive ? (SOURCE_COLORS[source] || 'text-white') :
                isDone   ? 'text-gray-400' :
                           'text-gray-600'
              }`}>
                {source}
              </span>

              <span className="text-xs flex-1">
                {isActive && <span className="text-gray-500 animate-pulse">querying...</span>}
                {isDone && (
                  <span className={result.live ? 'text-green-600' : 'text-yellow-600'}>
                    {result.live ? `${result.rows} rows · live` : 'seed data'}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {phase === 'gemini' && (
        <div className="flex items-center gap-2 pt-2 border-t border-gray-800">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-xs text-blue-400 font-mono animate-pulse">
            gemini-2.5-flash reasoning...
          </span>
        </div>
      )}
    </div>
  );
}
