'use client';

const SOURCE_COLORS: Record<string, string> = {
  github: 'bg-gray-800 text-gray-100',
  launchdarkly: 'bg-blue-600 text-white',
  sentry: 'bg-red-600 text-white',
  slack: 'bg-purple-600 text-white',
  stripe: 'bg-indigo-600 text-white',
  intercom: 'bg-orange-500 text-white'
};

const SOURCE_ICONS: Record<string, string> = {
  github: '⌥',
  launchdarkly: '⚑',
  sentry: '⚠',
  slack: '#',
  stripe: '$',
  intercom: '💬'
};

interface SourceBadgesProps {
  sources: string[];
}

export function SourceBadges({ sources }: SourceBadgesProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {sources.map(source => (
        <span
          key={source}
          className={`px-2 py-1 rounded-full text-xs font-medium ${SOURCE_COLORS[source] || 'bg-gray-200 text-gray-800'}`}
        >
          {SOURCE_ICONS[source] || '●'} {source}
        </span>
      ))}
    </div>
  );
}
